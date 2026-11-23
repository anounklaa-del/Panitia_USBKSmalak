import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Printer,
} from 'lucide-react';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import {
  PAPER_DIMENSIONS,
  type AttendanceConfig,
  type AttendanceGroupingMode,
  type AttendanceOrderMode,
  type PaperPreset,
  type PrepressConfig,
  type StickerGroupingMode,
} from '../types/prepress';
import {
  buildAttendanceCsv,
  buildAttendancePages,
  computeAutoAttendanceRowsPerPage,
  getAvailableScheduleSessions,
  getSortedClassList,
} from '../utils/attendanceBuilder';
import { getSortedRoomList } from '../utils/deskStickerBuilder';
import { getSeatingPaperDimensions } from '../utils/seatingPlanBuilder';
import { AttendanceSheetPagesBlock } from './AttendanceSheetRenderer';
import { SettingsDrawer } from './SettingsDrawer';

interface AttendanceSheetStudioProps {
  students: StudentRecord[];
  filteredCardStudents: StudentRecord[];
  cardFilterDesc?: string;
  groupingMode: StickerGroupingMode;
  paperConfig: PrepressConfig;
  attendanceConfig: AttendanceConfig;
  pageIndex: number;
  onPageIndexChange: (idx: number) => void;
  onPaperConfigChange: (patch: Partial<PrepressConfig>) => void;
  onAttendanceConfigChange: (patch: Partial<AttendanceConfig>) => void;
  onPrintAttendance: (scope: 'all' | 'current') => void;
  schedulesMap?: Record<string, ScheduleRow[]>;
  settingsOpen: boolean;
  onCloseSettings: () => void;
}

function triggerCsvDownload(csvText: string, filename: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const AttendanceSheetStudio: React.FC<AttendanceSheetStudioProps> = ({
  students,
  filteredCardStudents,
  cardFilterDesc,
  groupingMode,
  paperConfig,
  attendanceConfig,
  pageIndex,
  onPageIndexChange,
  onPaperConfigChange,
  onAttendanceConfigChange,
  onPrintAttendance,
  schedulesMap,
  settingsOpen,
  onCloseSettings,
}) => {
  const rooms = useMemo(() => getSortedRoomList(students), [students]);
  const classes = useMemo(() => getSortedClassList(students), [students]);
  const scheduleSessions = useMemo(
    () => getAvailableScheduleSessions(schedulesMap),
    [schedulesMap],
  );

  const { pages, groups, effectiveRowsPerPage } = useMemo(
    () =>
      buildAttendancePages(
        students,
        filteredCardStudents,
        groupingMode,
        paperConfig,
        attendanceConfig,
        cardFilterDesc,
      ),
    [students, filteredCardStudents, groupingMode, paperConfig, attendanceConfig, cardFilterDesc],
  );

  const autoRowsCount = useMemo(
    () => computeAutoAttendanceRowsPerPage(paperConfig, attendanceConfig),
    [paperConfig, attendanceConfig],
  );

  const { paperW, paperH } = useMemo(
    () => getSeatingPaperDimensions(paperConfig, attendanceConfig.paperOrientation),
    [paperConfig, attendanceConfig.paperOrientation],
  );

  const totalPages = Math.max(1, pages.length);
  const safePageIdx = Math.min(pageIndex, totalPages - 1);
  const activePage = pages[safePageIdx];

  const selectedSessionId = useMemo(() => {
    if (!attendanceConfig.subjectName && !attendanceConfig.examDate && !attendanceConfig.examTime) {
      return '';
    }
    const found = scheduleSessions.find(
      (s) =>
        s.date === attendanceConfig.examDate &&
        s.time === attendanceConfig.examTime &&
        s.subject === attendanceConfig.subjectName,
    );
    return found?.id ?? '__custom__';
  }, [
    scheduleSessions,
    attendanceConfig.subjectName,
    attendanceConfig.examDate,
    attendanceConfig.examTime,
  ]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Slide-over Configuration Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={onCloseSettings}
        title="Pengaturan Daftar Hadir"
        subtitle="Kelompok peserta, sesi mapel, kertas & pengesahan"
      >
        <div>
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Kelompok &amp; Urutan Daftar Hadir
          </h2>

          <label className="block text-[#44546A] font-medium mb-1">Pengelompokan Lembar</label>
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-1 mb-2.5">
            {(
              [
                ['per_ruang', 'Per Ruang'],
                ['per_ruang_jenjang', 'Ruang & Jenjang'],
                ['per_kelas', 'Per Kelas'],
                ['card_filter', `Filter (${filteredCardStudents.length})`],
              ] as Array<[AttendanceGroupingMode, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onAttendanceConfigChange({ groupingMode: val });
                  onPageIndexChange(0);
                }}
                className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  attendanceConfig.groupingMode === val
                    ? 'bg-[#1F3864] text-white shadow-2xs'
                    : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {(attendanceConfig.groupingMode === 'per_ruang' ||
            attendanceConfig.groupingMode === 'per_ruang_jenjang') && (
            <div className="mb-2.5">
              <label className="block text-[#44546A] font-medium mb-1">Filter Ruang Ujian</label>
              <select
                value={attendanceConfig.selectedRoom}
                onChange={(e) => {
                  onAttendanceConfigChange({ selectedRoom: e.target.value });
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
          )}

          {attendanceConfig.groupingMode === 'per_kelas' && (
            <div className="mb-2.5">
              <label className="block text-[#44546A] font-medium mb-1">Filter Kelas</label>
              <select
                value={attendanceConfig.selectedClass}
                onChange={(e) => {
                  onAttendanceConfigChange({ selectedClass: e.target.value });
                  onPageIndexChange(0);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="">Semua Kelas ({classes.length} kelas)</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    Kelas {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {attendanceConfig.groupingMode === 'card_filter' && (
            <div className="mb-2.5 p-2.5 rounded-xl bg-[#EEF2FA] border border-[#CBD5E1] text-[11px] text-[#1F3864]">
              <div className="font-semibold">Sinkron Filter Tab Kartu PAS</div>
              <div className="text-[#44546A] font-mono tabular-nums mt-0.5">
                {cardFilterDesc || 'Semua Siswa'} · {filteredCardStudents.length} peserta
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Urutan Peserta</label>
              <select
                value={attendanceConfig.orderMode}
                onChange={(e) => {
                  onAttendanceConfigChange({
                    orderMode: e.target.value as AttendanceOrderMode,
                  });
                  onPageIndexChange(0);
                }}
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="meja_order">Urutan Meja</option>
                <option value="no_peserta">No. Peserta</option>
                <option value="nama_alpha">Abjad Nama</option>
              </select>
            </div>
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Baris / Halaman</label>
              <select
                value={String(attendanceConfig.rowsPerPage)}
                onChange={(e) => {
                  const val = e.target.value;
                  onAttendanceConfigChange({
                    rowsPerPage:
                      val === 'fit_group'
                        ? 'fit_group'
                        : val === 'auto'
                          ? 'auto'
                          : (Number(val) as 20 | 25 | 30 | 35),
                  });
                  onPageIndexChange(0);
                }}
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
              >
                <option value="fit_group">Sesuai Data Ruang &amp; No (1 Hal)</option>
                <option value="auto">Auto Kertas ({autoRowsCount} brs/hal)</option>
                <option value="20">20 baris / hal</option>
                <option value="25">25 baris / hal</option>
                <option value="30">30 baris / hal</option>
                <option value="35">35 baris / hal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Session & Exam Details */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B]">
            Identitas Sesi &amp; Mata Pelajaran
          </h2>

          <div>
            <label className="block text-[#44546A] font-medium mb-1">
              Isi Otomatis dari Jadwal PAS
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onAttendanceConfigChange({
                    subjectName: '',
                    examDate: '',
                    examTime: '',
                  });
                  return;
                }
                const picked = scheduleSessions.find((s) => s.id === val);
                if (picked) {
                  onAttendanceConfigChange({
                    subjectName: picked.subject,
                    examDate: picked.date,
                    examTime: picked.time,
                  });
                }
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
            >
              <option value="">Kosongkan (Isi manual saat ujian)</option>
              {selectedSessionId === '__custom__' && (
                <option value="__custom__">Jadwal Kustom Aktif</option>
              )}
              {scheduleSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} · {s.time} · {s.subject} ({s.tiersLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[#44546A] font-medium mb-1">Judul Ujian</label>
              <input
                type="text"
                value={attendanceConfig.examTitle}
                onChange={(e) => onAttendanceConfigChange({ examTitle: e.target.value })}
                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
              />
            </div>
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Th. Ajaran</label>
              <input
                type="text"
                value={attendanceConfig.academicYear}
                onChange={(e) => onAttendanceConfigChange({ academicYear: e.target.value })}
                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono text-[#131C31]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#44546A] font-medium mb-1">
              Mata Pelajaran (kosong = garis tulis)
            </label>
            <input
              type="text"
              placeholder="Contoh: Bahasa Indonesia"
              value={attendanceConfig.subjectName}
              onChange={(e) => onAttendanceConfigChange({ subjectName: e.target.value })}
              className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Hari / Tanggal</label>
              <input
                type="text"
                placeholder="Kosong = garis isi"
                value={attendanceConfig.examDate}
                onChange={(e) => onAttendanceConfigChange({ examDate: e.target.value })}
                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
              />
            </div>
            <div>
              <label className="block text-[#44546A] font-medium mb-1">Waktu / Pukul</label>
              <input
                type="text"
                placeholder="08.00 – 09.00"
                value={attendanceConfig.examTime}
                onChange={(e) => onAttendanceConfigChange({ examTime: e.target.value })}
                className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
              />
            </div>
          </div>
        </div>

        {/* Columns, Paper & Signatures */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B]">
            Kertas, Kolom &amp; Pengesahan
          </h2>

          <div>
            <label className="block text-[#44546A] font-medium mb-1">Orientasi Kertas</label>
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
                  onClick={() => {
                    onAttendanceConfigChange({ paperOrientation: val });
                    onPageIndexChange(0);
                  }}
                  className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    attendanceConfig.paperOrientation === val
                      ? 'bg-[#1F3864] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#131C31] hover:bg-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
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
              <label className="block text-[#44546A] font-medium mb-1">Margin (mm)</label>
              <input
                type="number"
                step="0.5"
                min="4"
                max="25"
                value={attendanceConfig.marginMm}
                onChange={(e) =>
                  onAttendanceConfigChange({ marginMm: Math.max(4, Number(e.target.value) || 10) })
                }
                className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceConfig.showSchoolHeader !== false}
                onChange={(e) => onAttendanceConfigChange({ showSchoolHeader: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Tampilkan kop nama &amp; lambang sekolah
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceConfig.showFullParticipantNo}
                onChange={(e) =>
                  onAttendanceConfigChange({ showFullParticipantNo: e.target.checked })
                }
                className="accent-[#1F3864]"
              />
              Nomor peserta lengkap (2026/SMAN 1 ALALAK/...)
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceConfig.showDeskAndRoomCol}
                onChange={(e) =>
                  onAttendanceConfigChange({ showDeskAndRoomCol: e.target.checked })
                }
                className="accent-[#1F3864]"
              />
              Tampilkan kolom Ruang &amp; No. Meja
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceConfig.showNotesCol}
                onChange={(e) => onAttendanceConfigChange({ showNotesCol: e.target.checked })}
                className="accent-[#1F3864]"
              />
              Tampilkan kolom Keterangan (S/I/A)
            </label>
            <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={attendanceConfig.showSummaryAndSignatures}
                onChange={(e) =>
                  onAttendanceConfigChange({ showSummaryAndSignatures: e.target.checked })
                }
                className="accent-[#1F3864]"
              />
              Tampilkan rekap &amp; TTD Pengawas Ruangan
            </label>
            {attendanceConfig.showSummaryAndSignatures && (
              <label className="flex items-center gap-2 text-[#334155] cursor-pointer pl-4">
                <input
                  type="checkbox"
                  checked={attendanceConfig.twoProctors}
                  onChange={(e) => onAttendanceConfigChange({ twoProctors: e.target.checked })}
                  className="accent-[#1F3864]"
                />
                2 kolom Pengawas Ruangan
              </label>
            )}
          </div>

          {attendanceConfig.showSummaryAndSignatures && (
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#44546A] font-medium mb-0.5">Kota / Tempat</label>
                  <input
                    type="text"
                    value={attendanceConfig.cityLabel}
                    onChange={(e) => onAttendanceConfigChange({ cityLabel: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
                </div>
                <div>
                  <label className="block text-[#44546A] font-medium mb-0.5">
                    {attendanceConfig.twoProctors ? 'Pengawas 1' : 'Pengawas Ruangan'}
                  </label>
                  <input
                    type="text"
                    placeholder="Kosong = tanda titik"
                    value={attendanceConfig.proctor1Name}
                    onChange={(e) => onAttendanceConfigChange({ proctor1Name: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
                </div>
              </div>
              {attendanceConfig.twoProctors && (
                <div>
                  <label className="block text-[#44546A] font-medium mb-0.5">
                    Pengawas Ruangan 2
                  </label>
                  <input
                    type="text"
                    placeholder="Kosong = tanda titik"
                    value={attendanceConfig.proctor2Name}
                    onChange={(e) => onAttendanceConfigChange({ proctor2Name: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-[11px] tabular-nums text-[#1F3864]">
            <div>
              Total Cetak: <strong>{pages.length} halaman</strong> ({groups.length} kelompok)
            </div>
            <div className="text-[#55637A]">
              Ukuran: {paperW} × {paperH} mm ·{' '}
              {attendanceConfig.rowsPerPage === 'fit_group'
                ? 'Sesuai jumlah siswa/ruang'
                : `${effectiveRowsPerPage} baris/hal`}
            </div>
          </div>
        </div>

        {/* Direct Print & CSV */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
          <button
            type="button"
            onClick={() => onPrintAttendance('all')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-[#C9A227]" />
            Cetak Semua Daftar Hadir ({pages.length} Hal)
          </button>
          <button
            type="button"
            onClick={() =>
              triggerCsvDownload(
                buildAttendanceCsv(groups, attendanceConfig),
                `Daftar_Hadir_Peserta_PAS_SMAN1ALALAK.csv`,
              )
            }
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#1F3864] font-semibold text-xs shadow-2xs transition-all duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Daftar Hadir (CSV)
          </button>
        </div>
      </SettingsDrawer>

      {/* Main Preview Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#E9EDF5]">
        <div className="no-print flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-[#E2E8F0] shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
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
                {activePage.group.badgeLabel} · Bag. {activePage.pageInGroup}/
                {activePage.totalPagesInGroup} · {activePage.rows.length} baris (No.{' '}
                {activePage.rows[0]?.rowNumber ?? 0}–
                {activePage.rows[activePage.rows.length - 1]?.rowNumber ?? 0})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5" title="Orientasi Kertas">
              {(
                [
                  ['portrait', 'Potret'],
                  ['landscape', 'Lanskap'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    onAttendanceConfigChange({ paperOrientation: val });
                    onPageIndexChange(0);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    attendanceConfig.paperOrientation === val
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
                onAttendanceConfigChange({
                  showSchoolHeader: attendanceConfig.showSchoolHeader === false,
                })
              }
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                attendanceConfig.showSchoolHeader !== false
                  ? 'border-[#1F3864] bg-[#EEF2FA] text-[#1F3864]'
                  : 'border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {attendanceConfig.showSchoolHeader !== false
                ? 'Kop Sekolah: Tampil'
                : 'Kop Sekolah: Sembunyi'}
            </button>

            <div className="flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="range"
                min={30}
                max={105}
                value={attendanceConfig.zoomPct}
                onChange={(e) => onAttendanceConfigChange({ zoomPct: Number(e.target.value) })}
                className="w-20 accent-[#1F3864]"
              />
              <span className="font-mono text-xs text-[#1F3864] w-9 text-right tabular-nums">
                {attendanceConfig.zoomPct}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPrintAttendance('current')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#1F3864] text-[#1F3864] text-xs font-semibold shadow-2xs whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Hal {safePageIdx + 1}
            </button>
            <button
              type="button"
              onClick={() => onPrintAttendance('all')}
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
                Tidak ada data peserta ditemukan
              </p>
              <p className="text-sm text-[#55637A] mt-1">
                Ubah filter ruang/kelas atau tambahkan data siswa di tab Data Siswa.
              </p>
            </div>
          ) : (
            <div
              style={{
                zoom: attendanceConfig.zoomPct / 100,
                transformOrigin: 'top center',
              }}
            >
              <AttendanceSheetPagesBlock
                pages={[activePage]}
                paperConfig={paperConfig}
                attendanceConfig={attendanceConfig}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
