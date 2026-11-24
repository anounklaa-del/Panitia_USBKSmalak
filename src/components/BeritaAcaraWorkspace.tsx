import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  DoorOpen,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Home,
  Maximize2,
  Printer,
  RotateCcw,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { ProctorRecord } from '../data/proctorData';
import type {
  BeritaAcaraConfig,
  BeritaAcaraFillMode,
  BeritaAcaraLayoutMode,
  MainWorkspaceTab,
  PrepressConfig,
} from '../types/prepress';
import {
  buildBeritaAcaraPrintPages,
  type BeritaAcaraOverride,
  type BeritaAcaraRecord,
} from '../utils/beritaAcaraStore';
import { exportBeritaAcaraPdfBlob } from '../utils/beritaAcaraPdf';
import {
  BeritaAcaraPagesBlock,
  BeritaAcaraSingleSlip,
} from './BeritaAcaraDocumentRenderer';

interface BeritaAcaraWorkspaceProps {
  records: BeritaAcaraRecord[];
  proctors: ProctorRecord[];
  paperConfig: PrepressConfig;
  baConfig: BeritaAcaraConfig;
  academicYear: string;
  onBaConfigChange: (patch: Partial<BeritaAcaraConfig>) => void;
  onSaveOverride: (id: string, override: BeritaAcaraOverride | null) => void;
  onPrintRecords: (recordsToPrint: BeritaAcaraRecord[]) => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

const PAGE_SIZE = 8;

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const BeritaAcaraWorkspace: React.FC<BeritaAcaraWorkspaceProps> = ({
  records,
  proctors,
  paperConfig,
  baConfig,
  academicYear,
  onBaConfigChange,
  onSaveOverride,
  onPrintRecords,
  onNavigateTab,
}) => {
  const [draftDate, setDraftDate] = useState(baConfig.selectedDate);
  const [draftSubject, setDraftSubject] = useState(baConfig.selectedSubject);
  const [draftRoom, setDraftRoom] = useState(baConfig.selectedRoom);
  const [draftProctor, setDraftProctor] = useState(baConfig.selectedProctorCode);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id ?? '');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BeritaAcaraRecord | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Edit modal form state
  const [editAbsentNos, setEditAbsentNos] = useState<string[]>([]);
  const [editAbsentManualCount, setEditAbsentManualCount] = useState<string>('');
  const [editAbsentManualText, setEditAbsentManualText] = useState<string>('');
  const [editBaCopies, setEditBaCopies] = useState<number>(2);
  const [editAttCopies, setEditAttCopies] = useState<number>(2);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editProctorName, setEditProctorName] = useState<string>('');
  const [editProctorNip, setEditProctorNip] = useState<string>('');
  const [studentFilterQuery, setStudentFilterQuery] = useState<string>('');

  // Dropdown options from live records
  const dateOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of records) {
      if (!seen.has(r.date)) {
        seen.add(r.date);
        list.push(r.date);
      }
    }
    return list;
  }, [records]);

  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of records) {
      for (const s of r.subjects) {
        if (s) seen.add(s);
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b, 'id'));
  }, [records]);

  const roomOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of records) {
      seen.add(r.roomLabel);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, 'id'));
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (baConfig.selectedDate && r.date !== baConfig.selectedDate) return false;
      if (
        baConfig.selectedSubject &&
        !r.subjects.includes(baConfig.selectedSubject) &&
        r.subjectLabel !== baConfig.selectedSubject
      ) {
        return false;
      }
      if (baConfig.selectedRoom && r.roomLabel !== baConfig.selectedRoom) return false;
      if (
        baConfig.selectedProctorCode &&
        String(r.proctorCode ?? '') !== baConfig.selectedProctorCode
      ) {
        return false;
      }
      return true;
    });
  }, [
    records,
    baConfig.selectedDate,
    baConfig.selectedSubject,
    baConfig.selectedRoom,
    baConfig.selectedProctorCode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  const activeRecord = useMemo(() => {
    return (
      filteredRecords.find((r) => r.id === selectedRecordId) ??
      pageRows[0] ??
      filteredRecords[0] ??
      records[0] ??
      null
    );
  }, [filteredRecords, pageRows, records, selectedRecordId]);

  // Summary metrics across filtered records
  const summaryStats = useMemo(() => {
    let totalRegistered = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    const roomsSet = new Set<string>();

    for (const r of filteredRecords) {
      totalRegistered += r.registeredCount;
      totalPresent += r.presentCount;
      totalAbsent += r.absentCount;
      roomsSet.add(r.roomLabel);
    }

    const presentPct =
      totalRegistered > 0 ? +((totalPresent / totalRegistered) * 100).toFixed(1) : 100;

    return {
      totalRegistered,
      totalPresent,
      totalAbsent,
      roomCount: roomsSet.size,
      presentPct,
    };
  }, [filteredRecords]);

  // Donut chart geometry
  const donutRadius = 42;
  const donutCirc = 2 * Math.PI * donutRadius;
  const presentFraction =
    summaryStats.totalRegistered > 0
      ? summaryStats.totalPresent / summaryStats.totalRegistered
      : 1;
  const absentFraction = Math.max(0, 1 - presentFraction);
  const presentArc = donutCirc * presentFraction;
  const absentArc = donutCirc * absentFraction;

  const handleApplyFilters = () => {
    onBaConfigChange({
      selectedDate: draftDate,
      selectedSubject: draftSubject,
      selectedRoom: draftRoom,
      selectedProctorCode: draftProctor,
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setDraftDate('');
    setDraftSubject('');
    setDraftRoom('');
    setDraftProctor('');
    onBaConfigChange({
      selectedDate: '',
      selectedSubject: '',
      selectedRoom: '',
      selectedProctorCode: '',
    });
    setCurrentPage(1);
  };

  const hasFilters = Boolean(
    baConfig.selectedDate ||
      baConfig.selectedSubject ||
      baConfig.selectedRoom ||
      baConfig.selectedProctorCode,
  );

  const openEditModal = (rec: BeritaAcaraRecord) => {
    setEditingRecord(rec);
    setEditAbsentNos(rec.absentStudentNos);
    setEditAbsentManualCount(String(rec.absentCount));
    setEditAbsentManualText(rec.absentNumbersText === '-' ? '' : rec.absentNumbersText);
    setEditBaCopies(rec.baCopies);
    setEditAttCopies(rec.attendanceCopies);
    setEditNotes(rec.notes);
    setEditProctorName(rec.proctorName);
    setEditProctorNip(rec.proctorNip);
    setStudentFilterQuery('');
  };

  const toggleStudentAbsent = (no: string) => {
    setEditAbsentNos((prev) => {
      const exists = prev.includes(no);
      const next = exists ? prev.filter((x) => x !== no) : [...prev, no];
      setEditAbsentManualCount(String(next.length));
      setEditAbsentManualText(next.join(', '));
      return next;
    });
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const parsedCount = Math.max(
      0,
      Math.min(
        editingRecord.registeredCount,
        Number(editAbsentManualCount) || editAbsentNos.length,
      ),
    );
    const defaultProctor = proctors.find((p) => p.code === editingRecord.proctorCode);
    const defaultName = defaultProctor?.nama || 'Belum Ditugaskan';
    const defaultNip = defaultProctor?.nip || '';

    onSaveOverride(editingRecord.id, {
      absentStudentNos: editAbsentNos,
      absentCount: parsedCount,
      absentNumbersText:
        editAbsentManualText.trim() || (editAbsentNos.length > 0 ? editAbsentNos.join(', ') : '-'),
      baCopies: Math.max(1, editBaCopies || 2),
      attendanceCopies: Math.max(1, editAttCopies || 2),
      notes: editNotes.trim(),
      proctorNameOverride:
        editProctorName.trim() !== defaultName ? editProctorName.trim() : undefined,
      proctorNipOverride:
        editProctorNip.trim() !== defaultNip ? editProctorNip.trim() : undefined,
    });
    setSelectedRecordId(editingRecord.id);
    setEditingRecord(null);
  };

  const handleExportPdf = async (targetRecords: BeritaAcaraRecord[]) => {
    if (pdfBusy || targetRecords.length === 0) return;
    setPdfBusy(true);
    try {
      const pages = buildBeritaAcaraPrintPages(targetRecords, baConfig.layoutMode);
      const blob = await exportBeritaAcaraPdfBlob(
        pages,
        paperConfig,
        baConfig,
        academicYear,
      );
      const slug =
        targetRecords.length === 1
          ? `${targetRecords[0].roomLabel.replace(/\s+/g, '')}_${targetRecords[0].isoDate}`
          : `${targetRecords.length}_Sesi`;
      triggerBlobDownload(blob, `Berita_Acara_PAS_SMAN1ALALAK_${slug}.pdf`);
    } finally {
      setPdfBusy(false);
    }
  };

  const modalPreviewPages = useMemo(() => {
    if (!activeRecord) return [];
    return buildBeritaAcaraPrintPages([activeRecord], baConfig.layoutMode);
  }, [activeRecord, baConfig.layoutMode]);

  const paginationNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  const displayStart = filteredRecords.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const displayEnd = Math.min(filteredRecords.length, safePage * PAGE_SIZE);

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* ROW 1: Royal Blue Hero Header Banner */}
        <section
          className="relative rounded-2xl overflow-hidden px-5 py-4 lg:px-6 lg:py-4.5 shadow-[0_4px_18px_rgba(9,44,104,0.16)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{
            background: 'linear-gradient(100deg, #072968 0%, #0D44A2 52%, #0A327A 100%)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute -top-12 right-[18%] w-40 h-52 bg-white/[0.05] rotate-[24deg]" />
            <div className="absolute -bottom-14 right-[8%] w-36 h-36 rounded-full bg-[#60A5FA]/10" />
          </div>

          <div className="relative z-10 flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck2 className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white leading-tight text-balance">
                Berita Acara Ujian
              </h1>
              <p className="text-xs sm:text-[13px] text-white/85 mt-0.5 truncate">
                Kelola berita acara pelaksanaan ujian dengan mudah dan terstruktur · Format Resmi Per Lembar (1-Up)
              </p>
            </div>
          </div>

          <nav
            aria-label="Breadcrumb"
            className="relative z-10 flex items-center gap-1.5 text-xs text-white/90 shrink-0"
          >
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="inline-flex items-center gap-1 hover:text-[#FFD43B] transition-colors whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="font-semibold text-[#FFD43B] whitespace-nowrap">Berita Acara</span>
          </nav>
        </section>

        {/* ROW 2: 4-Column Pastel Summary KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Card 1: Peserta Terdaftar */}
          <div
            className="rounded-2xl border border-[#BFDBFE] p-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(37,99,235,0.06)]"
            style={{
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-2xl sm:text-[26px] text-[#1D4ED8] leading-none tabular-nums">
                {summaryStats.totalRegistered.toLocaleString('id-ID')}
              </div>
              <div className="text-xs font-semibold text-[#334155] mt-1">
                Peserta Terdaftar (Sesi)
              </div>
            </div>
          </div>

          {/* Card 2: Hadir */}
          <div
            className="rounded-2xl border border-[#A7F3D0] p-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(16,185,129,0.06)]"
            style={{
              background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-2xl sm:text-[26px] text-[#15803D] leading-none tabular-nums">
                {summaryStats.totalPresent.toLocaleString('id-ID')}
              </div>
              <div className="text-xs font-semibold text-[#334155] mt-1">Hadir</div>
            </div>
          </div>

          {/* Card 3: Tidak Hadir */}
          <div
            className="rounded-2xl border border-[#FECDD3] p-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(239,68,68,0.06)]"
            style={{
              background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-xs">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-2xl sm:text-[26px] text-[#BE123C] leading-none tabular-nums">
                {summaryStats.totalAbsent.toLocaleString('id-ID')}
              </div>
              <div className="text-xs font-semibold text-[#334155] mt-1">Tidak Hadir</div>
            </div>
          </div>

          {/* Card 4: Ruang Ujian */}
          <div
            className="rounded-2xl border border-[#FDE68A] p-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(245,158,11,0.06)]"
            style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-xs">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-2xl sm:text-[26px] text-[#B45309] leading-none tabular-nums">
                {summaryStats.roomCount}
              </div>
              <div className="text-xs font-semibold text-[#334155] mt-1">
                Ruang Ujian ({filteredRecords.length} BA)
              </div>
            </div>
          </div>
        </section>

        {/* ROW 3: Filter & Action Bar */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Pilih Tanggal Ujian"
              value={draftDate}
              onChange={(e) => {
                const v = e.target.value;
                setDraftDate(v);
                onBaConfigChange({ selectedDate: v });
                setCurrentPage(1);
              }}
              className="flex-1 min-w-[155px] px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B]"
            >
              <option value="">Pilih Tanggal Ujian ({dateOptions.length})</option>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Mata Pelajaran"
              value={draftSubject}
              onChange={(e) => {
                const v = e.target.value;
                setDraftSubject(v);
                onBaConfigChange({ selectedSubject: v });
                setCurrentPage(1);
              }}
              className="flex-1 min-w-[165px] px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B]"
            >
              <option value="">Pilih Mata Pelajaran ({subjectOptions.length})</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Ruang"
              value={draftRoom}
              onChange={(e) => {
                const v = e.target.value;
                setDraftRoom(v);
                onBaConfigChange({ selectedRoom: v });
                setCurrentPage(1);
              }}
              className="w-full sm:w-36 px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B]"
            >
              <option value="">Pilih Ruang ({roomOptions.length})</option>
              {roomOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Pengawas"
              value={draftProctor}
              onChange={(e) => {
                const v = e.target.value;
                setDraftProctor(v);
                onBaConfigChange({ selectedProctorCode: v });
                setCurrentPage(1);
              }}
              className="flex-1 min-w-[165px] px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#1E293B]"
            >
              <option value="">Pilih Pengawas ({proctors.length})</option>
              {[...proctors]
                .sort((a, b) => a.code - b.code)
                .map((p) => (
                  <option key={p.id} value={String(p.code)}>
                    [{String(p.code).padStart(2, '0')}] {p.nama}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              Tampilkan
            </button>

            {hasFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset semua filter"
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#475569] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={() => onPrintRecords(filteredRecords)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
              title={`Cetak ${filteredRecords.length} Berita Acara sesuai filter`}
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak BA ({filteredRecords.length})
            </button>

            <button
              type="button"
              disabled={pdfBusy || filteredRecords.length === 0}
              onClick={() => handleExportPdf(filteredRecords)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
              title="Unduh arsip PDF Berita Acara format resmi"
            >
              <Download className="w-3.5 h-3.5" />
              {pdfBusy ? 'Menyusun PDF...' : 'Export PDF'}
            </button>
          </div>
        </section>

        {/* ROW 4: Main 2-Column Content Split */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT: Data Berita Acara Table */}
          <section className="xl:col-span-8 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2.5 bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Data Berita Acara
                </h2>
              </div>

              {/* Format & Fill Mode Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-0.5 bg-white border border-[#CBD5E1] rounded-lg gap-0.5">
                  {(
                    [
                      ['one_up', 'Per Lembar (1-Up)'],
                      ['two_up_duplicate', '2-Up Duplikat'],
                      ['two_up_paired', '2 Sesi/Hal'],
                    ] as Array<[BeritaAcaraLayoutMode, string]>
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBaConfigChange({ layoutMode: mode })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        baConfig.layoutMode === mode
                          ? 'bg-[#1D4ED8] text-white'
                          : 'text-[#475569] hover:text-[#1E293B]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="inline-flex p-0.5 bg-white border border-[#CBD5E1] rounded-lg gap-0.5">
                  {(
                    [
                      ['filled', 'Terisi Data'],
                      ['blank', 'Blangko Kosong'],
                    ] as Array<[BeritaAcaraFillMode, string]>
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBaConfigChange({ fillMode: mode })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        baConfig.fillMode === mode
                          ? 'bg-[#1F3864] text-white'
                          : 'text-[#475569] hover:text-[#1E293B]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] text-[11.5px] font-bold text-[#1E293B]">
                    <th className="py-2.5 px-3 text-center w-10">No</th>
                    <th className="py-2.5 px-3">Mata Pelajaran</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal Ujian</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Ruang</th>
                    <th className="py-2.5 px-3">Pengawas</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Peserta Terdaftar</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Hadir</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Tidak Hadir</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 px-4 text-center text-[#64748B]">
                        <div className="font-display font-bold text-sm text-[#1E293B]">
                          Tidak ada Berita Acara yang cocok dengan filter
                        </div>
                        <p className="text-xs mt-1">
                          Ubah pilihan tanggal, mata pelajaran, ruang, atau pengawas lalu coba lagi.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((rec, idx) => {
                      const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1;
                      const isSelected = activeRecord?.id === rec.id;
                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedRecordId(rec.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-[#475569] tabular-nums">
                            {rowNum}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#1E293B] leading-snug">
                              {rec.subjectLabel}
                            </div>
                            <div className="text-[10.5px] text-[#64748B] font-mono tabular-nums mt-0.5">
                              {rec.time} WITA · {rec.kelasLabel}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[#334155] whitespace-nowrap font-mono text-[11.5px] tabular-nums">
                            {rec.dayNum} {rec.monthName.slice(0, 3)} {rec.year}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1F3864] whitespace-nowrap">
                            {rec.roomLabel}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#1E293B] truncate max-w-[160px]">
                              {rec.proctorName}
                            </div>
                            {rec.proctorCode !== null && (
                              <div className="text-[10px] font-mono text-[#64748B]">
                                Kode {String(rec.proctorCode).padStart(2, '0')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#1E293B] tabular-nums">
                            {rec.registeredCount}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-[#16A34A] tabular-nums">
                            {rec.presentCount}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold tabular-nums">
                            <span
                              className={
                                rec.absentCount > 0 ? 'text-[#E11D48]' : 'text-[#64748B]'
                              }
                            >
                              {rec.absentCount}
                            </span>
                          </td>
                          <td
                            className="py-2.5 px-3 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRecordId(rec.id);
                                  setPreviewModalOpen(true);
                                }}
                                title="Pratinjau Dokumen Berita Acara (Format File 2)"
                                className="w-7 h-7 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(rec)}
                                title="Input Kehadiran & Catatan Berita Acara"
                                className="w-7 h-7 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRecordId(rec.id);
                                  onPrintRecords([rec]);
                                }}
                                title="Cetak Berita Acara Sesi Ini"
                                className="w-7 h-7 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <Printer className="w-3.5 h-3.5" />
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
            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
              <div className="font-mono tabular-nums">
                Menampilkan {displayStart} – {displayEnd} dari {filteredRecords.length} data
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="Halaman pertama"
                  className="w-7 h-7 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  title="Halaman sebelumnya"
                  className="w-7 h-7 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {paginationNumbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCurrentPage(num)}
                    className={`w-7 h-7 rounded-lg font-mono text-xs font-semibold tabular-nums flex items-center justify-center transition-colors ${
                      num === safePage
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'border border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  title="Halaman berikutnya"
                  className="w-7 h-7 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Halaman terakhir"
                  className="w-7 h-7 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: Ringkasan Ujian + Preview Berita Acara */}
          <div className="xl:col-span-4 space-y-4">
            {/* Ringkasan Ujian Donut Card */}
            <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <h2 className="font-display font-bold text-sm text-[#1E293B]">
                  Ringkasan Ujian
                </h2>
              </div>

              <div className="p-4 flex items-center justify-between gap-4">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 108 108" className="w-full h-full -rotate-90">
                    <circle
                      cx="54"
                      cy="54"
                      r={donutRadius}
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="13"
                    />
                    <circle
                      cx="54"
                      cy="54"
                      r={donutRadius}
                      fill="none"
                      stroke="#16A34A"
                      strokeWidth="13"
                      strokeDasharray={`${presentArc} ${donutCirc}`}
                      strokeDashoffset={0}
                    />
                    {absentArc > 0.3 && (
                      <circle
                        cx="54"
                        cy="54"
                        r={donutRadius}
                        fill="none"
                        stroke="#E11D48"
                        strokeWidth="13"
                        strokeDasharray={`${absentArc} ${donutCirc}`}
                        strokeDashoffset={-presentArc}
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-display font-extrabold text-lg text-[#1E293B] leading-none tabular-nums">
                      {String(summaryStats.presentPct).replace('.', ',')}%
                    </span>
                    <span className="text-[11px] font-semibold text-[#475569] mt-0.5">
                      Hadir
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 text-xs min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[#334155]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shrink-0" />
                      Hadir
                    </span>
                    <span className="font-mono font-bold text-[#1E293B] tabular-nums">
                      {summaryStats.totalPresent.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[#334155]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] shrink-0" />
                      Tidak Hadir
                    </span>
                    <span className="font-mono font-bold text-[#1E293B] tabular-nums">
                      {summaryStats.totalAbsent.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#475569]">Total Peserta</span>
                    <span className="font-mono font-extrabold text-[#1E293B] tabular-nums">
                      {summaryStats.totalRegistered.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Preview Berita Acara Card (Exact Format File Kedua) */}
            <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="font-display font-bold text-sm text-[#1E293B] truncate">
                    Preview Berita Acara
                  </h2>
                </div>
                {activeRecord && (
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-semibold whitespace-nowrap transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Perbesar
                  </button>
                )}
              </div>

              <div className="p-3.5 bg-[#E9EEF7]">
                {!activeRecord ? (
                  <div className="bg-white rounded-xl border border-[#CBD5E1] p-6 text-center text-xs text-[#64748B]">
                    Pilih salah satu baris Berita Acara untuk melihat pratinjau dokumen.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Live Miniature Preview of Format File Kedua */}
                    <div
                      onClick={() => setPreviewModalOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setPreviewModalOpen(true);
                      }}
                      title="Klik untuk membuka tampilan dokumen lengkap Format File Kedua"
                      className="bg-white border border-[#94A3B8] shadow-sm rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#2563EB] transition-all"
                    >
                      <div className="p-3 sm:p-4">
                        <BeritaAcaraSingleSlip
                          record={activeRecord}
                          baConfig={baConfig}
                          academicYear={academicYear}
                          compact
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#475569] px-0.5">
                      <span className="font-mono font-semibold text-[#1F3864] truncate">
                        {activeRecord.roomLabel} · {activeRecord.subjectLabel}
                      </span>
                      <span className="font-mono whitespace-nowrap">
                        {baConfig.layoutMode === 'one_up' ? 'Per Lembar (1-Up)' : '2-Up Lanskap'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(activeRecord)}
                        className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#1E293B] text-[11px] font-semibold whitespace-nowrap transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#D97706]" />
                        Isi / Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintRecords([activeRecord])}
                        className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold whitespace-nowrap transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusy}
                        onClick={() => handleExportPdf([activeRecord])}
                        className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-[11px] font-bold whitespace-nowrap transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Full-Screen Format File Kedua Document Preview Modal */}
      {previewModalOpen && activeRecord && (
        <div className="fixed inset-0 z-50 bg-[#041434]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#E9EDF5] w-full max-w-6xl h-[92vh] rounded-2xl border border-[#CBD5E1] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white border-b border-[#E2E8F0] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1F3864] text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-sm text-[#1E293B] truncate">
                    Tampilan Dokumen Berita Acara · Format File Kedua ({activeRecord.roomLabel})
                  </h3>
                  <p className="text-xs text-[#64748B] truncate">
                    {activeRecord.subjectLabel} · {activeRecord.date} · {activeRecord.time} WITA
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                  {(
                    [
                      ['one_up', 'Per Lembar (1-Up)'],
                      ['two_up_duplicate', '2-Up Duplikat'],
                    ] as Array<[BeritaAcaraLayoutMode, string]>
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBaConfigChange({ layoutMode: mode })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        baConfig.layoutMode === mode
                          ? 'bg-[#1F3864] text-white'
                          : 'text-[#475569] hover:text-[#1E293B]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                  {(
                    [
                      ['filled', 'Terisi Data'],
                      ['blank', 'Blangko Kosong'],
                    ] as Array<[BeritaAcaraFillMode, string]>
                  ).map(([mode, lbl]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBaConfigChange({ fillMode: mode })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        baConfig.fillMode === mode
                          ? 'bg-[#2563EB] text-white'
                          : 'text-[#475569] hover:text-[#1E293B]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 px-2">
                  <input
                    type="range"
                    min={45}
                    max={110}
                    value={baConfig.zoomPct}
                    onChange={(e) => onBaConfigChange({ zoomPct: Number(e.target.value) })}
                    className="w-20 accent-[#1F3864]"
                    aria-label="Zoom dokumen berita acara"
                  />
                  <span className="font-mono text-xs font-semibold text-[#1F3864] w-9 text-right tabular-nums">
                    {baConfig.zoomPct}%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onPrintRecords([activeRecord])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold whitespace-nowrap transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Dokumen
                </button>

                <button
                  type="button"
                  disabled={pdfBusy}
                  onClick={() => handleExportPdf([activeRecord])}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfBusy ? 'Menyusun...' : 'Unduh PDF'}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  aria-label="Tutup pratinjau dokumen"
                  className="w-8 h-8 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#475569] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Document Canvas */}
            <div className="flex-1 overflow-auto p-6">
              <div
                style={{
                  zoom: baConfig.zoomPct / 100,
                  transformOrigin: 'top center',
                }}
              >
                <BeritaAcaraPagesBlock
                  pages={modalPreviewPages}
                  paperConfig={paperConfig}
                  baConfig={baConfig}
                  academicYear={academicYear}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Kehadiran & Catatan Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-[#041434]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditModal}
            className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl border border-[#CBD5E1] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="font-display font-bold text-sm text-[#1E293B]">
                  Input Kehadiran &amp; Catatan Berita Acara · {editingRecord.roomLabel}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {editingRecord.subjectLabel} · {editingRecord.date} ({editingRecord.time} WITA)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                aria-label="Tutup form edit"
                className="w-8 h-8 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#475569] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Attendance Summary Strip */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div>
                  <div className="text-[#64748B] font-medium">Seharusnya</div>
                  <div className="font-mono font-extrabold text-base text-[#1E293B] tabular-nums">
                    {editingRecord.registeredCount} Orang
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Yang Hadir</div>
                  <div className="font-mono font-extrabold text-base text-[#16A34A] tabular-nums">
                    {Math.max(
                      0,
                      editingRecord.registeredCount - (Number(editAbsentManualCount) || 0),
                    )}{' '}
                    Orang
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B] font-medium">Tidak Hadir</div>
                  <div className="font-mono font-extrabold text-base text-[#E11D48] tabular-nums">
                    {Number(editAbsentManualCount) || 0} Orang
                  </div>
                </div>
              </div>

              {/* Checklist of Room Participants to mark absent */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="font-semibold text-[#1E293B]">
                    Tandai Peserta Tidak Hadir ({editingRecord.participants.length} siswa di{' '}
                    {editingRecord.roomLabel})
                  </label>
                  <input
                    type="text"
                    placeholder="Cari nama / no. peserta..."
                    value={studentFilterQuery}
                    onChange={(e) => setStudentFilterQuery(e.target.value)}
                    className="w-48 px-2.5 py-1 rounded-lg border border-[#CBD5E1] text-xs"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-[#CBD5E1] divide-y divide-[#F1F5F9]">
                  {editingRecord.participants
                    .filter((st) => {
                      const q = studentFilterQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        st.nama.toLowerCase().includes(q) ||
                        st.no.toLowerCase().includes(q) ||
                        st.kelas.toLowerCase().includes(q)
                      );
                    })
                    .map((st) => {
                      const isAbsent = editAbsentNos.includes(st.no);
                      return (
                        <label
                          key={st.no}
                          className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            isAbsent ? 'bg-[#FFF1F2]' : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isAbsent}
                              onChange={() => toggleStudentAbsent(st.no)}
                              className="accent-[#E11D48]"
                            />
                            <span className="font-mono font-bold text-[#1F3864] shrink-0">
                              #{st.no}
                            </span>
                            <span className="font-medium text-[#1E293B] truncate">
                              {st.nama}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[#475569] shrink-0">
                            {st.kelas} {isAbsent ? '· Tidak Hadir' : ''}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Jumlah Tidak Hadir
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={editingRecord.registeredCount}
                    value={editAbsentManualCount}
                    onChange={(e) => setEditAbsentManualCount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#334155] mb-1">
                    Nomor Peserta Tidak Hadir
                  </label>
                  <input
                    type="text"
                    placeholder="Kosong atau contoh: 012, 045"
                    value={editAbsentManualText}
                    onChange={(e) => setEditAbsentManualText(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Berita Acara (Eks.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editBaCopies}
                    onChange={(e) => setEditBaCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Daftar Hadir (Eks.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editAttCopies}
                    onChange={(e) => setEditAttCopies(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Nama Pengawas
                  </label>
                  <input
                    type="text"
                    value={editProctorName}
                    onChange={(e) => setEditProctorName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    NIP Pengawas
                  </label>
                  <input
                    type="text"
                    placeholder="Opsional"
                    value={editProctorNip}
                    onChange={(e) => setEditProctorNip(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Catatan Selama Pelaksanaan Penilaian Sumatif
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pelaksanaan ujian berjalan dengan tertib, aman, dan lancar."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1]"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSaveOverride(editingRecord.id, null);
                  setEditingRecord(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#475569]"
              >
                Reset Sesi Ini
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#334155]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
