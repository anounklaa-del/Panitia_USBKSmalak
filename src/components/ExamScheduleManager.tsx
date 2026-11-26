import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CreditCard,
  DoorOpen,
  Eye,
  Home,
  Layers,
  Megaphone,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { CommitteeMember } from '../data/committeeData';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import type { ProctorMatrixSession, ProctorRecord } from '../data/proctorData';
import type { MainWorkspaceTab } from '../types/prepress';
import { compareNumericStrings, extractClassTier, getSortedRoomList } from '../utils/deskStickerBuilder';
import { summarizeProctorsForScheduleSlot } from '../utils/proctorStore';
import {
  BASE_CLASSES_LIST,
  buildCombinedScheduleRows,
  formatIndonesianDate,
  formatIndonesianDateLong,
  getAllKnownClasses,
  parseIndonesianDate,
  parseStartMinutes,
  splitDayAndDate,
  summarizeClassesLabel,
  toIsoDateKey,
  type CombinedScheduleRow,
  type ExamScheduleEntry,
  type ScheduleStatus,
  type ScheduleTargetPreset,
} from '../utils/scheduleStore';
import type { SchedulePrintMode } from './ScheduleRosterPrintRenderer';

export type ScheduleViewMode = 'combined' | 'sessions' | 'class';

interface ExamScheduleManagerProps {
  entries: ExamScheduleEntry[];
  schedulesMap: Record<string, ScheduleRow[]>;
  students: StudentRecord[];
  committeeMembers: CommitteeMember[];
  proctors?: ProctorRecord[];
  proctorMatrix?: ProctorMatrixSession[];
  academicYear: string;
  onAddEntries: (newEntries: ExamScheduleEntry[]) => void;
  onUpdateEntries: (updatedList: ExamScheduleEntry[]) => void;
  onToggleStatus: (entryIds: string[], nextStatus: ScheduleStatus) => void;
  onDeleteEntries: (entryIds: string[]) => void;
  onResetDefaults: () => void;
  onPrintSchedule: (opts: {
    mode: SchedulePrintMode;
    combinedRows: CombinedScheduleRow[];
    sessionRows: ExamScheduleEntry[];
    selectedClass?: string;
    filterSummary?: string;
  }) => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
  onInspectClassCard: (kelas: string) => void;
  onUseScheduleForAttendance: (session: { subject: string; date: string; time: string }) => void;
}

const PAGE_SIZE = 8;

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const TIME_PRESETS = [
  '07.00 – 09.00',
  '08.00 – 09.00',
  '09.15 – 10.15',
  '10.30 – 11.30',
  '07.30 – 08.45',
  '09.00 – 10.00',
];

type ActiveModal =
  | null
  | {
      type: 'form';
      mode: 'create' | 'edit';
      editingEntryIds?: string[];
      initial?: Partial<ScheduleFormState>;
    }
  | {
      type: 'detail';
      title: string;
      date: string;
      time: string;
      subject: string;
      classes: string[];
      kelasLabel: string;
      ruangLabel: string;
      pengawas: string;
      status: ScheduleStatus;
      hasMixedStatus?: boolean;
      entryIds: string[];
      entries: ExamScheduleEntry[];
    }
  | {
      type: 'confirmDelete';
      title: string;
      subtitle: string;
      entryIds: string[];
    };

interface ScheduleFormState {
  isoDate: string;
  subject: string;
  time: string;
  targetPreset: ScheduleTargetPreset;
  selectedClasses: string[];
  ruangLabel: string;
  pengawas: string;
  status: ScheduleStatus;
  notes: string;
}

export const ExamScheduleManager: React.FC<ExamScheduleManagerProps> = ({
  entries,
  schedulesMap,
  students,
  committeeMembers,
  proctors = [],
  proctorMatrix = [],
  academicYear,
  onAddEntries,
  onUpdateEntries,
  onToggleStatus,
  onDeleteEntries,
  onResetDefaults,
  onPrintSchedule,
  onNavigateTab,
  onInspectClassCard,
  onUseScheduleForAttendance,
}) => {
  const knownClasses = useMemo(() => getAllKnownClasses(students), [students]);
  const roomList = useMemo(() => getSortedRoomList(students), [students]);

  const combinedRowsAll = useMemo(
    () => buildCombinedScheduleRows(entries, knownClasses),
    [entries, knownClasses],
  );

  // Determine earliest active date to initialize calendar cleanly
  const sortedUniqueDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) {
      const iso = toIsoDateKey(e.date);
      if (!map.has(iso)) map.set(iso, e.date);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, label]) => ({ iso, label }));
  }, [entries]);

  const firstExamDateObj = useMemo(() => {
    if (sortedUniqueDates.length > 0) {
      const parsed = parseIndonesianDate(sortedUniqueDates[0].iso);
      if (parsed) return parsed;
    }
    return new Date(2026, 10, 30);
  }, [sortedUniqueDates]);

  const lastExamDateLabel = useMemo(() => {
    if (sortedUniqueDates.length === 0) return '-';
    return formatIndonesianDateLong(sortedUniqueDates[sortedUniqueDates.length - 1].label);
  }, [sortedUniqueDates]);

  const firstExamDateLabel = useMemo(() => {
    if (sortedUniqueDates.length === 0) return '-';
    return formatIndonesianDateLong(sortedUniqueDates[0].label);
  }, [sortedUniqueDates]);

  // Interactive Filters & View State
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('combined');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayIso, setSelectedDayIso] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('');
  const [perClassTarget, setPerClassTarget] = useState<string>(
    () => knownClasses[0] ?? BASE_CLASSES_LIST[0] ?? 'X1',
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Calendar Month State
  const [calYear, setCalYear] = useState(() => firstExamDateObj.getFullYear());
  const [calMonth, setCalMonth] = useState(() => firstExamDateObj.getMonth());
  const [activeCalDateIso, setActiveCalDateIso] = useState<string>(() =>
    sortedUniqueDates[0]?.iso ?? '2026-11-30',
  );

  // Modal & Form State
  const [modal, setModal] = useState<ActiveModal>(null);
  const [formState, setFormState] = useState<ScheduleFormState>({
    isoDate: sortedUniqueDates[0]?.iso ?? '2026-11-30',
    subject: '',
    time: '07.00 – 09.00',
    targetPreset: 'ALL',
    selectedClasses: knownClasses,
    ruangLabel: `R. 01 – ${String(Math.max(1, roomList.length)).padStart(2, '0')}`,
    pengawas: 'Tim A',
    status: 'Aktif',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setSyncNotice(msg);
    setTimeout(() => setSyncNotice((cur) => (cur === msg ? null : cur)), 4000);
  };

  // Unique dropdown room options
  const roomFilterOptions = useMemo(() => {
    const fromEntries = [...new Set(entries.map((e) => e.ruangLabel.trim()).filter(Boolean))];
    return fromEntries;
  }, [entries]);

  // Unique subject suggestions for modal datalist
  const subjectSuggestions = useMemo(() => {
    return [...new Set(entries.map((e) => e.subject.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'id'),
    );
  }, [entries]);

  // Supervisor dropdown options
  const supervisorOptions = useMemo(() => {
    const base = ['Tim A', 'Tim B', 'Tim C'];
    const names = committeeMembers
      .filter((m) => m.status === 'Aktif')
      .map((m) => m.nama)
      .slice(0, 12);
    return [...new Set([...base, ...names])];
  }, [committeeMembers]);

  // 4 KPI Metrics (live synchronized!)
  const kpiStats = useMemo(() => {
    const activeEntries = entries.filter((e) => e.status === 'Aktif');
    const uniqueSubjects = new Set(
      activeEntries.map((e) => e.subject.trim().toLowerCase()).filter(Boolean),
    ).size;
    const uniqueDays = new Set(activeEntries.map((e) => toIsoDateKey(e.date))).size;
    const totalRooms = roomList.length > 0 ? roomList.length : 10;
    const totalStudents = students.length;
    return { uniqueSubjects, uniqueDays, totalRooms, totalStudents };
  }, [entries, roomList.length, students.length]);

  const isCustomized = useMemo(() => {
    try {
      return Boolean(localStorage.getItem('pas_schedule_entries_v1'));
    } catch {
      return false;
    }
  }, [entries]);

  // Filter helper shared between combined and granular modes
  const matchesClassFilter = (classes: string[]): boolean => {
    if (!selectedClassFilter) return true;
    if (selectedClassFilter === '__ALL_COMBINED__') {
      return knownClasses.length > 0 && knownClasses.every((c) => classes.includes(c));
    }
    if (selectedClassFilter === '__TIER_X__') {
      return classes.some((c) => extractClassTier(c) === 'X');
    }
    if (selectedClassFilter === '__TIER_XI__') {
      return classes.some((c) => extractClassTier(c) === 'XI');
    }
    if (selectedClassFilter === '__TIER_XII__') {
      return classes.some((c) => extractClassTier(c) === 'XII');
    }
    return classes.includes(selectedClassFilter);
  };

  // Filtered Combined Rows
  const filteredCombinedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedRowsAll.filter((r) => {
      if (q) {
        const hit =
          r.subject.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.kelasLabel.toLowerCase().includes(q) ||
          r.pengawas.toLowerCase().includes(q) ||
          r.ruangLabel.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedDayIso && toIsoDateKey(r.date) !== selectedDayIso) return false;
      if (!matchesClassFilter(r.classes)) return false;
      if (
        selectedRoomFilter &&
        !r.ruangLabel.toLowerCase().includes(selectedRoomFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    combinedRowsAll,
    searchQuery,
    selectedDayIso,
    selectedClassFilter,
    selectedRoomFilter,
    knownClasses,
  ]);

  // Filtered Granular Session Rows
  const filteredSessionRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (q) {
        const hit =
          e.subject.toLowerCase().includes(q) ||
          e.date.toLowerCase().includes(q) ||
          e.kelasLabel.toLowerCase().includes(q) ||
          e.pengawas.toLowerCase().includes(q) ||
          e.ruangLabel.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedDayIso && toIsoDateKey(e.date) !== selectedDayIso) return false;
      if (!matchesClassFilter(e.classes)) return false;
      if (
        selectedRoomFilter &&
        !e.ruangLabel.toLowerCase().includes(selectedRoomFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
      const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
      if (da !== db) return da - db;
      const ta = parseStartMinutes(a.time);
      const tb = parseStartMinutes(b.time);
      if (ta !== tb) return ta - tb;
      return a.subject.localeCompare(b.subject, 'id');
    });
  }, [entries, searchQuery, selectedDayIso, selectedClassFilter, selectedRoomFilter, knownClasses]);

  // Filtered Per-Class Card Rows (exact rows rendered on Back of PAS Card)
  const perClassEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matching = entries.filter((e) => e.classes.includes(perClassTarget));
    const sorted = [...matching].sort((a, b) => {
      const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
      const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
      if (da !== db) return da - db;
      const ta = parseStartMinutes(a.time);
      const tb = parseStartMinutes(b.time);
      if (ta !== tb) return ta - tb;
      return a.subject.localeCompare(b.subject, 'id');
    });
    return sorted.filter((e) => {
      if (selectedDayIso && toIsoDateKey(e.date) !== selectedDayIso) return false;
      if (q && !e.subject.toLowerCase().includes(q) && !e.date.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [entries, perClassTarget, selectedDayIso, searchQuery]);

  // Active rows & pagination
  const totalFilteredCount =
    viewMode === 'combined'
      ? filteredCombinedRows.length
      : viewMode === 'sessions'
        ? filteredSessionRows.length
        : perClassEntries.length;

  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedCombined = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCombinedRows.slice(start, start + PAGE_SIZE);
  }, [filteredCombinedRows, safePage]);

  const pagedSessions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSessionRows.slice(start, start + PAGE_SIZE);
  }, [filteredSessionRows, safePage]);

  const pagedClassEntries = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return perClassEntries.slice(start, start + PAGE_SIZE);
  }, [perClassEntries, safePage]);

  // Calendar exam dates lookup with count & status
  const examDateStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; hasAktif: boolean; hasCombined: boolean }>();
    for (const e of entries) {
      const iso = toIsoDateKey(e.date);
      const cur = map.get(iso) ?? { count: 0, hasAktif: false, hasCombined: false };
      cur.count += 1;
      if (e.status === 'Aktif') cur.hasAktif = true;
      if (e.classes.length >= knownClasses.length) cur.hasCombined = true;
      map.set(iso, cur);
    }
    return map;
  }, [entries, knownClasses.length]);

  // Build 42-day Monday-first calendar grid
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    // Mon = 0 .. Sun = 6
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(calYear, calMonth, 1 - startWeekday);
    const cells: Array<{
      date: Date;
      iso: string;
      day: number;
      inMonth: boolean;
    }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      cells.push({
        date: d,
        iso: `${y}-${m}-${day}`,
        day: d.getDate(),
        inMonth: d.getMonth() === calMonth,
      });
    }
    return cells;
  }, [calYear, calMonth]);

  const handleShiftMonth = (delta: number) => {
    const next = new Date(calYear, calMonth + delta, 1);
    setCalYear(next.getFullYear());
    setCalMonth(next.getMonth());
  };

  const handleCalendarDayClick = (iso: string) => {
    setActiveCalDateIso(iso);
    if (selectedDayIso === iso) {
      setSelectedDayIso('');
    } else if (examDateStatsMap.has(iso)) {
      setSelectedDayIso(iso);
      setCurrentPage(1);
    }
  };

  // Resolve class list from TargetPreset
  const resolveClassesForPreset = (
    preset: ScheduleTargetPreset,
    customList: string[],
  ): string[] => {
    if (preset === 'ALL') return [...knownClasses];
    if (preset === 'X') return knownClasses.filter((c) => extractClassTier(c) === 'X');
    if (preset === 'XI') return knownClasses.filter((c) => extractClassTier(c) === 'XI');
    if (preset === 'XII') return knownClasses.filter((c) => extractClassTier(c) === 'XII');
    return [...new Set(customList)].sort(compareNumericStrings);
  };

  const inferPresetFromClasses = (classes: string[]): ScheduleTargetPreset => {
    if (knownClasses.length > 0 && knownClasses.every((c) => classes.includes(c))) return 'ALL';
    const xList = knownClasses.filter((c) => extractClassTier(c) === 'X');
    const xiList = knownClasses.filter((c) => extractClassTier(c) === 'XI');
    const xiiList = knownClasses.filter((c) => extractClassTier(c) === 'XII');
    if (classes.length === xList.length && xList.every((c) => classes.includes(c))) return 'X';
    if (classes.length === xiList.length && xiList.every((c) => classes.includes(c))) return 'XI';
    if (classes.length === xiiList.length && xiiList.every((c) => classes.includes(c))) return 'XII';
    return 'CUSTOM';
  };

  const openCreateModal = (defaultPreset: ScheduleTargetPreset = 'ALL') => {
    const classes = resolveClassesForPreset(defaultPreset, []);
    setFormError(null);
    setFormState({
      isoDate: selectedDayIso || sortedUniqueDates[0]?.iso || '2026-11-30',
      subject: '',
      time: '07.00 – 09.00',
      targetPreset: defaultPreset,
      selectedClasses: classes,
      ruangLabel: `R. 01 – ${String(Math.max(1, roomList.length)).padStart(2, '0')}`,
      pengawas: 'Tim A',
      status: 'Aktif',
      notes: '',
    });
    setModal({ type: 'form', mode: 'create' });
  };

  const openEditCombinedModal = (row: CombinedScheduleRow) => {
    const first = row.entries[0];
    const preset = inferPresetFromClasses(row.classes);
    setFormError(null);
    setFormState({
      isoDate: toIsoDateKey(row.date),
      subject: row.subject,
      time: first?.time ?? row.timeLabel,
      targetPreset: preset,
      selectedClasses: row.classes,
      ruangLabel: row.ruangLabel,
      pengawas: first?.pengawas ?? row.pengawas,
      status: row.status,
      notes: first?.notes ?? '',
    });
    setModal({
      type: 'form',
      mode: 'edit',
      editingEntryIds: row.entryIds,
    });
  };

  const openEditEntryModal = (entry: ExamScheduleEntry) => {
    const preset = inferPresetFromClasses(entry.classes);
    setFormError(null);
    setFormState({
      isoDate: toIsoDateKey(entry.date),
      subject: entry.subject,
      time: entry.time,
      targetPreset: preset,
      selectedClasses: entry.classes,
      ruangLabel: entry.ruangLabel,
      pengawas: entry.pengawas,
      status: entry.status,
      notes: entry.notes ?? '',
    });
    setModal({
      type: 'form',
      mode: 'edit',
      editingEntryIds: [entry.id],
    });
  };

  const handleFormPresetChange = (preset: ScheduleTargetPreset) => {
    const resolved =
      preset === 'CUSTOM'
        ? formState.selectedClasses
        : resolveClassesForPreset(preset, formState.selectedClasses);
    setFormState((prev) => ({
      ...prev,
      targetPreset: preset,
      selectedClasses: resolved,
    }));
  };

  const handleToggleCustomClass = (kelas: string) => {
    setFormState((prev) => {
      const exists = prev.selectedClasses.includes(kelas);
      const next = exists
        ? prev.selectedClasses.filter((c) => c !== kelas)
        : [...prev.selectedClasses, kelas].sort(compareNumericStrings);
      return {
        ...prev,
        targetPreset: 'CUSTOM',
        selectedClasses: next,
      };
    });
  };

  const handleSubmitForm = (ev: React.FormEvent) => {
    ev.preventDefault();
    const subjectClean = formState.subject.trim();
    const timeClean = formState.time.trim();
    const dateObj = parseIndonesianDate(formState.isoDate);

    if (!subjectClean) {
      setFormError('Nama mata pelajaran wajib diisi.');
      return;
    }
    if (!dateObj) {
      setFormError('Tanggal pelaksanaan tidak valid.');
      return;
    }
    if (!timeClean) {
      setFormError('Waktu pelaksanaan wajib diisi.');
      return;
    }
    const targetClasses = resolveClassesForPreset(formState.targetPreset, formState.selectedClasses);
    if (targetClasses.length === 0) {
      setFormError('Pilih minimal satu kelas peserta ujian.');
      return;
    }

    const formattedDate = formatIndonesianDate(dateObj);
    const kelasLabel = summarizeClassesLabel(targetClasses, knownClasses);
    const roomClean = formState.ruangLabel.trim() || 'R. 01 – 10';
    const pengawasClean = formState.pengawas.trim() || 'Tim A';

    if (modal?.type === 'form' && modal.mode === 'edit' && modal.editingEntryIds?.length) {
      // Replace the edited entry group cleanly with unified entry preserving ID[0]
      const keepId = modal.editingEntryIds[0];
      const replaceIds = new Set(modal.editingEntryIds);
      const updatedEntry: ExamScheduleEntry = {
        id: keepId,
        date: formattedDate,
        time: timeClean,
        subject: subjectClean,
        classes: targetClasses,
        kelasLabel,
        ruangLabel: roomClean,
        pengawas: pengawasClean,
        status: formState.status,
        isCombined: targetClasses.length > 1,
        ...(formState.notes.trim() ? { notes: formState.notes.trim() } : {}),
      };
      const remaining = entries.filter((e) => !replaceIds.has(e.id));
      onUpdateEntries([...remaining, updatedEntry]);
      flashNotice(
        `Jadwal "${subjectClean}" (${kelasLabel}) diperbarui & tersinkron ke Kartu PAS.`,
      );
    } else {
      const newEntry: ExamScheduleEntry = {
        id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: formattedDate,
        time: timeClean,
        subject: subjectClean,
        classes: targetClasses,
        kelasLabel,
        ruangLabel: roomClean,
        pengawas: pengawasClean,
        status: formState.status,
        isCombined: targetClasses.length > 1,
        ...(formState.notes.trim() ? { notes: formState.notes.trim() } : {}),
      };
      onAddEntries([newEntry]);
      flashNotice(
        `Jadwal "${subjectClean}" (${kelasLabel}) ditambahkan & tersinkron ke ${targetClasses.length} kelas.`,
      );
    }

    // Move calendar view to that month so user sees the update immediately
    setCalYear(dateObj.getFullYear());
    setCalMonth(dateObj.getMonth());
    setActiveCalDateIso(toIsoDateKey(formattedDate));
    setModal(null);
  };

  const handlePrintActiveSchedule = () => {
    const filterParts: string[] = [];
    if (selectedDayIso) filterParts.push(formatIndonesianDateLong(selectedDayIso));
    if (selectedClassFilter === '__ALL_COMBINED__') filterParts.push('Gabungan Semua Kelas');
    else if (selectedClassFilter === '__TIER_X__') filterParts.push('Jenjang X');
    else if (selectedClassFilter === '__TIER_XI__') filterParts.push('Jenjang XI');
    else if (selectedClassFilter === '__TIER_XII__') filterParts.push('Jenjang XII');
    else if (selectedClassFilter) filterParts.push(`Kelas ${selectedClassFilter}`);
    if (searchQuery.trim()) filterParts.push(`"${searchQuery.trim()}"`);

    onPrintSchedule({
      mode: viewMode,
      combinedRows: filteredCombinedRows,
      sessionRows: viewMode === 'class' ? perClassEntries : filteredSessionRows,
      selectedClass: viewMode === 'class' ? perClassTarget : undefined,
      filterSummary: filterParts.join(' · ') || undefined,
    });
  };

  const countImpactedStudents = (classes: string[]): number => {
    const set = new Set(classes);
    return students.filter((s) => set.has(s.kelas)).length;
  };

  const resolveSyncedProctors = (
    date: string,
    subEntries: ExamScheduleEntry[],
    fallbackTime: string,
    fallbackLabel: string,
  ) => {
    if (proctors.length === 0 || proctorMatrix.length === 0) {
      return {
        label: fallbackLabel,
        tooltip: fallbackLabel,
        synced: false,
        shifts: [] as Array<{
          time: string;
          kelasLabel: string;
          assignments: Array<{ roomNo: number; roomLabel: string; code: number; nama: string }>;
        }>,
      };
    }

    const timeSlots =
      subEntries.length > 0
        ? subEntries.map((e) => ({ time: e.time, kelasLabel: e.kelasLabel }))
        : [{ time: fallbackTime, kelasLabel: '' }];

    const seenTime = new Set<string>();
    const shifts: Array<{
      time: string;
      kelasLabel: string;
      assignments: Array<{ roomNo: number; roomLabel: string; code: number; nama: string }>;
    }> = [];

    for (const slot of timeSlots) {
      if (seenTime.has(slot.time)) continue;
      seenTime.add(slot.time);
      const sum = summarizeProctorsForScheduleSlot(date, slot.time, proctorMatrix, proctors);
      if (sum.assignments.length > 0) {
        shifts.push({
          time: slot.time,
          kelasLabel: slot.kelasLabel,
          assignments: sum.assignments,
        });
      }
    }

    if (shifts.length === 0) {
      return { label: fallbackLabel, tooltip: fallbackLabel, synced: false, shifts: [] };
    }

    if (shifts.length === 1) {
      const sum = summarizeProctorsForScheduleSlot(date, shifts[0].time, proctorMatrix, proctors);
      return {
        label: sum.label,
        tooltip: sum.tooltip,
        synced: true,
        shifts,
      };
    }

    const totalAssignments = shifts.reduce((acc, s) => acc + s.assignments.length, 0);
    const tooltip = shifts
      .map(
        (s) =>
          `[${s.time}] ${s.assignments
            .map((a) => `${a.roomLabel}:${String(a.code).padStart(2, '0')}`)
            .join(', ')}`,
      )
      .join('\n');

    return {
      label: `${shifts.length} sesi (${totalAssignments} ruang)`,
      tooltip,
      synced: true,
      shifts,
    };
  };

  // Pagination page numbers (up to 5 visible pages)
  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [safePage, totalPages]);

  const showFrom = totalFilteredCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(totalFilteredCount, safePage * PAGE_SIZE);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Top Royal-Blue Gradient Header Banner matching screenshot */}
      <div
        className="relative rounded-2xl px-5 sm:px-6 py-4 text-white overflow-hidden shadow-[0_6px_20px_rgba(9,47,113,0.18)]"
        style={{
          background: 'linear-gradient(100deg, #092F71 0%, #1046A2 55%, #0A347B 100%)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-10 right-[18%] w-36 h-48 bg-white/[0.06] rotate-[26deg]" />
          <div className="absolute -top-10 right-[11%] w-16 h-48 bg-white/[0.04] rotate-[26deg]" />
          <div className="absolute -bottom-12 right-[3%] w-40 h-40 rounded-full bg-white/[0.05]" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs">
              <CalendarCheck2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-white">
                Jadwal Ulangan
              </h1>
              <p className="text-xs sm:text-[13px] italic text-[#DCE8FF] mt-0.5">
                Kelola jadwal pelaksanaan ulangan dengan mudah dan terstruktur
              </p>
            </div>
          </div>

          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-[#DCE8FF] font-medium shrink-0"
          >
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white font-semibold">Jadwal Ulangan</span>
          </nav>
        </div>
      </div>

      {/* Sync Toast Feedback */}
      {syncNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-semibold shadow-2xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
            {syncNotice}
          </span>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="p-1 rounded hover:bg-[#D1FAE5] text-[#047857]"
            aria-label="Tutup pemberitahuan"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Pastel KPI Cards matching reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          className="rounded-2xl border border-[#BBD7FC] px-4 py-3.5 shadow-[0_3px_12px_rgba(37,99,235,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #EDF4FF 0%, #D9E9FF 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#BFDBFE] flex items-center justify-center text-[#1D63D8] shrink-0 shadow-2xs">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#0F295C] tabular-nums leading-tight">
              {kpiStats.uniqueSubjects}
            </div>
            <div className="text-xs font-semibold text-[#1E3A8A]">Mata Pelajaran</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#AEE7CB] px-4 py-3.5 shadow-[0_3px_12px_rgba(16,185,129,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #E8FAF1 0%, #CFF4E2 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#A7F3D0] flex items-center justify-center text-[#059669] shrink-0 shadow-2xs">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#064E3B] tabular-nums leading-tight">
              {kpiStats.uniqueDays}
            </div>
            <div className="text-xs font-semibold text-[#047857]">Hari Pelaksanaan</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#D4C2FC] px-4 py-3.5 shadow-[0_3px_12px_rgba(124,58,237,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #F3EEFF 0%, #E6DCFF 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#DDD6FE] flex items-center justify-center text-[#7C3AED] shrink-0 shadow-2xs">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#3B0764] tabular-nums leading-tight">
              {kpiStats.totalRooms}
            </div>
            <div className="text-xs font-semibold text-[#6D28D9]">Ruang Ujian</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#FACBA2] px-4 py-3.5 shadow-[0_3px_12px_rgba(234,88,12,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #FFF2E6 0%, #FFE3C8 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shrink-0 shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#7C2D12] tabular-nums leading-tight">
              {kpiStats.totalStudents}
            </div>
            <div className="text-xs font-semibold text-[#C2410C]">Peserta Ujian</div>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Left Daftar Jadwal Ulangan + Right Kalender / Info / Banner */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        {/* LEFT CARD: Daftar Jadwal Ulangan */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Top Title & Mode Switcher Row */}
          <div className="px-5 pt-4 pb-3 border-b border-[#E8EFF8] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-[#EBF2FF] border border-[#C7DCFD] flex items-center justify-center text-[#1D4ED8] shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display font-bold text-[15px] text-[#0F295C]">
                  Daftar Jadwal Ulangan
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[10.5px] font-semibold text-[#047857]">
                <RefreshCw className="w-3 h-3" />
                Tersinkron ke Kartu PAS, Absen, Ruang &amp; Pengawas
              </span>
            </div>

            {/* View Mode Toggle Pills incl. Jadwal Gabungan Semua Kelas */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('combined');
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'combined'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                  title="Tampilan jadwal ulangan gabungan lintas kelas (X, XI, XII)"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Gabungan Semua Kelas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('sessions');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'sessions'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                  title="Tampilan rincian setiap sesi & shift waktu per jenjang"
                >
                  Detail Sesi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('class');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'class'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                  title="Tampilan jadwal persis seperti di balik Kartu Peserta PAS per kelas"
                >
                  Per Kelas (Kartu)
                </button>
              </div>

              {isCustomized && (
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaults();
                    setSelectedDayIso('');
                    setCurrentPage(1);
                    flashNotice('Jadwal ulangan dikembalikan ke jadwal bawaan Paste November.');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF2F7] text-[#475569] text-[11px] font-semibold transition-colors"
                  title="Kembalikan ke jadwal standar Paste November"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Bawaan
                </button>
              )}
            </div>
          </div>

          {/* Filter & Action Toolbar matching reference */}
          <div className="px-5 py-3 bg-[#F8FAFC]/80 border-b border-[#E8EFF8] flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari mata pelajaran..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            {/* Semua Hari */}
            <select
              value={selectedDayIso}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDayIso(val);
                if (val) {
                  setActiveCalDateIso(val);
                  const d = parseIndonesianDate(val);
                  if (d) {
                    setCalYear(d.getFullYear());
                    setCalMonth(d.getMonth());
                  }
                }
                setCurrentPage(1);
              }}
              aria-label="Filter Hari Pelaksanaan"
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Semua Hari ({sortedUniqueDates.length} hari)</option>
              {sortedUniqueDates.map((d) => (
                <option key={d.iso} value={d.iso}>
                  {d.label}
                </option>
              ))}
            </select>

            {/* Semua Kelas OR Class Picker when in 'class' viewMode */}
            {viewMode === 'class' ? (
              <select
                value={perClassTarget}
                onChange={(e) => {
                  setPerClassTarget(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Pilih Kelas untuk Kartu"
                className="px-3 py-1.5 rounded-lg border border-[#2563EB] bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8] focus:outline-none"
              >
                {knownClasses.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k} ({schedulesMap[k]?.length ?? 0} mapel di kartu)
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter Kelas"
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">Semua Kelas</option>
                <option value="__ALL_COMBINED__">Gabungan Semua Kelas (X, XI, XII)</option>
                <option value="__TIER_X__">Jenjang X (X1–X6)</option>
                <option value="__TIER_XI__">Jenjang XI (XI 1–XI 7)</option>
                <option value="__TIER_XII__">Jenjang XII (XII 1–XII 7)</option>
                {knownClasses.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            )}

            {/* Semua Ruang */}
            <select
              value={selectedRoomFilter}
              onChange={(e) => {
                setSelectedRoomFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter Ruang Ujian"
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Semua Ruang</option>
              {roomFilterOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Action Buttons: Cetak Jadwal & + Tambah Jadwal */}
            <div className="flex items-center gap-2 ml-auto">
              {viewMode === 'class' && (
                <button
                  type="button"
                  onClick={() => onInspectClassCard(perClassTarget)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#93C5FD] text-[#1D4ED8] text-xs font-bold transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Lihat Kartu {perClassTarget}
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintActiveSchedule}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Jadwal
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('ALL')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Jadwal
              </button>
            </div>
          </div>

          {/* Active calendar/filter chip */}
          {(selectedDayIso || selectedClassFilter || searchQuery) && (
            <div className="px-5 py-2 bg-[#EFF6FF] border-b border-[#DBEAFE] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#1E3A8A] font-medium">
                Menampilkan jadwal terfilter:{' '}
                <strong>
                  {[
                    selectedDayIso ? formatIndonesianDateLong(selectedDayIso) : null,
                    selectedClassFilter === '__ALL_COMBINED__'
                      ? 'Gabungan Semua Kelas (X, XI, XII)'
                      : selectedClassFilter || null,
                    searchQuery ? `"${searchQuery}"` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedDayIso('');
                  setSelectedClassFilter('');
                  setSelectedRoomFilter('');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-bold text-[#1D4ED8] hover:underline"
              >
                Hapus Filter
              </button>
            </div>
          )}

          {/* 9-Column Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#EEF4FC] text-[#0F295C] font-bold border-b border-[#D8E4F3]">
                  <th className="py-2.5 px-3 text-center w-10">No</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Hari / Tanggal</th>
                  <th className="py-2.5 px-3 min-w-[165px]">Mata Pelajaran</th>
                  <th className="py-2.5 px-3 min-w-[95px]">Kelas</th>
                  <th className="py-2.5 px-3 min-w-[115px] whitespace-nowrap">Waktu</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Ruang</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Pengawas</th>
                  <th className="py-2.5 px-3 text-center w-24">Status</th>
                  <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {viewMode === 'combined' &&
                  pagedCombined.map((row, idx) => {
                    const { dayLabel, dateLabel } = splitDayAndDate(row.date);
                    const rowNo = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const proctorSummary = resolveSyncedProctors(
                      row.date,
                      row.entries,
                      row.timeLabel,
                      row.pengawas,
                    );
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[#F7FAFF] transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-[#475569] tabular-nums">
                          {rowNo}
                        </td>
                        <td className="py-2.5 px-3 leading-snug">
                          {dayLabel && (
                            <div className="text-[11px] text-[#64748B]">{dayLabel}</div>
                          )}
                          <div className="font-semibold text-[#0F172A]">{dateLabel}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#0F295C]">
                          {row.subject}
                          {row.entries.length > 1 && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-[#EFF6FF] border border-[#DBEAFE] text-[10px] font-semibold text-[#2563EB] align-middle">
                              {row.entries.length} sesi
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              row.isAllClasses ? 'text-[#1D4ED8]' : 'text-[#1E293B]'
                            }`}
                            title={`${row.classes.length} kelas (${row.classes.join(', ')})`}
                          >
                            {row.kelasLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#1E293B] whitespace-nowrap">
                          {row.timeLabel}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#334155] whitespace-nowrap">
                          {row.ruangLabel}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[#334155] whitespace-nowrap"
                          title={proctorSummary.tooltip}
                        >
                          <span
                            className={
                              proctorSummary.synced
                                ? 'font-mono font-semibold text-[#1D4ED8]'
                                : 'text-[#334155]'
                            }
                          >
                            {proctorSummary.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const next: ScheduleStatus =
                                row.status === 'Aktif' ? 'Ditunda' : 'Aktif';
                              onToggleStatus(row.entryIds, next);
                              flashNotice(
                                `Status "${row.subject}" (${row.kelasLabel}) diubah ke ${next}.`,
                              );
                            }}
                            title="Klik untuk ubah status Aktif / Ditunda"
                            className={`inline-flex items-center justify-center min-w-[66px] px-2.5 py-1 rounded-md text-[11px] font-bold text-white transition-opacity hover:opacity-90 ${
                              row.status === 'Aktif' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                            }`}
                          >
                            {row.hasMixedStatus ? 'Sebagian' : row.status}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'detail',
                                  title: `Detail Jadwal — ${row.subject}`,
                                  date: row.date,
                                  time: row.timeLabel,
                                  subject: row.subject,
                                  classes: row.classes,
                                  kelasLabel: row.isAllClasses
                                    ? 'Gabungan Semua Kelas (X, XI, XII)'
                                    : row.kelasLabel,
                                  ruangLabel: row.ruangLabel,
                                  pengawas: proctorSummary.label,
                                  status: row.status,
                                  hasMixedStatus: row.hasMixedStatus,
                                  entryIds: row.entryIds,
                                  entries: row.entries,
                                })
                              }
                              title="Lihat rincian kelas & sinkronisasi"
                              className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditCombinedModal(row)}
                              title="Edit jadwal ini"
                              className="w-7 h-7 rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'confirmDelete',
                                  title: `Hapus Jadwal "${row.subject}"?`,
                                  subtitle: `${row.date} · Sasaran: ${row.kelasLabel} (${row.entryIds.length} sesi). Perubahan akan menghapus mapel ini dari Kartu PAS.`,
                                  entryIds: row.entryIds,
                                })
                              }
                              title="Hapus jadwal ini"
                              className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {viewMode === 'sessions' &&
                  pagedSessions.map((entry, idx) => {
                    const { dayLabel, dateLabel } = splitDayAndDate(entry.date);
                    const rowNo = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const proctorSummary = resolveSyncedProctors(
                      entry.date,
                      [entry],
                      entry.time,
                      entry.pengawas,
                    );
                    return (
                      <tr key={entry.id} className="hover:bg-[#F7FAFF] transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-[#475569] tabular-nums">
                          {rowNo}
                        </td>
                        <td className="py-2.5 px-3 leading-snug">
                          {dayLabel && (
                            <div className="text-[11px] text-[#64748B]">{dayLabel}</div>
                          )}
                          <div className="font-semibold text-[#0F172A]">{dateLabel}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#0F295C]">
                          {entry.subject}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#1E293B]">
                          {entry.kelasLabel}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#1E293B] whitespace-nowrap">
                          {entry.time}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#334155] whitespace-nowrap">
                          {entry.ruangLabel}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[#334155] whitespace-nowrap"
                          title={proctorSummary.tooltip}
                        >
                          <span
                            className={
                              proctorSummary.synced
                                ? 'font-mono font-semibold text-[#1D4ED8]'
                                : 'text-[#334155]'
                            }
                          >
                            {proctorSummary.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const next: ScheduleStatus =
                                entry.status === 'Aktif' ? 'Ditunda' : 'Aktif';
                              onToggleStatus([entry.id], next);
                              flashNotice(
                                `Status sesi "${entry.subject}" (${entry.kelasLabel}) diubah ke ${next}.`,
                              );
                            }}
                            className={`inline-flex items-center justify-center min-w-[66px] px-2.5 py-1 rounded-md text-[11px] font-bold text-white transition-opacity hover:opacity-90 ${
                              entry.status === 'Aktif' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                            }`}
                          >
                            {entry.status}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'detail',
                                  title: `Detail Sesi — ${entry.subject}`,
                                  date: entry.date,
                                  time: entry.time,
                                  subject: entry.subject,
                                  classes: entry.classes,
                                  kelasLabel: entry.kelasLabel,
                                  ruangLabel: entry.ruangLabel,
                                  pengawas: proctorSummary.label,
                                  status: entry.status,
                                  entryIds: [entry.id],
                                  entries: [entry],
                                })
                              }
                              className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditEntryModal(entry)}
                              className="w-7 h-7 rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'confirmDelete',
                                  title: `Hapus Sesi "${entry.subject}"?`,
                                  subtitle: `${entry.date} (${entry.time}) · Kelas ${entry.kelasLabel}.`,
                                  entryIds: [entry.id],
                                })
                              }
                              className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {viewMode === 'class' &&
                  pagedClassEntries.map((entry, idx) => {
                    const { dayLabel, dateLabel } = splitDayAndDate(entry.date);
                    const rowNo = (safePage - 1) * PAGE_SIZE + idx + 1;
                    const proctorSummary = resolveSyncedProctors(
                      entry.date,
                      [entry],
                      entry.time,
                      entry.pengawas,
                    );
                    return (
                      <tr key={entry.id} className="hover:bg-[#F7FAFF] transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-[#475569] tabular-nums">
                          {rowNo}
                        </td>
                        <td className="py-2.5 px-3 leading-snug">
                          {dayLabel && (
                            <div className="text-[11px] text-[#64748B]">{dayLabel}</div>
                          )}
                          <div className="font-semibold text-[#0F172A]">{dateLabel}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#0F295C]">
                          {entry.subject}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#1D4ED8]">
                          {perClassTarget}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#1E293B] whitespace-nowrap">
                          {entry.time}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#334155] whitespace-nowrap">
                          {entry.ruangLabel}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[#334155] whitespace-nowrap"
                          title={proctorSummary.tooltip}
                        >
                          <span
                            className={
                              proctorSummary.synced
                                ? 'font-mono font-semibold text-[#1D4ED8]'
                                : 'text-[#334155]'
                            }
                          >
                            {proctorSummary.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const next: ScheduleStatus =
                                entry.status === 'Aktif' ? 'Ditunda' : 'Aktif';
                              onToggleStatus([entry.id], next);
                            }}
                            className={`inline-flex items-center justify-center min-w-[66px] px-2.5 py-1 rounded-md text-[11px] font-bold text-white ${
                              entry.status === 'Aktif' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                            }`}
                          >
                            {entry.status}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'detail',
                                  title: `Kartu Kelas ${perClassTarget} — ${entry.subject}`,
                                  date: entry.date,
                                  time: entry.time,
                                  subject: entry.subject,
                                  classes: entry.classes,
                                  kelasLabel: entry.kelasLabel,
                                  ruangLabel: entry.ruangLabel,
                                  pengawas: proctorSummary.label,
                                  status: entry.status,
                                  entryIds: [entry.id],
                                  entries: [entry],
                                })
                              }
                              className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditEntryModal(entry)}
                              className="w-7 h-7 rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: 'confirmDelete',
                                  title: `Hapus Jadwal "${entry.subject}"?`,
                                  subtitle: `${entry.date} (${entry.time}) · Sasaran: ${entry.kelasLabel}.`,
                                  entryIds: [entry.id],
                                })
                              }
                              className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {totalFilteredCount === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 px-4 text-center text-[#64748B]">
                      <div className="font-semibold text-[#1E293B] mb-1">
                        Tidak ada jadwal ulangan yang cocok
                      </div>
                      <p className="text-xs mb-3">
                        Coba ubah kata kunci pencarian atau tambah jadwal gabungan baru.
                      </p>
                      <button
                        type="button"
                        onClick={() => openCreateModal('ALL')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah Jadwal Gabungan
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination matching screenshot */}
          <div className="px-5 py-3 border-t border-[#E8EFF8] bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-[#334155]">
              Menampilkan{' '}
              <strong className="font-bold text-[#0F295C]">
                {showFrom} – {showTo}
              </strong>{' '}
              dari <strong className="font-bold text-[#0F295C]">{totalFilteredCount}</strong> data
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(1)}
                className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                aria-label="Halaman pertama"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {visiblePageNumbers.map((pageNo) => (
                <button
                  key={pageNo}
                  type="button"
                  onClick={() => setCurrentPage(pageNo)}
                  className={`w-7 h-7 rounded-md text-xs font-bold transition-colors ${
                    pageNo === safePage
                      ? 'bg-[#2563EB] text-white border border-[#2563EB] shadow-2xs'
                      : 'border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#334155]'
                  }`}
                >
                  {pageNo}
                </button>
              ))}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                aria-label="Halaman terakhir"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR COLUMN */}
        <aside className="space-y-4">
          {/* 1. Kalender Ulangan */}
          <div className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8EFF8] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1D4ED8]" />
              <h3 className="font-display font-bold text-sm text-[#0F295C]">
                Kalender Ulangan
              </h3>
            </div>

            <div className="p-4">
              {/* Month Switcher */}
              <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="w-6 h-6 rounded-md hover:bg-white text-[#475569] flex items-center justify-center"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-display font-bold text-xs text-[#0F295C]">
                  {MONTH_NAMES_ID[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="w-6 h-6 rounded-md hover:bg-white text-[#475569] flex items-center justify-center"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold text-[#475569] mb-1.5">
                {WEEKDAY_HEADERS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
                {calendarCells.map((cell) => {
                  const info = examDateStatsMap.get(cell.iso);
                  const isSelectedFilter = selectedDayIso === cell.iso;
                  const isHighlightCircle =
                    isSelectedFilter || (!selectedDayIso && activeCalDateIso === cell.iso && info);
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => handleCalendarDayClick(cell.iso)}
                      title={
                        info
                          ? `${formatIndonesianDateLong(cell.iso)} — ${info.count} jadwal ujian (klik untuk filter)`
                          : formatIndonesianDateLong(cell.iso)
                      }
                      className={`relative h-8 flex flex-col items-center justify-center rounded-full text-xs transition-colors ${
                        isHighlightCircle
                          ? 'bg-[#1D4ED8] text-white font-bold shadow-xs'
                          : cell.inMonth
                            ? info
                              ? 'text-[#0F295C] font-bold hover:bg-[#EFF6FF]'
                              : 'text-[#334155] hover:bg-[#F1F5F9]'
                            : 'text-[#CBD5E1]'
                      }`}
                    >
                      <span className="leading-none">{cell.day}</span>
                      {info && !isHighlightCircle && (
                        <span
                          className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                            info.hasAktif
                              ? info.hasCombined
                                ? 'bg-[#2563EB]'
                                : 'bg-[#F59E0B]'
                              : 'bg-[#94A3B8]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDayIso && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayIso('');
                    setCurrentPage(1);
                  }}
                  className="mt-3 w-full py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-bold transition-colors"
                >
                  Tampilkan Semua Tanggal
                </button>
              )}
            </div>
          </div>

          {/* 2. Informasi Penting (Mint Green Card) */}
          <div className="rounded-2xl bg-[#E7F9F0] border border-[#B6EBD4] p-4 shadow-[0_3px_12px_rgba(16,185,129,0.06)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-display font-bold text-sm text-[#064E3B]">
                Informasi Penting
              </h3>
            </div>

            <ul className="space-y-2.5 text-xs text-[#0F295C]">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="leading-snug font-medium">
                  Ulangan Semester Ganjil Tahun Pelajaran <strong>{academicYear}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="leading-snug font-medium">
                  Dimulai: <strong>{firstExamDateLabel}</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="leading-snug font-medium">
                  Berakhir: <strong>{lastExamDateLabel}</strong>
                </span>
              </li>
            </ul>
          </div>

          {/* 3. Sukses Ulangan Trophy Banner */}
          <div
            className="relative rounded-2xl p-4 text-white overflow-hidden shadow-[0_6px_18px_rgba(16,70,162,0.22)]"
            style={{
              background: 'linear-gradient(125deg, #1E64D8 0%, #10429C 60%, #092B6B 100%)',
            }}
          >
            <div className="absolute -right-4 -bottom-5 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-[#FACC15]" />
              </div>
              <div>
                <div className="font-display font-extrabold text-base leading-tight text-white">
                  Sukses Ulangan
                </div>
                <div className="font-display font-extrabold text-sm text-[#FACC15] italic mt-0.5">
                  Raih Prestasi Terbaik!
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* TAMBAH / EDIT JADWAL MODAL */}
      {modal?.type === 'form' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <h3 className="font-display font-bold text-base text-[#0F295C]">
                  {modal.mode === 'edit'
                    ? 'Edit Jadwal Ulangan'
                    : 'Tambah Jadwal Ulangan Baru'}
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Perubahan otomatis tersinkron ke Kartu PAS (2D/3D/PDF/ZIP), Absen, Ruang &amp; Pengawas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] font-semibold">
                  {formError}
                </div>
              )}

              {/* Sasaran Kelas (Gabungan Semua Kelas vs Jenjang vs Kustom) */}
              <div>
                <label className="block font-bold text-[#0F295C] mb-1.5">
                  Sasaran Kelas Ujian
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                  {(
                    [
                      ['ALL', `Gabungan Semua Kelas (${knownClasses.length})`],
                      ['X', 'Semua Kelas X'],
                      ['XI', 'Semua Kelas XI'],
                      ['XII', 'Semua Kelas XII'],
                      ['CUSTOM', 'Pilih Kelas Spesifik'],
                    ] as Array<[ScheduleTargetPreset, string]>
                  ).map(([presetKey, label]) => (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleFormPresetChange(presetKey)}
                      className={`px-2.5 py-2 rounded-lg border text-left font-semibold transition-all ${
                        formState.targetPreset === presetKey
                          ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white shadow-2xs'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                      } ${presetKey === 'ALL' ? 'col-span-2 sm:col-span-2' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {formState.targetPreset === 'CUSTOM' ? (
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
                    {knownClasses.map((k) => {
                      const checked = formState.selectedClasses.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleToggleCustomClass(k)}
                          className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                            checked
                              ? 'bg-[#2563EB] border-[#2563EB] text-white'
                              : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#EFF6FF]'
                          }`}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#1D4ED8] bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg px-3 py-1.5 font-medium">
                    Mencakup {formState.selectedClasses.length} kelas:{' '}
                    {formState.selectedClasses.slice(0, 8).join(', ')}
                    {formState.selectedClasses.length > 8
                      ? ` ... +${formState.selectedClasses.length - 8} lainnya`
                      : ''}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    value={formState.isoDate}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, isoDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono focus:outline-none focus:border-[#2563EB]"
                  />
                  <div className="text-[10.5px] text-[#64748B] mt-1">
                    Format cetak:{' '}
                    <strong>
                      {parseIndonesianDate(formState.isoDate)
                        ? formatIndonesianDate(parseIndonesianDate(formState.isoDate)!)
                        : '-'}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    list="pas-subject-suggestions"
                    value={formState.subject}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, subject: e.target.value }))
                    }
                    placeholder="Contoh: Matematika Wajib"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                  <datalist id="pas-subject-suggestions">
                    {subjectSuggestions.map((subj) => (
                      <option key={subj} value={subj} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#0F295C]">Waktu Pelaksanaan</label>
                  <span className="text-[10.5px] text-[#64748B]">Pilih cepat atau ketik manual</span>
                </div>
                <input
                  type="text"
                  value={formState.time}
                  onChange={(e) => setFormState((prev) => ({ ...prev, time: e.target.value }))}
                  placeholder="07.00 – 09.00"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono focus:outline-none focus:border-[#2563EB] mb-1.5"
                />
                <div className="flex flex-wrap gap-1.5">
                  {TIME_PRESETS.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, time: tp }))}
                      className={`px-2 py-0.5 rounded-md border font-mono text-[10.5px] ${
                        formState.time === tp
                          ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Ruang Ujian</label>
                  <input
                    type="text"
                    value={formState.ruangLabel}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, ruangLabel: e.target.value }))
                    }
                    placeholder="R. 01 – 10"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Pengawas</label>
                  <select
                    value={formState.pengawas}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, pengawas: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    {supervisorOptions.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: e.target.value as ScheduleStatus,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="Aktif">Aktif (Tampil di Kartu)</option>
                    <option value="Ditunda">Ditunda</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-bold shadow-xs"
                >
                  {modal.mode === 'edit' ? 'Simpan Perubahan' : 'Simpan & Sinkronkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (EYE BUTTON) */}
      {modal?.type === 'detail' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-display font-bold text-base text-[#0F295C]">
                {modal.title}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5">
                <div>
                  <div className="text-[10.5px] text-[#64748B]">Hari / Tanggal</div>
                  <div className="font-bold text-[#0F295C] mt-0.5">{modal.date}</div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#64748B]">Waktu Pelaksanaan</div>
                  <div className="font-mono font-bold text-[#0F295C] mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
                    {modal.time}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#64748B]">Ruang &amp; Pengawas</div>
                  <div className="font-semibold text-[#1E293B] mt-0.5">
                    {modal.ruangLabel} · {modal.pengawas}
                  </div>
                </div>
                <div>
                  <div className="text-[10.5px] text-[#64748B]">Peserta Terdampak</div>
                  <div className="font-bold text-[#059669] mt-0.5">
                    {countImpactedStudents(modal.classes)} siswa ({modal.classes.length} kelas)
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold text-[#0F295C] mb-1.5">
                  Kelas Tercakup ({modal.kelasLabel})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {modal.classes.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setModal(null);
                        onInspectClassCard(k);
                      }}
                      className="px-2.5 py-1 rounded-md bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#1D4ED8] font-semibold text-[11px]"
                      title={`Buka Kartu PAS kelas ${k}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {modal.entries.length > 1 && (
                <div>
                  <div className="font-bold text-[#0F295C] mb-1.5">
                    Rincian Sesi / Shift Waktu
                  </div>
                  <div className="space-y-1.5">
                    {modal.entries.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white"
                      >
                        <div>
                          <span className="font-bold text-[#0F295C]">{sub.kelasLabel}</span>
                          <span className="mx-2 text-[#CBD5E1]">|</span>
                          <span className="font-mono text-[#334155]">{sub.time}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                            sub.status === 'Aktif' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const slotProctors = resolveSyncedProctors(
                  modal.date,
                  modal.entries,
                  modal.time,
                  modal.pengawas,
                );
                if (!slotProctors.synced || slotProctors.shifts.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="font-bold text-[#0F295C] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        Pengawas Bertugas per Ruang (Tersinkron)
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModal(null);
                          onNavigateTab('proctor');
                        }}
                        className="text-[11px] font-bold text-[#1D4ED8] hover:underline"
                      >
                        Atur di Pengawas Ujian →
                      </button>
                    </div>
                    <div className="space-y-2">
                      {slotProctors.shifts.map((shift) => (
                        <div
                          key={shift.time}
                          className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5"
                        >
                          <div className="text-[10.5px] font-bold text-[#475569] flex items-center justify-between">
                            <span>
                              Shift {shift.time} WITA{shift.kelasLabel ? ` (${shift.kelasLabel})` : ''}
                            </span>
                            <span>{shift.assignments.length} ruang</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {shift.assignments.map((a) => (
                              <div
                                key={`${shift.time}-${a.roomNo}`}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-[#E2E8F0] text-[11px]"
                              >
                                <span className="font-mono font-bold text-[#1D4ED8] shrink-0">
                                  {a.roomLabel}
                                </span>
                                <span className="px-1 py-0.2 rounded bg-[#EFF6FF] font-mono font-bold text-[#0F295C] shrink-0">
                                  {String(a.code).padStart(2, '0')}
                                </span>
                                <span className="truncate text-[#334155]">{a.nama}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const firstTime = modal.entries[0]?.time ?? modal.time;
                    setModal(null);
                    onUseScheduleForAttendance({
                      subject: modal.subject,
                      date: modal.date,
                      time: firstTime,
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#93C5FD] text-[#1D4ED8] font-bold"
                >
                  Pakai Sesi di Daftar Hadir
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = modal.classes[0] || 'X1';
                      setModal(null);
                      onInspectClassCard(target);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold"
                  >
                    Lihat Kartu Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-UI DELETE CONFIRMATION MODAL */}
      {modal?.type === 'confirmDelete' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#0F295C]">
                    {modal.title}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">{modal.subtitle}</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteEntries(modal.entryIds);
                    flashNotice('Jadwal dihapus & langsung tersinkron ke seluruh perangkat PAS.');
                    setModal(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold"
                >
                  Ya, Hapus Jadwal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
