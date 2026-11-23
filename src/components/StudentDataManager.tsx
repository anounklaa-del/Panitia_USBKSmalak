import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CloudUpload,
  CreditCard,
  Download,
  Eye,
  GraduationCap,
  Home,
  Info,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  STUDENTS_MASTER,
  type ScheduleRow,
  type StudentExamStatus,
  type StudentGender,
  type StudentRecord,
} from '../data/pasData';
import type { MainWorkspaceTab, StickerGroupingMode } from '../types/prepress';
import {
  buildDeskAssignmentLookup,
  compareNumericStrings,
  formatParticipantNo,
  getSortedRoomList,
  normalizeRoomLabel,
} from '../utils/deskStickerBuilder';
import { BASE_CLASSES_LIST, getLiveSchedulesMap } from '../utils/scheduleStore';
import {
  deriveStudentGender,
  deriveStudentJurusan,
  deriveStudentNisn,
  deriveStudentStatus,
  exportStudentsExcelCsv,
  JURUSAN_LIST,
} from '../utils/studentMetadata';

interface StudentDataManagerProps {
  students: StudentRecord[];
  groupingMode: StickerGroupingMode;
  schedulesMap?: Record<string, ScheduleRow[]>;
  onAddStudent: (record: StudentRecord) => void;
  onUpdateStudent: (originalNo: string, updated: StudentRecord) => void;
  onDeleteStudent: (no: string) => void;
  onResetStudents: () => void;
  onImportCsv: (ev: React.ChangeEvent<HTMLInputElement>) => void;
  onInspectStudentCard: (student: StudentRecord) => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
  onPrintRoster: () => void;
  csvFeedback: string | null;
}

type ActiveModal =
  | null
  | { type: 'form'; editing?: StudentRecord }
  | { type: 'detail'; student: StudentRecord }
  | { type: 'import' }
  | { type: 'validate' };

const PAGE_SIZE = 10;
const KNOWN_CLASSES = BASE_CLASSES_LIST;
const STATUS_OPTIONS: StudentExamStatus[] = ['Lulus', 'Susulan', 'Nonaktif'];

const JURUSAN_CHART_COLORS: Record<string, string> = {
  MIPA: '#2563EB',
  IPS: '#EC4899',
  BAHASA: '#F59E0B',
  'Fase E': '#14B8A6',
};

function suggestNextNo(students: StudentRecord[]): string {
  let maxNo = 0;
  for (const s of students) {
    const n = Number(s.no);
    if (!Number.isNaN(n) && n > maxNo) maxNo = n;
  }
  return String(maxNo + 1).padStart(3, '0');
}

function downloadCsvTemplate() {
  const header = 'No,Nama,Kelas,Ruang,User,NISN,Jurusan,JenisKelamin,Status';
  const sample = [
    '"621","MUHAMMAD RIZKY PRATAMA","XI 1","01","621","0084530621","MIPA","L","Lulus"',
    '"622","AISYAH NURHALIZA","XII 4","05","622","0074530622","BAHASA","P","Lulus"',
  ];
  const blob = new Blob(['\uFEFF' + [header, ...sample].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Import_Peserta_SMAN1ALALAK.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function getPageWindow(current: number, total: number, maxVisible = 5): number[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, current - half);
  let end = start + maxVisible - 1;
  if (end > total) {
    end = total;
    start = Math.max(1, end - maxVisible + 1);
  }
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

export const StudentDataManager: React.FC<StudentDataManagerProps> = ({
  students,
  groupingMode,
  schedulesMap,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onResetStudents,
  onImportCsv,
  onInspectStudentCard,
  onNavigateTab,
  onPrintRoster,
  csvFeedback,
}) => {
  const liveSchedulesMap = schedulesMap ?? getLiveSchedulesMap();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterJurusan, setFilterJurusan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Add/Edit Modal Form State
  const [noInput, setNoInput] = useState('');
  const [nisnInput, setNisnInput] = useState('');
  const [namaInput, setNamaInput] = useState('');
  const [kelasMode, setKelasMode] = useState<'preset' | 'custom'>('preset');
  const [kelasPreset, setKelasPreset] = useState(KNOWN_CLASSES[0] ?? 'X1');
  const [kelasCustom, setKelasCustom] = useState('');
  const [jurusanInput, setJurusanInput] = useState<string>('Fase E');
  const [genderInput, setGenderInput] = useState<StudentGender>('L');
  const [ruangInput, setRuangInput] = useState('01');
  const [userInput, setUserInput] = useState('');
  const [userEditedManually, setUserEditedManually] = useState(false);
  const [statusInput, setStatusInput] = useState<StudentExamStatus>('Lulus');
  const [formError, setFormError] = useState<string | null>(null);

  const rooms = useMemo(() => getSortedRoomList(students), [students]);

  const classOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.kelas.trim()).filter(Boolean));
    return [...set].sort(compareNumericStrings);
  }, [students]);

  const jurusanOptions = useMemo(() => {
    const set = new Set<string>(JURUSAN_LIST);
    for (const s of students) set.add(deriveStudentJurusan(s));
    return [...set];
  }, [students]);

  const deskLookup = useMemo(
    () => buildDeskAssignmentLookup(students, groupingMode),
    [students, groupingMode],
  );

  // Enrich rows deterministically without mutating underlying StudentRecord array
  const enrichedRows = useMemo(
    () =>
      [...students]
        .map((s) => ({
          raw: s,
          nisn: deriveStudentNisn(s),
          jurusan: deriveStudentJurusan(s),
          gender: deriveStudentGender(s),
          status: deriveStudentStatus(s),
        }))
        .sort((a, b) => compareNumericStrings(a.raw.no, b.raw.no)),
    [students],
  );

  const maleCount = useMemo(
    () => enrichedRows.filter((r) => r.gender === 'L').length,
    [enrichedRows],
  );
  const femaleCount = useMemo(
    () => enrichedRows.filter((r) => r.gender === 'P').length,
    [enrichedRows],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedRows.filter((item) => {
      if (filterClass && item.raw.kelas !== filterClass) return false;
      if (filterJurusan && item.jurusan !== filterJurusan) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (q) {
        const hit =
          item.raw.nama.toLowerCase().includes(q) ||
          item.raw.no.toLowerCase().includes(q) ||
          item.nisn.toLowerCase().includes(q) ||
          item.raw.kelas.toLowerCase().includes(q) ||
          item.jurusan.toLowerCase().includes(q) ||
          item.raw.ruang.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [enrichedRows, filterClass, filterJurusan, filterStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pagedRows = filteredRows.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filteredRows.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(filteredRows.length, startIdx + PAGE_SIZE);
  const pageNumbers = getPageWindow(safePage, totalPages, 5);

  // Donut Chart Breakdown by Jurusan
  const jurusanBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of enrichedRows) {
      counts.set(item.jurusan, (counts.get(item.jurusan) ?? 0) + 1);
    }
    const paletteFallback = ['#2563EB', '#EC4899', '#F59E0B', '#14B8A6', '#8B5CF6'];
    const total = Math.max(1, enrichedRows.length);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], idx) => ({
        label,
        count,
        pct: Math.round((count / total) * 100),
        color: JURUSAN_CHART_COLORS[label] ?? paletteFallback[idx % paletteFallback.length],
      }));
  }, [enrichedRows]);

  // Validation Audit Metrics for "Validasi Data" Modal
  const validationAudit = useMemo(() => {
    const seenNos = new Map<string, number>();
    const seenNisns = new Map<string, number>();
    const missingSchedule: StudentRecord[] = [];
    const missingRoom: StudentRecord[] = [];

    for (const item of enrichedRows) {
      seenNos.set(item.raw.no, (seenNos.get(item.raw.no) ?? 0) + 1);
      seenNisns.set(item.nisn, (seenNisns.get(item.nisn) ?? 0) + 1);
      if (!liveSchedulesMap[item.raw.kelas] || liveSchedulesMap[item.raw.kelas].length === 0) {
        missingSchedule.push(item.raw);
      }
      if (!item.raw.ruang.trim()) missingRoom.push(item.raw);
    }

    const duplicateNos = Array.from(seenNos.entries())
      .filter(([, cnt]) => cnt > 1)
      .map(([no]) => no);
    const duplicateNisns = Array.from(seenNisns.entries())
      .filter(([, cnt]) => cnt > 1)
      .map(([nisn]) => nisn);

    const activeCount = enrichedRows.filter((r) => r.status !== 'Nonaktif').length;
    const issuesTotal =
      duplicateNos.length + duplicateNisns.length + missingSchedule.length + missingRoom.length;

    return {
      duplicateNos,
      duplicateNisns,
      missingSchedule,
      missingRoom,
      activeCount,
      issuesTotal,
    };
  }, [enrichedRows, liveSchedulesMap]);

  const openCreateModal = () => {
    const nextNo = suggestNextNo(students);
    const defaultClass = KNOWN_CLASSES[0] ?? 'X1';
    setNoInput(nextNo);
    setNisnInput(`009453${nextNo.padStart(4, '0')}`);
    setNamaInput('');
    setKelasMode('preset');
    setKelasPreset(defaultClass);
    setKelasCustom('');
    setJurusanInput(deriveStudentJurusan({ no: nextNo, nama: '', kelas: defaultClass, ruang: '01', user: nextNo }));
    setGenderInput('L');
    setRuangInput('01');
    setUserInput(nextNo);
    setUserEditedManually(false);
    setStatusInput('Lulus');
    setFormError(null);
    setModal({ type: 'form' });
  };

  const openEditModal = (st: StudentRecord) => {
    setNoInput(st.no);
    setNisnInput(deriveStudentNisn(st));
    setNamaInput(st.nama);
    if (KNOWN_CLASSES.includes(st.kelas)) {
      setKelasMode('preset');
      setKelasPreset(st.kelas);
      setKelasCustom('');
    } else {
      setKelasMode('custom');
      setKelasCustom(st.kelas);
    }
    setJurusanInput(deriveStudentJurusan(st));
    setGenderInput(deriveStudentGender(st));
    setRuangInput(normalizeRoomLabel(st.ruang));
    setUserInput(st.user);
    setUserEditedManually(st.user !== st.no);
    setStatusInput(deriveStudentStatus(st));
    setFormError(null);
    setModal({ type: 'form', editing: st });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const editingNo = modal?.type === 'form' ? modal.editing?.no : undefined;
    const cleanNo = noInput.trim();
    const cleanNama = namaInput.trim().toUpperCase();
    const cleanKelas = kelasMode === 'custom' ? kelasCustom.trim() : kelasPreset;
    const cleanRuang = normalizeRoomLabel(ruangInput);
    const cleanUser = (userEditedManually ? userInput.trim() : cleanNo) || cleanNo;
    const cleanNisn = nisnInput.trim() || `008453${cleanNo.replace(/\D/g, '').padStart(4, '0')}`;

    if (!cleanNo) {
      setFormError('No. urut peserta wajib diisi.');
      return;
    }
    if (!cleanNama) {
      setFormError('Nama lengkap peserta wajib diisi.');
      return;
    }
    if (!cleanKelas) {
      setFormError('Kelas peserta wajib dipilih atau diisi.');
      return;
    }

    const duplicate = students.find((s) => s.no === cleanNo && s.no !== editingNo);
    if (duplicate) {
      setFormError(`No. Peserta ${cleanNo} sudah digunakan oleh ${duplicate.nama}.`);
      return;
    }

    const record: StudentRecord = {
      no: cleanNo,
      nama: cleanNama,
      kelas: cleanKelas,
      ruang: cleanRuang,
      user: cleanUser,
      nisn: cleanNisn,
      jurusan: jurusanInput.trim() || 'Fase E',
      jenisKelamin: genderInput,
      status: statusInput,
    };

    if (editingNo) {
      onUpdateStudent(editingNo, record);
    } else {
      onAddStudent(record);
    }
    setModal(null);
  };

  const cycleStatus = (st: StudentRecord) => {
    const current = deriveStudentStatus(st);
    const nextIdx = (STATUS_OPTIONS.indexOf(current) + 1) % STATUS_OPTIONS.length;
    onUpdateStudent(st.no, { ...st, status: STATUS_OPTIONS[nextIdx] });
  };

  const activeFormKelas = kelasMode === 'custom' ? kelasCustom.trim() : kelasPreset;
  const effectiveFormUser = userEditedManually ? userInput.trim() : noInput.trim();
  const isCustomStudentDataset = students.length !== STUDENTS_MASTER.length;

  // Donut Ring SVG math (radius = 42, circumference = ~263.89)
  const donutRadius = 42;
  const donutCirc = 2 * Math.PI * donutRadius;
  let accumulatedOffset = 0;

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Top Royal Blue Banner with Breadcrumb */}
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
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-tight">
                Data Peserta Ujian
              </h1>
              <p className="text-xs sm:text-[13px] italic text-white/85 mt-0.5 truncate">
                Kelola data peserta ulangan dengan mudah dan akurat
              </p>
            </div>
          </div>

          <nav
            aria-label="Breadcrumb"
            className="relative z-10 flex items-center gap-1.5 text-xs text-white/85 shrink-0"
          >
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="font-semibold text-white">Data Peserta Ujian</span>
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

          {/* Card 2: Peserta Laki-Laki */}
          <div
            className="rounded-2xl border border-[#BAEBD6] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
            style={{ background: 'linear-gradient(180deg, #E8FAF3 0%, #D3F5E7 100%)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#A7F3D0] text-[#059669] flex items-center justify-center shrink-0 shadow-2xs">
              <User className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                {maleCount}
              </div>
              <div className="text-xs font-semibold text-[#065F46] mt-1 truncate">
                Peserta Laki-Laki
              </div>
            </div>
          </div>

          {/* Card 3: Peserta Perempuan */}
          <div
            className="rounded-2xl border border-[#DFC2FF] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
            style={{ background: 'linear-gradient(180deg, #F5EBFF 0%, #EAD8FF 100%)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#DDD6FE] text-[#7C3AED] flex items-center justify-center shrink-0 shadow-2xs">
              <User className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                {femaleCount}
              </div>
              <div className="text-xs font-semibold text-[#5B21B6] mt-1 truncate">
                Peserta Perempuan
              </div>
            </div>
          </div>

          {/* Card 4: Kelas Terdaftar */}
          <div
            className="rounded-2xl border border-[#FED7AA] px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] flex items-center gap-4"
            style={{ background: 'linear-gradient(180deg, #FFF3E2 0%, #FFE6C7 100%)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/65 border border-[#FDBA74] text-[#EA580C] flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-3xl text-[#0F172A] leading-none tabular-nums">
                {classOptions.length}
              </div>
              <div className="text-xs font-semibold text-[#9A3412] mt-1 truncate">
                Kelas Terdaftar
              </div>
            </div>
          </div>
        </section>

        {/* Main Workspace White Container */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 lg:p-5 space-y-4">
          {/* Pencarian & Filter + Primary Action Buttons */}
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3 pb-3 border-b border-[#EEF2F7]">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#1E293B]" />
                <h2 className="font-display font-bold text-sm text-[#0F172A]">
                  Pencarian &amp; Filter
                </h2>
                {csvFeedback && (
                  <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[11px] font-medium">
                    {csvFeedback}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Cari nama siswa..."
                    className="px-3 py-1.5 text-xs rounded-l-lg border border-r-0 border-[#CBD5E1] bg-white text-[#1E293B] w-44 sm:w-56 focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    aria-label="Cari peserta"
                    className="px-2.5 py-1.5 rounded-r-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white border border-[#2563EB] transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>

                <select
                  value={filterClass}
                  onChange={(e) => {
                    setFilterClass(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Pilih Kelas"
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B]"
                >
                  <option value="">Pilih Kelas</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={filterJurusan}
                  onChange={(e) => {
                    setFilterJurusan(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Pilih Jurusan"
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B]"
                >
                  <option value="">Pilih Jurusan</option>
                  {jurusanOptions.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Pilih Status"
                  className="px-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B]"
                >
                  <option value="">Pilih Status</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                {(searchQuery || filterClass || filterJurusan || filterStatus) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterClass('');
                      setFilterJurusan('');
                      setFilterStatus('');
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-medium text-[#475569]"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  exportStudentsExcelCsv(
                    filteredRows.map((r) => r.raw),
                    deskLookup,
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export Excel
              </button>

              <button
                type="button"
                onClick={onPrintRoster}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Data
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Peserta
              </button>
            </div>
          </div>

          {/* Lower Split: Paginated Roster Table (9 cols) + Informasi Peserta & Quick Action (3 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left: Table + Pagination */}
            <div className="xl:col-span-9 min-w-0 flex flex-col justify-between">
              <div className="overflow-x-auto rounded-xl border border-[#DCE5F2]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#DCE8FB] text-[#0F295C] font-display font-bold border-b border-[#C7DAFA]">
                      <th className="py-2.5 px-3 w-12 text-center">No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">NISN</th>
                      <th className="py-2.5 px-3">Nama Peserta</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Kelas</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Jurusan</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">
                        Jenis Kelamin
                      </th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 text-center w-32 whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#64748B]">
                          Tidak ada data peserta yang cocok dengan pencarian atau filter.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((item, idx) => {
                        const st = item.raw;
                        const statusColor =
                          item.status === 'Lulus'
                            ? 'bg-[#22C55E] hover:bg-[#16A34A] text-white'
                            : item.status === 'Susulan'
                              ? 'bg-[#F59E0B] hover:bg-[#D97706] text-white'
                              : 'bg-[#94A3B8] hover:bg-[#64748B] text-white';

                        return (
                          <tr key={st.no} className="hover:bg-[#F8FAFF] transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-[#334155] tabular-nums">
                              {startIdx + idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[#334155] tabular-nums whitespace-nowrap">
                              {item.nisn}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0F172A] whitespace-nowrap">
                              {st.nama}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#1E293B] whitespace-nowrap">
                              {st.kelas}
                            </td>
                            <td className="py-2.5 px-3 text-[#334155] whitespace-nowrap">
                              {item.jurusan}
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-[#1E293B]">
                              {item.gender}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => cycleStatus(st)}
                                title="Klik untuk ubah status peserta (Lulus / Susulan / Nonaktif)"
                                className={`inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-[11px] font-bold transition-colors ${statusColor}`}
                              >
                                {item.status}
                              </button>
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setModal({ type: 'detail', student: st })}
                                  title="Lihat detail peserta & kartu ujian"
                                  className="w-7 h-7 rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex items-center justify-center shadow-2xs transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(st)}
                                  title="Edit data peserta"
                                  className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-2xs transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={students.length <= 1}
                                  onClick={() => onDeleteStudent(st.no)}
                                  title="Hapus data peserta"
                                  className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white flex items-center justify-center shadow-2xs transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#475569]">
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span>
                    Menampilkan {showingFrom} – {showingTo} dari {filteredRows.length} data
                  </span>
                  {isCustomStudentDataset && !confirmReset && (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline font-medium"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Bawaan ({STUDENTS_MASTER.length})
                    </button>
                  )}
                  {confirmReset && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-2 py-0.5">
                      <span className="text-[#991B1B] font-medium">Kembalikan {STUDENTS_MASTER.length} siswa?</span>
                      <button
                        type="button"
                        onClick={() => {
                          onResetStudents();
                          setConfirmReset(false);
                          setCurrentPage(1);
                        }}
                        className="px-2 py-0.5 rounded bg-[#DC2626] text-white font-semibold"
                      >
                        Ya
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="px-2 py-0.5 rounded bg-white border border-[#CBD5E1] text-[#334155]"
                      >
                        Batal
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    title="Halaman pertama"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    title="Halaman sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {pageNumbers.map((pageNo) => (
                    <button
                      key={pageNo}
                      type="button"
                      onClick={() => setCurrentPage(pageNo)}
                      className={`w-7 h-7 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                        safePage === pageNo
                          ? 'bg-[#2563EB] text-white shadow-2xs'
                          : 'border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] text-[#334155]'
                      }`}
                    >
                      {pageNo}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                    className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    title="Halaman berikutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                    title="Halaman terakhir"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sidebar Cards: Informasi Peserta + Quick Action */}
            <aside className="xl:col-span-3 space-y-4">
              {/* Informasi Peserta Card */}
              <div className="rounded-2xl border border-[#DCE5F2] bg-[#F8FAFF] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-[#0F172A]">
                    Informasi Peserta
                  </h3>
                </div>

                {/* Donut Ring */}
                <div className="flex justify-center py-1">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r={donutRadius}
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="16"
                      />
                      {jurusanBreakdown.map((seg) => {
                        const segLen =
                          students.length > 0 ? (seg.count / students.length) * donutCirc : 0;
                        const dashOffset = -accumulatedOffset;
                        accumulatedOffset += segLen;
                        return (
                          <circle
                            key={seg.label}
                            cx="56"
                            cy="56"
                            r={donutRadius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="16"
                            strokeDasharray={`${segLen} ${donutCirc}`}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-display font-extrabold text-2xl text-[#0F172A] leading-none tabular-nums">
                        {students.length}
                      </span>
                      <span className="text-[11px] font-medium text-[#475569] mt-0.5">Total</span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Legend */}
                <div className="space-y-2 pt-1 text-xs">
                  {jurusanBreakdown.map((seg) => (
                    <button
                      key={seg.label}
                      type="button"
                      onClick={() => {
                        setFilterJurusan((prev) => (prev === seg.label ? '' : seg.label));
                        setCurrentPage(1);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg transition-colors ${
                        filterJurusan === seg.label ? 'bg-[#DCE8FB]' : 'hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-[#1E293B] font-medium truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        {seg.label}
                      </span>
                      <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                        {seg.pct}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Action Card */}
              <div className="rounded-2xl border border-[#DCE5F2] bg-[#F8FAFF] p-4 space-y-2.5">
                <div className="flex items-center gap-2 pb-1">
                  <Zap className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="font-display font-bold text-sm text-[#0F172A]">Quick Action</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setModal({ type: 'import' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
                >
                  <CloudUpload className="w-4 h-4" />
                  Import Data Siswa
                </button>

                <button
                  type="button"
                  onClick={() => setModal({ type: 'validate' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] hover:from-[#7C3AED] hover:to-[#5B21B6] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Validasi Data
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = filteredRows[0]?.raw ?? students[0];
                    if (target) onInspectStudentCard(target);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4" />
                  Print Kartu Peserta
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {/* Interactive Modals */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#041434]/55 backdrop-blur-xs"
          onClick={() => setModal(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal: Add / Edit Student */}
            {modal.type === 'form' && (
              <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#0F172A]">
                      {modal.editing
                        ? `Edit Peserta #${modal.editing.no}`
                        : 'Tambah Data Peserta Ujian'}
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Otomatis tersinkron ke Kartu PAS 2D, Mockup 3D, Stiker Meja &amp; Daftar Hadir
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs font-medium text-[#991B1B]">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">
                      No. Urut / Peserta *
                    </label>
                    <input
                      type="text"
                      value={noInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNoInput(val);
                        if (!userEditedManually) setUserInput(val);
                      }}
                      placeholder="620"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">NISN *</label>
                    <input
                      type="text"
                      value={nisnInput}
                      onChange={(e) => setNisnInput(e.target.value)}
                      placeholder="0084530620"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-[#334155] mb-1">
                      Nama Lengkap Peserta *
                    </label>
                    <input
                      type="text"
                      value={namaInput}
                      onChange={(e) => setNamaInput(e.target.value)}
                      placeholder="Contoh: AHMAD RIZKI PRATAMA"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A] uppercase"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#334155]">Kelas *</label>
                      <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                        <button
                          type="button"
                          onClick={() => setKelasMode('preset')}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            kelasMode === 'preset'
                              ? 'bg-[#2563EB] text-white'
                              : 'text-[#475569]'
                          }`}
                        >
                          Daftar
                        </button>
                        <button
                          type="button"
                          onClick={() => setKelasMode('custom')}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            kelasMode === 'custom'
                              ? 'bg-[#2563EB] text-white'
                              : 'text-[#475569]'
                          }`}
                        >
                          Kustom
                        </button>
                      </div>
                    </div>
                    {kelasMode === 'preset' ? (
                      <select
                        value={kelasPreset}
                        onChange={(e) => {
                          const nextClass = e.target.value;
                          setKelasPreset(nextClass);
                          setJurusanInput(
                            deriveStudentJurusan({
                              no: noInput,
                              nama: namaInput,
                              kelas: nextClass,
                              ruang: ruangInput,
                              user: effectiveFormUser,
                            }),
                          );
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                      >
                        {KNOWN_CLASSES.map((k) => (
                          <option key={k} value={k}>
                            {k} ({liveSchedulesMap[k]?.length ?? 0} mapel)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={kelasCustom}
                        onChange={(e) => setKelasCustom(e.target.value)}
                        placeholder="Contoh: X7 atau XI 8"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">
                      Jurusan / Peminatan
                    </label>
                    <select
                      value={jurusanInput}
                      onChange={(e) => setJurusanInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      {jurusanOptions.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Jenis Kelamin</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['L', 'P'] as StudentGender[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenderInput(g)}
                          className={`py-2 rounded-lg border font-semibold transition-colors ${
                            genderInput === g
                              ? 'bg-[#2563EB] text-white border-[#2563EB]'
                              : 'bg-white text-[#334155] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                          }`}
                        >
                          {g === 'L' ? 'L (Laki-Laki)' : 'P (Perempuan)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">
                      Status Peserta
                    </label>
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value as StudentExamStatus)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">Ruang Ujian</label>
                    <input
                      type="text"
                      list="student-room-suggestions"
                      value={ruangInput}
                      onChange={(e) => setRuangInput(e.target.value)}
                      placeholder="01"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                    />
                    <datalist id="student-room-suggestions">
                      {rooms.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">
                      User Name Login Ujian
                    </label>
                    <input
                      type="text"
                      value={effectiveFormUser}
                      onChange={(e) => {
                        setUserEditedManually(true);
                        setUserInput(e.target.value);
                      }}
                      placeholder="Otomatis mengikuti No. Peserta"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                    />
                  </div>
                </div>

                {/* Quick Room Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#64748B] mr-1">
                    Pilih Cepat Ruang:
                  </span>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRuangInput(r)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border transition-colors ${
                        normalizeRoomLabel(ruangInput) === r
                          ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:bg-[#EFF6FF]'
                      }`}
                    >
                      R.{r}
                    </button>
                  ))}
                </div>

                {/* Real-Time Identity Preview */}
                <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2] space-y-1 font-mono text-[11px] tabular-nums">
                  <div className="text-[#64748B]">Pratinjau Identitas Cetak Kartu PAS</div>
                  <div className="font-bold text-[#1D4ED8]">
                    {formatParticipantNo(noInput || '---')}
                  </div>
                  <div className="text-[#0F172A] font-semibold truncate">
                    {namaInput.trim().toUpperCase() || 'NAMA LENGKAP SISWA'}
                  </div>
                  <div className="text-[#475569]">
                    NISN: <strong>{nisnInput || '-'}</strong> · Kelas:{' '}
                    <strong>{activeFormKelas || '-'}</strong> ({jurusanInput}) · Ruang:{' '}
                    <strong>{normalizeRoomLabel(ruangInput)}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF2F7]">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-bold shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {modal.editing ? 'Simpan Perubahan' : 'Tambah Peserta'}
                  </button>
                </div>
              </form>
            )}

            {/* Modal: Detail Student */}
            {modal.type === 'detail' && (() => {
              const st = modal.student;
              const desk = deskLookup.get(st.no);
              const nisn = deriveStudentNisn(st);
              const jurusan = deriveStudentJurusan(st);
              const gender = deriveStudentGender(st);
              const status = deriveStudentStatus(st);
              const hasSchedule = Boolean(liveSchedulesMap[st.kelas]?.length);
              return (
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] pb-3">
                    <div>
                      <div className="font-mono text-[11px] font-bold text-[#2563EB]">
                        {formatParticipantNo(st.no)}
                      </div>
                      <h3 className="font-display font-bold text-lg text-[#0F172A]">{st.nama}</h3>
                      <p className="text-xs text-[#64748B]">
                        NISN: <span className="font-mono">{nisn}</span> · Kelas {st.kelas} ({jurusan})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModal(null)}
                      className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">No. Urut / User</div>
                      <div className="font-mono font-bold text-[#0F172A] mt-0.5 tabular-nums">
                        #{st.no} / {st.user}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">Ruang &amp; Meja</div>
                      <div className="font-mono font-bold text-[#0F172A] mt-0.5 tabular-nums">
                        RUANG {normalizeRoomLabel(st.ruang)} · {desk ? desk.mejaLabel : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">Jenis Kelamin</div>
                      <div className="font-semibold text-[#0F172A] mt-0.5">
                        {gender === 'L' ? 'Laki-Laki (L)' : 'Perempuan (P)'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">Jurusan</div>
                      <div className="font-semibold text-[#0F172A] mt-0.5">{jurusan}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">Status Ujian</div>
                      <div className="font-bold text-[#15803D] mt-0.5">{status}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                      <div className="text-[#64748B]">Jadwal Paste Nov</div>
                      <div className="font-semibold text-[#0F172A] mt-0.5">
                        {hasSchedule
                          ? `${liveSchedulesMap[st.kelas]?.length ?? 0} Mata Pelajaran`
                          : 'Kelas Kustom'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF2F7]">
                    <button
                      type="button"
                      onClick={() => openEditModal(st)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Data Peserta
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModal(null);
                          onInspectStudentCard(st);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Lihat Kartu PAS 2D
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal(null)}
                        className="px-4 py-2 rounded-lg bg-[#0F295C] hover:bg-[#091D42] text-white text-xs font-bold"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal: Import Data Siswa */}
            {modal.type === 'import' && (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F1FF] text-[#2563EB] flex items-center justify-center">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#0F172A]">
                        Import Data Siswa (CSV / TSV)
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Unggah file daftar peserta untuk memperbarui kartu, stiker meja, &amp; absen
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2] text-xs text-[#334155] space-y-1.5">
                  <div className="font-bold text-[#0F172A]">Format Kolom yang Didukung:</div>
                  <div className="font-mono text-[11px] bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#1D4ED8] overflow-x-auto">
                    No,Nama,Kelas,Ruang,User,NISN,Jurusan,JenisKelamin,Status
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Kolom NISN, Jurusan, JenisKelamin (L/P), dan Status bersifat opsional dan akan
                    terisi otomatis bila tidak dicantumkan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#93C5FD] bg-[#F8FAFF] hover:bg-[#EFF6FF] hover:border-[#2563EB] cursor-pointer transition-colors text-center">
                    <CloudUpload className="w-7 h-7 text-[#2563EB]" />
                    <span className="text-xs font-bold text-[#0F172A]">
                      Pilih File CSV / TSV dari Komputer
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Mendukung pemisah koma (,), titik koma (;), atau tab
                    </span>
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={(ev) => {
                        onImportCsv(ev);
                        setModal(null);
                        setCurrentPage(1);
                      }}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-col justify-between p-4 rounded-xl border border-[#DCE5F2] bg-white space-y-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-[#0F172A]">
                        Unduh Template / Cadangan
                      </div>
                      <p className="text-[11px] text-[#64748B]">
                        Gunakan template resmi atau ekspor data peserta saat ini sebagai cadangan.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={downloadCsvTemplate}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#1E293B]"
                      >
                        <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                        Unduh Template CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportStudentsExcelCsv(students, deskLookup)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Cadangkan Data ({students.length} Siswa)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Validasi Data */}
            {modal.type === 'validate' && (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F3EEFF] text-[#7C3AED] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#0F172A]">
                        Hasil Validasi Data Peserta Ujian
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Audit kelengkapan nomor peserta, NISN, ruang ujian, dan sinkronisasi jadwal
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="w-8 h-8 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                    validationAudit.issuesTotal === 0
                      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                      : 'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]'
                  }`}
                >
                  {validationAudit.issuesTotal === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />
                  )}
                  <div>
                    <div className="font-bold">
                      {validationAudit.issuesTotal === 0
                        ? `Semua ${students.length} Data Peserta Valid & Siap Cetak!`
                        : `Ditemukan ${validationAudit.issuesTotal} catatan pemeriksaan data.`}
                    </div>
                    <div className="text-[11px] opacity-90">
                      Peserta aktif terjadwal: {validationAudit.activeCount} dari {students.length}{' '}
                      peserta di {rooms.length} ruang ujian.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF]">
                    <div className="text-[#64748B]">Duplikasi No. Peserta</div>
                    <div className="font-display font-bold text-lg text-[#0F172A] mt-0.5 tabular-nums">
                      {validationAudit.duplicateNos.length}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {validationAudit.duplicateNos.length === 0
                        ? 'Tidak ada nomor peserta ganda'
                        : `Nomor ganda: ${validationAudit.duplicateNos.join(', ')}`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF]">
                    <div className="text-[#64748B]">Duplikasi NISN</div>
                    <div className="font-display font-bold text-lg text-[#0F172A] mt-0.5 tabular-nums">
                      {validationAudit.duplicateNisns.length}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {validationAudit.duplicateNisns.length === 0
                        ? 'Semua NISN unik'
                        : `NISN ganda: ${validationAudit.duplicateNisns.join(', ')}`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF]">
                    <div className="text-[#64748B]">Kelengkapan Ruang Ujian</div>
                    <div className="font-display font-bold text-lg text-[#0F172A] mt-0.5 tabular-nums">
                      {students.length - validationAudit.missingRoom.length} / {students.length}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {validationAudit.missingRoom.length === 0
                        ? `Terbagi rata di ${rooms.length} ruang ujian`
                        : `${validationAudit.missingRoom.length} peserta belum punya ruang`}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFF]">
                    <div className="text-[#64748B]">Sinkron Jadwal Paste Nov</div>
                    <div className="font-display font-bold text-lg text-[#0F172A] mt-0.5 tabular-nums">
                      {students.length - validationAudit.missingSchedule.length} / {students.length}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      {validationAudit.missingSchedule.length === 0
                        ? 'Seluruh kelas memiliki jadwal ujian lengkap'
                        : `${validationAudit.missingSchedule.length} siswa menggunakan kelas kustom`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF2F7]">
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      onNavigateTab('studio');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Buka Kartu Peserta 2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="px-4 py-2 rounded-lg bg-[#0F295C] hover:bg-[#091D42] text-white text-xs font-bold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
