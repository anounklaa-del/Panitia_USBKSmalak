import React from 'react';
import { LOGO_LEFT_DATA_URI } from '../data/pasData';
import type { BeritaAcaraConfig, PrepressConfig } from '../types/prepress';
import type { BeritaAcaraPrintPage, BeritaAcaraRecord } from '../utils/beritaAcaraStore';
import { getSeatingPaperDimensions } from '../utils/seatingPlanBuilder';

interface SlipProps {
  record: BeritaAcaraRecord;
  baConfig: BeritaAcaraConfig;
  academicYear: string;
  compact?: boolean;
}

function DottedValue({
  value,
  isBlank,
  placeholder,
  minWidth,
  bold,
}: {
  value?: string | number;
  isBlank: boolean;
  placeholder: string;
  minWidth?: string;
  bold?: boolean;
}) {
  const strVal = value !== undefined && value !== null ? String(value).trim() : '';
  if (isBlank || !strVal) {
    return (
      <span
        style={{
          display: 'inline-block',
          minWidth: minWidth ?? 'auto',
          letterSpacing: '0.15mm',
          color: '#111827',
        }}
      >
        {placeholder}
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: minWidth ?? 'auto',
        fontWeight: bold ? 700 : 600,
        color: '#000000',
        borderBottom: '0.22mm dotted #475569',
        paddingLeft: '0.8mm',
        paddingRight: '0.8mm',
      }}
    >
      {strVal}
    </span>
  );
}

export const BeritaAcaraSingleSlip: React.FC<SlipProps> = ({
  record,
  baConfig,
  academicYear,
  compact = false,
}) => {
  const isBlank = baConfig.fillMode === 'blank';
  const yearDash = (academicYear || '2026/2027').replace('/', '-');
  const titleText =
    baConfig.examPeriodTitle.trim() ||
    'PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER GANJIL';
  const addressText =
    baConfig.schoolAddress.trim() ||
    'Jalan Brigjen. H. Hasan Basri KM. 11 Handil Bakti Kec. Alalak Kab. Batola ,70582';

  const bodyPt = compact ? '7.6pt' : '8.6pt';
  const kopTitlePt = compact ? '7.5pt' : '8.5pt';
  const kopSchoolPt = compact ? '8.4pt' : '9.5pt';
  const kopAddrPt = compact ? '6.4pt' : '7.2pt';
  const logoH = compact ? '11.5mm' : '13.5mm';
  const sigBoxW = compact ? '68%' : '62%';

  return (
    <div
      style={{
        fontFamily: '"Times New Roman", Georgia, serif',
        color: '#000000',
        lineHeight: compact ? 1.32 : 1.38,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Kop Surat */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2.5mm',
          paddingBottom: '1.4mm',
          borderBottom: '0.7mm solid #000000',
        }}
      >
        <div
          style={{
            width: compact ? '12mm' : '14.5mm',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={LOGO_LEFT_DATA_URI}
            alt="Logo Pemerintah Provinsi Kalimantan Selatan"
            style={{
              height: logoH,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
        <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.18 }}>
          <div style={{ fontSize: kopTitlePt, fontWeight: 700, letterSpacing: '0.08mm' }}>
            {titleText}
          </div>
          <div style={{ fontSize: kopTitlePt, fontWeight: 700 }}>
            TAHUN PELAJARAN {yearDash}
          </div>
          <div style={{ fontSize: kopSchoolPt, fontWeight: 700 }}>
            SMA NEGERI 1 ALALAK
          </div>
          <div style={{ fontSize: kopAddrPt, fontWeight: 400, marginTop: '0.3mm' }}>
            {addressText}
          </div>
        </div>
      </div>

      {/* Document Heading */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: compact ? '9pt' : '10.2pt',
          textDecoration: 'underline',
          marginTop: compact ? '2.4mm' : '3.4mm',
          marginBottom: compact ? '2.2mm' : '3mm',
          letterSpacing: '0.25mm',
        }}
      >
        BERITA ACARA
      </div>

      {/* Body Paragraphs */}
      <div style={{ fontSize: bodyPt, flex: 1 }}>
        <div style={{ marginBottom: '1.2mm' }}>
          Pada hari ini{' '}
          <DottedValue
            value={record.dayName}
            isBlank={isBlank}
            placeholder="………………"
            minWidth="16mm"
            bold
          />{' '}
          Tanggal{' '}
          <DottedValue
            value={record.dayNum}
            isBlank={isBlank}
            placeholder="……"
            minWidth="7mm"
            bold
          />{' '}
          Bulan{' '}
          <DottedValue
            value={record.monthName}
            isBlank={isBlank}
            placeholder="………….."
            minWidth="18mm"
            bold
          />{' '}
          Tahun{' '}
          <DottedValue
            value={record.year}
            isBlank={isBlank}
            placeholder="2026"
            minWidth="9mm"
            bold
          />{' '}
          SMA Negeri 1 Alalak
        </div>

        {/* Section a */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.8mm', marginBottom: '1.5mm' }}>
          <span style={{ width: '3.5mm', flexShrink: 0 }}>a.</span>
          <div style={{ flex: 1 }}>
            <div>
              Telah menyelenggarakan Penilaian Sumatif dari pukul{' '}
              <DottedValue
                value={record.timeStart}
                isBlank={isBlank}
                placeholder="………….."
                minWidth="12mm"
              />{' '}
              sampai{' '}
              <DottedValue
                value={record.timeEnd}
                isBlank={isBlank}
                placeholder="……………….."
                minWidth="13mm"
              />
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '0.7mm',
                fontSize: bodyPt,
              }}
            >
              <tbody>
                <tr>
                  <td style={{ width: compact ? '26mm' : '30mm', padding: '0.2mm 0', verticalAlign: 'top' }}>
                    Ruang/ kelas
                  </td>
                  <td style={{ width: '2.5mm', padding: '0.2mm 0', verticalAlign: 'top' }}>:</td>
                  <td style={{ padding: '0.2mm 0' }}>
                    <DottedValue
                      value={record.roomLabel}
                      isBlank={isBlank}
                      placeholder="……………….."
                      minWidth="15mm"
                      bold
                    />{' '}
                    /{' '}
                    <DottedValue
                      value={record.kelasLabel}
                      isBlank={isBlank}
                      placeholder="………….."
                      minWidth="22mm"
                    />
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ padding: '0.4mm 0 0.1mm 0', fontWeight: 400 }}>
                    Jumlah Peserta
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2mm 0' }}>Seharusnya</td>
                  <td style={{ padding: '0.2mm 0' }}>:</td>
                  <td style={{ padding: '0.2mm 0' }}>
                    <DottedValue
                      value={`${record.registeredCount} Orang`}
                      isBlank={isBlank}
                      placeholder="………………………….."
                      minWidth="24mm"
                      bold
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2mm 0' }}>Yang Hadir</td>
                  <td style={{ padding: '0.2mm 0' }}>:</td>
                  <td style={{ padding: '0.2mm 0' }}>
                    <DottedValue
                      value={record.presentCount}
                      isBlank={isBlank}
                      placeholder="…………………."
                      minWidth="10mm"
                      bold
                    />{' '}
                    Orang, yakni nomor{' '}
                    <DottedValue
                      value={record.presentNumbersSummary}
                      isBlank={isBlank}
                      placeholder="………………………………………."
                      minWidth="28mm"
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2mm 0' }}>Yang tidak hadir</td>
                  <td style={{ padding: '0.2mm 0' }}>:</td>
                  <td style={{ padding: '0.2mm 0' }}>
                    <DottedValue
                      value={record.absentCount}
                      isBlank={isBlank}
                      placeholder="…………….."
                      minWidth="10mm"
                      bold
                    />{' '}
                    Orang yakni nomor{' '}
                    <DottedValue
                      value={record.absentNumbersText}
                      isBlank={isBlank}
                      placeholder="………………………………………."
                      minWidth="28mm"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section b */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.8mm', marginBottom: '1.5mm' }}>
          <span style={{ width: '3.5mm', flexShrink: 0 }}>b.</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1mm' }}>
              <span style={{ width: compact ? '34mm' : '38mm', flexShrink: 0 }}>
                Sampul Penilaian Sumatif
              </span>
              <span>:</span>
              <span style={{ flex: 1 }}>
                <DottedValue
                  value={record.subjectLabel}
                  isBlank={isBlank}
                  placeholder="……………………………………"
                  minWidth="36mm"
                  bold
                />{' '}
                <span>*)</span>
              </span>
            </div>
            <div style={{ marginTop: '0.4mm' }}>
              Telah diterima soal melalui Link Sekolah oleh peserta di ruangan masing-masing
            </div>
            <div style={{ marginTop: '0.4mm' }}>
              Berita acara sebanyak{' '}
              <DottedValue
                value={record.baCopies}
                isBlank={isBlank}
                placeholder="……………."
                minWidth="8mm"
              />{' '}
              eksemplar dan daftar hadir sebanyak{' '}
              <DottedValue
                value={record.attendanceCopies}
                isBlank={isBlank}
                placeholder="………"
                minWidth="8mm"
              />{' '}
              eksemplar.
            </div>
          </div>
        </div>

        {/* Section c */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.8mm' }}>
          <span style={{ width: '3.5mm', flexShrink: 0 }}>c.</span>
          <div style={{ flex: 1 }}>
            <div>Catatan selama pelaksanaan Penilaian Sumatif semester ganjil :</div>
            {isBlank || !record.notes.trim() ? (
              <>
                <div
                  style={{
                    borderBottom: '0.25mm dotted #111827',
                    height: compact ? '4.2mm' : '5mm',
                  }}
                />
                <div
                  style={{
                    borderBottom: '0.25mm dotted #111827',
                    height: compact ? '4.2mm' : '5mm',
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  borderBottom: '0.25mm dotted #111827',
                  minHeight: compact ? '8.4mm' : '10mm',
                  paddingTop: '0.6mm',
                  fontWeight: 600,
                }}
              >
                {record.notes}
              </div>
            )}
            <div style={{ marginTop: '1mm' }}>Berita acara ini dibuat dengan sesungguhnya,</div>
          </div>
        </div>

        {/* Pengawas Signature Table */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: compact ? '2.5mm' : '3.8mm',
          }}
        >
          <table
            style={{
              width: sigBoxW,
              borderCollapse: 'collapse',
              border: '0.3mm solid #000000',
              fontSize: bodyPt,
            }}
          >
            <thead>
              <tr>
                <th
                  colSpan={2}
                  style={{
                    borderBottom: '0.3mm solid #000000',
                    padding: compact ? '0.9mm 2mm' : '1.2mm 2mm',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  Pengawas
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    width: '34%',
                    borderRight: '0.3mm solid #000000',
                    padding: compact ? '3.5mm 2mm 1.8mm 2mm' : '4.5mm 2.5mm 2.2mm 2.5mm',
                    verticalAlign: 'bottom',
                  }}
                >
                  Tanda Tangan
                </td>
                <td
                  style={{
                    padding: compact ? '3.5mm 2mm 1.8mm 2.5mm' : '4.5mm 2.5mm 2.2mm 3mm',
                    verticalAlign: 'bottom',
                  }}
                >
                  …………………………
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    borderRight: '0.3mm solid #000000',
                    padding: compact ? '1.3mm 2mm' : '1.8mm 2.5mm',
                    verticalAlign: 'middle',
                  }}
                >
                  Nama
                </td>
                <td
                  style={{
                    padding: compact ? '1.3mm 2mm 1.3mm 2.5mm' : '1.8mm 2.5mm 1.8mm 3mm',
                    fontWeight: isBlank ? 400 : 700,
                    verticalAlign: 'middle',
                  }}
                >
                  {isBlank ? '…………………………' : record.proctorName}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    borderRight: '0.3mm solid #000000',
                    padding: compact ? '1.3mm 2mm 1.8mm 2mm' : '1.8mm 2.5mm 2.4mm 2.5mm',
                    verticalAlign: 'middle',
                  }}
                >
                  NIP
                </td>
                <td
                  style={{
                    padding: compact ? '1.3mm 2mm 1.8mm 2.5mm' : '1.8mm 2.5mm 2.4mm 3mm',
                    verticalAlign: 'middle',
                  }}
                >
                  {isBlank || !record.proctorNip.trim()
                    ? '…………………………'
                    : record.proctorNip}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footnote */}
      <div
        style={{
          fontSize: compact ? '6.6pt' : '7.4pt',
          marginTop: compact ? '2mm' : '3mm',
          paddingTop: '0.8mm',
        }}
      >
        *) Diisi dengan mata pelajaran yang di Penilaian Sumatif (Semester Ganjil)
      </div>
    </div>
  );
};

export function getBeritaAcaraPaperDimensions(
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  layoutMode: BeritaAcaraConfig['layoutMode'],
): { paperW: number; paperH: number } {
  const orientation = layoutMode === 'one_up' ? 'portrait' : 'landscape';
  return getSeatingPaperDimensions(paperConfig, orientation);
}

export function BeritaAcaraPagesBlock({
  pages,
  paperConfig,
  baConfig,
  academicYear,
  forPrint,
}: {
  pages: BeritaAcaraPrintPage[];
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>;
  baConfig: BeritaAcaraConfig;
  academicYear: string;
  forPrint?: boolean;
}) {
  const { paperW, paperH } = getBeritaAcaraPaperDimensions(
    paperConfig,
    baConfig.layoutMode,
  );

  return (
    <div className={forPrint ? '' : 'space-y-6 flex flex-col items-center'}>
      {pages.map((page, idx) => (
        <div key={page.key} className={forPrint ? '' : 'flex flex-col items-center'}>
          {!forPrint && (
            <div className="mb-2 flex items-center gap-2 text-xs font-mono text-[#44546A]">
              <span className="font-semibold text-[#1F3864]">
                HALAMAN {idx + 1} · {page.isTwoUp ? '2-UP LANSKAP (FORMAT FILE 2)' : '1-UP POTRET'}
              </span>
              <span>·</span>
              <span>
                {page.items.map((it) => `${it.roomLabel} (${it.subjectLabel})`).join(' | ')}
              </span>
            </div>
          )}

          <div
            className={`relative bg-white overflow-hidden ${
              forPrint ? 'print-sheet-page' : 'shadow-lg border border-[#CBD5E1]'
            }`}
            style={{
              width: `${paperW}mm`,
              height: `${paperH}mm`,
              padding: page.isTwoUp ? '8mm 8mm' : '14mm 16mm',
              boxSizing: 'border-box',
            }}
          >
            {page.isTwoUp ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10mm',
                  height: '100%',
                  position: 'relative',
                }}
              >
                {/* Center Cut Guide Line */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '-2mm',
                    bottom: '-2mm',
                    left: '50%',
                    borderLeft: '0.25mm dashed #94A3B8',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ minWidth: 0, height: '100%' }}>
                  <BeritaAcaraSingleSlip
                    record={page.items[0]}
                    baConfig={baConfig}
                    academicYear={academicYear}
                    compact
                  />
                </div>
                <div style={{ minWidth: 0, height: '100%' }}>
                  {page.items[1] ? (
                    <BeritaAcaraSingleSlip
                      record={page.items[1]}
                      baConfig={baConfig}
                      academicYear={academicYear}
                      compact
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: '175mm', margin: '0 auto', height: '100%' }}>
                <BeritaAcaraSingleSlip
                  record={page.items[0]}
                  baConfig={baConfig}
                  academicYear={academicYear}
                  compact={false}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
