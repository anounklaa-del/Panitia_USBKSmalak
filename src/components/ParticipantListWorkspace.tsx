import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Printer,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { StudentRecord } from '../data/pasData';
import {
  DEFAULT_PARTICIPANT_LIST_CONFIG,
  PAPER_DIMENSIONS,
  type PaperPreset,
  type ParticipantListConfig,
  type ParticipantListGroupingMode,
  type ParticipantListOrderMode,
  type PrepressConfig,
  type StickerGroupingMode,
} from '../types/prepress';
import { getSortedRoomList } from '../utils/deskStickerBuilder';
import { getSortedClassList } from '../utils/attendanceBuilder';
import {
  buildParticipantListCsv,
  buildParticipantListPages,
  formatParticipantRoomLabel,
} from '../utils/participantListBuilder';
import { getSeatingPaperDimensions } from '../utils/seatingPlanBuilder';
import { ParticipantListPagesBlock } from './ParticipantListRenderer';

interface ParticipantListWorkspaceProps {
  students: StudentRecord[];
  filteredCardStudents: StudentRecord[];
  cardFilterDesc: string;
  groupingMode: StickerGroupingMode;
  paperConfig: PrepressConfig;
  listConfig: ParticipantListConfig;
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  pageIndex: number;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onPageIndexChange: (idx: number) => void;
  onPaperConfigChange: (patch: Partial<PrepressConfig>) => void;
  onListConfigChange: (patch: Partial<ParticipantListConfig>) => void;
  onPrintList: (scope: 'all' | 'current') => void;
}

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const ParticipantListWorkspace: React.FC<ParticipantListWorkspaceProps> = ({
  students,
  filteredCardStudents,
  cardFilterDesc,
  groupingMode,
  paperConfig,
  listConfig,
  academicYear,
  semester,
  pageIndex,
  searchQuery,
  onSearchQueryChange,
  onPageIndexChange,
  onPaperConfigChange,
  onListConfigChange,
  onPrintList,
}) => {
  const [showEditor, setShowEditor] = useState(false);

  const roomList = useMemo(() => getSortedRoomList(students), [students]);
  const classList = useMemo(() => getSortedClassList(students), [students]);

  const { pages, groups, effectiveRowsPerPage } = useMemo(
    () =>
      buildParticipantListPages(
        students,
        filteredCardStudents,
        groupingMode,
        paperConfig,
        listConfig,
        cardFilterDesc,
        searchQuery,
      ),
    [
      students,
      filteredCardStudents,
      groupingMode,
      paperConfig,
      listConfig,
      cardFilterDesc,
      searchQuery,
    ],
  );

  const safePageIdx = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const activePage = pages[safePageIdx];
  const totalListedStudents = useMemo(
    () => groups.reduce((sum, g) => sum + g.rows.length, 0),
    [groups],
  );

  const { paperW, paperH } = useMemo(
    () => getSeatingPaperDimensions(paperConfig, listConfig.paperOrientation),
    [paperConfig, listConfig.paperOrientation],
  );

  const scale = Math.max(0.4, Math.min(1.1, (listConfig.zoomPct || 72) / 100));

  const handleDownloadCsv = () => {
    if (groups.length === 0) return;
    const csv = buildParticipantListCsv(groups);
    const scopeSlug = listConfig.selectedRoom
      ? `Ruang_${formatParticipantRoomLabel(listConfig.selectedRoom, listConfig.useLeadingZeroRoom)}`
      : listConfig.selectedClass
        ? `Kelas_${listConfig.selectedClass.replace(/\s+/g, '_')}`
        : 'Semua_Peserta';
    triggerCsvDownload(csv, `Daftar_Nama_Peserta_${scopeSlug}.csv`);
  };

  const handleResetFilters = () => {
    onSearchQueryChange('');
    onListConfigChange({
      groupingMode: 'per_ruang_jenjang',
      selectedRoom: '',
      selectedTier: '',
      selectedClass: '',
    });
    onPageIndexChange(0);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F6FA]">
      {/* Primary Control Toolbar */}
      <div className="no-print bg-white border-b border-[#E2E8F0] px-4 lg:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Grouping Mode Switch */}
          <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5 flex-wrap">
            {(
              [
                ['per_ruang_jenjang', 'Ruang & Jenjang'],
                ['per_ruang', 'Per Ruang'],
                ['per_kelas', 'Per Kelas'],
                ['card_filter', 'Sinkron Kartu'],
              ] as Array<[ParticipantListGroupingMode, string]>
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  onListConfigChange({ groupingMode: mode });
                  onPageIndexChange(0);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  listConfig.groupingMode === mode
                    ? 'bg-[#1F3864] text-white shadow-2xs'
                    : 'text-[#475569] hover:text-[#131C31]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Room / Class / Tier Filter Dropdowns */}
          {(listConfig.groupingMode === 'per_ruang_jenjang' ||
            listConfig.groupingMode === 'per_ruang') && (
            <select
              value={listConfig.selectedRoom}
              onChange={(e) => {
                onListConfigChange({ selectedRoom: e.target.value });
                onPageIndexChange(0);
              }}
              aria-label="Filter Ruang Ujian"
              className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#131C31]"
            >
              <option value="">Semua Ruang ({roomList.length})</option>
              {roomList.map((r) => (
                <option key={r} value={r}>
                  RUANG {formatParticipantRoomLabel(r, listConfig.useLeadingZeroRoom)}
                </option>
              ))}
            </select>
          )}

          {listConfig.groupingMode === 'per_ruang_jenjang' && (
            <select
              value={listConfig.selectedTier}
              onChange={(e) => {
                onListConfigChange({
                  selectedTier: e.target.value as ParticipantListConfig['selectedTier'],
                });
                onPageIndexChange(0);
              }}
              aria-label="Filter Jenjang Kelas"
              className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#131C31]"
            >
              <option value="">Semua Jenjang (X / XI / XII)</option>
              <option value="X">KELAS X</option>
              <option value="XI">KELAS XI</option>
              <option value="XII">KELAS XII</option>
            </select>
          )}

          {listConfig.groupingMode === 'per_kelas' && (
            <select
              value={listConfig.selectedClass}
              onChange={(e) => {
                onListConfigChange({ selectedClass: e.target.value });
                onPageIndexChange(0);
              }}
              aria-label="Filter Kelas"
              className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#131C31]"
            >
              <option value="">Semua Kelas ({classList.length})</option>
              {classList.map((k) => (
                <option key={k} value={k}>
                  KELAS {k}
                </option>
              ))}
            </select>
          )}

          {/* Sort order */}
          <select
            value={listConfig.orderMode}
            onChange={(e) => {
              onListConfigChange({ orderMode: e.target.value as ParticipantListOrderMode });
              onPageIndexChange(0);
            }}
            aria-label="Urutan Peserta"
            className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#334155]"
          >
            <option value="no_peserta">Urut No. Peserta</option>
            <option value="meja_order">Urut No. Meja</option>
            <option value="nama_alpha">Urut Abjad Nama</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchQueryChange(e.target.value);
                onPageIndexChange(0);
              }}
              placeholder="Cari nama / no. peserta / kelas..."
              className="pl-8 pr-3 py-1.5 w-48 sm:w-56 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] focus:border-[#1D4ED8]"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
              showEditor
                ? 'bg-[#EEF4FF] border-[#93C5FD] text-[#1D4ED8]'
                : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
            }`}
          >
            {showEditor ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {showEditor ? 'Tutup Pengaturan' : 'Sesuaikan Kop & Kertas'}
          </button>

          <button
            type="button"
            disabled={groups.length === 0}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] disabled:opacity-40 text-xs font-semibold text-[#1E293B] transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#059669]" />
            Ekspor CSV
          </button>

          <button
            type="button"
            disabled={!activePage}
            onClick={() => onPrintList('current')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] disabled:opacity-40 text-xs font-semibold text-[#1E293B] transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-[#1D4ED8]" />
            Cetak Hal Ini
          </button>

          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => onPrintList('all')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Semua ({pages.length} Hal)
          </button>
        </div>
      </div>

      {/* Main Split Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Optional Side Customizer Drawer */}
        {showEditor && (
          <aside className="no-print w-full max-w-[340px] bg-white border-r border-[#E2E8F0] overflow-y-auto p-4 space-y-4 shrink-0">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-display font-bold text-sm text-[#1F3864]">
                  Pengaturan Daftar Peserta
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Data tersinkron langsung dengan Kartu PAS &amp; Data Peserta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onListConfigChange(DEFAULT_PARTICIPANT_LIST_CONFIG);
                  onPageIndexChange(0);
                }}
                title="Kembalikan pengaturan daftar nama ke bawaan"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[11px] font-medium text-[#475569]"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Header Overrides */}
            <div className="space-y-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1F3864]">
                Judul &amp; Label Header
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#475569] mb-1">
                  Judul Utama (kosongkan = otomatis ikut semester)
                </label>
                <input
                  type="text"
                  value={listConfig.customTitle}
                  onChange={(e) => onListConfigChange({ customTitle: e.target.value })}
                  placeholder={`DAFTAR NAMA PESERTA PENILAIAN SUMATIF SEMESTER ${semester.toUpperCase()}`}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#475569] mb-1">
                  Label Tahun (kosongkan = otomatis ikut Tahun Pelajaran)
                </label>
                <input
                  type="text"
                  value={listConfig.customYearLabel}
                  onChange={(e) => onListConfigChange({ customYearLabel: e.target.value })}
                  placeholder={`TAHUN ${academicYear.replace(/\s*\/\s*/g, '-')}`}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listConfig.showYearHeader}
                    onChange={(e) => onListConfigChange({ showYearHeader: e.target.checked })}
                    className="accent-[#1F3864]"
                  />
                  Tampilkan baris TAHUN
                </label>
                <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listConfig.showRoomHeader}
                    onChange={(e) => onListConfigChange({ showRoomHeader: e.target.checked })}
                    className="accent-[#1F3864]"
                  />
                  Tampilkan judul RUANG
                </label>
                <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listConfig.showTierHeader}
                    onChange={(e) => onListConfigChange({ showTierHeader: e.target.checked })}
                    className="accent-[#1F3864]"
                  />
                  Tampilkan subjudul KELAS (X / XI / XII)
                </label>
                <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={listConfig.useLeadingZeroRoom}
                    onChange={(e) =>
                      onListConfigChange({ useLeadingZeroRoom: e.target.checked })
                    }
                    className="accent-[#1F3864]"
                  />
                  Gunakan 2 digit nomor ruang (RUANG 01)
                </label>
              </div>
            </div>

            {/* Paper & Pagination */}
            <div className="space-y-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1F3864]">
                Kertas, Margin &amp; Baris
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#475569] mb-1">
                  Ukuran Kertas
                </label>
                <select
                  value={paperConfig.paper}
                  onChange={(e) => onPaperConfigChange({ paper: e.target.value as PaperPreset })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                >
                  {Object.entries(PAPER_DIMENSIONS).map(([k, [, , label]]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                  <option value="custom">Kustom ({paperConfig.customW}×{paperConfig.customH}mm)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Orientasi
                  </label>
                  <select
                    value={listConfig.paperOrientation}
                    onChange={(e) => {
                      onListConfigChange({
                        paperOrientation: e.target.value as 'portrait' | 'landscape',
                      });
                      onPageIndexChange(0);
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                  >
                    <option value="portrait">Potret</option>
                    <option value="landscape">Lanskap</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Margin (mm)
                  </label>
                  <input
                    type="number"
                    min={6}
                    max={25}
                    step={1}
                    value={listConfig.marginMm}
                    onChange={(e) =>
                      onListConfigChange({
                        marginMm: Math.max(6, Math.min(25, Number(e.target.value) || 14)),
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white font-mono tabular-nums text-[#131C31]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#475569] mb-1">
                  Baris Maksimal per Halaman ({effectiveRowsPerPage} baris)
                </label>
                <select
                  value={String(listConfig.rowsPerPage)}
                  onChange={(e) => {
                    const val = e.target.value;
                    onListConfigChange({
                      rowsPerPage:
                        val === 'auto' || val === 'fit_group'
                          ? val
                          : (Number(val) as 20 | 25 | 30 | 35),
                    });
                    onPageIndexChange(0);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                >
                  <option value="auto">Otomatis sesuai tinggi kertas</option>
                  <option value="fit_group">1 Kelompok = 1 Halaman</option>
                  <option value="20">20 Siswa / Halaman</option>
                  <option value="25">25 Siswa / Halaman</option>
                  <option value="30">30 Siswa / Halaman</option>
                  <option value="35">35 Siswa / Halaman</option>
                </select>
              </div>
            </div>
          </aside>
        )}

        {/* Document Preview Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Secondary Navigation & Status Bar */}
          <div className="no-print bg-white/90 border-b border-[#DCE2EE] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={safePageIdx <= 0}
                onClick={() => onPageIndexChange(Math.max(0, safePageIdx - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 text-[#1F3864]" />
              </button>
              <span className="font-mono text-xs font-bold text-[#1F3864] tabular-nums whitespace-nowrap">
                {pages.length > 0 ? `HAL ${safePageIdx + 1} / ${pages.length}` : '0 HALAMAN'}
              </span>
              <button
                type="button"
                disabled={safePageIdx >= pages.length - 1}
                onClick={() => onPageIndexChange(Math.min(pages.length - 1, safePageIdx + 1))}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4 text-[#1F3864]" />
              </button>

              {activePage && (
                <span className="text-xs text-[#475569] truncate ml-1 tabular-nums">
                  {activePage.group.badgeLabel} · {activePage.group.classSummaryText} ·{' '}
                  <span className="font-semibold text-[#131C31]">
                    Total {totalListedStudents} peserta
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden md:inline text-[11px] font-mono text-[#64748B] tabular-nums">
                {paperConfig.paper} {listConfig.paperOrientation === 'portrait' ? 'Potret' : 'Lanskap'} · {paperW}×{paperH}mm
              </span>
              <button
                type="button"
                onClick={() =>
                  onListConfigChange({ zoomPct: Math.max(40, (listConfig.zoomPct || 72) - 8) })
                }
                className="p-1 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#475569]"
                title="Perkecil pratinjau"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={40}
                max={110}
                step={1}
                value={listConfig.zoomPct || 72}
                onChange={(e) => onListConfigChange({ zoomPct: Number(e.target.value) })}
                aria-label="Zoom pratinjau daftar nama peserta"
                className="w-20 accent-[#1D4ED8]"
              />
              <span className="font-mono text-xs font-semibold text-[#334155] w-9 text-right tabular-nums">
                {listConfig.zoomPct || 72}%
              </span>
              <button
                type="button"
                onClick={() =>
                  onListConfigChange({ zoomPct: Math.min(110, (listConfig.zoomPct || 72) + 8) })
                }
                className="p-1 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#475569]"
                title="Perbesar pratinjau"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Jump Strip Across Rooms / Groups */}
          {pages.length > 1 && (
            <div className="no-print bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
              {pages.map((p, idx) => {
                const isSelected = idx === safePageIdx;
                const label =
                  p.totalPagesInGroup > 1
                    ? `${p.group.badgeLabel} (${p.pageInGroup}/${p.totalPagesInGroup})`
                    : p.group.badgeLabel;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onPageIndexChange(idx)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                      isSelected
                        ? 'bg-[#1F3864] border-[#1F3864] text-white'
                        : 'bg-white border-[#CBD5E1] text-[#334155] hover:border-[#93C5FD] hover:text-[#1D4ED8]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scaled Sheet Canvas */}
          <div className="flex-1 overflow-auto p-4 lg:p-6 flex flex-col items-center">
            {activePage ? (
              <div
                style={{
                  width: `calc(${paperW}mm * ${scale})`,
                  minHeight: `calc(${paperH}mm * ${scale})`,
                }}
                className="relative shrink-0 mb-8"
              >
                <div
                  style={{
                    width: `${paperW}mm`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <ParticipantListPagesBlock
                    pages={[activePage]}
                    paperConfig={paperConfig}
                    listConfig={listConfig}
                    academicYear={academicYear}
                    semester={semester}
                  />
                </div>
              </div>
            ) : (
              <div className="my-auto max-w-md w-full bg-white rounded-2xl border border-[#DCE5F2] p-6 text-center space-y-3 shadow-xs">
                <div className="font-display font-bold text-sm text-[#131C31]">
                  Tidak ada peserta yang cocok dengan filter aktif
                </div>
                <p className="text-xs text-[#64748B]">
                  {searchQuery.trim()
                    ? `Pencarian "${searchQuery}" tidak ditemukan pada kelompok ${listConfig.groupingMode.replace(/_/g, ' ')}.`
                    : 'Ubah filter ruang, jenjang kelas, atau gunakan tombol reset untuk menampilkan kembali seluruh peserta.'}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Filter &amp; Pencarian
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
