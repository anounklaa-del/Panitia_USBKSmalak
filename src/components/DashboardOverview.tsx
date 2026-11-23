import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MapPin,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  Zap,
} from 'lucide-react';
import { type ScheduleRow, type StudentRecord } from '../data/pasData';
import type {
  AttendanceConfig,
  MainWorkspaceTab,
  PrepressConfig,
  SeatingConfig,
  StickerConfig,
} from '../types/prepress';
import {
  compareNumericStrings,
  extractClassTier,
  formatParticipantNo,
  normalizeRoomLabel,
} from '../utils/deskStickerBuilder';
import {
  buildCombinedScheduleRows,
  getLiveSchedulesMap,
  parseIndonesianDate,
  type ExamScheduleEntry,
} from '../utils/scheduleStore';
import { type CommitteeMember } from '../data/committeeData';
import { CommitteeAvatar } from './CommitteeAvatars';

interface DashboardOverviewProps {
  students: StudentRecord[];
  filteredStudents: StudentRecord[];
  committeeMembers: CommitteeMember[];
  schedulesMap?: Record<string, ScheduleRow[]>;
  scheduleEntries?: ExamScheduleEntry[];
  config: PrepressConfig;
  stickerConfig: StickerConfig;
  seatingConfig: SeatingConfig;
  attendanceConfig: AttendanceConfig;
  stats: {
    cardsPerSheet: number;
    cardSheets: number;
    stickerCount: number;
    stickerSheets: number;
    seatingPages: number;
    attendancePages: number;
    missingScheduleCount: number;
  };
  onNavigateTab: (tab: MainWorkspaceTab) => void;
  onQuickJumpRoom: (
    room: string,
    targetTab: 'studio' | 'sticker' | 'seating' | 'attendance',
  ) => void;
  onUseScheduleForAttendance: (session: {
    subject: string;
    date: string;
    time: string;
  }) => void;
  onPrintCards: () => void;
}

interface RoomSummaryRow {
  room: string;
  studentsCount: number;
  desksCount: number;
  classesLabel: string;
  tierCounts: { X: number; XI: number; XII: number };
  firstNo: string;
  lastNo: string;
}

type SortOption = 'room_asc' | 'count_desc' | 'count_asc';

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  students,
  filteredStudents,
  committeeMembers,
  schedulesMap,
  scheduleEntries,
  stickerConfig,
  attendanceConfig,
  stats,
  onNavigateTab,
  onQuickJumpRoom,
  onUseScheduleForAttendance,
  onPrintCards,
}) => {
  const [roomSearch, setRoomSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('room_asc');
  const [selectedScheduleTier, setSelectedScheduleTier] = useState<'Gabungan' | 'X' | 'XI' | 'XII'>('Gabungan');
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [showCommitteeDetail, setShowCommitteeDetail] = useState(false);

  const liveSchedulesMap = schedulesMap ?? getLiveSchedulesMap();

  const classList = useMemo(
    () =>
      [...new Set(students.map((s) => s.kelas.trim()).filter(Boolean))].sort(compareNumericStrings),
    [students],
  );

  const uniqueSubjectsCount = useMemo(() => {
    const subjects = new Set<string>();
    for (const rows of Object.values(liveSchedulesMap)) {
      for (const [, , subj] of rows) {
        if (subj) subjects.add(subj);
      }
    }
    return subjects.size;
  }, [liveSchedulesMap]);

  const scheduleDateRangeText = useMemo(() => {
    const dates: Array<{ raw: string; ts: number }> = [];
    const seen = new Set<string>();
    for (const rows of Object.values(liveSchedulesMap)) {
      for (const [date] of rows) {
        if (!seen.has(date)) {
          seen.add(date);
          dates.push({ raw: date, ts: parseIndonesianDate(date)?.getTime() ?? 0 });
        }
      }
    }
    dates.sort((a, b) => a.ts - b.ts);
    if (dates.length === 0) return 'Belum dijadwalkan';
    if (dates.length === 1) return dates[0].raw;
    const firstShort = dates[0].raw.replace(/^[^,]+,\s*/, '');
    const lastShort = dates[dates.length - 1].raw.replace(/^[^,]+,\s*/, '');
    return `${firstShort} – ${lastShort}`;
  }, [liveSchedulesMap]);

  const roomRows = useMemo<RoomSummaryRow[]>(() => {
    const map = new Map<string, StudentRecord[]>();
    for (const st of students) {
      const r = normalizeRoomLabel(st.ruang);
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(st);
    }

    const list: RoomSummaryRow[] = [];
    for (const [room, members] of map.entries()) {
      const sorted = [...members].sort((a, b) => compareNumericStrings(a.no, b.no));
      const classSet = [...new Set(sorted.map((s) => s.kelas.trim()).filter(Boolean))].sort(
        compareNumericStrings,
      );
      const tierCounts = { X: 0, XI: 0, XII: 0 };
      for (const m of sorted) {
        const t = extractClassTier(m.kelas);
        if (t === 'X' || t === 'XI' || t === 'XII') tierCounts[t] += 1;
      }
      let desksCount = 0;
      if (stickerConfig.groupingMode === 'tier_room') {
        desksCount = Math.max(tierCounts.X, tierCounts.XI, tierCounts.XII);
      } else {
        const byClass = new Map<string, number>();
        for (const m of sorted) {
          byClass.set(m.kelas, (byClass.get(m.kelas) ?? 0) + 1);
        }
        desksCount = Math.max(1, ...Array.from(byClass.values()));
      }

      list.push({
        room,
        studentsCount: sorted.length,
        desksCount,
        classesLabel: classSet.join(', '),
        tierCounts,
        firstNo: sorted[0]?.no ?? '-',
        lastNo: sorted[sorted.length - 1]?.no ?? '-',
      });
    }

    return list.sort((a, b) => compareNumericStrings(a.room, b.room));
  }, [students, stickerConfig.groupingMode]);

  const filteredRoomRows = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const base = q
      ? roomRows.filter(
          (r) =>
            `ruang ${r.room}`.toLowerCase().includes(q) ||
            r.classesLabel.toLowerCase().includes(q) ||
            r.firstNo.includes(q) ||
            r.lastNo.includes(q),
        )
      : roomRows;

    const copy = [...base];
    if (sortBy === 'count_desc') {
      copy.sort((a, b) => b.studentsCount - a.studentsCount || compareNumericStrings(a.room, b.room));
    } else if (sortBy === 'count_asc') {
      copy.sort((a, b) => a.studentsCount - b.studentsCount || compareNumericStrings(a.room, b.room));
    } else {
      copy.sort((a, b) => compareNumericStrings(a.room, b.room));
    }
    return copy;
  }, [roomRows, roomSearch, sortBy]);

  const totalDesks = useMemo(
    () => roomRows.reduce((sum, r) => sum + r.desksCount, 0),
    [roomRows],
  );
  const totalPrintPages =
    stats.cardSheets + stats.stickerSheets + stats.seatingPages + stats.attendancePages;
  const scheduledStudentsCount = Math.max(0, students.length - stats.missingScheduleCount);
  const readinessPct =
    students.length > 0 ? Math.round((scheduledStudentsCount / students.length) * 100) : 100;

  // Donut chart segments (circumference for r=44 -> ~276.46)
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const readyFraction = students.length > 0 ? scheduledStudentsCount / students.length : 1;
  const missingFraction = Math.max(0, 1 - readyFraction);
  const blueLen = circ * (readyFraction * 0.52);
  const greenLen = circ * (readyFraction * 0.48);
  const amberLen = circ * missingFraction;

  // Representative schedule rows per tier or Gabungan Semua Kelas from live schedules
  const tierSchedules = useMemo<Array<[string, string, string, string?]>>(() => {
    if (selectedScheduleTier === 'Gabungan') {
      if (scheduleEntries && scheduleEntries.length > 0) {
        return buildCombinedScheduleRows(
          scheduleEntries.filter((e) => e.status === 'Aktif'),
          classList,
        ).map((c) => [c.date, c.timeLabel, c.subject, c.kelasLabel]);
      }
      const seen = new Map<string, [string, string, string, string?]>();
      for (const rows of Object.values(liveSchedulesMap)) {
        for (const [d, t, s] of rows) {
          const k = `${d}|${s}`;
          if (!seen.has(k)) seen.set(k, [d, t, s, 'Gabungan']);
        }
      }
      return [...seen.values()];
    }
    const sampleKey = Object.keys(liveSchedulesMap).find(
      (k) => extractClassTier(k) === selectedScheduleTier && liveSchedulesMap[k].length > 0,
    );
    return sampleKey ? liveSchedulesMap[sampleKey].map(([d, t, s]) => [d, t, s]) : [];
  }, [selectedScheduleTier, scheduleEntries, liveSchedulesMap, classList]);

  const visibleSchedules = showAllSchedules ? tierSchedules : tierSchedules.slice(0, 4);

  const featuredCommittee = useMemo(() => {
    const active = committeeMembers.filter((m) => m.status === 'Aktif');
    const pool = active.length > 0 ? active : committeeMembers;
    return pool.slice(0, 5);
  }, [committeeMembers]);

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* ROW 1: Hero Welcome Banner (8 cols) + Informasi Pelaksanaan (4 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Hero Welcome Banner */}
          <section className="xl:col-span-8 relative rounded-2xl overflow-hidden shadow-[0_4px_18px_rgba(9,44,104,0.14)] min-h-[192px] flex items-center bg-[#062458]">
            {/* School Building Right Image */}
            <img
              src="/src/assets/images/sman1_alalak_building_1795448237432.jpg"
              alt="Gedung SMA Negeri 1 Alalak"
              className="absolute inset-0 w-full h-full object-cover object-[86%_36%]"
            />

            {/* Navy Gradient Scrim on Left for High-Contrast Typography */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(95deg, #052154 0%, #09327A 44%, rgba(9,50,122,0.72) 58%, rgba(9,50,122,0.08) 78%, transparent 100%)',
              }}
            />

            {/* Bottom-Right Decorative Curved Gold & Royal Blue Ribbon Swoosh */}
            <svg
              viewBox="0 0 320 192"
              className="absolute right-0 bottom-0 h-full w-auto pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M205,192 C258,145 292,82 320,0 L320,192 Z"
                fill="#0D3C8E"
                opacity="0.92"
              />
              <path
                d="M175,192 C236,155 276,94 316,0 L320,0 C282,98 242,158 192,192 Z"
                fill="#FACC15"
              />
            </svg>

            {/* Left Text Content */}
            <div className="relative z-10 px-6 py-5 lg:px-7 max-w-xl">
              <p className="text-xs sm:text-sm font-medium text-white/90">
                Selamat Datang di
              </p>
              <h1 className="font-display font-extrabold text-xl sm:text-[26px] lg:text-[28px] text-white leading-[1.15] tracking-tight mt-0.5 text-balance">
                Sistem Manajemen
                <br />
                Panitia Ulangan
              </h1>
              <div className="mt-2.5 inline-block px-3.5 py-1 rounded-full bg-[#FACC15] text-[#092252] font-display font-extrabold text-xs sm:text-[13px] tracking-wide shadow-xs">
                SMA NEGERI 1 ALALAK
              </div>
              <p className="mt-2.5 text-[11.5px] sm:text-xs italic text-white/90">
                &ldquo;Mewujudkan Ulangan yang Jujur, Tertib dan Berkualitas&rdquo;
              </p>
            </div>
          </section>

          {/* Informasi Pelaksanaan Card */}
          <section className="xl:col-span-4 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Informasi Pelaksanaan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('schedule')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
              >
                Jadwal
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-xl bg-gradient-to-b from-[#DCEBFF] to-[#CEE2FF] border border-[#BFDBFE] py-2.5 px-3 text-center">
              <div className="font-display font-bold text-[12.5px] text-[#1D4ED8]">
                Ulangan Semester Ganjil
              </div>
              <div className="font-display font-bold text-xs text-[#1E40AF] tabular-nums mt-0.5">
                Tahun Pelajaran {attendanceConfig.academicYear || '2026/2027'}
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#334155]">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-[#475569] mt-0.5 shrink-0" />
                <span className="w-24 text-[#475569] shrink-0">Hari / Tanggal</span>
                <span className="font-semibold text-[#1E293B] tabular-nums">
                  : {scheduleDateRangeText}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[#475569] mt-0.5 shrink-0" />
                <span className="w-24 text-[#475569] shrink-0">Waktu</span>
                <span className="font-semibold text-[#1E293B] tabular-nums">
                  : 08.00 – 11.40 WITA
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-[#475569] mt-0.5 shrink-0" />
                <span className="w-24 text-[#475569] shrink-0">Tempat</span>
                <span className="font-semibold text-[#1E293B]">
                  : {roomRows.length} Ruang Ujian Sesuai Jadwal
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ROW 2: 4-Column Vibrant Gradient KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Peserta Ujian */}
          <button
            type="button"
            onClick={() => onNavigateTab('students')}
            className="group relative rounded-2xl p-4 text-left text-white overflow-hidden shadow-[0_4px_14px_rgba(37,99,235,0.22)] hover:-translate-y-0.5 transition-transform duration-150"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            }}
          >
            <svg
              viewBox="0 0 240 60"
              className="absolute inset-x-0 bottom-0 w-full h-12 opacity-20 pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0,36 C60,10 130,52 240,22 L240,60 L0,60 Z" fill="#FFFFFF" />
            </svg>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl leading-none tabular-nums">
                    {students.length}
                  </div>
                  <div className="text-xs font-medium text-white/90 mt-1 truncate">
                    Peserta Ujian
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-white/95 bg-white/15 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                {classList.length} Kelas
              </span>
            </div>
          </button>

          {/* Card 2: Ruang Ujian */}
          <button
            type="button"
            onClick={() => onNavigateTab('seating')}
            className="group relative rounded-2xl p-4 text-left text-white overflow-hidden shadow-[0_4px_14px_rgba(16,185,129,0.22)] hover:-translate-y-0.5 transition-transform duration-150"
            style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #059669 100%)',
            }}
          >
            <svg
              viewBox="0 0 240 60"
              className="absolute inset-x-0 bottom-0 w-full h-12 opacity-20 pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0,28 C70,50 150,12 240,38 L240,60 L0,60 Z" fill="#FFFFFF" />
            </svg>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl leading-none tabular-nums">
                    {roomRows.length}
                  </div>
                  <div className="text-xs font-medium text-white/90 mt-1 truncate">
                    Ruang Ujian
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-white/95 bg-white/15 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                {totalDesks} Meja
              </span>
            </div>
          </button>

          {/* Card 3: Kartu & Lembar Cetak */}
          <button
            type="button"
            onClick={() => onNavigateTab('studio')}
            className="group relative rounded-2xl p-4 text-left text-white overflow-hidden shadow-[0_4px_14px_rgba(245,158,11,0.24)] hover:-translate-y-0.5 transition-transform duration-150"
            style={{
              background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 55%, #EA580C 100%)',
            }}
          >
            <svg
              viewBox="0 0 240 60"
              className="absolute inset-x-0 bottom-0 w-full h-12 opacity-20 pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0,40 C80,14 160,52 240,26 L240,60 L0,60 Z" fill="#FFFFFF" />
            </svg>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl leading-none tabular-nums">
                    {totalPrintPages}
                  </div>
                  <div className="text-xs font-medium text-white/95 mt-1 truncate">
                    Halaman Cetak
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-white/95 bg-black/15 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                {stats.cardSheets} Kartu
              </span>
            </div>
          </button>

          {/* Card 4: Mata Pelajaran */}
          <button
            type="button"
            onClick={() => onNavigateTab('schedule')}
            className="group relative rounded-2xl p-4 text-left text-white overflow-hidden shadow-[0_4px_14px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 transition-transform duration-150"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
            }}
          >
            <svg
              viewBox="0 0 240 60"
              className="absolute inset-x-0 bottom-0 w-full h-12 opacity-20 pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0,26 C65,48 145,10 240,34 L240,60 L0,60 Z" fill="#FFFFFF" />
            </svg>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-extrabold text-3xl leading-none tabular-nums">
                    {uniqueSubjectsCount}
                  </div>
                  <div className="text-xs font-medium text-white/90 mt-1 truncate">
                    Mata Pelajaran
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-white/95 bg-white/15 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                {stats.attendancePages} Absen
              </span>
            </div>
          </button>
        </section>

        {/* ROW 3: Statistik Pelaksanaan (4 cols) + Jadwal Ulangan Mendatang (5 cols) + Aksi Cepat (3 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Statistik Pelaksanaan Ujian */}
          <section className="xl:col-span-4 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-display font-bold text-sm text-[#1E293B]">
                Statistik Pelaksanaan Ujian
              </h2>
            </div>

            <div className="flex items-center justify-center gap-5 my-auto py-2">
              {/* Donut Ring */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="14"
                  />
                  {/* Blue arc */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="14"
                    strokeDasharray={`${blueLen} ${circ}`}
                    strokeDashoffset={0}
                  />
                  {/* Green arc */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="14"
                    strokeDasharray={`${greenLen} ${circ}`}
                    strokeDashoffset={-blueLen}
                  />
                  {/* Amber arc (if any missing schedules) */}
                  {amberLen > 0.5 && (
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="14"
                      strokeDasharray={`${amberLen} ${circ}`}
                      strokeDashoffset={-(blueLen + greenLen)}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                  <span className="font-display font-extrabold text-xl text-[#1E293B] leading-none tabular-nums">
                    {readinessPct}%
                  </span>
                  <span className="text-[10.5px] font-medium text-[#475569] leading-tight mt-1">
                    Persiapan
                    <br />
                    Lengkap
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2.5 text-xs min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[#334155] truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shrink-0" />
                    Peserta Terjadwal
                  </span>
                  <span className="font-mono font-bold text-[#1E293B] tabular-nums whitespace-nowrap">
                    {scheduledStudentsCount} ({readinessPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[#334155] truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
                    Filter Kartu Aktif
                  </span>
                  <span className="font-mono font-bold text-[#1E293B] tabular-nums whitespace-nowrap">
                    {filteredStudents.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[#334155] truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                    Belum Terjadwal
                  </span>
                  <span className="font-mono font-bold text-[#1E293B] tabular-nums whitespace-nowrap">
                    {stats.missingScheduleCount}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Jadwal Ulangan Mendatang */}
          <section className="xl:col-span-5 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Jadwal Ulangan Mendatang
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                  {(['Gabungan', 'X', 'XI', 'XII'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedScheduleTier(tier)}
                      className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold transition-colors ${
                        selectedScheduleTier === tier
                          ? 'bg-[#1D4ED8] text-white'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllSchedules((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#1D4ED8] whitespace-nowrap"
                >
                  {showAllSchedules ? 'Ringkas' : 'Semua'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('schedule')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
                >
                  Kelola
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#334155]">
                    <th className="py-2 px-2.5 w-8">No</th>
                    <th className="py-2 px-2.5">Mata Pelajaran</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">Hari / Tanggal</th>
                    <th className="py-2 px-2.5 whitespace-nowrap">Waktu</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Absen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {visibleSchedules.map(([date, time, subject, scopeLabel], idx) => (
                    <tr
                      key={`${date}-${time}-${subject}-${idx}`}
                      className="hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="py-2 px-2.5 font-mono text-[#64748B] tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-[#1E293B] truncate max-w-[140px]">
                        <div>{subject}</div>
                        {scopeLabel && (
                          <div className="text-[10px] font-normal text-[#2563EB] truncate">
                            Kelas {scopeLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-[#475569] whitespace-nowrap">{date}</td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-[#475569] tabular-nums whitespace-nowrap">
                        {time}
                      </td>
                      <td className="py-2 px-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onUseScheduleForAttendance({
                              subject,
                              date,
                              time,
                            })
                          }
                          className="px-2 py-0.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#1D4ED8] hover:text-white text-[#1D4ED8] text-[10.5px] font-semibold transition-colors"
                        >
                          Pakai
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Aksi Cepat */}
          <section className="xl:col-span-3 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-display font-bold text-sm text-[#1E293B]">Aksi Cepat</h2>
            </div>

            <div className="space-y-2 flex-1 flex flex-col justify-between">
              {[
                {
                  label: 'Kelola Data Peserta',
                  tab: 'students' as MainWorkspaceTab,
                  icon: <Users className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#2563EB]',
                },
                {
                  label: 'Kelola Jadwal Ulangan',
                  tab: 'schedule' as MainWorkspaceTab,
                  icon: <CalendarDays className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#7C3AED]',
                },
                {
                  label: 'Atur Pembagian Ruang',
                  tab: 'seating' as MainWorkspaceTab,
                  icon: <LayoutGrid className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#F59E0B]',
                },
                {
                  label: 'Atur Pengawas Ujian',
                  tab: 'proctor' as MainWorkspaceTab,
                  icon: <ShieldCheck className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#0284C7]',
                },
                {
                  label: 'Cetak Kartu Peserta',
                  tab: 'studio' as MainWorkspaceTab,
                  icon: <CreditCard className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#0EA5E9]',
                },
                {
                  label: 'Cetak Daftar Hadir',
                  tab: 'attendance' as MainWorkspaceTab,
                  icon: <ClipboardCheck className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#10B981]',
                },
                {
                  label: 'Berita Acara Ujian',
                  tab: 'berita_acara' as MainWorkspaceTab,
                  icon: <FileCheck2 className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#0D9488]',
                },
                {
                  label: 'Stiker Meja & Ekspor',
                  tab: 'sticker' as MainWorkspaceTab,
                  icon: <Tag className="w-3.5 h-3.5 text-white" />,
                  badgeBg: 'bg-[#1E3A8A]',
                },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onNavigateTab(action.tab)}
                  className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] transition-colors group"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg ${action.badgeBg} flex items-center justify-center shrink-0 shadow-2xs`}
                    >
                      {action.icon}
                    </span>
                    <span className="text-xs font-semibold text-[#1E293B] group-hover:text-[#1D4ED8] truncate">
                      {action.label}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#1D4ED8] shrink-0" />
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ROW 4: Tim Panitia (5 cols) + Berita Acara & Laporan (4 cols) + Sistem Siap Digunakan! (3 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Tim Panitia */}
          <section className="xl:col-span-5 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">Tim Panitia</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCommitteeDetail((prev) => !prev)}
                  className="text-xs font-semibold text-[#475569] hover:text-[#1D4ED8] whitespace-nowrap"
                >
                  {showCommitteeDetail ? 'Ringkas' : 'Lihat Detail'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('committee')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
                >
                  Kelola
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center my-auto">
              {featuredCommittee.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onNavigateTab('committee')}
                  className="flex flex-col items-center p-1.5 rounded-xl hover:bg-[#F8FAFC] transition-colors text-center"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#E2E8F0] shadow-xs mb-1.5">
                    <CommitteeAvatar variant={member.avatarVariant} className="w-full h-full" />
                  </div>
                  <div className="text-[11px] font-bold text-[#1E293B] leading-tight">
                    {member.jabatan === 'Ketua Panitia' ? 'Ketua' : member.jabatan}
                  </div>
                  <div className="text-[10.5px] text-[#475569] leading-tight mt-0.5 line-clamp-2">
                    {member.nama}
                  </div>
                  {showCommitteeDetail && (
                    <div className="text-[9.5px] text-[#1D4ED8] mt-1 leading-tight line-clamp-2">
                      {member.ruangTugas}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Berita Acara & Laporan */}
          <section className="xl:col-span-4 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Berita Acara &amp; Laporan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('berita_acara')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap"
              >
                Lihat Semua
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9] my-auto">
              {[
                {
                  badge: 'BA',
                  badgeClass: 'bg-[#1D4ED8] text-white',
                  title: 'Berita Acara Pelaksanaan Ujian (Format 2-Up)',
                  date: '23 Nov 2026',
                  tab: 'berita_acara' as MainWorkspaceTab,
                },
                {
                  badge: 'PDF',
                  badgeClass: 'bg-[#EF4444] text-white',
                  title: `Kartu Peserta & Kode QR (${stats.cardSheets} Hal)`,
                  date: '23 Nov 2026',
                  tab: 'studio' as MainWorkspaceTab,
                },
                {
                  badge: 'XLS',
                  badgeClass: 'bg-[#10B981] text-white',
                  title: `Rekap Kehadiran Peserta (${stats.attendancePages} Hal)`,
                  date: '23 Nov 2026',
                  tab: 'attendance' as MainWorkspaceTab,
                },
                {
                  badge: 'PDF',
                  badgeClass: 'bg-[#EF4444] text-white',
                  title: 'Arsip Pracetak PDF/X-1a & ZIP',
                  date: '23 Nov 2026',
                  tab: 'export' as MainWorkspaceTab,
                },
              ].map((doc) => (
                <button
                  key={doc.title}
                  type="button"
                  onClick={() => onNavigateTab(doc.tab)}
                  className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] px-1.5 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-md ${doc.badgeClass} font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs`}
                    >
                      {doc.badge}
                    </span>
                    <span className="text-xs font-medium text-[#1E293B] group-hover:text-[#1D4ED8] truncate">
                      {doc.title}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B] tabular-nums whitespace-nowrap shrink-0">
                    {doc.date}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Sistem Siap Digunakan! */}
          <section className="xl:col-span-3 rounded-2xl border border-[#A7F3D0] bg-gradient-to-b from-[#ECFDF5] to-[#DCFCE7] shadow-[0_2px_10px_rgba(16,185,129,0.08)] p-4 flex flex-col items-center justify-center text-center gap-2.5">
            <div className="w-12 h-12 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-sm">
              <Check className="w-7 h-7 stroke-[2.75]" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-sm text-[#14532D]">
                Sistem Siap Digunakan!
              </h2>
              <p className="text-[11.5px] text-[#166534] leading-snug mt-1">
                {stats.missingScheduleCount === 0
                  ? 'Semua persiapan telah lengkap untuk pelaksanaan ulangan.'
                  : `${scheduledStudentsCount}/${students.length} siswa siap cetak.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onPrintCards}
              className="mt-1 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98] whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Mulai Cetak Kartu PAS
            </button>
          </section>
        </div>

        {/* BELOW-THE-FOLD: Distribusi Ruang Ujian & Akses Dokumen per Ruang */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="p-4 lg:px-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Distribusi Ruang Ujian &amp; Akses Dokumen per Ruang
                </h2>
                <p className="text-xs text-[#64748B]">
                  Klik tombol pada tiap ruang untuk langsung membuka Kartu, Stiker, Denah, atau Absen.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Cari ruang / kelas..."
                  className="pl-8 pr-3 py-1.5 w-44 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] focus:border-[#1D4ED8]"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Urutkan ruang"
                className="px-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="room_asc">Urut Ruang</option>
                <option value="count_desc">Siswa Terbanyak</option>
                <option value="count_asc">Siswa Tersedikit</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#44546A]">
                  <th className="py-2.5 px-4 whitespace-nowrap">Ruang</th>
                  <th className="py-2.5 px-3">Rombel / Kelas</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Rentang No.</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Siswa</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Meja</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Buka Langsung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredRoomRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-[#64748B]">
                      Tidak ada ruang yang cocok dengan pencarian &ldquo;{roomSearch}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filteredRoomRows.map((row) => (
                    <tr key={row.room} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-4 font-display font-bold text-[#1E3A8A] whitespace-nowrap">
                        RUANG {row.room}
                      </td>
                      <td className="py-2.5 px-3 text-[#334155]">
                        <div className="truncate max-w-[220px]" title={row.classesLabel}>
                          {row.classesLabel}
                        </div>
                        <div className="font-mono text-[10px] text-[#64748B] tabular-nums">
                          X:{row.tierCounts.X} · XI:{row.tierCounts.XI} · XII:{row.tierCounts.XII}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#44546A] tabular-nums whitespace-nowrap">
                        {formatParticipantNo(row.firstNo).split('/').pop()} –{' '}
                        {formatParticipantNo(row.lastNo).split('/').pop()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#131C31] tabular-nums whitespace-nowrap">
                        {row.studentsCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#44546A] tabular-nums whitespace-nowrap">
                        {row.desksCount}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onQuickJumpRoom(row.room, 'studio')}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#334155] hover:text-[#1D4ED8] transition-colors"
                          >
                            Kartu
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickJumpRoom(row.room, 'sticker')}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#334155] hover:text-[#1D4ED8] transition-colors"
                          >
                            Stiker
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickJumpRoom(row.room, 'seating')}
                            className="px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#334155] hover:text-[#1D4ED8] transition-colors"
                          >
                            Denah
                          </button>
                          <button
                            type="button"
                            onClick={() => onQuickJumpRoom(row.room, 'attendance')}
                            className="px-2.5 py-1 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-[11px] font-semibold text-white shadow-2xs transition-colors"
                          >
                            Absen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
