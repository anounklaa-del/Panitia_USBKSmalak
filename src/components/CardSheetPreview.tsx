import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Maximize2,
  Printer,
  Scissors,
} from 'lucide-react';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import { computeSheetGeometry, type PrepressConfig } from '../types/prepress';
import { SheetPagesBlock } from './PrintSheetRenderer';

interface CardSheetPreviewProps {
  students: StudentRecord[];
  config: PrepressConfig;
  selectedStudent: StudentRecord;
  deskLookup?: Record<string, string>;
  schedulesMap?: Record<string, ScheduleRow[]>;
  sheetIndex: number;
  onSheetIndexChange: (idx: number) => void;
  onSelectStudent: (student: StudentRecord) => void;
  onConfigChange: (patch: Partial<PrepressConfig>) => void;
  onPrintBatch: (scope: 'all' | 'current') => void;
}

export const CardSheetPreview: React.FC<CardSheetPreviewProps> = ({
  students,
  config,
  selectedStudent,
  deskLookup,
  schedulesMap,
  sheetIndex,
  onSheetIndexChange,
  onSelectStudent,
  onConfigChange,
  onPrintBatch,
}) => {
  const geo = useMemo(() => computeSheetGeometry(config), [config]);
  const totalSheets = Math.max(1, Math.ceil(students.length / geo.cardsPerSheet));
  const safeSheetIdx = Math.min(sheetIndex, totalSheets - 1);

  const proofFilter = config.cmykSoftProof
    ? 'contrast(0.95) saturate(0.92) sepia(0.04)'
    : undefined;

  return (
    <div className="flex flex-col h-full bg-[#E9EDF5]">
      {/* Viewport Sub-toolbar */}
      <div className="no-print flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-[#DCE2EE] shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={safeSheetIdx <= 0 || config.imposition === 'calibration'}
            onClick={() => onSheetIndexChange(Math.max(0, safeSheetIdx - 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] hover:border-[#CBD5E1] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Lembar sebelumnya"
          >
            <ChevronLeft className="w-4 h-4 text-[#1F3864]" />
          </button>
          <span className="font-mono text-xs font-semibold text-[#1F3864] tabular-nums whitespace-nowrap px-1">
            {config.imposition === 'calibration'
              ? 'TES KALIBRASI (2 HAL)'
              : `LEMBAR ${safeSheetIdx + 1} / ${totalSheets}`}
          </span>
          <button
            type="button"
            disabled={safeSheetIdx >= totalSheets - 1 || config.imposition === 'calibration'}
            onClick={() => onSheetIndexChange(Math.min(totalSheets - 1, safeSheetIdx + 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] hover:border-[#CBD5E1] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="Lembar berikutnya"
          >
            <ChevronRight className="w-4 h-4 text-[#1F3864]" />
          </button>
          <span className="text-xs text-[#55637A] font-mono tabular-nums whitespace-nowrap ml-1.5">
            {geo.cols}×{geo.rows} ({geo.cardsPerSheet}/lembar) · Jarak {geo.gapXmm}×{geo.gapYmm}mm · Margin {geo.originX.toFixed(1)}/{geo.originY.toFixed(1)}mm
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#334155] cursor-pointer whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={config.showBleedGuide}
              onChange={(e) => onConfigChange({ showBleedGuide: e.target.checked })}
              className="accent-[#00AEEF]"
            />
            Bleed {config.bleedMm}mm
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#334155] cursor-pointer whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={config.showFoldMarks}
              onChange={(e) => onConfigChange({ showFoldMarks: e.target.checked })}
              className="accent-[#EC008C]"
            />
            Fold Marks
          </label>
          <label
            className="flex items-center gap-1.5 text-xs font-medium text-[#334155] cursor-pointer whitespace-nowrap shrink-0"
            title="Simulasi lapisan transparan sisi belakang di atas depan untuk memeriksa kesimetrisan potong"
          >
            <input
              type="checkbox"
              checked={config.xrayAlignmentOverlay}
              onChange={(e) => onConfigChange({ xrayAlignmentOverlay: e.target.checked })}
              className="accent-[#EC008C]"
            />
            <Layers className="w-3.5 h-3.5 text-[#EC008C]" />
            X-Ray Simetri
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#334155] cursor-pointer whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={config.cmykSoftProof}
              onChange={(e) => onConfigChange({ cmykSoftProof: e.target.checked })}
              className="accent-[#1F3864]"
            />
            <Eye className="w-3.5 h-3.5 text-[#1F3864]" />
            Soft-Proof CMYK
          </label>

          <div className="flex items-center gap-1.5 border-l border-[#DCE2EE] pl-3">
            <Maximize2 className="w-3.5 h-3.5 text-[#64748B]" />
            <input
              type="range"
              min={30}
              max={105}
              value={config.zoomPct}
              onChange={(e) => onConfigChange({ zoomPct: Number(e.target.value) })}
              className="w-20 accent-[#1F3864]"
            />
            <span className="font-mono text-xs text-[#1F3864] w-9 text-right tabular-nums">
              {config.zoomPct}%
            </span>
          </div>

          <button
            type="button"
            onClick={() => onPrintBatch('current')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#1F3864] text-[#1F3864] text-xs font-semibold shadow-2xs whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
            title="Cetak hanya lembar yang sedang dilihat"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Lembar {safeSheetIdx + 1}
          </button>
          <button
            type="button"
            onClick={() => onPrintBatch('all')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold shadow-xs hover:shadow whitespace-nowrap shrink-0 transition-all duration-150 active:scale-[0.98]"
            title="Cetak seluruh lembar hasil filter saat ini"
          >
            <Printer className="w-3.5 h-3.5 text-[#C9A227]" />
            Cetak Semua ({totalSheets})
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="no-print flex items-center justify-between px-4 py-1.5 bg-[#F8FAFC] border-b border-[#DCE2EE] text-[11px] text-[#475569] shrink-0">
        <div className="flex items-center gap-4 whitespace-nowrap overflow-x-auto">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 border-t-2 border-dashed border-[#00AEEF]" />
            Bleed {config.bleedMm}mm
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 border-t-2 border-dashed border-[#EC008C]" />
            Penanda Lipatan (Fold)
          </span>
          <span className="flex items-center gap-1.5">
            <Scissors className="w-3 h-3 text-black" />
            Garis Potong (Crop Marks)
          </span>
          <span className="font-mono text-[#1F3864]">
            Klik kartu mana pun untuk muat ke Pratinjau 3D
          </span>
        </div>
        <span className="font-mono text-[#1F3864] font-semibold whitespace-nowrap">
          Aktif 3D: #{selectedStudent.no} {selectedStudent.nama} ({selectedStudent.kelas})
        </span>
      </div>

      {/* Paginated Interactive Screen Viewport */}
      <div className="flex-1 overflow-auto p-6">
        {students.length === 0 ? (
          <div className="max-w-md mx-auto mt-16 bg-white border border-[#DCE2EE] p-8 text-center">
            <p className="font-display font-bold text-[#1F3864] text-base">
              Tidak ada siswa sesuai filter
            </p>
            <p className="text-sm text-[#55637A] mt-1">
              Sesuaikan pilihan kelas atau rentang nomor peserta melalui tombol Pengaturan.
            </p>
            <button
              type="button"
              onClick={() => onConfigChange({ selectedClass: '', noFrom: '', noTo: '' })}
              className="mt-4 px-4 py-2 bg-[#1F3864] text-white text-xs font-semibold rounded"
            >
              Tampilkan Semua 619 Siswa
            </button>
          </div>
        ) : (
          <div
            style={{
              zoom: config.zoomPct / 100,
              transformOrigin: 'top center',
              filter: proofFilter,
            }}
          >
            <SheetPagesBlock
              students={students}
              config={config}
              geo={geo}
              sheetIndices={[safeSheetIdx]}
              deskLookup={deskLookup}
              schedulesMap={schedulesMap}
              selectedStudentNo={selectedStudent.no}
              onSelectStudent={onSelectStudent}
            />
          </div>
        )}
      </div>
    </div>
  );
};
