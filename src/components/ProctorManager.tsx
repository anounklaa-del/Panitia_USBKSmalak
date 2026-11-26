import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  DoorOpen,
  Eraser,
  Eye,
  Grid3X3,
  Home,
  Megaphone,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Undo2,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import type {
  ProctorMatrixSession,
  ProctorRecord,
  ProctorStatus,
} from '../data/proctorData';
import type { MainWorkspaceTab } from '../types/prepress';
import { compareNumericStrings, normalizeRoomLabel } from '../utils/deskStickerBuilder';
import {
  areMatricesEqual,
  computeSessionRoomActiveFlags,
  describeMatrixSession,
  getProctorDutyList,
  matchSubjectsForSlot,
  PROCTOR_MATRIX_STORAGE_KEY,
  PROCTORS_STORAGE_KEY,
  type ProctorDutyItem,
} from '../utils/proctorStore';
import {
  formatIndonesianDateLong,
  parseStartMinutes,
  toIsoDateKey,
  type ExamScheduleEntry,
} from '../utils/scheduleStore';
import { CommitteeAvatar, type AvatarVariant } from './CommitteeAvatars';
import type { ProctorPrintMode } from './ProctorRosterPrintRenderer';

interface ProctorManagerProps {
  proctors: ProctorRecord[];
  matrix: ProctorMatrixSession[];
  schedulesMap: Record<string, ScheduleRow[]>;
  scheduleEntries: ExamScheduleEntry[];
  students: StudentRecord[];
  academicYear: string;
  onAddProctor: (proctor: ProctorRecord) => void;
  onUpdateProctor: (id: string, updated: ProctorRecord) => void;
  onToggleProctorStatus: (id: string, nextStatus: ProctorStatus) => void;
  onDeleteProctor: (id: string) => void;
  onUpdateMatrixSlot: (sessionId: string, roomIdx: number, proctorCode: number | null) => void;
  onUpdateMatrix: (nextMatrix: ProctorMatrixSession[]) => void;
  onResyncFromSchedule: () => void;
  onResetAll: () => void;
  onPrintProctors: (opts: {
    mode: ProctorPrintMode;
    proctors: ProctorRecord[];
    matrix: ProctorMatrixSession[];
    filterSummary?: string;
  }) => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

type ProctorViewMode = 'list' | 'matrix' | 'edit_matrix';

function groupMatrixByDay(sessions: ProctorMatrixSession[]) {
  const sorted = [...sessions].sort((a, b) => {
    const isoA = toIsoDateKey(a.date);
    const isoB = toIsoDateKey(b.date);
    if (isoA !== isoB) return isoA.localeCompare(isoB);
    return parseStartMinutes(a.time) - parseStartMinutes(b.time);
  });

  const groups: Array<{
    dayNo: number;
    dayLabel: string;
    date: string;
    shortDate: string;
    iso: string;
    sessions: ProctorMatrixSession[];
  }> = [];
  for (const s of sorted) {
    const iso = toIsoDateKey(s.date);
    let g = groups.find((x) => x.iso === iso);
    if (!g) {
      g = {
        dayNo: groups.length + 1,
        dayLabel: s.dayLabel,
        date: s.date,
        shortDate: s.shortDate,
        iso,
        sessions: [],
      };
      groups.push(g);
    }
    g.sessions.push(s);
  }
  return groups;
}

type ActiveModal =
  | null
  | { type: 'form'; editing?: ProctorRecord }
  | { type: 'detail'; proctor: ProctorRecord }
  | { type: 'matrixSlot'; session: ProctorMatrixSession; roomIdx: number }
  | { type: 'confirmDelete'; proctor: ProctorRecord };

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

export const ProctorManager: React.FC<ProctorManagerProps> = ({
  proctors,
  matrix,
  schedulesMap,
  scheduleEntries,
  students,
  academicYear,
  onAddProctor,
  onUpdateProctor,
  onToggleProctorStatus,
  onDeleteProctor,
  onUpdateMatrixSlot,
  onUpdateMatrix,
  onResyncFromSchedule,
  onResetAll,
  onPrintProctors,
  onNavigateTab,
}) => {
  const [viewMode, setViewMode] = useState<ProctorViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ProctorStatus>('');
  const [selectedDayIso, setSelectedDayIso] = useState<string>('');
  const [selectedRoomNo, setSelectedRoomNo] = useState<string>('');
  const [highlightedCode, setHighlightedCode] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Draft state for Edit Matriks Tugas mode
  const [draftMatrix, setDraftMatrix] = useState<ProctorMatrixSession[]>(() => matrix);
  const [swapCodeA, setSwapCodeA] = useState<number>(1);
  const [swapCodeB, setSwapCodeB] = useState<number>(2);
  const [replaceFromCode, setReplaceFromCode] = useState<number>(1);
  const [replaceToCode, setReplaceToCode] = useState<string>('');
  const [bulkScope, setBulkScope] = useState<'all' | 'filtered'>('all');

  useEffect(() => {
    setDraftMatrix(matrix);
  }, [matrix]);

  // Calendar defaults to November 2026 (where PAS Day 1 = 30 Nov 2026 starts)
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(10); // 10 = November
  const [activeCalDateIso, setActiveCalDateIso] = useState('2026-11-30');

  const [modal, setModal] = useState<ActiveModal>(null);
  const [formCode, setFormCode] = useState<number>(38);
  const [formNama, setFormNama] = useState('');
  const [formNip, setFormNip] = useState('');
  const [formStatus, setFormStatus] = useState<ProctorStatus>('Aktif');
  const [formAvatar, setFormAvatar] = useState<AvatarVariant>('sekretaris');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 4000);
  };

  const sortedProctors = useMemo(
    () => [...proctors].sort((a, b) => a.code - b.code),
    [proctors],
  );

  const proctorByCode = useMemo(() => {
    const map = new Map<number, ProctorRecord>();
    for (const p of proctors) map.set(p.code, p);
    return map;
  }, [proctors]);

  // Unique exam days from matrix (strictly chronological & sequentially numbered 1..N)
  const examDays = useMemo(() => {
    const map = new Map<string, { date: string; shortDate: string }>();
    for (const s of matrix) {
      const iso = toIsoDateKey(s.date);
      if (!map.has(iso)) {
        map.set(iso, { date: s.date, shortDate: s.shortDate });
      }
    }
    return [...map.entries()]
      .sort(([isoA], [isoB]) => isoA.localeCompare(isoB))
      .map(([iso, val], idx) => ({ iso, dayNo: idx + 1, ...val }));
  }, [matrix]);

  // Map each proctor code to their duties (full & filtered by selectedDayIso/selectedRoomNo)
  const fullDutiesByCode = useMemo(() => {
    const map = new Map<number, ProctorDutyItem[]>();
    for (const p of proctors) {
      map.set(p.code, getProctorDutyList(p.code, matrix, schedulesMap, undefined, undefined, students));
    }
    return map;
  }, [proctors, matrix, schedulesMap, students]);

  const filteredProctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const roomFilterNum = selectedRoomNo ? Number(selectedRoomNo) : undefined;

    return sortedProctors.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;

      if (q) {
        const hit =
          p.nama.toLowerCase().includes(q) ||
          String(p.code).includes(q) ||
          `kode ${p.code}`.includes(q) ||
          (p.nip ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (selectedDayIso || roomFilterNum) {
        const matchingDuties = getProctorDutyList(
          p.code,
          matrix,
          schedulesMap,
          selectedDayIso || undefined,
          roomFilterNum,
          students,
        );
        if (matchingDuties.length === 0) return false;
      }
      return true;
    });
  }, [sortedProctors, searchQuery, statusFilter, selectedDayIso, selectedRoomNo, matrix, schedulesMap, students]);

  const totalPages = Math.max(1, Math.ceil(filteredProctors.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedProctors = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredProctors.slice(start, start + PAGE_SIZE);
  }, [filteredProctors, safePage]);

  // KPI metrics
  const kpiStats = useMemo(() => {
    const active = proctors.filter((p) => p.status === 'Aktif').length;
    const inactive = proctors.length - active;
    return {
      total: proctors.length,
      active,
      inactive,
      days: examDays.length,
    };
  }, [proctors, examDays.length]);

  const scheduleRangeInfo = useMemo(() => {
    const dateRange =
      examDays.length === 0
        ? '-'
        : examDays.length === 1
          ? formatIndonesianDateLong(examDays[0].iso)
          : `${examDays[0].shortDate} – ${examDays[examDays.length - 1].shortDate}`;

    let minStart = Infinity;
    let maxEndStr = '15.30';
    let minStartStr = '08.00';
    let maxEnd = -1;
    for (const s of matrix) {
      const sMin = parseStartMinutes(s.time);
      const parts = s.time.split(/[-–—]/).map((x) => x.trim());
      if (sMin < minStart && parts[0]) {
        minStart = sMin;
        minStartStr = parts[0];
      }
      if (parts[1]) {
        const eMin = parseStartMinutes(parts[1]);
        if (eMin > maxEnd) {
          maxEnd = eMin;
          maxEndStr = parts[1];
        }
      }
    }
    return {
      dateRange,
      timeRange: matrix.length > 0 ? `${minStartStr} – ${maxEndStr} WITA` : '-',
      sessionCount: matrix.length,
    };
  }, [examDays, matrix]);

  const isCustomized = useMemo(() => {
    try {
      return Boolean(
        localStorage.getItem(PROCTORS_STORAGE_KEY) ||
          localStorage.getItem(PROCTOR_MATRIX_STORAGE_KEY),
      );
    } catch {
      return false;
    }
  }, [proctors, matrix]);

  // Matrix filtered by selectedDayIso
  const filteredMatrix = useMemo(() => {
    if (!selectedDayIso) return matrix;
    return matrix.filter((s) => toIsoDateKey(s.date) === selectedDayIso);
  }, [matrix, selectedDayIso]);

  const matrixDayGroups = useMemo(() => groupMatrixByDay(filteredMatrix), [filteredMatrix]);

  const filteredDraftMatrix = useMemo(() => {
    if (!selectedDayIso) return draftMatrix;
    return draftMatrix.filter((s) => toIsoDateKey(s.date) === selectedDayIso);
  }, [draftMatrix, selectedDayIso]);

  const draftDayGroups = useMemo(
    () => groupMatrixByDay(filteredDraftMatrix),
    [filteredDraftMatrix],
  );

  const hasUnsavedMatrixChanges = useMemo(
    () => !areMatricesEqual(draftMatrix, matrix),
    [draftMatrix, matrix],
  );

  // Map roomNo (1..10) -> Set of classes sitting in that room
  const roomClassesMap = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (let r = 1; r <= 10; r++) map.set(r, new Set());
    for (const st of students) {
      const rNum = Number(normalizeRoomLabel(st.ruang).replace(/\D/g, ''));
      if (rNum >= 1 && rNum <= 10 && st.kelas.trim()) {
        map.get(rNum)!.add(st.kelas.trim());
      }
    }
    return map;
  }, [students]);

  const getSessionRoomActiveFlags = useMemo(() => {
    return (sess: ProctorMatrixSession): boolean[] => {
      const iso = toIsoDateKey(sess.date);
      const startMin = parseStartMinutes(sess.time);
      const activeClasses = new Set<string>();
      for (const e of scheduleEntries) {
        if (e.status !== 'Aktif') continue;
        if (toIsoDateKey(e.date) !== iso) continue;
        if (Math.abs(parseStartMinutes(e.time) - startMin) > 15) continue;
        for (const c of e.classes) {
          if (c.trim()) activeClasses.add(c.trim());
        }
      }
      return computeSessionRoomActiveFlags(activeClasses, roomClassesMap);
    };
  }, [scheduleEntries, roomClassesMap]);

  const draftStats = useMemo(() => {
    const savedById = new Map(matrix.map((s) => [s.id, s]));
    let modifiedCount = 0;
    let missingActiveCount = 0;
    const conflictCellKeys = new Set<string>();
    const conflicts: Array<{
      sessionId: string;
      dayNo: number;
      shortDate: string;
      time: string;
      code: number;
      roomNumbers: number[];
    }> = [];

    for (const sess of draftMatrix) {
      const saved = savedById.get(sess.id);
      const activeFlags = getSessionRoomActiveFlags(sess);
      const codeToRooms = new Map<number, number[]>();

      sess.rooms.forEach((code, rIdx) => {
        if (saved && saved.rooms[rIdx] !== code) {
          modifiedCount++;
        }
        if (activeFlags[rIdx] && (code === null || code === undefined)) {
          missingActiveCount++;
        }
        if (code !== null && code !== undefined) {
          const arr = codeToRooms.get(code) ?? [];
          arr.push(rIdx + 1);
          codeToRooms.set(code, arr);
        }
      });

      for (const [code, roomNums] of codeToRooms.entries()) {
        if (roomNums.length >= 2) {
          conflicts.push({
            sessionId: sess.id,
            dayNo: sess.dayNo,
            shortDate: sess.shortDate,
            time: sess.time,
            code,
            roomNumbers: roomNums,
          });
          for (const rNum of roomNums) {
            conflictCellKeys.add(`${sess.id}:${rNum - 1}`);
          }
        }
      }
    }

    return {
      modifiedCount,
      missingActiveCount,
      conflicts,
      conflictCellKeys,
    };
  }, [draftMatrix, matrix, getSessionRoomActiveFlags]);

  const handleUpdateDraftCell = (sessionId: string, roomIdx: number, proctorCode: number | null) => {
    setDraftMatrix((prev) =>
      prev.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const nextRooms = [...sess.rooms];
        nextRooms[roomIdx] = proctorCode;
        return { ...sess, rooms: nextRooms };
      }),
    );
  };

  const handleSwapCodesInDraft = () => {
    if (swapCodeA === swapCodeB) {
      flashNotice('Pilih dua kode pengawas yang berbeda untuk ditukar.');
      return;
    }
    const filterIso = bulkScope === 'filtered' && selectedDayIso ? selectedDayIso : '';
    let swappedCount = 0;
    setDraftMatrix((prev) =>
      prev.map((sess) => {
        if (filterIso && toIsoDateKey(sess.date) !== filterIso) return sess;
        let touched = false;
        const nextRooms = sess.rooms.map((c) => {
          if (c === swapCodeA) {
            touched = true;
            swappedCount++;
            return swapCodeB;
          }
          if (c === swapCodeB) {
            touched = true;
            swappedCount++;
            return swapCodeA;
          }
          return c;
        });
        return touched ? { ...sess, rooms: nextRooms } : sess;
      }),
    );
    flashNotice(
      swappedCount > 0
        ? `Kode ${swapCodeA} dan ${swapCodeB} ditukar pada ${swappedCount} slot (klik Simpan Matriks untuk menerapkan ke Cloud).`
        : `Tidak ditemukan jadwal Kode ${swapCodeA} atau ${swapCodeB} pada cakupan yang dipilih.`,
    );
  };

  const handleReplaceCodeInDraft = () => {
    const targetCode = replaceToCode ? Number(replaceToCode) : null;
    if (targetCode === replaceFromCode) {
      flashNotice('Kode sumber dan kode pengganti sama.');
      return;
    }
    const filterIso = bulkScope === 'filtered' && selectedDayIso ? selectedDayIso : '';
    let changedCount = 0;
    setDraftMatrix((prev) =>
      prev.map((sess) => {
        if (filterIso && toIsoDateKey(sess.date) !== filterIso) return sess;
        let touched = false;
        const nextRooms = sess.rooms.map((c) => {
          if (c === replaceFromCode) {
            touched = true;
            changedCount++;
            return targetCode;
          }
          return c;
        });
        return touched ? { ...sess, rooms: nextRooms } : sess;
      }),
    );
    flashNotice(
      changedCount > 0
        ? `Kode ${replaceFromCode} diganti ${targetCode !== null ? `ke Kode ${targetCode}` : '(Dikosongkan)'} pada ${changedCount} slot (klik Simpan Matriks untuk menerapkan).`
        : `Kode ${replaceFromCode} tidak ditemukan pada cakupan yang dipilih.`,
    );
  };

  const handleAutoFillEmptyInDraft = (targetSessionId?: string) => {
    const activePool = sortedProctors.filter((p) => p.status === 'Aktif');
    const pool = activePool.length > 0 ? activePool : sortedProctors;
    if (pool.length === 0) return;

    const filterIso =
      !targetSessionId && bulkScope === 'filtered' && selectedDayIso ? selectedDayIso : '';
    let filledCount = 0;
    let cursor = 0;

    setDraftMatrix((prev) =>
      prev.map((sess) => {
        if (targetSessionId && sess.id !== targetSessionId) return sess;
        if (filterIso && toIsoDateKey(sess.date) !== filterIso) return sess;

        const activeFlags = getSessionRoomActiveFlags(sess);
        const used = new Set<number>();
        sess.rooms.forEach((c) => {
          if (c !== null && c !== undefined) used.add(c);
        });

        let touched = false;
        const nextRooms = sess.rooms.map((c, rIdx) => {
          if (!activeFlags[rIdx] || c !== null) return c;
          let chosen: number | null = null;
          for (let tries = 0; tries < pool.length; tries++) {
            const candidate = pool[(cursor + tries) % pool.length].code;
            if (!used.has(candidate)) {
              chosen = candidate;
              cursor = (cursor + tries + 1) % pool.length;
              break;
            }
          }
          if (chosen === null) {
            chosen = pool[cursor % pool.length].code;
            cursor = (cursor + 1) % pool.length;
          }
          used.add(chosen);
          touched = true;
          filledCount++;
          return chosen;
        });

        return touched ? { ...sess, rooms: nextRooms } : sess;
      }),
    );

    flashNotice(
      filledCount > 0
        ? `${filledCount} ruang ujian kosong diisi otomatis tanpa bentrok sesi (klik Simpan Matriks untuk menyimpan).`
        : 'Semua ruang ujian aktif pada cakupan ini sudah memiliki pengawas.',
    );
  };

  const handleClearSessionRoomsInDraft = (sessionId: string) => {
    setDraftMatrix((prev) =>
      prev.map((sess) =>
        sess.id === sessionId ? { ...sess, rooms: Array(10).fill(null) } : sess,
      ),
    );
    flashNotice('Slot pengawas pada sesi tersebut dikosongkan di draft.');
  };

  const handleSaveDraftMatrix = () => {
    onUpdateMatrix(draftMatrix);
    flashNotice('Perubahan Matriks Tugas berhasil disimpan & disinkronkan ke Cloud.');
  };

  const handleDiscardDraftMatrix = () => {
    setDraftMatrix(matrix);
    flashNotice('Perubahan draft matriks dibatalkan.');
  };

  // Calendar grid for current calYear/calMonth
  const examDateSet = useMemo(() => new Set(examDays.map((d) => d.iso)), [examDays]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(calYear, calMonth, 1 - startWeekday);
    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({ iso, day: d.getDate(), inMonth: d.getMonth() === calMonth });
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
    } else if (examDateSet.has(iso)) {
      setSelectedDayIso(iso);
      setCurrentPage(1);
    }
  };

  const openCreateModal = () => {
    const nextCode =
      sortedProctors.length > 0
        ? Math.max(...sortedProctors.map((p) => p.code)) + 1
        : 1;
    setFormError(null);
    setFormCode(nextCode);
    setFormNama('');
    setFormNip('');
    setFormStatus('Aktif');
    setFormAvatar('sekretaris');
    setModal({ type: 'form' });
  };

  const openEditModal = (p: ProctorRecord) => {
    setFormError(null);
    setFormCode(p.code);
    setFormNama(p.nama);
    setFormNip(p.nip ?? '');
    setFormStatus(p.status);
    setFormAvatar(p.avatarVariant);
    setModal({ type: 'form', editing: p });
  };

  const handleSubmitForm = (ev: React.FormEvent) => {
    ev.preventDefault();
    const cleanName = formNama.trim();
    if (!cleanName) {
      setFormError('Nama pengawas wajib diisi.');
      return;
    }
    const cleanCode = Number(formCode);
    if (!cleanCode || cleanCode < 1) {
      setFormError('Kode pengawas harus angka positif (1, 2, 3...).');
      return;
    }

    const editingId = modal?.type === 'form' ? modal.editing?.id : undefined;
    const duplicateCode = proctors.some(
      (p) => p.code === cleanCode && p.id !== editingId,
    );
    if (duplicateCode) {
      setFormError(`Kode Pengawas ${cleanCode} sudah digunakan pengawas lain.`);
      return;
    }

    if (modal?.type === 'form' && modal.editing) {
      const updated: ProctorRecord = {
        ...modal.editing,
        code: cleanCode,
        nama: cleanName,
        nip: formNip.trim() || undefined,
        status: formStatus,
        avatarVariant: formAvatar,
      };
      onUpdateProctor(modal.editing.id, updated);
      flashNotice(`Data pengawas Kode ${cleanCode} (${cleanName}) diperbarui.`);
    } else {
      const created: ProctorRecord = {
        id: `prg-${Date.now()}`,
        code: cleanCode,
        nama: cleanName,
        nip: formNip.trim() || undefined,
        status: formStatus,
        avatarVariant: formAvatar,
      };
      onAddProctor(created);
      flashNotice(`Pengawas baru Kode ${cleanCode} (${cleanName}) ditambahkan.`);
    }
    setModal(null);
  };

  // Helper to get summary strings for a proctor row in Daftar Pengawas
  const summarizeRowDuties = (code: number) => {
    const roomFilterNum = selectedRoomNo ? Number(selectedRoomNo) : undefined;
    const matching = getProctorDutyList(
      code,
      matrix,
      schedulesMap,
      selectedDayIso || undefined,
      roomFilterNum,
      students,
    );
    const allDuties = fullDutiesByCode.get(code) ?? matching;
    const list = matching.length > 0 ? matching : allDuties;
    const uniqueRooms = [...new Set(list.map((d) => d.roomLabel))].sort(compareNumericStrings);
    const uniqueSubjects = [...new Set(list.flatMap((d) => d.subjects))];
    const roomSummary =
      uniqueRooms.length === 0
        ? '-'
        : uniqueRooms.join(', ');
    const subjectSummary =
      uniqueSubjects.length === 0
        ? 'Sesuai Jadwal PAS'
        : uniqueSubjects.join(', ');

    return {
      totalShifts: allDuties.length,
      filteredShifts: matching.length,
      roomSummary,
      roomTooltip: uniqueRooms.join(', '),
      subjectSummary,
      subjectTooltip: uniqueSubjects.join(', '),
    };
  };

  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [safePage, totalPages]);

  const showFrom = filteredProctors.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(filteredProctors.length, safePage * PAGE_SIZE);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Top Royal-Blue Header Banner matching Exam_Proctor_Dashboard_Interface_aa02adbf.png */}
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
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-white">
                Pengawas Ujian
              </h1>
              <p className="text-xs sm:text-[13px] italic text-[#DCE8FF] mt-0.5">
                Kelola data pengawas ujian dengan mudah dan terstruktur
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
            <span className="text-white font-semibold">Pengawas Ujian</span>
          </nav>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-semibold shadow-2xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 rounded hover:bg-[#D1FAE5] text-[#047857]"
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
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#0F295C] tabular-nums leading-tight">
              {kpiStats.total}
            </div>
            <div className="text-xs font-semibold text-[#1E3A8A]">Total Pengawas</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#AEE7CB] px-4 py-3.5 shadow-[0_3px_12px_rgba(16,185,129,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #E8FAF1 0%, #CFF4E2 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#A7F3D0] flex items-center justify-center text-[#059669] shrink-0 shadow-2xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#064E3B] tabular-nums leading-tight">
              {kpiStats.active}
            </div>
            <div className="text-xs font-semibold text-[#047857]">Aktif</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#FBC4D2] px-4 py-3.5 shadow-[0_3px_12px_rgba(225,29,72,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #FFF0F3 0%, #FFDDE6 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#FECDD3] flex items-center justify-center text-[#E11D48] shrink-0 shadow-2xs">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#881337] tabular-nums leading-tight">
              {kpiStats.inactive}
            </div>
            <div className="text-xs font-semibold text-[#BE123C]">Tidak Aktif</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-[#FACBA2] px-4 py-3.5 shadow-[0_3px_12px_rgba(234,88,12,0.06)] flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #FFF2E6 0%, #FFE3C8 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/80 border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shrink-0 shadow-2xs">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-extrabold text-2xl text-[#7C2D12] tabular-nums leading-tight">
              {kpiStats.days}
            </div>
            <div className="text-xs font-semibold text-[#C2410C]">Hari Pelaksanaan</div>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
        {/* LEFT SECTION */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header Row with View Mode Switcher */}
          <div className="px-5 pt-4 pb-3 border-b border-[#E8EFF8] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] gap-0.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Daftar Pengawas ({proctors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'matrix'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Matriks Tugas ({matrix.length} Sesi)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit_matrix')}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'edit_matrix'
                      ? 'bg-[#1D4ED8] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#0F295C]'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Matriks Tugas
                  {hasUnsavedMatrixChanges && (
                    <span
                      title="Ada perubahan draft matriks yang belum disimpan"
                      className="w-2 h-2 rounded-full bg-[#FACC15] ring-2 ring-white"
                    />
                  )}
                </button>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[10.5px] font-semibold text-[#047857]">
                <RefreshCw className="w-3 h-3" />
                Tersinkron ke Jadwal Ulangan
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  onResyncFromSchedule();
                  flashNotice(
                    'Matriks pengawas disusun ulang & disinkronkan persis dengan Jadwal Ulangan serta ruang siswa aktif.',
                  );
                }}
                title="Susun ulang rotasi pengawas secara merata mengikuti Jadwal Ulangan & pembagian ruang terbaru"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] text-[#0369A1] text-[11px] font-semibold transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Sinkron Ulang Jadwal
              </button>
              {isCustomized && (
                <button
                  type="button"
                  onClick={() => {
                    onResetAll();
                    setHighlightedCode(null);
                    setSelectedDayIso('');
                    flashNotice('Data & matriks pengawas dikembalikan ke jadwal PAS Semester 1.');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EEF2F7] text-[#475569] text-[11px] font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Bawaan
                </button>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Tambah Pengawas
              </button>
              <button
                type="button"
                onClick={() =>
                  onPrintProctors({
                    mode: viewMode === 'list' ? 'both' : 'matrix',
                    proctors: sortedProctors,
                    matrix: viewMode === 'edit_matrix' ? filteredDraftMatrix : filteredMatrix,
                    filterSummary: selectedDayIso
                      ? formatIndonesianDateLong(selectedDayIso)
                      : undefined,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#0F295C] text-xs font-semibold shadow-2xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-[#1D4ED8]" />
                {viewMode === 'list' ? 'Cetak Daftar' : 'Cetak Matriks'}
              </button>
            </div>
          </div>

          {/* Filter Toolbar matching Image 1 */}
          <div className="px-5 py-3 bg-[#F8FAFC]/80 border-b border-[#E8EFF8] flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama atau kode pengawas..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | ProctorStatus);
                setCurrentPage(1);
              }}
              aria-label="Filter Status Pengawas"
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Tidak Aktif">Tidak Aktif</option>
            </select>

            <select
              value={selectedDayIso}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDayIso(val);
                if (val) {
                  setActiveCalDateIso(val);
                  const [, m] = val.split('-');
                  if (m) setCalMonth(Number(m) - 1);
                }
                setCurrentPage(1);
              }}
              aria-label="Filter Hari Pelaksanaan"
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Semua Hari Ujian ({examDays.length} hari)</option>
              {examDays.map((d) => (
                <option key={d.iso} value={d.iso}>
                  Hari {d.dayNo} — {d.date}
                </option>
              ))}
            </select>

            <select
              value={selectedRoomNo}
              onChange={(e) => {
                setSelectedRoomNo(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter Ruang Ujian"
              className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="">Semua Ruang</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                <option key={r} value={String(r)}>
                  Ruang {String(r).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {viewMode === 'list' ? (
            <>
              {/* 8-Column Proctor Roster Table matching Image 1 */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#EEF4FC] text-[#0F295C] font-bold border-b border-[#D8E4F3]">
                      <th className="py-2.5 px-3 text-center w-12">Kode</th>
                      <th className="py-2.5 px-3 min-w-[190px]">Nama Pengawas</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Kode / NIP</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Mata Pelajaran</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Ujian</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Ruang</th>
                      <th className="py-2.5 px-3 text-center w-24">Status</th>
                      <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {pagedProctors.map((p) => {
                      const summary = summarizeRowDuties(p.code);
                      return (
                        <tr key={p.id} className="hover:bg-[#F7FAFF] transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1D4ED8] tabular-nums">
                            {String(p.code).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-[#CBD5E1] bg-white shrink-0">
                                <CommitteeAvatar
                                  variant={p.avatarVariant}
                                  className="w-full h-full"
                                />
                              </div>
                              <div>
                                <div className="font-bold text-[#0F295C]">{p.nama}</div>
                                <div className="text-[10.5px] text-[#64748B]">
                                  {summary.totalShifts} sesi mengawas
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11.5px] text-[#334155] whitespace-nowrap">
                            {p.nip ? p.nip : `KODE-${String(p.code).padStart(2, '0')}`}
                          </td>
                          <td
                            className="py-2.5 px-3 text-[#1E293B] font-medium truncate max-w-[180px]"
                            title={summary.subjectTooltip}
                          >
                            {summary.subjectSummary}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[#334155]">
                            PAS Sem. 1
                          </td>
                          <td
                            className="py-2.5 px-3 font-mono font-semibold text-[#0F295C] max-w-[160px] truncate"
                            title={summary.roomTooltip}
                          >
                            {summary.roomSummary}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const next: ProctorStatus =
                                  p.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
                                onToggleProctorStatus(p.id, next);
                                flashNotice(
                                  `Status ${p.nama} diubah ke ${next}.`,
                                );
                              }}
                              title="Klik untuk ubah status Aktif / Tidak Aktif"
                              className={`inline-flex items-center justify-center min-w-[74px] px-2.5 py-1 rounded-md text-[11px] font-bold text-white transition-opacity hover:opacity-90 ${
                                p.status === 'Aktif' ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'
                              }`}
                            >
                              {p.status}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setModal({ type: 'detail', proctor: p })}
                                title="Lihat rincian jadwal mengawas"
                                className="w-7 h-7 rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center justify-center"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                title="Edit data pengawas"
                                className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setModal({ type: 'confirmDelete', proctor: p })}
                                title="Hapus pengawas"
                                className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredProctors.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 px-4 text-center text-[#64748B]">
                          Tidak ada pengawas yang sesuai dengan filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer matching Image 1 */}
              <div className="px-5 py-3 border-t border-[#E8EFF8] bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-[#334155]">
                  Menampilkan{' '}
                  <strong className="font-bold text-[#0F295C]">
                    {showFrom} – {showTo}
                  </strong>{' '}
                  dari <strong className="font-bold text-[#0F295C]">{filteredProctors.length}</strong> data
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {visiblePageNumbers.map((pageNo) => (
                    <button
                      key={pageNo}
                      type="button"
                      onClick={() => setCurrentPage(pageNo)}
                      className={`w-7 h-7 rounded-md text-xs font-bold ${
                        pageNo === safePage
                          ? 'bg-[#2563EB] text-white border border-[#2563EB]'
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
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-7 h-7 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 text-[#475569] flex items-center justify-center"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          ) : viewMode === 'matrix' ? (
            /* MATRIKS TUGAS PENGAWAS + KETERANGAN (Matching Images 2 & 3) */
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs">
                <div>
                  <span className="font-bold text-[#0F295C]">
                    Matriks Kode Pengawas PAS Semester 1 ({academicYear})
                  </span>
                  <span className="ml-2 text-[#64748B]">
                    Klik sel angka untuk mengganti kode pengawas ruang, atau gunakan menu Edit Matriks Tugas untuk edit massal.
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {highlightedCode !== null && (
                    <button
                      type="button"
                      onClick={() => setHighlightedCode(null)}
                      className="px-2.5 py-1 rounded-md bg-[#2563EB] text-white text-[11px] font-bold"
                    >
                      Sorot Kode {highlightedCode} ({proctorByCode.get(highlightedCode)?.nama}) ×
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewMode('edit_matrix')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[11px] font-bold shadow-2xs transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit Matriks Tugas
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#CBD5E1]">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-9">
                        NO
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-24">
                        HARI / TGL
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-1.5 text-center w-12">
                        JAM KE
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-24">
                        PUKUL (WITA)
                      </th>
                      <th
                        colSpan={10}
                        className="border border-[#94A3B8] py-1 px-2 text-center bg-[#9BC2E6] text-[#0F295C]"
                      >
                        RUANG DAN KODE PENGAWAS
                      </th>
                    </tr>
                    <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                        <th key={r} className="border border-[#94A3B8] py-1 px-1.5 text-center min-w-[34px]">
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixDayGroups.map((grp) =>
                      grp.sessions.map((sess, sIdx) => {
                        const isEvenRow = sIdx % 2 === 1;
                        const meta = describeMatrixSession(sess, scheduleEntries);
                        return (
                          <tr
                            key={sess.id}
                            className={isEvenRow ? 'bg-[#E2E8F0]/55' : 'bg-white'}
                          >
                            {sIdx === 0 && (
                              <>
                                <td
                                  rowSpan={grp.sessions.length}
                                  className="border border-[#CBD5E1] text-center font-bold bg-white text-[#0F295C] align-middle"
                                >
                                  {grp.dayNo}
                                </td>
                                <td
                                  rowSpan={grp.sessions.length}
                                  className="border border-[#CBD5E1] px-2 text-center bg-white align-middle"
                                >
                                  <div className="font-bold text-[#0F295C]">{grp.dayLabel}</div>
                                  <div className="font-mono text-[10.5px] text-[#475569]">
                                    {grp.shortDate}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="border border-[#CBD5E1] py-1 text-center font-semibold text-[#334155]">
                              {sess.jamKe}
                            </td>
                            <td
                              className="border border-[#CBD5E1] py-1 px-1.5 text-center"
                              title={`${meta.subjects.join(', ') || 'Sesuai Jadwal'} (${meta.activeRoomCount} ruang aktif)`}
                            >
                              <div className="font-mono text-[10.5px] text-[#1E293B] font-semibold whitespace-nowrap">
                                {sess.time}
                              </div>
                              <div className="text-[9.5px] text-[#1D4ED8] font-medium leading-tight max-w-[165px] mx-auto">
                                {meta.summaryLabel}
                              </div>
                            </td>
                            {sess.rooms.map((code, rIdx) => {
                              const roomFilterActive =
                                selectedRoomNo && Number(selectedRoomNo) !== rIdx + 1;
                              const isHighlighted =
                                highlightedCode !== null && code === highlightedCode;
                              const pInfo = code !== null ? proctorByCode.get(code) : undefined;
                              return code === null ? (
                                <td
                                  key={rIdx}
                                  onClick={() =>
                                    setModal({ type: 'matrixSlot', session: sess, roomIdx: rIdx })
                                  }
                                  title={`Ruang ${String(rIdx + 1).padStart(2, '0')} (${sess.date}, ${sess.time}) — Tidak ada siswa ruang ini pada sesi ${meta.summaryLabel} (klik untuk ubah manual)`}
                                  className="border border-[#334155] bg-[#0F172A] hover:bg-[#1E293B] cursor-pointer transition-colors"
                                />
                              ) : (
                                <td key={rIdx} className="border border-[#CBD5E1] p-0 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setModal({
                                        type: 'matrixSlot',
                                        session: sess,
                                        roomIdx: rIdx,
                                      })
                                    }
                                    title={`Ruang ${String(rIdx + 1).padStart(2, '0')} · ${sess.date} (${sess.time})\n${meta.summaryLabel}\nKode ${code}: ${pInfo?.nama ?? 'Belum terdaftar'}`}
                                    className={`w-full py-1 px-1 font-mono font-bold transition-colors ${
                                      isHighlighted
                                        ? 'bg-[#2563EB] text-white ring-2 ring-inset ring-[#FACC15]'
                                        : roomFilterActive
                                          ? 'text-[#CBD5E1] hover:bg-[#EFF6FF]'
                                          : 'text-[#0F172A] hover:bg-[#DBEAFE] hover:text-[#1D4ED8]'
                                    }`}
                                  >
                                    {code}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Keterangan Kode 1-37 Card matching Image 3 */}
              <div className="rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="font-display font-bold text-sm text-[#0F295C]">
                    Keterangan Kode Pengawas (1 – {sortedProctors.length})
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Klik nama untuk menyorot posisi pada matriks
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  {sortedProctors.map((p) => {
                    const active = highlightedCode === p.code;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setHighlightedCode((prev) => (prev === p.code ? null : p.code))
                        }
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                          active
                            ? 'bg-[#2563EB] text-white font-bold shadow-2xs'
                            : 'hover:bg-white text-[#1E293B]'
                        }`}
                      >
                        <span
                          className={`font-mono font-bold w-6 text-right shrink-0 ${
                            active ? 'text-[#FACC15]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {p.code}.
                        </span>
                        <span className="truncate">{p.nama}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* MENU EDIT MATRIKS TUGAS PENGAWAS */
            <div className="p-4 space-y-4">
              {/* Save / Status Bar */}
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
                  hasUnsavedMatrixChanges
                    ? 'bg-[#FFFBEB] border-[#FDE68A]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm text-[#0F295C]">
                      Editor Matriks Tugas Pengawas ({academicYear})
                    </span>
                    {hasUnsavedMatrixChanges ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/40 text-[#92400E] text-[10.5px] font-bold">
                        {draftStats.modifiedCount} sel diubah (belum disimpan)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857] text-[10.5px] font-bold">
                        Tersimpan &amp; Tersinkron
                      </span>
                    )}
                    {draftStats.conflicts.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[10.5px] font-bold">
                        {draftStats.conflicts.length} Bentrok Jadwal
                      </span>
                    )}
                    {draftStats.missingActiveCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[10.5px] font-bold">
                        {draftStats.missingActiveCount} Ruang Aktif Kosong
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#475569]">
                    Ubah kode pengawas langsung pada sel ruang (1–10), tukar atau ganti kode secara massal, lalu klik{' '}
                    <strong className="text-[#0F295C]">Simpan Matriks</strong> untuk memperbarui Berita Acara &amp; Cloud.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {hasUnsavedMatrixChanges && (
                    <button
                      type="button"
                      onClick={handleDiscardDraftMatrix}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#475569] text-xs font-semibold"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Batalkan Draft
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!hasUnsavedMatrixChanges}
                    onClick={handleSaveDraftMatrix}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:bg-[#CBD5E1] disabled:text-[#64748B] text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Matriks
                  </button>
                </div>
              </div>

              {/* Quick Bulk Tools */}
              <div className="rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] p-3.5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-display font-bold text-[#0F295C] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#2563EB]" />
                    Alat Edit Massal Matriks
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#475569]">Cakupan:</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-white border border-[#CBD5E1]">
                      <button
                        type="button"
                        onClick={() => setBulkScope('all')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          bulkScope === 'all'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'text-[#475569] hover:text-[#0F295C]'
                        }`}
                      >
                        Semua Sesi ({draftMatrix.length})
                      </button>
                      <button
                        type="button"
                        disabled={!selectedDayIso}
                        onClick={() => setBulkScope('filtered')}
                        title={
                          selectedDayIso
                            ? 'Terapkan hanya ke tanggal ujian yang sedang difilter'
                            : 'Pilih tanggal pada filter Hari di atas untuk mengaktifkan'
                        }
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-45 ${
                          bulkScope === 'filtered' && selectedDayIso
                            ? 'bg-[#1D4ED8] text-white'
                            : 'text-[#475569] hover:text-[#0F295C]'
                        }`}
                      >
                        Hari Terfilter
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoFillEmptyInDraft()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#93C5FD] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-bold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Isi Otomatis Ruang Kosong
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Swap 2 Codes */}
                  <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0F295C] whitespace-nowrap">
                      Tukar 2 Kode:
                    </span>
                    <select
                      value={swapCodeA}
                      onChange={(e) => setSwapCodeA(Number(e.target.value))}
                      aria-label="Kode Pengawas Pertama"
                      className="flex-1 min-w-[130px] px-2 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-[11px] font-medium"
                    >
                      {sortedProctors.map((p) => (
                        <option key={p.id} value={p.code}>
                          {String(p.code).padStart(2, '0')} — {p.nama}
                        </option>
                      ))}
                    </select>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                    <select
                      value={swapCodeB}
                      onChange={(e) => setSwapCodeB(Number(e.target.value))}
                      aria-label="Kode Pengawas Kedua"
                      className="flex-1 min-w-[130px] px-2 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-[11px] font-medium"
                    >
                      {sortedProctors.map((p) => (
                        <option key={p.id} value={p.code}>
                          {String(p.code).padStart(2, '0')} — {p.nama}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleSwapCodesInDraft}
                      className="px-3 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold shrink-0"
                    >
                      Tukar
                    </button>
                  </div>

                  {/* Replace 1 Code */}
                  <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0F295C] whitespace-nowrap">
                      Ganti Kode:
                    </span>
                    <select
                      value={replaceFromCode}
                      onChange={(e) => setReplaceFromCode(Number(e.target.value))}
                      aria-label="Kode Pengawas Sumber"
                      className="flex-1 min-w-[125px] px-2 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-[11px] font-medium"
                    >
                      {sortedProctors.map((p) => (
                        <option key={p.id} value={p.code}>
                          {String(p.code).padStart(2, '0')} — {p.nama}
                        </option>
                      ))}
                    </select>
                    <span className="text-[#64748B] font-bold">→</span>
                    <select
                      value={replaceToCode}
                      onChange={(e) => setReplaceToCode(e.target.value)}
                      aria-label="Kode Pengawas Pengganti"
                      className="flex-1 min-w-[125px] px-2 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-[11px] font-medium"
                    >
                      <option value="">— Kosongkan (Blok Hitam)</option>
                      {sortedProctors.map((p) => (
                        <option key={p.id} value={String(p.code)}>
                          {String(p.code).padStart(2, '0')} — {p.nama}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReplaceCodeInDraft}
                      className="px-3 py-1.5 rounded-md bg-[#0F295C] hover:bg-[#1E3A8A] text-white text-[11px] font-bold shrink-0"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Conflict Warning Banner */}
              {draftStats.conflicts.length > 0 && (
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    Terdeteksi {draftStats.conflicts.length} Bentrok Pengawas (1 pengawas bertugas di lebih dari 1 ruang pada jam yang sama):
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {draftStats.conflicts.slice(0, 6).map((c, i) => (
                      <span
                        key={`${c.sessionId}-${c.code}-${i}`}
                        className="px-2 py-0.5 rounded-md bg-white border border-[#FCA5A5] text-[10.5px] font-semibold"
                      >
                        Hari {c.dayNo} ({c.shortDate}) {c.time}: Kode {String(c.code).padStart(2, '0')} di R. {c.roomNumbers.join(' & R. ')}
                      </span>
                    ))}
                    {draftStats.conflicts.length > 6 && (
                      <span className="text-[10.5px] font-semibold px-1 py-0.5">
                        +{draftStats.conflicts.length - 6} bentrok lainnya
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Legend Badges */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#475569] px-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-[#CBD5E1] bg-white inline-block" />
                  Terjadwal Normal
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border-2 border-[#F59E0B] bg-[#FEF3C7] inline-block" />
                  Diubah (Draft)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border-2 border-[#EF4444] bg-[#FEE2E2] inline-block" />
                  Bentrok Sesi Sama
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-dashed border-[#FB923C] bg-[#FFF7ED] inline-block" />
                  Ruang Ujian Aktif Belum Terisi
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-[#334155] bg-[#0F172A] inline-block" />
                  Tidak Ada Ujian (Blok Hitam)
                </span>
                {highlightedCode !== null && (
                  <button
                    type="button"
                    onClick={() => setHighlightedCode(null)}
                    className="ml-auto px-2.5 py-0.5 rounded-md bg-[#2563EB] text-white font-bold"
                  >
                    Sorot Kode {highlightedCode} ×
                  </button>
                )}
              </div>

              {/* Editable Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-[#CBD5E1]">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-9">
                        NO
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-24">
                        HARI / TGL
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-1.5 text-center w-12">
                        JAM KE
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-28">
                        PUKUL (WITA)
                      </th>
                      <th
                        colSpan={10}
                        className="border border-[#94A3B8] py-1 px-2 text-center bg-[#9BC2E6] text-[#0F295C]"
                      >
                        EDIT KODE PENGAWAS PER RUANG (KLIK SEL UNTUK UBAH)
                      </th>
                      <th rowSpan={2} className="border border-[#94A3B8] py-1.5 px-2 text-center w-20">
                        AKSI SESI
                      </th>
                    </tr>
                    <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                        <th key={r} className="border border-[#94A3B8] py-1 px-1 text-center min-w-[44px]">
                          R.{r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draftDayGroups.map((grp) =>
                      grp.sessions.map((sess, sIdx) => {
                        const isEvenRow = sIdx % 2 === 1;
                        const meta = describeMatrixSession(sess, scheduleEntries);
                        const activeFlags = getSessionRoomActiveFlags(sess);
                        const savedSession = matrix.find((m) => m.id === sess.id);

                        return (
                          <tr
                            key={sess.id}
                            className={isEvenRow ? 'bg-[#F1F5F9]/75' : 'bg-white'}
                          >
                            {sIdx === 0 && (
                              <>
                                <td
                                  rowSpan={grp.sessions.length}
                                  className="border border-[#CBD5E1] text-center font-bold bg-white text-[#0F295C] align-middle"
                                >
                                  {grp.dayNo}
                                </td>
                                <td
                                  rowSpan={grp.sessions.length}
                                  className="border border-[#CBD5E1] px-2 text-center bg-white align-middle"
                                >
                                  <div className="font-bold text-[#0F295C]">{grp.dayLabel}</div>
                                  <div className="font-mono text-[10.5px] text-[#475569]">
                                    {grp.shortDate}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="border border-[#CBD5E1] py-1 text-center font-semibold text-[#334155]">
                              {sess.jamKe}
                            </td>
                            <td
                              className="border border-[#CBD5E1] py-1 px-1.5 text-center"
                              title={`${meta.subjects.join(', ') || 'Sesuai Jadwal'} (${meta.activeRoomCount} ruang terisi)`}
                            >
                              <div className="font-mono text-[10.5px] text-[#1E293B] font-semibold whitespace-nowrap">
                                {sess.time}
                              </div>
                              <div className="text-[9.5px] text-[#1D4ED8] font-medium leading-tight max-w-[165px] mx-auto">
                                {meta.summaryLabel}
                              </div>
                            </td>
                            {sess.rooms.map((code, rIdx) => {
                              const roomHasExam = activeFlags[rIdx];
                              const isConflict = draftStats.conflictCellKeys.has(`${sess.id}:${rIdx}`);
                              const isModified =
                                savedSession !== undefined && savedSession.rooms[rIdx] !== code;
                              const isHighlighted =
                                highlightedCode !== null && code === highlightedCode;
                              const roomFilterActive =
                                selectedRoomNo && Number(selectedRoomNo) !== rIdx + 1;
                              const pInfo = code !== null ? proctorByCode.get(code) : undefined;

                              let cellBgClass = 'bg-white text-[#0F172A] hover:bg-[#EFF6FF]';
                              if (isConflict) {
                                cellBgClass =
                                  'bg-[#FEE2E2] text-[#991B1B] ring-2 ring-inset ring-[#EF4444]';
                              } else if (isHighlighted) {
                                cellBgClass =
                                  'bg-[#2563EB] text-white ring-2 ring-inset ring-[#FACC15]';
                              } else if (isModified) {
                                cellBgClass =
                                  'bg-[#FEF3C7] text-[#92400E] ring-2 ring-inset ring-[#F59E0B]';
                              } else if (code === null) {
                                cellBgClass = roomHasExam
                                  ? 'bg-[#FFF7ED] text-[#C2410C] ring-1 ring-inset ring-[#FB923C]'
                                  : 'bg-[#0F172A] text-[#64748B] hover:bg-[#1E293B]';
                              } else if (roomFilterActive) {
                                cellBgClass = 'bg-white/70 text-[#CBD5E1] hover:bg-[#EFF6FF]';
                              }

                              return (
                                <td
                                  key={rIdx}
                                  className="border border-[#CBD5E1] p-0 text-center relative"
                                >
                                  <div
                                    className={`relative w-full h-8 flex items-center justify-center font-mono font-bold text-[11.5px] transition-colors ${cellBgClass}`}
                                    title={
                                      code !== null
                                        ? `Ruang ${String(rIdx + 1).padStart(2, '0')} · ${sess.date} (${sess.time})\nKode ${String(code).padStart(2, '0')}: ${pInfo?.nama ?? 'Belum terdaftar'}${isConflict ? '\n[BENTROK: Kode sama bertugas di ruang lain pada jam ini]' : ''}${isModified ? '\n[Diubah di draft]' : ''}`
                                        : roomHasExam
                                          ? `Ruang ${String(rIdx + 1).padStart(2, '0')} memiliki jadwal ujian aktif tetapi belum ada pengawas (klik untuk memilih)`
                                          : `Ruang ${String(rIdx + 1).padStart(2, '0')} tidak ada jadwal ujian pada sesi ini (klik jika ingin mengisi manual)`
                                    }
                                  >
                                    <span className="pointer-events-none select-none">
                                      {code !== null ? String(code).padStart(2, '0') : roomHasExam ? '?' : '—'}
                                    </span>
                                    <select
                                      value={code !== null ? String(code) : ''}
                                      onChange={(e) =>
                                        handleUpdateDraftCell(
                                          sess.id,
                                          rIdx,
                                          e.target.value ? Number(e.target.value) : null,
                                        )
                                      }
                                      aria-label={`Pilih pengawas ${sess.date} ${sess.time} Ruang ${rIdx + 1}`}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    >
                                      <option value="">
                                        — Kosongkan (Blok Hitam)
                                      </option>
                                      {sortedProctors.map((p) => (
                                        <option key={p.id} value={String(p.code)}>
                                          {String(p.code).padStart(2, '0')} — {p.nama}
                                          {p.status !== 'Aktif' ? ' (Tidak Aktif)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="border border-[#CBD5E1] px-1 py-0.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAutoFillEmptyInDraft(sess.id)}
                                  title="Isi otomatis ruang ujian aktif yang masih kosong pada sesi ini"
                                  className="w-6 h-6 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center"
                                >
                                  <Sparkles className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearSessionRoomsInDraft(sess.id)}
                                  title="Kosongkan semua pengawas pada sesi ini"
                                  className="w-6 h-6 rounded bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center"
                                >
                                  <Eraser className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>

              {/* Keterangan Kode 1-37 Card inside Edit Mode for quick reference & highlight */}
              <div className="rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="font-display font-bold text-sm text-[#0F295C]">
                    Referensi Kode Pengawas (1 – {sortedProctors.length})
                  </h3>
                  <span className="text-[11px] text-[#64748B]">
                    Klik nama untuk menyorot posisi pada matriks editor
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  {sortedProctors.map((p) => {
                    const active = highlightedCode === p.code;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setHighlightedCode((prev) => (prev === p.code ? null : p.code))
                        }
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                          active
                            ? 'bg-[#2563EB] text-white font-bold shadow-2xs'
                            : 'hover:bg-white text-[#1E293B]'
                        }`}
                      >
                        <span
                          className={`font-mono font-bold w-6 text-right shrink-0 ${
                            active ? 'text-[#FACC15]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {p.code}.
                        </span>
                        <span className="truncate">{p.nama}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT SIDEBAR COLUMN matching Image 1 */}
        <aside className="space-y-4">
          {/* Kalender Ujian */}
          <div className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8EFF8] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#1D4ED8]" />
              <h3 className="font-display font-bold text-sm text-[#0F295C]">
                Kalender Ujian
              </h3>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="w-6 h-6 rounded-md hover:bg-white text-[#475569] flex items-center justify-center"
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
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold text-[#475569] mb-1.5">
                {WEEKDAY_HEADERS.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
                {calendarCells.map((cell) => {
                  const hasExam = examDateSet.has(cell.iso);
                  const isSelected = selectedDayIso === cell.iso;
                  const isHighlightCircle =
                    isSelected || (!selectedDayIso && activeCalDateIso === cell.iso && hasExam);
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => handleCalendarDayClick(cell.iso)}
                      title={
                        hasExam
                          ? `${formatIndonesianDateLong(cell.iso)} — Klik untuk filter pengawas pada tanggal ini`
                          : formatIndonesianDateLong(cell.iso)
                      }
                      className={`relative h-8 flex flex-col items-center justify-center rounded-full text-xs transition-colors ${
                        isHighlightCircle
                          ? 'bg-[#1D4ED8] text-white font-bold shadow-xs'
                          : cell.inMonth
                            ? hasExam
                              ? 'text-[#0F295C] font-bold hover:bg-[#EFF6FF]'
                              : 'text-[#334155] hover:bg-[#F1F5F9]'
                            : 'text-[#CBD5E1]'
                      }`}
                    >
                      <span className="leading-none">{cell.day}</span>
                      {hasExam && !isHighlightCircle && (
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
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
                  className="mt-3 w-full py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-bold"
                >
                  Tampilkan Semua Tanggal
                </button>
              )}
            </div>
          </div>

          {/* Informasi Penting (Mint Green Card) */}
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
                  Jadwal Ujian: <strong>{scheduleRangeInfo.dateRange}</strong> ({scheduleRangeInfo.sessionCount} sesi aktif)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="leading-snug font-medium">
                  Pastikan pengawas hadir tepat waktu ({scheduleRangeInfo.timeRange})
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="leading-snug font-medium">
                  Gunakan ID Card Panitia &amp; Kode Pengawas (01–{String(sortedProctors.length).padStart(2, '0')})
                </span>
              </li>
            </ul>
          </div>

          {/* Sukses Ulangan Trophy Banner */}
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
                  Sukses Ulangan,
                </div>
                <div className="font-display font-extrabold text-sm text-[#FACC15] italic mt-0.5">
                  Raih Prestasi Terbaik!
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ADD / EDIT PROCTOR MODAL */}
      {modal?.type === 'form' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h3 className="font-display font-bold text-base text-[#0F295C]">
                {modal.editing ? 'Edit Data Pengawas Ujian' : 'Tambah Pengawas Ujian'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Kode Pengawas</label>
                  <input
                    type="number"
                    min={1}
                    value={formCode}
                    onChange={(e) => setFormCode(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono font-bold text-[#0F172A]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-[#0F295C] mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    value={formNip}
                    onChange={(e) => setFormNip(e.target.value)}
                    placeholder="Kosongkan untuk pakai Kode"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono text-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F295C] mb-1">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Fitriah, S.Pd"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Status Tugas</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProctorStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0F295C] mb-1">Avatar Profil</label>
                  <select
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value as AvatarVariant)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                  >
                    <option value="sekretaris">Ibu Guru (Hijab)</option>
                    <option value="proktor">Guru Wanita</option>
                    <option value="ketua">Bapak Guru (Berkacamata)</option>
                    <option value="bendahara">Bapak Guru</option>
                    <option value="teknisi">Staf / Pengawas Muda</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold"
                >
                  Simpan Pengawas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: Personal 9-Day Schedule for Proctor */}
      {modal?.type === 'detail' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#BFDBFE] bg-white">
                  <CommitteeAvatar variant={modal.proctor.avatarVariant} className="w-full h-full" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#0F295C]">
                    Kode {String(modal.proctor.code).padStart(2, '0')} — {modal.proctor.nama}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Rincian jadwal mengawas di Ruang 01 – 10 ({fullDutiesByCode.get(modal.proctor.code)?.length ?? 0} sesi)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 text-xs">
              {(fullDutiesByCode.get(modal.proctor.code) ?? []).length === 0 ? (
                <div className="py-10 text-center text-[#64748B]">
                  Pengawas ini belum memiliki sesi tugas pada matriks.
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#EEF4FC] text-[#0F295C] font-bold">
                      <th className="py-2 px-2 text-center border border-[#DCE5F2] w-10">No</th>
                      <th className="py-2 px-2 text-center border border-[#DCE5F2]">Hari</th>
                      <th className="py-2 px-2.5 text-left border border-[#DCE5F2]">Tanggal</th>
                      <th className="py-2 px-2.5 text-center border border-[#DCE5F2]">Jam Ke</th>
                      <th className="py-2 px-2.5 text-center border border-[#DCE5F2]">Pukul (WITA)</th>
                      <th className="py-2 px-2.5 text-center border border-[#DCE5F2]">Ruang</th>
                      <th className="py-2 px-2.5 text-left border border-[#DCE5F2]">Mata Pelajaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fullDutiesByCode.get(modal.proctor.code) ?? []).map((d, idx) => (
                      <tr key={`${d.sessionId}-${d.roomNo}-${idx}`} className="hover:bg-[#F8FAFC]">
                        <td className="py-1.5 px-2 text-center border border-[#E2E8F0] font-mono text-[#475569]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2 text-center border border-[#E2E8F0] font-semibold">
                          #{d.dayNo}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#E2E8F0] font-medium">
                          {d.date}
                        </td>
                        <td className="py-1.5 px-2.5 text-center border border-[#E2E8F0]">
                          Jam {d.jamKe}
                        </td>
                        <td className="py-1.5 px-2.5 text-center border border-[#E2E8F0] font-mono">
                          {d.time}
                        </td>
                        <td className="py-1.5 px-2.5 text-center border border-[#E2E8F0] font-mono font-bold text-[#1D4ED8]">
                          {d.roomLabel}
                        </td>
                        <td className="py-1.5 px-2.5 border border-[#E2E8F0] text-[#334155]">
                          <div>
                            {d.subjects.length > 0 ? d.subjects.join(', ') : 'Sesuai Jadwal Ruang'}
                          </div>
                          {d.classes.length > 0 && (
                            <div className="text-[10px] text-[#64748B]">
                              Kelas di ruang: {d.classes.join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] shrink-0 text-xs">
              <button
                type="button"
                onClick={() => {
                  setHighlightedCode(modal.proctor.code);
                  setViewMode('matrix');
                  setModal(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#93C5FD] text-[#1D4ED8] font-bold"
              >
                Sorot di Matriks Tugas
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATRIX SLOT REASSIGN MODAL */}
      {modal?.type === 'matrixSlot' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <h3 className="font-display font-bold text-base text-[#0F295C]">
                  Atur Pengawas Ruang {String(modal.roomIdx + 1).padStart(2, '0')}
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  {modal.session.date} · Jam ke-{modal.session.jamKe} ({modal.session.time} WITA)
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

            <div className="p-5 space-y-3 text-xs">
              {(() => {
                const roomMatch = matchSubjectsForSlot(
                  modal.session.date,
                  modal.session.time,
                  schedulesMap,
                  modal.roomIdx + 1,
                  students,
                );
                return (
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-2 text-[#334155]">
                    <Clock className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                    <div>
                      <div>
                        Mapel Ruang {String(modal.roomIdx + 1).padStart(2, '0')}:{' '}
                        <strong className="text-[#0F295C]">
                          {roomMatch.subjects.length > 0
                            ? roomMatch.subjects.join(', ')
                            : 'Tidak ada ujian di ruang ini pada sesi ini'}
                        </strong>
                      </div>
                      {roomMatch.classes.length > 0 && (
                        <div className="text-[10.5px] text-[#64748B] mt-0.5">
                          Kelas peserta: {roomMatch.classes.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block font-bold text-[#0F295C] mb-1.5">
                  Pilih Pengawas (Kode 1 – {sortedProctors.length})
                </label>
                <div className="max-h-60 overflow-y-auto border border-[#E2E8F0] rounded-xl divide-y divide-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateMatrixSlot(modal.session.id, modal.roomIdx, null);
                      flashNotice(
                        `Ruang ${String(modal.roomIdx + 1).padStart(2, '0')} (${modal.session.time}) dikosongkan.`,
                      );
                      setModal(null);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#F8FAFC] ${
                      modal.session.rooms[modal.roomIdx] === null
                        ? 'bg-[#0F172A] text-white font-bold'
                        : 'text-[#475569]'
                    }`}
                  >
                    <span>Sesi Kosong / Tidak Ada Ujian (Blok Hitam)</span>
                    <DoorOpen className="w-3.5 h-3.5 opacity-70" />
                  </button>
                  {sortedProctors.map((p) => {
                    const current = modal.session.rooms[modal.roomIdx] === p.code;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onUpdateMatrixSlot(modal.session.id, modal.roomIdx, p.code);
                          flashNotice(
                            `Ruang ${String(modal.roomIdx + 1).padStart(2, '0')} (${modal.session.time}) ditugaskan ke Kode ${p.code} (${p.nama}).`,
                          );
                          setModal(null);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#EFF6FF] ${
                          current ? 'bg-[#2563EB] text-white font-bold' : 'text-[#0F172A]'
                        }`}
                      >
                        <span>
                          <span
                            className={`font-mono font-bold mr-2 ${
                              current ? 'text-[#FACC15]' : 'text-[#1D4ED8]'
                            }`}
                          >
                            {String(p.code).padStart(2, '0')}.
                          </span>
                          {p.nama}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            p.status === 'Aktif'
                              ? 'bg-[#22C55E] text-white'
                              : 'bg-[#F59E0B] text-white'
                          }`}
                        >
                          {p.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {modal?.type === 'confirmDelete' && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[#0F295C]">
                  Hapus Pengawas Kode {String(modal.proctor.code).padStart(2, '0')}?
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {modal.proctor.nama} akan dihapus dari daftar pengawas ujian.
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProctor(modal.proctor.id);
                  flashNotice(`Pengawas ${modal.proctor.nama} dihapus.`);
                  setModal(null);
                }}
                className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
