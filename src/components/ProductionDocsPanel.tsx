import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileBarChart2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import type { ScheduleRow, StudentRecord } from '../data/pasData';
import type { PrepressConfig } from '../types/prepress';
import {
  computeEfficiencyMetrics,
  evaluateAssetChecklist,
  generateEfficiencyReportMarkdown,
  generateProductionGuideMarkdown,
} from '../utils/archiveExporter';

interface ProductionDocsPanelProps {
  filteredStudents: StudentRecord[];
  config: PrepressConfig;
  schedulesMap?: Record<string, ScheduleRow[]>;
}

export const ProductionDocsPanel: React.FC<ProductionDocsPanelProps> = ({
  filteredStudents,
  config,
  schedulesMap,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const checklist = useMemo(
    () => evaluateAssetChecklist(filteredStudents, config, schedulesMap),
    [filteredStudents, config, schedulesMap],
  );
  const metrics = useMemo(
    () => computeEfficiencyMetrics(filteredStudents, config),
    [filteredStudents, config],
  );

  const passedCount = checklist.filter((c) => c.passed).length;

  const copyMarkdown = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F4F6FA] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Audit Banner */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-[#C9A227] font-semibold">
              Dokumen Utama Proyek · Audit &amp; Evaluasi Tim Produksi
            </p>
            <h2 className="font-display text-xl font-bold text-[#1F3864] mt-0.5">
              Pengecekan Kelengkapan Aset, Panduan Produksi &amp; Laporan Efisiensi Pengarsipan
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-2.5">
            <span className="text-[#475569]">Verifikasi Akhir:</span>
            <strong className="text-[#059669] tabular-nums">
              {passedCount}/{checklist.length} ELEMEN LENGKAP
            </strong>
          </div>
        </div>

        {/* 1. Asset Completeness Final Audit */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                1. Pengecekan Akhir Kelengkapan Seluruh Elemen Aset
              </h3>
            </div>
            <span className="font-mono text-xs text-[#64748B]">Evaluasi Otomatis Langsung</span>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-[#F8FAFC]"
              >
                <div className="flex items-start gap-3">
                  {item.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-[#131C31]">{item.label}</div>
                    <div className="text-xs text-[#475569] mt-0.5">{item.detail}</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#44546A] rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 whitespace-nowrap shrink-0">
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Archiving Workflow Efficiency Report */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                2. Laporan Ringkas Efisiensi Alur Kerja Pengarsipan
              </h3>
            </div>
            <button
              type="button"
              onClick={() =>
                copyMarkdown(
                  'eff',
                  generateEfficiencyReportMarkdown(metrics, checklist, config),
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-medium text-[#1F3864] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedId === 'eff' ? 'Tersalin!' : 'Salin Laporan (Markdown)'}
            </button>
          </div>

          {/* Quantitative KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#DCE2EE] border-b border-[#DCE2EE]">
            <div className="p-4">
              <div className="text-xs text-[#64748B]">Efisiensi Luas Kertas</div>
              <div className="font-mono text-2xl font-bold text-[#1F3864] tabular-nums mt-1">
                {metrics.paperUtilizationPct}%
              </div>
              <div className="text-[11px] text-[#475569] mt-0.5 tabular-nums">
                {metrics.cardsPerSheet} kartu/lembar · {metrics.totalSheets} lembar
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#64748B]">Reduksi Kompresi Arsip</div>
              <div className="font-mono text-2xl font-bold text-[#059669] tabular-nums mt-1">
                {metrics.compressionRatioPct}%
              </div>
              <div className="text-[11px] text-[#475569] mt-0.5 tabular-nums">
                ZIP ~{metrics.estimatedZipSizeMb} MB vs CMYK mentah {config.dpi} DPI
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#64748B]">Penghematan Waktu Kerja</div>
              <div className="font-mono text-2xl font-bold text-[#1F3864] tabular-nums mt-1">
                {metrics.timeSavedPct}%
              </div>
              <div className="text-[11px] text-[#475569] mt-0.5 tabular-nums">
                ~{metrics.automatedTimeMinutes} mnt vs ~{metrics.manualTimeMinutes} mnt manual
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-[#64748B]">Deduplikasi XObject Kelas</div>
              <div className="font-mono text-2xl font-bold text-[#C9A227] tabular-nums mt-1">
                20 / {metrics.totalStudents}
              </div>
              <div className="text-[11px] text-[#475569] mt-0.5">
                Hanya 20 template belakang di-render untuk 619 kartu
              </div>
            </div>
          </div>

          <div className="p-5 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DCE2EE] text-[#44546A] font-semibold">
                  <th className="py-2 pr-4">Tahapan Alur Kerja</th>
                  <th className="py-2 pr-4">Metode Konvensional</th>
                  <th className="py-2 pr-4">Alur Terstruktur Studio Pracetak</th>
                  <th className="py-2">Dampak Efisiensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[#1E293B]">
                <tr>
                  <td className="py-2.5 pr-4 font-semibold">Pembaruan Jadwal Belakang</td>
                  <td className="py-2.5 pr-4">Salin-tempel manual 20 kelas di Corel/Word</td>
                  <td className="py-2.5 pr-4">Sinkronisasi otomatis dari JSON Paste November</td>
                  <td className="py-2.5 font-mono text-[#059669]">0 kesalahan ketik jadwal</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold">Imposisi Simetris &amp; Bleed 3mm</td>
                  <td className="py-2.5 pr-4">Geser manual koordinat duplex + gambar garis potong</td>
                  <td className="py-2.5 pr-4">Matriks simetris otomatis + mode Lipat-Tempel + dx/dy</td>
                  <td className="py-2.5 font-mono text-[#059669]">Presisi ≤ 0,1 mm &amp; anti garis putih</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold">Konversi CMYK &amp; PDF/X-1a</td>
                  <td className="py-2.5 pr-4">Ekspor terpisah per file lalu konversi preflight RIP</td>
                  <td className="py-2.5 pr-4">Stream /DeviceCMYK + ICC OutputIntent FOGRA39 langsung</td>
                  <td className="py-2.5 font-mono text-[#059669]">Siap cetak mesin tanpa konversi ulang</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold">Pengarsipan &amp; Kompresi Aset</td>
                  <td className="py-2.5 pr-4">File terpencar tanpa penamaan baku (&gt; 300 MB raster)</td>
                  <td className="py-2.5 pr-4">4 folder terstruktur + ZIP DEFLATE Level 9 + SVG berlapis</td>
                  <td className="py-2.5 font-mono text-[#059669]">Mudah dibagikan &amp; siap revisi</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Production Team Operations Guide */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#1F3864]" />
              <h3 className="font-display font-bold text-sm text-[#1F3864]">
                3. Panduan Singkat Pengoperasian Berkas bagi Tim Produksi
              </h3>
            </div>
            <button
              type="button"
              onClick={() => copyMarkdown('sop', generateProductionGuideMarkdown(config))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-medium text-[#1F3864] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedId === 'sop' ? 'Tersalin!' : 'Salin SOP Produksi'}
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#334155] leading-relaxed">
            <div className="space-y-3">
              <h4 className="font-display font-bold text-[#1F3864]">
                A. Persiapan Cetak &amp; Uji Kalibrasi Printer
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li>
                  Gunakan berkas di folder <code className="font-mono bg-[#F1F5F9] px-1">01_PDFX1a_CMYK_PrintReady/</code> untuk mesin cetak digital/offset.
                </li>
                <li>
                  Pada dialog printer, wajib atur <strong>Scale: 100% / Actual Size</strong>, matikan <em>Fit to Page</em> dan header/footer browser.
                </li>
                <li>
                  Cetak 1 lembar <strong>Tes Kalibrasi</strong> bolak-balik, lalu terawang terhadap cahaya. Jika lingkaran <code>○</code> belakang belum tepat di tengah tanda <code>+</code> depan, isi kompensasi <strong>dx / dy (mm)</strong> lalu ekspor ulang.
                </li>
              </ol>
              <h4 className="font-display font-bold text-[#1F3864] pt-2">
                B. Pemotongan &amp; Penempelan Presisi
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li>
                  Gunakan garis potong solid hitam (<strong>Crop Marks</strong>) sebagai jalur pisau potong guillotine/cutter. Margin <strong>Bleed 3 mm</strong> memastikan warna latar menembus batas potong tanpa tepi putih.
                </li>
                <li>
                  Jika memilih metode cetak 1-sisi <strong>Lipat &amp; Tempel (Bifold)</strong>, tekuk di sepanjang garis putus-putus magenta (<strong>Penanda Lipatan / Fold Marks</strong>) lalu lem/laminasi untuk kesejajaran 0,0 mm.
                </li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-display font-bold text-[#1F3864]">
                C. Revisi Desain Berlapis &amp; Arsip Semester Berikutnya
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs">
                <li>
                  Untuk mengedit logo, warna border, atau teks tanpa menyusun ulang layout, buka berkas SVG di <code className="font-mono bg-[#F1F5F9] px-1">02_Source_Berlapis_SVG/</code> via Adobe Illustrator, Inkscape, atau CorelDRAW.
                </li>
                <li>
                  Setiap berkas SVG terorganisasi menjadi 4 layer terkunci terstruktur: <code className="font-mono">01 Bleed 3mm</code>, <code className="font-mono">02 Artwork &amp; Konten</code>, <code className="font-mono">03 Penanda Lipatan</code>, dan <code className="font-mono">04 Crop Marks</code>.
                </li>
                <li>
                  Untuk mencetak ulang di tahun ajaran baru, cukup unggah berkas CSV baru (kolom: <code className="font-mono">no,nama,kelas,ruang,user</code>) pada sidebar Studio Desain.
                </li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
