import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  FolderTree,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  STUDENTS_MASTER,
  type ScheduleRow,
  type StudentRecord,
} from '../data/pasData';
import {
  computeSheetGeometry,
  type PrepressConfig,
  type StickerGroupingMode,
} from '../types/prepress';
import {
  buildStructuredZipArchive,
  computeEfficiencyMetrics,
  evaluateAssetChecklist,
  generateLayeredCardSvg,
  generateStandalonePasteNovHtml,
} from '../utils/archiveExporter';
import { buildCmykIccProfile, ICC_PROFILES } from '../utils/cmykEngine';
import { buildDeskAssignmentLookup } from '../utils/deskStickerBuilder';
import { generatePdfX1aDocument } from '../utils/pdfxWriter';

import { getLiveSchedulesMap } from '../utils/scheduleStore';

interface ExportArchivePanelProps {
  filteredStudents: StudentRecord[];
  allStudents?: StudentRecord[];
  selectedStudent: StudentRecord;
  config: PrepressConfig;
  groupingMode?: StickerGroupingMode;
  schedulesMap?: Record<string, ScheduleRow[]>;
  onConfigChange: (patch: Partial<PrepressConfig>) => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const ExportArchivePanel: React.FC<ExportArchivePanelProps> = ({
  filteredStudents,
  allStudents,
  selectedStudent,
  config,
  groupingMode = 'tier_room',
  schedulesMap,
  onConfigChange,
}) => {
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [lastZipReport, setLastZipReport] = useState<{
    zipKb: number;
    pdfKb: number;
    files: number;
  } | null>(null);

  const activeScheduleMap = schedulesMap ?? getLiveSchedulesMap();
  const geo = useMemo(() => computeSheetGeometry(config), [config]);
  const checklist = useMemo(
    () => evaluateAssetChecklist(filteredStudents, config, activeScheduleMap),
    [filteredStudents, config, activeScheduleMap],
  );
  const metrics = useMemo(
    () => computeEfficiencyMetrics(filteredStudents, config),
    [filteredStudents, config],
  );

  const activeStudents = filteredStudents.length > 0 ? filteredStudents : [selectedStudent];
  const iccMeta = ICC_PROFILES[config.iccProfile];
  const deskLookup = useMemo(() => {
    const source = allStudents ?? filteredStudents;
    return Object.fromEntries(
      Array.from(buildDeskAssignmentLookup(source, groupingMode).entries()).map(([no, v]) => [
        no,
        v.mejaLabel,
      ]),
    );
  }, [allStudents, filteredStudents, groupingMode]);

  const handleExportPdfx = async (modeOverride?: PrepressConfig['imposition']) => {
    try {
      setBusyTask(modeOverride === 'calibration' ? 'calib' : 'pdfx');
      setProgressPct(2);
      setProgressMsg('Menyiapkan mesin PDF/X-1a:2001 CMYK...');
      const batch = modeOverride === 'calibration' ? activeStudents.slice(0, 8) : activeStudents;
      const bytes = await generatePdfX1aDocument(
        batch,
        config,
        (pct, msg) => {
          setProgressPct(pct);
          setProgressMsg(msg);
        },
        modeOverride,
        deskLookup,
        groupingMode,
      );
      const fname =
        modeOverride === 'calibration'
          ? 'Lembar_Kalibrasi_Duplex_PDFX1a_CMYK.pdf'
          : `Kartu_PAS_SMAN1ALALAK_PDFX1a_CMYK_${config.dpi}DPI_${
              config.selectedClass ? config.selectedClass.replace(/\s+/g, '') : `${batch.length}Siswa`
            }.pdf`;
      triggerDownload(new Blob([bytes as BlobPart], { type: 'application/pdf' }), fname);
    } finally {
      setBusyTask(null);
    }
  };

  const handleDownloadLayeredSvg = (side: 'front' | 'back' | 'foldable') => {
    const svg = generateLayeredCardSvg(
      selectedStudent,
      side,
      config,
      deskLookup[selectedStudent.no],
      activeScheduleMap,
    );
    const fname = `Kartu_PAS_${selectedStudent.no}_${side}_Berlapis_Bleed${config.bleedMm}mm.svg`;
    triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fname);
  };

  const handleDownloadIcc = () => {
    const icc = buildCmykIccProfile(config.iccProfile);
    triggerDownload(
      new Blob([icc as BlobPart], { type: 'application/vnd.iccprofile' }),
      `Profil_Warna_${config.iccProfile}_CMYK.icc`,
    );
  };

  const handleDownloadStandaloneHtml = () => {
    const html = generateStandalonePasteNovHtml(
      allStudents ?? STUDENTS_MASTER,
      deskLookup,
      config.showDeskOnCard,
      activeScheduleMap,
    );
    triggerDownload(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      'Cetak_Kartu_Ujian_PAS_Paste_November.html',
    );
  };

  const handleDownloadZip = async () => {
    try {
      setBusyTask('zip');
      setProgressPct(2);
      setProgressMsg('Memulai pengemasan arsip terstruktur...');
      const res = await buildStructuredZipArchive(
        activeStudents,
        config,
        (pct, msg) => {
          setProgressPct(pct);
          setProgressMsg(msg);
        },
        allStudents ?? STUDENTS_MASTER,
        groupingMode,
      );
      setLastZipReport({
        zipKb: Math.round(res.actualZipSizeBytes / 1024),
        pdfKb: Math.round(res.pdfSizeBytes / 1024),
        files: res.fileCount,
      });
      const slug = config.selectedClass
        ? config.selectedClass.replace(/\s+/g, '_')
        : `${activeStudents.length}Siswa`;
      triggerDownload(res.blob, `SMAN1ALALAK_PAS2026_Arsip_Pracetak_${slug}.zip`);
    } finally {
      setBusyTask(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F4F6FA] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Summary */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-[#C9A227] font-semibold">
              Pusat Ekspor Pracetak &amp; Arsip Digital
            </p>
            <h2 className="font-display text-xl font-bold text-[#1F3864] mt-0.5">
              PDF/X-1a:2001 CMYK · SVG Berlapis · Paket ZIP Terstruktur
            </h2>
            <p className="text-sm text-[#475569] mt-1">
              Batch aktif: <strong className="text-[#1F3864] tabular-nums">{activeStudents.length} siswa</strong> ·{' '}
              {geo.cols}×{geo.rows} per lembar ({geo.paperW}×{geo.paperH} mm) · Bleed {config.bleedMm.toFixed(1)} mm ·{' '}
              {config.dpi} DPI · {iccMeta.name}
            </p>
          </div>
          <button
            type="button"
            disabled={busyTask !== null}
            onClick={handleDownloadZip}
            className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] disabled:opacity-60 text-white text-sm font-semibold shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            <Archive className="w-4 h-4 text-[#C9A227]" />
            Unduh Paket Arsip Lengkap (.ZIP)
          </button>
        </div>

        {/* Active Progress Strip */}
        {busyTask && (
          <div className="bg-white border border-[#1F3864] rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-mono text-[#1F3864] mb-2">
              <span>{progressMsg}</span>
              <span className="font-bold tabular-nums">{progressPct}%</span>
            </div>
            <div className="w-full h-2 rounded-sm bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full bg-[#1F3864] transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {lastZipReport && !busyTask && (
          <div className="bg-[#ECFDF5] border border-[#10B981] rounded-xl px-4 py-3 flex items-center justify-between text-sm text-[#065F46]">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              Paket arsip terstruktur berhasil dikompresi ({lastZipReport.files} berkas dalam 4 folder).
            </span>
            <span className="font-mono text-xs tabular-nums">
              Ukuran PDF CMYK: {lastZipReport.pdfKb.toLocaleString('id-ID')} KB · Ukuran ZIP Final: {lastZipReport.zipKb.toLocaleString('id-ID')} KB
            </span>
          </div>
        )}

        {/* Color & Resolution Prepress Parameters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
              <ShieldCheck className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                Setelan Warna CMYK &amp; Resolusi PDF/X-1a
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44546A] mb-1">
                Resolusi Output Cetak (Min. 300 DPI)
              </label>
              <select
                value={config.dpi}
                onChange={(e) => onConfigChange({ dpi: Number(e.target.value) as 300 | 450 | 600 })}
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm bg-white text-[#131C31]"
              >
                <option value={300}>300 DPI — Standar Industri Cetak (Direkomendasikan)</option>
                <option value={450}>450 DPI — Ultra Tajam Teks Jadwal Kecil</option>
                <option value={600}>600 DPI — Maksimum Master Offset</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#44546A] mb-1">
                Profil Warna ICC (OutputIntent CMYK)
              </label>
              <select
                value={config.iccProfile}
                onChange={(e) =>
                  onConfigChange({ iccProfile: e.target.value as PrepressConfig['iccProfile'] })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm bg-white text-[#131C31]"
              >
                {Object.values(ICC_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#64748B] mt-1.5">{iccMeta.description}</p>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] space-y-2 text-xs text-[#334155] font-mono tabular-nums">
              <div className="flex justify-between">
                <span>Standar PDF:</span>
                <span className="font-bold text-[#1F3864]">PDF/X-1a:2001</span>
              </div>
              <div className="flex justify-between">
                <span>Ruang Warna:</span>
                <span className="font-bold text-[#1F3864]">/DeviceCMYK (0 RGB)</span>
              </div>
              <div className="flex justify-between">
                <span>TrimBox Kartu:</span>
                <span>{config.cardW} × {config.cardH} mm</span>
              </div>
              <div className="flex justify-between">
                <span>BleedBox (+{config.bleedMm}mm):</span>
                <span>
                  {(config.cardW + config.bleedMm * 2).toFixed(1)} ×{' '}
                  {(config.cardH + config.bleedMm * 2).toFixed(1)} mm
                </span>
              </div>
            </div>
          </div>

          {/* Individual Print & Layered Source Downloads */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
              <Download className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                Unduh Berkas Satuan &amp; Sumber Berlapis
              </h3>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={busyTask !== null}
                onClick={() => handleExportPdfx()}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] disabled:opacity-50 text-white text-xs font-semibold shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C9A227]" />
                  Ekspor PDF/X-1a CMYK ({activeStudents.length} Siswa)
                </span>
                <span className="font-mono text-[11px] text-[#C9A227]">~{metrics.estimatedPdfSizeMb} MB</span>
              </button>

              <button
                type="button"
                disabled={busyTask !== null}
                onClick={() => handleExportPdfx('calibration')}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#1F3864] text-xs font-semibold shadow-2xs transition-all duration-150"
              >
                <span>Lembar Tes Kalibrasi Duplex (+ / ○) PDF/X-1a</span>
                <span className="font-mono text-[11px]">2 Hal</span>
              </button>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                  Sumber Vector Berlapis SVG (#{selectedStudent.no} · {selectedStudent.kelas})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadLayeredSvg('front')}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] hover:border-[#94A3B8] text-xs font-medium text-[#1F3864] transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Depan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadLayeredSvg('back')}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] hover:border-[#94A3B8] text-xs font-medium text-[#1F3864] transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Belakang
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadLayeredSvg('foldable')}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] hover:border-[#94A3B8] text-xs font-medium text-[#1F3864] transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Lipat 2-Sisi
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadIcc}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] hover:border-[#94A3B8] text-xs font-medium text-[#334155] transition-colors"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  Profil .ICC CMYK
                </button>
                <button
                  type="button"
                  onClick={handleDownloadStandaloneHtml}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] hover:border-[#94A3B8] text-xs font-medium text-[#334155] transition-colors"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  HTML Paste Nov
                </button>
              </div>
            </div>
          </div>

          {/* Structured Archive Folder Tree Preview */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
              <FolderTree className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                Struktur Folder Arsip Konsisten
              </h3>
            </div>
            <pre className="font-mono text-[11px] leading-relaxed text-[#334155] rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 overflow-x-auto">
{`SMAN1ALALAK_PAS2026_Arsip_Pracetak/
├── 01_PDFX1a_CMYK_PrintReady/
│   ├── Kartu_PAS_PDFX1a_CMYK_${config.dpi}DPI.pdf
│   └── Lembar_Kalibrasi_Duplex.pdf
├── 02_Source_Berlapis_SVG/
│   ├── Kartu_Depan_Berlapis_Bleed3mm.svg
│   ├── Kartu_Belakang_PasteNov_Berlapis.svg
│   └── Spread_Lipat_Tempel_Berlapis.svg
├── 03_Berkas_Sumber_Asli/
│   ├── Data_Siswa_Master_${STUDENTS_MASTER.length}.csv
│   ├── Jadwal_Paste_November_2026.json (${Object.keys(activeScheduleMap).length} kls)
│   ├── Profil_Warna_${config.iccProfile}_CMYK.icc
│   └── Cetak_Kartu_PAS_Paste_November.html
└── 04_Dokumentasi_dan_Laporan/
    ├── Panduan_Operasional_Tim_Produksi.md
    ├── Checklist_Kelengkapan_Aset.json
    └── Laporan_Efisiensi_Alur_Kerja.md`}
            </pre>
            <div className="text-xs text-[#475569] flex items-center justify-between pt-1">
              <span>Status kelengkapan:</span>
              <span className="font-mono font-bold text-[#059669]">
                {checklist.filter((c) => c.passed).length}/{checklist.length} ELEMEN SIAP
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
