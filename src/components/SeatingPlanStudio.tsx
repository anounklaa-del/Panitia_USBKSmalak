import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DoorOpen,
  Download,
  Eye,
  FileSpreadsheet,
  Home,
  LayoutGrid,
  MapPin,
  Maximize2,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { type ScheduleRow, type StudentRecord } from '../data/pasData';
import {
  PAPER_DIMENSIONS,
  type MainWorkspaceTab,
  type PaperPreset,
  type PrepressConfig,
  type SeatingClassGrouping,
  type SeatingConfig,
  type SeatingDataSource,
  type SeatingDoorSide,
  type SeatingMode,
  type SeatingNumberingOrder,
  type SeatingOrientation,
  type SeatingStudentOrder,
  type SeatingVariant,
  type StickerGroupingMode,
} from '../types/prepress';
import {
  compareNumericStrings,
  getSortedRoomList,
  normalizeRoomLabel,
} from '../utils/deskStickerBuilder';
import { getLiveSchedulesMap } from '../utils/scheduleStore';
import {
  buildCommitteeSummaryCsv,
  buildRoomSeatingPlans,
  buildSeatingPages,
  getAvailableSeatingClassOptions,
  getSeatingPaperDimensions,
} from '../utils/seatingPlanBuilder';
import { SeatingSheetPagesBlock } from './SeatingPlanRenderer';
import { SettingsDrawer } from './SettingsDrawer';

export interface RoomAllocationOverride {
  capacity: number;
  supervisor: string;
  note?: string;
}

interface SeatingPlanStudioProps {
  students: StudentRecord[];
  filteredCardStudents: StudentRecord[];
  cardFilterDesc?: string;
  groupingMode: StickerGroupingMode;
  paperConfig: PrepressConfig;
  seatingConfig: SeatingConfig;
  schedulesMap?: Record<string, ScheduleRow[]>;
  roomOverrides?: Record<string, RoomAllocationOverride>;
  onRoomOverridesChange?: (next: Record<string, RoomAllocationOverride>) => void;
  pageIndex: number;
  onPageIndexChange: (idx: number) => void;
  onPaperConfigChange: (patch: Partial<PrepressConfig>) => void;
  onSeatingConfigChange: (patch: Partial<SeatingConfig>) => void;
  onPrintSeating: (scope: 'all' | 'current') => void;
  onInspectStudentCard?: (student: StudentRecord) => void;
  onNavigateTab?: (tab: MainWorkspaceTab) => void;
  settingsOpen: boolean;
  onCloseSettings: () => void;
}

interface ExamSessionOption {
  key: string;
  date: string;
  time: string;
  label: string;
  subjectsByClass: Record<string, string>;
}

const DEFAULT_SUPERVISORS = [
  'Drs. Budi Santoso',
  'Dra. Siti Rahayu',
  'M. Yusuf, S.Pd',
  'Hj. Nurhayati, S.Pd',
  'Dr. Ahmad Fauzi',
  'Dra. Rina Marlina',
  'Suryadi, S.Pd',
  'Fitriani, S.Kom',
  'Hj. Rahmawati, S.Pd',
  'Agus Salim, S.Pd',
];

const ROOM_ALLOCATION_STORAGE_KEY = 'pas_room_allocations_v1';
const TABLE_PAGE_SIZE = 8;

function triggerCsvDownload(csvText: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buildExamSessionOptions(
  schedulesMap?: Record<string, ScheduleRow[]>,
): ExamSessionOption[] {
  const source = schedulesMap ?? getLiveSchedulesMap();
  const map = new Map<string, { date: string; time: string; subjectsByClass: Record<string, string> }>();
  for (const [kelas, rows] of Object.entries(source)) {
    for (const [date, time, subject] of rows) {
      const key = `${date}||${time}`;
      if (!map.has(key)) {
        map.set(key, { date, time, subjectsByClass: {} });
      }
      map.get(key)!.subjectsByClass[kelas] = subject;
    }
  }
  return Array.from(map.entries()).map(([key, item]) => {
    const uniqueSubjects = [...new Set(Object.values(item.subjectsByClass))];
    const shortSubj =
      uniqueSubjects.length === 1
        ? uniqueSubjects[0]
        : `${uniqueSubjects[0]} (${uniqueSubjects.length} mapel)`;
    return {
      key,
      date: item.date,
      time: item.time,
      label: `${item.date} (${item.time}) - ${shortSubj}`,
      subjectsByClass: item.subjectsByClass,
    };
  });
}

function defaultCapacityForRoom(count: number): number {
  return Math.max(36, Math.ceil(count / 6) * 6);
}

export const SeatingPlanStudio: React.FC<SeatingPlanStudioProps> = ({
  students,
  filteredCardStudents,
  cardFilterDesc,
  groupingMode,
  paperConfig,
  seatingConfig,
  schedulesMap,
  roomOverrides: controlledRoomOverrides,
  onRoomOverridesChange,
  pageIndex,
  onPageIndexChange,
  onPaperConfigChange,
  onSeatingConfigChange,
  onPrintSeating,
  onInspectStudentCard,
  onNavigateTab,
  settingsOpen,
  onCloseSettings,
}) => {
  const liveSchedulesMap = schedulesMap ?? getLiveSchedulesMap();
  const [viewMode, setViewMode] = useState<'overview' | 'sheet'>('overview');
  const [internalRoomOverrides, setInternalRoomOverrides] = useState<
    Record<string, RoomAllocationOverride>
  >(() => {
    try {
      const saved = localStorage.getItem(ROOM_ALLOCATION_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Record<string, RoomAllocationOverride>;
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const roomOverrides = controlledRoomOverrides ?? internalRoomOverrides;

  const sessionOptions = useMemo(
    () => buildExamSessionOptions(liveSchedulesMap),
    [liveSchedulesMap],
  );
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>(
    () => sessionOptions[0]?.key ?? '',
  );
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(1);

  const [previewRoom, setPreviewRoom] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState<string>('66');
  const [editSupervisor, setEditSupervisor] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  const persistOverrides = (next: Record<string, RoomAllocationOverride>) => {
    if (onRoomOverridesChange) {
      onRoomOverridesChange(next);
    } else {
      setInternalRoomOverrides(next);
      try {
        localStorage.setItem(ROOM_ALLOCATION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  };

  const rooms = useMemo(() => getSortedRoomList(students), [students]);
  const allStudentClasses = useMemo(
    () => [...new Set(students.map((s) => s.kelas.trim()).filter(Boolean))].sort(compareNumericStrings),
    [students],
  );

  const classOptions = useMemo(
    () =>
      getAvailableSeatingClassOptions(
        students,
        seatingConfig.classGrouping,
        seatingConfig.dataSource === 'room' ? seatingConfig.selectedRoom || undefined : undefined,
      ),
    [students, seatingConfig.classGrouping, seatingConfig.dataSource, seatingConfig.selectedRoom],
  );

  const roomPlans = useMemo(
    () =>
      buildRoomSeatingPlans(
        students,
        filteredCardStudents,
        groupingMode,
        seatingConfig,
        cardFilterDesc,
      ),
    [students, filteredCardStudents, groupingMode, seatingConfig, cardFilterDesc],
  );

  const pages = useMemo(
    () => buildSeatingPages(roomPlans, seatingConfig.variant),
    [roomPlans, seatingConfig.variant],
  );

  const { paperW, paperH } = useMemo(
    () => getSeatingPaperDimensions(paperConfig, seatingConfig.paperOrientation),
    [paperConfig, seatingConfig.paperOrientation],
  );

  const activeSession = useMemo(
    () => sessionOptions.find((s) => s.key === selectedSessionKey) ?? sessionOptions[0],
    [sessionOptions, selectedSessionKey],
  );

  // Build room allocation rows derived live from students + selected session + overrides
  const roomAllocationRows = useMemo(() => {
    return rooms.map((roomCode, idx) => {
      const roomStudents = students.filter((s) => normalizeRoomLabel(s.ruang) === roomCode);
      const classesInRoom = [...new Set(roomStudents.map((s) => s.kelas.trim()).filter(Boolean))].sort(
        compareNumericStrings,
      );
      const override = roomOverrides[roomCode];
      const capacity = override?.capacity ?? defaultCapacityForRoom(roomStudents.length);
      const supervisor =
        override?.supervisor ?? DEFAULT_SUPERVISORS[idx % DEFAULT_SUPERVISORS.length];

      // Determine active subject(s) in this room for the selected exam session
      const sessionSubjects = activeSession
        ? [
            ...new Set(
              classesInRoom
                .map((c) => activeSession.subjectsByClass[c])
                .filter(Boolean),
            ),
          ]
        : [];
      const fallbackSubjects = classesInRoom
        .map((c) => liveSchedulesMap[c]?.[0]?.[2])
        .filter(Boolean);
      const subjectDisplay =
        sessionSubjects.length > 0
          ? sessionSubjects.slice(0, 2).join(', ') +
            (sessionSubjects.length > 2 ? ` (+${sessionSubjects.length - 2})` : '')
          : fallbackSubjects[0] || 'Sesuai Jadwal PAS';

      const classesLabel =
        classesInRoom.length <= 3
          ? classesInRoom.join(', ')
          : `${classesInRoom.slice(0, 2).join(', ')} +${classesInRoom.length - 2}`;

      return {
        roomCode,
        roomLabel: `Ruang ${roomCode}`,
        capacity,
        studentCount: roomStudents.length,
        classesInRoom,
        classesLabel,
        subjectDisplay,
        supervisor,
        note: override?.note ?? '',
      };
    });
  }, [rooms, students, roomOverrides, activeSession, liveSchedulesMap]);

  const filteredAllocationRows = useMemo(() => {
    return roomAllocationRows.filter((row) => {
      if (filterRoom && row.roomCode !== filterRoom) return false;
      if (filterClass && !row.classesInRoom.includes(filterClass)) return false;
      return true;
    });
  }, [roomAllocationRows, filterRoom, filterClass]);

  const totalTablePages = Math.max(1, Math.ceil(filteredAllocationRows.length / TABLE_PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const tableStartIdx = (safeTablePage - 1) * TABLE_PAGE_SIZE;
  const pagedAllocationRows = filteredAllocationRows.slice(
    tableStartIdx,
    tableStartIdx + TABLE_PAGE_SIZE,
  );
  const showingFrom = filteredAllocationRows.length === 0 ? 0 : tableStartIdx + 1;
  const showingTo = Math.min(filteredAllocationRows.length, tableStartIdx + TABLE_PAGE_SIZE);

  const avgPerRoom = rooms.length > 0 ? Math.round(students.length / rooms.length) : 0;
  const allocatedRoomsCount = roomAllocationRows.filter((r) => r.studentCount > 0).length;
  const completionPct =
    rooms.length > 0 ? Math.round((allocatedRoomsCount / rooms.length) * 100) : 100;

  const totalPages = Math.max(1, pages.length);
  const safePageIdx = Math.min(pageIndex, totalPages - 1);
  const activePage = pages[safePageIdx];
  const isPerKelasMode = seatingConfig.seatingMode === 'per_kelas';
  const isStudentCardMode = seatingConfig.seatingMode === 'student_card' || isPerKelasMode;
  const colPresets = isPerKelasMode ? [2, 4, 5, 6] : isStudentCardMode ? [2, 4, 6, 8] : [3, 4, 5];

  const previewModalPages = useMemo(() => {
    if (!previewRoom) return [];
    const singlePlan = buildRoomSeatingPlans(
      students,
      filteredCardStudents,
      groupingMode,
      {
        ...seatingConfig,
        seatingMode: 'student_card',
        dataSource: 'room',
        selectedRoom: previewRoom,
      },
      cardFilterDesc,
    );
    return buildSeatingPages(singlePlan, 'kelas');
  }, [previewRoom, students, filteredCardStudents, groupingMode, seatingConfig, cardFilterDesc]);

  const openEditRoom = (row: (typeof roomAllocationRows)[number]) => {
    setEditingRoom(row.roomCode);
    setEditCapacity(String(row.capacity));
    setEditSupervisor(row.supervisor);
    setEditNote(row.note);
  };

  const handleSaveRoomEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    const nextCap = Math.max(10, Number(editCapacity) || 36);
    const nextSup = editSupervisor.trim() || 'Belum Ditugaskan';
    persistOverrides({
      ...roomOverrides,
      [editingRoom]: {
        capacity: nextCap,
        supervisor: nextSup,
        note: editNote.trim(),
      },
    });
    setEditingRoom(null);
  };

  const handleClearRoomOverride = (roomCode: string) => {
    const next = { ...roomOverrides };
    delete next[roomCode];
    persistOverrides(next);
  };

  const handleExportAllocationsExcel = () => {
    const header = 'No,Ruang,Kapasitas,Jumlah Peserta,Kelas,Mata Pelajaran,Pengawas';
    const csvRows = filteredAllocationRows.map((r, i) =>
      [
        String(i + 1),
        r.roomLabel,
        String(r.capacity),
        String(r.studentCount),
        r.classesInRoom.join(' / '),
        r.subjectDisplay,
        r.supervisor,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    );
    triggerCsvDownload(
      [header, ...csvRows].join('\n'),
      `Pembagian_Ruang_Ujian_SMAN1ALALAK_${filteredAllocationRows.length}Ruang.csv`,
    );
  };

  const jumpToRoomSheet = (roomCode: string) => {
    onSeatingConfigChange({
      dataSource: 'room',
      selectedRoom: roomCode,
      seatingMode: 'student_card',
    });
    onPageIndexChange(0);
    setPreviewRoom(null);
    setViewMode('sheet');
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#EBF1FA]">
      {/* Slide-over Prepress Seating Configuration Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={onCloseSettings}
        title="Pengaturan Denah Ruang"
        subtitle="Mode kursi, proporsi banjar, orientasi & kop"
      >
        <div>
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Mode Denah &amp; Sinkron Kartu
          </h2>

          <label className="block text-[#44546A] font-medium mb-1">Model Penempatan Kursi</label>
          <div className="grid grid-cols-3 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-1 mb-2.5">
            {(
              [
                ['student_card', 'Per Ruang'],
                ['per_kelas', 'Per Kelas'],
                ['desk_combined', 'Meja Stiker'],
              ] as Array<[SeatingMode, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  if (val === 'per_kelas') {
                    onSeatingConfigChange({
                      seatingMode: 'per_kelas',
                      cols: 4,
                      numberingOrder: 'row_left',
                    });
                  } else if (val === 'student_card') {
                    onSeatingConfigChange({
                      seatingMode: 'student_card',
                      cols: 6,
                      numberingOrder: 'snake_col',
                    });
                  } else {
                    onSeatingConfigChange({
                      seatingMode: 'desk_combined',
                      cols: 4,
                      numberingOrder: 'snake_col',
                    });
                  }
                  onPageIndexChange(0);
                }}
                className={`py-1.5 px-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  seatingConfig.seatingMode === val
                    ? 'bg-[#1F3864] text-white shadow-2xs'
                    : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-[#44546A] font-medium mb-1">Sumber Data Peserta</label>
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-1 mb-2.5">
            {(
              [
                ['room', 'Per Ruang Ujian'],
                ['card_filter', `Filter Kartu (${filteredCardStudents.length})`],
              ] as Array<[SeatingDataSource, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onSeatingConfigChange({ dataSource: val });
                  onPageIndexChange(0);
                }}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  seatingConfig.dataSource === val
                    ? 'bg-[#1F3864] text-white shadow-2xs'
                    : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {seatingConfig.dataSource === 'room' ? (
            <div className="mb-2.5">
              <label className="block text-[#44546A] font-medium mb-1">Filter Ruang</label>
              <select
                value={seatingConfig.selectedRoom}
                onChange={(e) => {
                  onSeatingConfigChange({ selectedRoom: e.target.value, selectedClassTier: '' });
                  onPageIndexChange(0);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="">Semua Ruang ({rooms.length} ruang)</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    RUANG {r}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-2.5 p-2.5 rounded-xl bg-[#EEF2FA] border border-[#CBD5E1] text-[11px] text-[#1F3864]">
              <div className="font-semibold">Sinkron Filter Tab Kartu PAS</div>
              <div className="text-[#44546A] font-mono tabular-nums mt-0.5">
                {cardFilterDesc || 'Semua Siswa'} · {filteredCardStudents.length} kartu
              </div>
            </div>
          )}

          {isPerKelasMode && (
            <div className="mb-2.5 space-y-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <label className="block text-[#44546A] font-medium mb-1">
                  Pengelompokan Denah Per Kelas
                </label>
                <div className="grid grid-cols-2 p-0.5 bg-white border border-[#E2E8F0] rounded-lg gap-0.5">
                  {(
                    [
                      ['tier_per_room', 'Jenjang (X / XI / XII)'],
                      ['exact_class_per_room', 'Sub-Kelas (X1..XII 7)'],
                    ] as Array<[SeatingClassGrouping, string]>
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        onSeatingConfigChange({ classGrouping: val, selectedClassTier: '' });
                        onPageIndexChange(0);
                      }}
                      className={`py-1 px-1 rounded-md text-[10.5px] font-semibold whitespace-nowrap transition-colors ${
                        seatingConfig.classGrouping === val
                          ? 'bg-[#1F3864] text-white'
                          : 'text-[#475569] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[#44546A] font-medium mb-1">
                  Filter Kelas / Jenjang
                </label>
                <select
                  value={seatingConfig.selectedClassTier}
                  onChange={(e) => {
                    onSeatingConfigChange({ selectedClassTier: e.target.value });
                    onPageIndexChange(0);
                  }}
                  className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                >
                  <option value="">Semua ({classOptions.length} kelompok)</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isStudentCardMode && (
            <div className="mb-2.5">
              <label className="block text-[#44546A] font-medium mb-1">Urutan Penempatan Kursi</label>
              <select
                value={
                  seatingConfig.studentOrder === 'interleave_class'
                    ? 'desk_order'
                    : seatingConfig.studentOrder
                }
                onChange={(e) => {
                  onSeatingConfigChange({
                    studentOrder: e.target.value as SeatingStudentOrder,
                  });
                  onPageIndexChange(0);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="desk_order">Sesuai Urutan Meja (MEJA 01 → akhir)</option>
                <option value="card_order">Sesuai Urutan No. Kartu (001 → akhir)</option>
              </select>
            </div>
          )}

          <label className="block text-[#44546A] font-medium mb-1">Varian Cetak Denah</label>
          <div className="grid grid-cols-3 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-1">
            {(
              [
                ['kelas', 'Tempel Kelas'],
                ['panitia', 'Panitia'],
                ['both', 'Keduanya'],
              ] as Array<[SeatingVariant, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onSeatingConfigChange({ variant: val });
                  onPageIndexChange(0);
                }}
                className={`py-1.5 px-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  seatingConfig.variant === val
                    ? 'bg-[#1F3864] text-white shadow-2xs'
                    : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Classroom Proportions & Grid Layout */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Proporsi Kursi &amp; Ruang Kelas
          </h2>

          <div className="mb-2.5">
            <label className="block text-[#44546A] font-medium mb-1">
              Jumlah Banjar / Kolom {isStudentCardMode ? 'Kartu' : 'Meja'}
            </label>
            <div className={`grid gap-1.5 ${isStudentCardMode ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {colPresets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSeatingConfigChange({ cols: c })}
                  className={`py-1.5 rounded-md font-mono text-[11px] border transition-colors ${
                    seatingConfig.cols === c
                      ? 'bg-[#1F3864] text-white border-[#1F3864] shadow-2xs'
                      : 'bg-[#F8FAFC] text-[#44546A] border-[#E2E8F0] hover:bg-[#EEF2FA]'
                  }`}
                >
                  {c} Kol
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[#44546A] font-medium mb-1">Pola Penomoran Posisi</label>
          <select
            value={seatingConfig.numberingOrder}
            onChange={(e) =>
              onSeatingConfigChange({
                numberingOrder: e.target.value as SeatingNumberingOrder,
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5"
          >
            <option value="snake_col">Zig-Zag / Ular per Banjar (Depan↔Belakang)</option>
            <option value="col_top">Lurus per Banjar (Depan → Belakang)</option>
            <option value="row_left">Lurus per Baris (Kiri → Kanan)</option>
          </select>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Posisi Papan Tulis</label>
              <select
                value={seatingConfig.orientation}
                onChange={(e) =>
                  onSeatingConfigChange({
                    orientation: e.target.value as SeatingOrientation,
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="front_top">Di Atas (Standar)</option>
                <option value="front_bottom">Di Bawah</option>
              </select>
            </div>
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Posisi Pintu</label>
              <select
                value={seatingConfig.doorSide}
                onChange={(e) =>
                  onSeatingConfigChange({ doorSide: e.target.value as SeatingDoorSide })
                }
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="left">Kiri Depan</option>
                <option value="right">Kanan Depan</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={seatingConfig.showStudentNames}
                onChange={(e) => onSeatingConfigChange({ showStudentNames: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Tampilkan nama lengkap peserta
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={seatingConfig.showUserAndFullNo}
                onChange={(e) => onSeatingConfigChange({ showUserAndFullNo: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Sinkron No. Kartu Lengkap &amp; User Name
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={paperConfig.showDeskOnCard}
                onChange={(e) => onPaperConfigChange({ showDeskOnCard: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Cantumkan No. Meja pada Kartu Peserta
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={seatingConfig.showEmptyDesks}
                onChange={(e) => onSeatingConfigChange({ showEmptyDesks: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Tampilkan kotak {isStudentCardMode ? 'kursi' : 'meja'} cadangan / kosong
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={seatingConfig.showSchoolHeader !== false}
                onChange={(e) => onSeatingConfigChange({ showSchoolHeader: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Tampilkan header nama sekolah di denah
            </label>
          </div>
        </div>

        {/* Paper & Orientation */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Kertas, Orientasi &amp; Kop Sekolah
          </h2>

          <div className="mb-2.5">
            <label className="block text-[#44546A] font-medium mb-1">Orientasi Denah</label>
            <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-1">
              {(
                [
                  ['portrait', 'Potret (Tegak)'],
                  ['landscape', 'Lanskap (Mendatar)'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onSeatingConfigChange({ paperOrientation: val })}
                  className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    seatingConfig.paperOrientation === val
                      ? 'bg-[#1F3864] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Ukuran Kertas</label>
              <select
                value={paperConfig.paper}
                onChange={(e) => onPaperConfigChange({ paper: e.target.value as PaperPreset })}
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                {Object.entries(PAPER_DIMENSIONS).map(([k, [, , label]]) => (
                  <option key={k} value={k}>
                    {k} ({label.split('(')[1]?.replace(')', '') ?? k})
                  </option>
                ))}
                <option value="custom">Kustom</option>
              </select>
            </div>
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Margin Tepi (mm)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="25"
                value={seatingConfig.marginMm}
                onChange={(e) =>
                  onSeatingConfigChange({ marginMm: Math.max(4, Number(e.target.value) || 8) })
                }
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[#44546A] font-medium">Judul Ujian (Kop Sekolah)</label>
              <button
                type="button"
                onClick={() =>
                  onSeatingConfigChange({
                    showSchoolHeader: seatingConfig.showSchoolHeader === false,
                  })
                }
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                  seatingConfig.showSchoolHeader !== false
                    ? 'border-[#1F3864] bg-[#EEF2FA] text-[#1F3864]'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]'
                }`}
              >
                {seatingConfig.showSchoolHeader !== false ? 'Kop Tampil' : 'Kop Disembunyikan'}
              </button>
            </div>
            <input
              type="text"
              disabled={seatingConfig.showSchoolHeader === false}
              value={seatingConfig.examTitle}
              onChange={(e) => onSeatingConfigChange({ examTitle: e.target.value })}
              className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
            />
          </div>

          <div className="mb-2">
            <label className="block text-[#44546A] font-medium mb-1">
              Penanggung Jawab Panitia
            </label>
            <input
              type="text"
              value={seatingConfig.committeeChairName}
              onChange={(e) => onSeatingConfigChange({ committeeChairName: e.target.value })}
              className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-[11px] tabular-nums text-[#1F3864]">
            <div>
              Total Halaman: <strong>{pages.length} halaman</strong> ({roomPlans.length} denah)
            </div>
            <div className="text-[#55637A]">
              Ukuran cetak: {paperW} × {paperH} mm (1 halaman/ruang)
            </div>
          </div>
        </div>

        {/* Direct Print & Committee CSV */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
          <button
            type="button"
            onClick={() => onPrintSeating('all')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-[#C9A227]" />
            Cetak Semua Denah ({pages.length} Hal)
          </button>
          <button
            type="button"
            onClick={() =>
              triggerCsvDownload(
                buildCommitteeSummaryCsv(roomPlans, seatingConfig.seatingMode),
                'Rekap_Denah_Kursi_Panitia_PAS_SMAN1ALALAK.csv',
              )
            }
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#1F3864] font-semibold text-xs shadow-2xs transition-all duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Rekap Panitia (CSV)
          </button>
        </div>
      </SettingsDrawer>

      {/* Main Content Area */}
      {viewMode === 'overview' ? (
        <div className="flex-1 h-full overflow-y-auto p-4 lg:p-5">
          <div className="max-w-[1440px] mx-auto space-y-4">
            {/* Top Royal Blue Banner + Breadcrumb */}
            <section
              className="relative rounded-2xl overflow-hidden px-6 py-4 text-white shadow-[0_4px_16px_rgba(9,44,104,0.16)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              style={{
                background: 'linear-gradient(95deg, #062458 0%, #0D3C8E 55%, #1553B8 100%)',
              }}
            >
              <svg
                viewBox="0 0 420 100"
                className="absolute right-0 top-0 h-full w-auto opacity-20 pointer-events-none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M120,0 C190,45 270,15 420,80 L420,0 Z" fill="#60A5FA" />
                <path d="M210,100 C280,55 340,85 420,35 L420,100 Z" fill="#3B82F6" />
              </svg>

              <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center shrink-0">
                  <DoorOpen className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-tight">
                    Pembagian Ruang
                  </h1>
                  <p className="text-xs sm:text-[13px] italic text-white/85 mt-0.5 truncate">
                    Pengaturan peserta ujian berdasarkan ruang dan jadwal
                  </p>
                </div>
              </div>

              <nav
                aria-label="Breadcrumb"
                className="relative z-10 flex items-center gap-1.5 text-xs text-white/85 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => (onNavigateTab ? onNavigateTab('dashboard') : setViewMode('sheet'))}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                <span className="font-semibold text-white">Pembagian Ruang</span>
              </nav>
            </section>

            {/* 4 Pastel Summary KPI Cards */}
            <section className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
              {/* Card 1: Total Peserta */}
              <div
                className="rounded-2xl border border-[#C7DCFF] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
                style={{ background: 'linear-gradient(180deg, #E8F1FF 0%, #DCEAFF 100%)' }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#BFDBFE] text-[#1D4ED8] flex items-center justify-center shrink-0 shadow-2xs">
                  <Users className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                    {students.length}
                  </div>
                  <div className="text-xs font-semibold text-[#1E3A8A] mt-1 truncate">
                    Total Peserta
                  </div>
                </div>
              </div>

              {/* Card 2: Jumlah Ruang */}
              <div
                className="rounded-2xl border border-[#BAEBD6] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
                style={{ background: 'linear-gradient(180deg, #E8FAF3 0%, #D3F5E7 100%)' }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#A7F3D0] text-[#059669] flex items-center justify-center shrink-0 shadow-2xs">
                  <DoorOpen className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                    {rooms.length}
                  </div>
                  <div className="text-xs font-semibold text-[#065F46] mt-1 truncate">
                    Jumlah Ruang
                  </div>
                </div>
              </div>

              {/* Card 3: Rata-rata/Ruang */}
              <div
                className="rounded-2xl border border-[#DFC2FF] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
                style={{ background: 'linear-gradient(180deg, #F5EBFF 0%, #EAD8FF 100%)' }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#DDD6FE] text-[#7C3AED] flex items-center justify-center shrink-0 shadow-2xs">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                    {avgPerRoom}
                  </div>
                  <div className="text-xs font-semibold text-[#5B21B6] mt-1 truncate">
                    Rata-rata/Ruang
                  </div>
                </div>
              </div>

              {/* Card 4: Pembagian Selesai */}
              <div
                className="rounded-2xl border border-[#FED7AA] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
                style={{ background: 'linear-gradient(180deg, #FFF3E2 0%, #FFE6C7 100%)' }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#FDBA74] text-[#EA580C] flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                    {completionPct}%
                  </div>
                  <div className="text-xs font-semibold text-[#9A3412] mt-1 truncate">
                    Pembagian Selesai
                  </div>
                </div>
              </div>
            </section>

            {/* Filter & Action Toolbar */}
            <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_8px_rgba(15,23,42,0.04)] px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold text-[#64748B] leading-none mb-1">
                      Pilih Jadwal Ujian
                    </div>
                    <select
                      value={selectedSessionKey}
                      onChange={(e) => setSelectedSessionKey(e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] max-w-[270px] font-medium"
                    >
                      {sessionOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-l border-[#E2E8F0] pl-3">
                  <div className="text-[10.5px] font-semibold text-[#64748B] leading-none mb-1">
                    Pilih Kelas
                  </div>
                  <select
                    value={filterClass}
                    onChange={(e) => {
                      setFilterClass(e.target.value);
                      setTablePage(1);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] font-medium"
                  >
                    <option value="">Semua Kelas</option>
                    {allStudentClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-l border-[#E2E8F0] pl-3">
                  <div className="text-[10.5px] font-semibold text-[#64748B] leading-none mb-1">
                    Pilih Ruang
                  </div>
                  <select
                    value={filterRoom}
                    onChange={(e) => {
                      setFilterRoom(e.target.value);
                      setTablePage(1);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] font-medium"
                  >
                    <option value="">Semua Ruang</option>
                    {rooms.map((r) => (
                      <option key={r} value={r}>
                        Ruang {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('sheet')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                >
                  <Search className="w-3.5 h-3.5" />
                  Tampilkan Denah Cetak
                </button>
                <button
                  type="button"
                  onClick={() => onPrintSeating('all')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Daftar
                </button>
                <button
                  type="button"
                  onClick={handleExportAllocationsExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel
                </button>
              </div>
            </section>

            {/* Middle Split: Daftar Pembagian Ruang Table (8 cols) + Denah Pembagian Ruang Grid (4 cols) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              {/* Left: Daftar Pembagian Ruang Table */}
              <section className="xl:col-span-8 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 lg:p-5 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                        <DoorOpen className="w-4 h-4" />
                      </div>
                      <h2 className="font-display font-bold text-base text-[#0F172A]">
                        Daftar Pembagian Ruang
                      </h2>
                    </div>

                    {(filterClass || filterRoom) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterClass('');
                          setFilterRoom('');
                          setTablePage(1);
                        }}
                        className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                      >
                        Tampilkan Semua ({rooms.length} Ruang)
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#DCE5F2]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#DCE8FB] text-[#0F295C] font-display font-bold border-b border-[#C7DAFA]">
                          <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                          <th className="py-2.5 px-2.5 whitespace-nowrap">Ruang</th>
                          <th className="py-2.5 px-2.5 text-center whitespace-nowrap">Kapasitas</th>
                          <th className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            Jumlah Peserta
                          </th>
                          <th className="py-2.5 px-2.5 whitespace-nowrap">Kelas</th>
                          <th className="py-2.5 px-2.5 whitespace-nowrap">Mata Pelajaran</th>
                          <th className="py-2.5 px-2.5 whitespace-nowrap">Pengawas</th>
                          <th className="py-2.5 px-2.5 text-center w-28 whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F7]">
                        {pagedAllocationRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-[#64748B]">
                              Tidak ada ruang yang cocok dengan filter kelas/ruang saat ini.
                            </td>
                          </tr>
                        ) : (
                          pagedAllocationRows.map((row, idx) => (
                            <tr key={row.roomCode} className="hover:bg-[#F8FAFF] transition-colors">
                              <td className="py-2.5 px-2.5 text-center font-mono text-[#334155] tabular-nums">
                                {tableStartIdx + idx + 1}
                              </td>
                              <td className="py-2.5 px-2.5 font-semibold text-[#0F172A] whitespace-nowrap">
                                {row.roomLabel}
                              </td>
                              <td className="py-2.5 px-2.5 text-center font-mono text-[#334155] tabular-nums">
                                {row.capacity}
                              </td>
                              <td className="py-2.5 px-2.5 text-center font-mono font-bold text-[#1D4ED8] tabular-nums">
                                {row.studentCount}
                              </td>
                              <td className="py-2.5 px-2.5 text-[#1E293B] whitespace-nowrap">
                                {row.classesLabel}
                              </td>
                              <td
                                className="py-2.5 px-2.5 text-[#334155] max-w-[150px] truncate"
                                title={row.subjectDisplay}
                              >
                                {row.subjectDisplay}
                              </td>
                              <td className="py-2.5 px-2.5 text-[#1E293B] whitespace-nowrap">
                                {row.supervisor}
                              </td>
                              <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewRoom(row.roomCode)}
                                    title={`Lihat denah kursi ${row.roomLabel}`}
                                    className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-2xs transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditRoom(row)}
                                    title={`Edit kapasitas & pengawas ${row.roomLabel}`}
                                    className="w-7 h-7 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white flex items-center justify-center shadow-2xs transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearRoomOverride(row.roomCode)}
                                    disabled={!roomOverrides[row.roomCode]}
                                    title="Kembalikan pengawas & kapasitas bawaan"
                                    className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white flex items-center justify-center shadow-2xs transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table Pagination */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#475569]">
                  <div className="flex items-center gap-3 tabular-nums">
                    <span>
                      Menampilkan {showingFrom} – {showingTo} dari {filteredAllocationRows.length} data
                    </span>
                    {Object.keys(roomOverrides).length > 0 && (
                      <button
                        type="button"
                        onClick={() => persistOverrides({})}
                        className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset Pengaturan Ruang
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safeTablePage <= 1}
                      onClick={() => setTablePage(1)}
                      className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={safeTablePage <= 1}
                      onClick={() => setTablePage(Math.max(1, safeTablePage - 1))}
                      className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: totalTablePages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTablePage(p)}
                        className={`w-7 h-7 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                          safeTablePage === p
                            ? 'bg-[#2563EB] text-white shadow-2xs'
                            : 'border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] text-[#334155]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={safeTablePage >= totalTablePages}
                      onClick={() => setTablePage(Math.min(totalTablePages, safeTablePage + 1))}
                      className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={safeTablePage >= totalTablePages}
                      onClick={() => setTablePage(totalTablePages)}
                      className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Right: Denah Pembagian Ruang Room Grid */}
              <section className="xl:col-span-4 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 lg:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h2 className="font-display font-bold text-base text-[#0F172A]">
                        Denah Pembagian Ruang
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {roomAllocationRows.map((row) => (
                      <button
                        key={row.roomCode}
                        type="button"
                        onClick={() => setPreviewRoom(row.roomCode)}
                        className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-[#DCE5F2] bg-[#F4F8FF] hover:bg-[#E8F1FF] hover:border-[#93C5FD] transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <LayoutGrid className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#0F172A] truncate">
                            {row.roomLabel}
                          </div>
                          <div className="text-[11px] font-medium text-[#475569] tabular-nums">
                            ({row.studentCount} Peserta)
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#EEF2F7]">
                  <button
                    type="button"
                    onClick={() => setViewMode('sheet')}
                    className="w-full py-2 px-3 rounded-xl bg-[#EEF4FF] hover:bg-[#DCE8FB] text-[#1D4ED8] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Buka Pratinjau Denah Kursi 1:1mm ({pages.length} Hal)
                  </button>
                </div>
              </section>
            </div>

            {/* Bottom 3-Card Row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              {/* Card 1: Informasi Penting */}
              <section
                className="xl:col-span-4 rounded-2xl border border-[#BAEBD6] p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] space-y-2.5"
                style={{ background: 'linear-gradient(180deg, #EDFCF5 0%, #E0F7ED 100%)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-[#065F46]">
                    Informasi Penting
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-[#1E293B]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>Pastikan jumlah peserta sesuai dengan kapasitas ruang.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>Koordinasikan dengan pengawas sebelum pelaksanaan ujian.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab?.('attendance')}
                        className="text-left hover:text-[#1D4ED8] hover:underline font-medium"
                      >
                        Cetak daftar hadir per ruang untuk kelancaran ujian.
                      </button>
                    </span>
                  </li>
                </ul>
              </section>

              {/* Card 2: Ringkasan Pembagian */}
              <section
                className="xl:col-span-4 rounded-2xl border border-[#C7DCFF] p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex flex-col justify-between"
                style={{ background: 'linear-gradient(180deg, #F4F8FF 0%, #E8F1FF 100%)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-[#0F295C]">
                    Ringkasan Pembagian
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs text-[#1E293B]">
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-[#475569]">Ruang Terisi</span>
                    <span>:</span>
                    <strong className="font-mono tabular-nums text-[#0F172A]">
                      {allocatedRoomsCount} dari {rooms.length}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-[#475569]">Total Peserta</span>
                    <span>:</span>
                    <strong className="font-mono tabular-nums text-[#0F172A]">
                      {students.length} Peserta
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-[#475569]">Status</span>
                    <span>:</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#22C55E] text-white text-[11px] font-bold">
                      <Check className="w-3 h-3" />
                      Siap Pelaksanaan
                    </span>
                  </div>
                </div>
              </section>

              {/* Card 3: Motivational Banner */}
              <section
                className="xl:col-span-4 relative rounded-2xl overflow-hidden px-5 py-4 text-white shadow-[0_4px_14px_rgba(9,44,104,0.16)] flex items-center justify-between gap-4"
                style={{
                  background: 'linear-gradient(110deg, #092F71 0%, #1452B8 60%, #1E6BE6 100%)',
                }}
              >
                {/* Checklist + Stopwatch SVG Illustration */}
                <svg viewBox="0 0 96 84" className="w-20 h-20 shrink-0" aria-hidden="true">
                  <rect x="8" y="10" width="48" height="64" rx="7" fill="#38BDF8" />
                  <rect x="13" y="16" width="38" height="52" rx="4" fill="#FFFFFF" />
                  <rect x="23" y="6" width="18" height="7" rx="3" fill="#FACC15" />
                  <path d="M18 27l3 3 5-5" stroke="#10B981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="30" y="26" width="16" height="3" rx="1.5" fill="#94A3B8" />
                  <path d="M18 39l3 3 5-5" stroke="#10B981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="30" y="38" width="16" height="3" rx="1.5" fill="#94A3B8" />
                  <rect x="19" y="49" width="5" height="5" rx="1" fill="#F97316" />
                  <rect x="30" y="50" width="14" height="3" rx="1.5" fill="#CBD5E1" />
                  {/* Stopwatch */}
                  <circle cx="68" cy="54" r="19" fill="#E2E8F0" stroke="#1E3A8A" strokeWidth="2.5" />
                  <circle cx="68" cy="54" r="14" fill="#FFFFFF" />
                  <rect x="65" y="31" width="6" height="5" rx="1" fill="#1E3A8A" />
                  <path d="M68 44v10l7 4" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>

                <div className="min-w-0 text-right">
                  <div className="font-display font-extrabold italic text-xl sm:text-2xl leading-tight text-white">
                    Sukses Ulangan
                  </div>
                  <div className="font-display font-extrabold italic text-base sm:text-lg text-[#FACC15] mt-0.5">
                    Raih Prestasi Terbaik!
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : (
        /* Full-Screen 1:1mm Prepress Seating Sheet Preview */
        <div className="flex-1 flex flex-col min-w-0 bg-[#E9EDF5]">
          <div className="no-print flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-[#E2E8F0] shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#93C5FD] text-[#1D4ED8] text-xs font-bold transition-colors whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Kembali ke Pembagian Ruang
              </button>

              <button
                type="button"
                disabled={safePageIdx <= 0}
                onClick={() => onPageIndexChange(Math.max(0, safePageIdx - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 text-[#1F3864]" />
              </button>
              <span className="font-mono text-xs font-semibold text-[#1F3864] tabular-nums whitespace-nowrap px-1">
                HALAMAN {safePageIdx + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePageIdx >= totalPages - 1}
                onClick={() => onPageIndexChange(Math.min(totalPages - 1, safePageIdx + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4 text-[#1F3864]" />
              </button>
              {activePage && (
                <span className="text-xs text-[#55637A] font-mono tabular-nums whitespace-nowrap ml-1.5">
                  {activePage.roomPlan.badgeLabel} ·{' '}
                  {activePage.mode === 'kelas' ? 'Tempel Kelas' : 'Kontrol Panitia'} ·{' '}
                  {isStudentCardMode
                    ? `${activePage.roomPlan.totalStudents} kartu kursi`
                    : `${activePage.roomPlan.totalDesks} meja / ${activePage.roomPlan.totalStudents} siswa`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5"
                title="Orientasi Denah"
              >
                {(
                  [
                    ['portrait', 'Potret'],
                    ['landscape', 'Lanskap'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onSeatingConfigChange({ paperOrientation: val })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                      seatingConfig.paperOrientation === val
                        ? 'bg-[#1F3864] text-white shadow-2xs'
                        : 'text-[#475569] hover:text-[#131C31]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  onSeatingConfigChange({
                    showSchoolHeader: seatingConfig.showSchoolHeader === false,
                  })
                }
                title="Tampilkan atau sembunyikan header nama sekolah & lambang pada denah"
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  seatingConfig.showSchoolHeader !== false
                    ? 'border-[#1F3864] bg-[#EEF2FA] text-[#1F3864]'
                    : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {seatingConfig.showSchoolHeader !== false
                  ? 'Kop Sekolah: Tampil'
                  : 'Kop Sekolah: Sembunyi'}
              </button>

              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-[#64748B]" />
                <input
                  type="range"
                  min={30}
                  max={105}
                  value={seatingConfig.zoomPct}
                  onChange={(e) => onSeatingConfigChange({ zoomPct: Number(e.target.value) })}
                  className="w-20 accent-[#1F3864]"
                />
                <span className="font-mono text-xs text-[#1F3864] w-9 text-right tabular-nums">
                  {seatingConfig.zoomPct}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => onPrintSeating('current')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#1F3864] text-[#1F3864] text-xs font-semibold shadow-2xs whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Hal {safePageIdx + 1}
              </button>
              <button
                type="button"
                onClick={() => onPrintSeating('all')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold shadow-xs hover:shadow whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5 text-[#C9A227]" />
                Cetak Semua ({totalPages})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {!activePage ? (
              <div className="max-w-md mx-auto mt-16 bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-8 text-center">
                <p className="font-display font-bold text-[#1F3864] text-base">
                  Tidak ada data ruang ditemukan
                </p>
                <p className="text-sm text-[#55637A] mt-1">
                  Tambahkan data siswa atau pilih ruang lain untuk membuat denah tempat duduk.
                </p>
              </div>
            ) : (
              <div
                style={{
                  zoom: seatingConfig.zoomPct / 100,
                  transformOrigin: 'top center',
                }}
              >
                <SeatingSheetPagesBlock
                  pages={[activePage]}
                  paperConfig={paperConfig}
                  seatingConfig={seatingConfig}
                  onSelectStudent={onInspectStudentCard}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Live Room Seating Plan Preview */}
      {previewRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#041434]/60 backdrop-blur-xs"
          onClick={() => setPreviewRoom(null)}
        >
          <div
            className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-[#0A2E70] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <DoorOpen className="w-5 h-5 text-[#FACC15]" />
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base">
                    Denah Tempat Duduk — Ruang {previewRoom}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Pratinjau langsung tata letak kursi peserta · Klik kartu peserta untuk cetak
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => jumpToRoomSheet(previewRoom)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-[#092252] text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Buka di Mode Cetak 1:1mm
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewRoom(null)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#E9EDF5] p-5">
              {previewModalPages.length > 0 ? (
                <div style={{ zoom: 0.72, transformOrigin: 'top center' }}>
                  <SeatingSheetPagesBlock
                    pages={[previewModalPages[0]]}
                    paperConfig={paperConfig}
                    seatingConfig={seatingConfig}
                    onSelectStudent={(st) => {
                      setPreviewRoom(null);
                      onInspectStudentCard?.(st);
                    }}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-[#475569]">
                  Tidak ada peserta pada Ruang {previewRoom}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Room Capacity & Supervisor */}
      {editingRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#041434]/55 backdrop-blur-xs"
          onClick={() => setEditingRoom(null)}
        >
          <form
            onSubmit={handleSaveRoomEdit}
            className="w-full max-w-md bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-[#0F172A]">
                  Edit Pengaturan Ruang {editingRoom}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Atur kapasitas kursi maksimal dan pengawas ruang ujian
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Kapasitas Kursi Ruang
                </label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Nama Pengawas Ruang
                </label>
                <input
                  type="text"
                  value={editSupervisor}
                  onChange={(e) => setEditSupervisor(e.target.value)}
                  placeholder="Contoh: Drs. Budi Santoso"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Catatan Ruang (Opsional)
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Contoh: Lantai 1 Sayap Timur"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF2F7]">
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
