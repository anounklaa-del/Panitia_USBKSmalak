import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Printer,
  Scissors,
  Search,
} from 'lucide-react';
import type { StudentRecord } from '../data/pasData';
import {
  computeStickerGeometry,
  PAPER_DIMENSIONS,
  type PaperPreset,
  type PrepressConfig,
  type StickerConfig,
  type StickerGroupingMode,
} from '../types/prepress';
import {
  buildDeskStickerCsv,
  buildDeskStickers,
  getSortedRoomList,
} from '../utils/deskStickerBuilder';
import { StickerSheetPagesBlock } from './DeskStickerRenderer';
import { SettingsDrawer } from './SettingsDrawer';

interface DeskStickerStudioProps {
  students: StudentRecord[];
  paperConfig: PrepressConfig;
  stickerConfig: StickerConfig;
  sheetIndex: number;
  onSheetIndexChange: (idx: number) => void;
  onPaperConfigChange: (patch: Partial<PrepressConfig>) => void;
  onStickerConfigChange: (patch: Partial<StickerConfig>) => void;
  onPrintStickers: (scope: 'all' | 'current') => void;
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

export const DeskStickerStudio: React.FC<DeskStickerStudioProps> = ({
  students,
  paperConfig,
  stickerConfig,
  sheetIndex,
  onSheetIndexChange,
  onPaperConfigChange,
  onStickerConfigChange,
  onPrintStickers,
  settingsOpen,
  onCloseSettings,
}) => {
  const rooms = useMemo(() => getSortedRoomList(students), [students]);

  const allStickers = useMemo(
    () =>
      buildDeskStickers(
        students,
        stickerConfig.groupingMode,
        stickerConfig.selectedRoom || undefined,
      ),
    [students, stickerConfig.groupingMode, stickerConfig.selectedRoom],
  );

  const filteredStickers = useMemo(() => {
    const q = stickerConfig.searchQuery.trim().toLowerCase();
    if (!q) return allStickers;
    return allStickers.filter((st) => {
      if (st.mejaLabel.toLowerCase().includes(q) || `ruang ${st.ruang}`.toLowerCase().includes(q)) {
        return true;
      }
      return st.slots.some(
        (slot) =>
          slot.student &&
          (slot.student.nama.toLowerCase().includes(q) ||
            slot.student.no.toLowerCase().includes(q) ||
            slot.student.kelas.toLowerCase().includes(q)),
      );
    });
  }, [allStickers, stickerConfig.searchQuery]);

  const geo = useMemo(
    () => computeStickerGeometry(paperConfig, stickerConfig),
    [paperConfig, stickerConfig],
  );

  const totalSheets = Math.max(1, Math.ceil(filteredStickers.length / geo.stickersPerSheet));
  const safeSheetIdx = Math.min(sheetIndex, totalSheets - 1);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Slide-over Configuration Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={onCloseSettings}
        title="Pengaturan Stiker Meja"
        subtitle="Filter ruang, ukuran stiker, jarak & margin"
      >
        <div>
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Filter Ruang &amp; Pengelompokan Meja
          </h2>

          <label className="block text-[#44546A] font-medium mb-1">Pilih Ruang Ujian</label>
          <select
            value={stickerConfig.selectedRoom}
            onChange={(e) => {
              onStickerConfigChange({ selectedRoom: e.target.value });
              onSheetIndexChange(0);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5 transition-colors focus:border-[#1F3864]"
          >
            <option value="">Semua Ruang ({rooms.length} ruang)</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                RUANG {r}
              </option>
            ))}
          </select>

          <label className="block text-[#44546A] font-medium mb-1">Mode Gabung Kelas per Meja</label>
          <select
            value={stickerConfig.groupingMode}
            onChange={(e) => {
              onStickerConfigChange({ groupingMode: e.target.value as StickerGroupingMode });
              onSheetIndexChange(0);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5 transition-colors focus:border-[#1F3864]"
          >
            <option value="tier_room">Gabung Tingkat X / XI / XII (1 Meja = 3 Siswa)</option>
            <option value="class_room">Gabung Semua Kelas Berbeda per Ruang</option>
          </select>

          <label className="block text-[#44546A] font-medium mb-1">Cari Nama / No / Meja</label>
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-2" />
            <input
              type="text"
              value={stickerConfig.searchQuery}
              placeholder="Contoh: ABDUL HADI, 406, MEJA 01..."
              onChange={(e) => {
                onStickerConfigChange({ searchQuery: e.target.value });
                onSheetIndexChange(0);
              }}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] transition-colors focus:border-[#1F3864]"
            />
          </div>

          <label className="flex items-center gap-2 text-[#334155] cursor-pointer">
            <input
              type="checkbox"
              checked={stickerConfig.showEmptyTiers}
              onChange={(e) => onStickerConfigChange({ showEmptyTiers: e.target.checked })}
              className="accent-[#1F3864]"
            />
            Tampilkan slot tingkat kosong di meja ganjil
          </label>
        </div>

        {/* Paper, Sticker Size, Spacing, Manual Margins */}
        <div className="pt-4 border-t border-[#E2E8F0]">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
            Ukuran Stiker, Jarak &amp; Margin Manual
          </h2>

          <label className="block text-[#44546A] font-medium mb-1">Kertas Cetak</label>
          <select
            value={paperConfig.paper}
            onChange={(e) => onPaperConfigChange({ paper: e.target.value as PaperPreset })}
            className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5"
          >
            {Object.entries(PAPER_DIMENSIONS).map(([k, [, , label]]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
            <option value="custom">Kustom (mm)...</option>
          </select>

          <div className="mb-2.5">
            <label className="block text-[#44546A] font-medium mb-1">
              Preset Isi Stiker per Lembar (A4)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  label: '10/Hal (96×52)',
                  w: 96,
                  h: 52,
                  gx: 4,
                  gy: 3,
                  mt: 12.5,
                  mb: 12.5,
                  ml: 7,
                  mr: 7,
                },
                {
                  label: '8/Hal (96×64)',
                  w: 96,
                  h: 64,
                  gx: 4,
                  gy: 4,
                  mt: 14,
                  mb: 14,
                  ml: 7,
                  mr: 7,
                },
                {
                  label: '6/Hal (92×84)',
                  w: 92,
                  h: 84,
                  gx: 6,
                  gy: 6,
                  mt: 16.5,
                  mb: 16.5,
                  ml: 10,
                  mr: 10,
                },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    onStickerConfigChange({
                      stickerW: p.w,
                      stickerH: p.h,
                      gapXmm: p.gx,
                      gapYmm: p.gy,
                      marginTopMm: p.mt,
                      marginBottomMm: p.mb,
                      marginLeftMm: p.ml,
                      marginRightMm: p.mr,
                    })
                  }
                  className={`px-1.5 py-1.5 rounded-md font-mono text-[10px] border transition-colors whitespace-nowrap ${
                    stickerConfig.stickerW === p.w && stickerConfig.stickerH === p.h
                      ? 'bg-[#1F3864] text-white border-[#1F3864] shadow-2xs'
                      : 'bg-[#F8FAFC] text-[#44546A] border-[#E2E8F0] hover:bg-[#EEF2FA]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Lebar Stiker (mm)</label>
              <input
                type="number"
                step="0.5"
                min="30"
                value={stickerConfig.stickerW}
                onChange={(e) =>
                  onStickerConfigChange({ stickerW: Math.max(30, Number(e.target.value) || 96) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Tinggi Stiker (mm)</label>
              <input
                type="number"
                step="0.5"
                min="25"
                value={stickerConfig.stickerH}
                onChange={(e) =>
                  onStickerConfigChange({ stickerH: Math.max(25, Number(e.target.value) || 64) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <label className="text-[#44546A] font-medium">Jarak Antar Stiker (mm)</label>
            <div className="flex items-center gap-1">
              {[0, 4, 6].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onStickerConfigChange({ gapXmm: g, gapYmm: g })}
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] border transition-colors ${
                    stickerConfig.gapXmm === g && stickerConfig.gapYmm === g
                      ? 'bg-[#1F3864] text-white border-[#1F3864]'
                      : 'bg-[#F8FAFC] text-[#44546A] border-[#E2E8F0] hover:bg-[#EEF2FA]'
                  }`}
                >
                  {g}mm
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Jarak X (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.gapXmm}
                onChange={(e) =>
                  onStickerConfigChange({ gapXmm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Jarak Y (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.gapYmm}
                onChange={(e) =>
                  onStickerConfigChange({ gapYmm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
          </div>

          <label className="block text-[#44546A] font-medium mb-1">Margin Kertas Manual (mm)</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Atas (Top)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.marginTopMm}
                onChange={(e) =>
                  onStickerConfigChange({ marginTopMm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Bawah (Bottom)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.marginBottomMm}
                onChange={(e) =>
                  onStickerConfigChange({ marginBottomMm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Kiri (Left)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.marginLeftMm}
                onChange={(e) =>
                  onStickerConfigChange({ marginLeftMm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#64748B] mb-0.5">Kanan (Right)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stickerConfig.marginRightMm}
                onChange={(e) =>
                  onStickerConfigChange({ marginRightMm: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2 py-1 border border-[#CBD5E1] font-mono tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[#334155] mb-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={stickerConfig.showCropMarks}
              onChange={(e) => onStickerConfigChange({ showCropMarks: e.target.checked })}
              className="accent-[#1F3864]"
            />
            Cetak Garis Potong (Crop Marks)
          </label>

          <div
            className={`p-3 rounded-xl border font-mono text-[11px] tabular-nums ${
              geo.overflowsPaper
                ? 'bg-[#FEF3C7] border-[#D97706] text-[#92400E]'
                : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#1F3864]'
            }`}
          >
            <div>
              Total Stiker: <strong>{filteredStickers.length} meja</strong> ·{' '}
              <strong>{totalSheets} lembar</strong>
            </div>
            <div className="text-[#55637A]">
              Grid: {geo.cols} × {geo.rows} ({geo.stickersPerSheet} stiker/lembar)
            </div>
            <div className="text-[#55637A]">
              Margin aktual: Ki {geo.originX.toFixed(1)} · Ka {geo.marginRightActual.toFixed(1)} ·
              At {geo.originY.toFixed(1)} · Ba {geo.marginBottomActual.toFixed(1)} mm
            </div>
            {geo.overflowsPaper && (
              <div className="font-semibold mt-1">
                Perhatian: Ukuran stiker / margin melebihi kertas. Perkecil ukuran atau margin.
              </div>
            )}
          </div>
        </div>

        {/* Direct Print & CSV Export */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
          <button
            type="button"
            onClick={() => onPrintStickers('all')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
          >
            <Printer className="w-4 h-4 text-[#C9A227]" />
            Cetak Semua Stiker ({totalSheets} Hal)
          </button>

          <button
            type="button"
            onClick={() =>
              triggerCsvDownload(
                buildDeskStickerCsv(filteredStickers),
                `Rekap_Stiker_Meja_PAS_SMAN1ALALAK_${
                  stickerConfig.selectedRoom ? `Ruang${stickerConfig.selectedRoom}` : 'SemuaRuang'
                }.csv`,
              )
            }
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#1F3864] font-semibold text-xs shadow-2xs transition-all duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Rekap Meja (CSV)
          </button>
        </div>
      </SettingsDrawer>

      {/* Main Sticker Sheet Preview */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#E9EDF5]">
        <div className="no-print flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-[#E2E8F0] shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={safeSheetIdx <= 0}
              onClick={() => onSheetIndexChange(Math.max(0, safeSheetIdx - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Lembar sebelumnya"
            >
              <ChevronLeft className="w-4 h-4 text-[#1F3864]" />
            </button>
            <span className="font-mono text-xs font-semibold text-[#1F3864] tabular-nums whitespace-nowrap px-1">
              LEMBAR STIKER {safeSheetIdx + 1} / {totalSheets}
            </span>
            <button
              type="button"
              disabled={safeSheetIdx >= totalSheets - 1}
              onClick={() => onSheetIndexChange(Math.min(totalSheets - 1, safeSheetIdx + 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Lembar berikutnya"
            >
              <ChevronRight className="w-4 h-4 text-[#1F3864]" />
            </button>
            <span className="text-xs text-[#55637A] font-mono tabular-nums whitespace-nowrap ml-1.5">
              {filteredStickers.length} Meja · {geo.cols}×{geo.rows} ({geo.stickerW}×{geo.stickerH}
              mm)
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-[11px] text-[#475569] whitespace-nowrap">
              <Scissors className="w-3.5 h-3.5 text-[#1F3864]" />
              Gabung per Ruang &amp; Meja (X / XI / XII)
            </span>

            <div className="flex items-center gap-1.5 border-l border-[#DCE2EE] pl-3">
              <Maximize2 className="w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="range"
                min={30}
                max={105}
                value={stickerConfig.zoomPct}
                onChange={(e) => onStickerConfigChange({ zoomPct: Number(e.target.value) })}
                className="w-20 accent-[#1F3864]"
              />
              <span className="font-mono text-xs text-[#1F3864] w-9 text-right tabular-nums">
                {stickerConfig.zoomPct}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPrintStickers('current')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#1F3864] text-[#1F3864] text-xs font-semibold shadow-2xs whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Lembar {safeSheetIdx + 1}
            </button>
            <button
              type="button"
              onClick={() => onPrintStickers('all')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold shadow-xs hover:shadow whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
            >
              <Printer className="w-3.5 h-3.5 text-[#C9A227]" />
              Cetak Semua ({totalSheets})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredStickers.length === 0 ? (
            <div className="max-w-md mx-auto mt-16 bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-8 text-center">
              <p className="font-display font-bold text-[#1F3864] text-base">
                Tidak ada stiker meja sesuai filter
              </p>
              <p className="text-sm text-[#55637A] mt-1">
                Ubah filter ruang atau kata kunci pencarian melalui tombol Pengaturan.
              </p>
              <button
                type="button"
                onClick={() => onStickerConfigChange({ selectedRoom: '', searchQuery: '' })}
                className="mt-4 px-4 py-2 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Tampilkan Semua Ruang
              </button>
            </div>
          ) : (
            <div
              style={{
                zoom: stickerConfig.zoomPct / 100,
                transformOrigin: 'top center',
              }}
            >
              <StickerSheetPagesBlock
                stickers={filteredStickers}
                stickerConfig={stickerConfig}
                geo={geo}
                sheetIndices={[safeSheetIdx]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
