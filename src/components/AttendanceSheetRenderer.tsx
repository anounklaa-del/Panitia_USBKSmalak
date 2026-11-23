import React from 'react';
import { LOGO_LEFT_DATA_URI, LOGO_RIGHT_DATA_URI } from '../data/pasData';
import type { AttendanceConfig, PrepressConfig } from '../types/prepress';
import type { AttendancePageEntry } from '../utils/attendanceBuilder';
import { formatParticipantNo } from '../utils/deskStickerBuilder';
import { getSeatingPaperDimensions } from '../utils/seatingPlanBuilder';

function AttendancePageMarkup({
  entry,
  paperW,
  paperH,
  attendanceConfig,
  forPrint,
}: {
  entry: AttendancePageEntry;
  paperW: number;
  paperH: number;
  attendanceConfig: AttendanceConfig;
  forPrint?: boolean;
}) {
  const { group, pageInGroup, totalPagesInGroup, rows } = entry;
  const showSchoolHeader = attendanceConfig.showSchoolHeader !== false;
  const isLandscape = attendanceConfig.paperOrientation === 'landscape';
  const showSummary = attendanceConfig.showSummaryAndSignatures;

  // Adaptive row density so rows fit cleanly without clipping (including full 65-student rooms)
  const isUltraDense = rows.length >= 42 || (isLandscape && rows.length >= 26);
  const isVeryDense = !isUltraDense && (rows.length >= 32 || (isLandscape && rows.length >= 21));
  const isDense = !isUltraDense && !isVeryDense && (rows.length >= 25 || (isLandscape && rows.length >= 16));
  const cellFontPt = isUltraDense ? '5.4pt' : isVeryDense ? '6.1pt' : isDense ? '6.8pt' : '7.4pt';
  const rowPadY = isUltraDense ? '0.28mm' : isVeryDense ? '0.35mm' : isDense ? '0.6mm' : '0.95mm';
  const sigMinH = isUltraDense ? '2.85mm' : isVeryDense ? '3.9mm' : isDense ? '4.8mm' : '5.8mm';
  const pageGap = isUltraDense ? '1.1mm' : '2.2mm';

  const sigColW = isLandscape ? '64mm' : '48mm';
  const noPesertaW = attendanceConfig.showFullParticipantNo ? '34mm' : '15mm';

  return (
    <div
      className={`relative bg-white overflow-hidden ${
        forPrint ? 'print-sheet-page' : 'shadow-lg border border-[#CBD5E1]'
      }`}
      style={{
        width: `${paperW}mm`,
        height: `${paperH}mm`,
        padding: `${Math.max(4, attendanceConfig.marginMm)}mm`,
        display: 'flex',
        flexDirection: 'column',
        gap: pageGap,
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0F172A',
      }}
    >
      {/* Official School Kop or Minimal Header */}
      {showSchoolHeader ? (
        <div
          style={{
            marginBottom: isUltraDense ? '0.4mm' : '0.8mm',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3.5mm',
              paddingBottom: isUltraDense ? '1.2mm' : '2.0mm',
              borderBottom: '0.85mm solid #1F3864',
            }}
          >
            <div
              style={{
                width: isUltraDense ? '19mm' : '24mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={LOGO_LEFT_DATA_URI}
                alt="Logo Pemprov Kalimantan Selatan"
                style={{
                  height: isUltraDense ? '15.5mm' : '20.5mm',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <div
              style={{
                textAlign: 'center',
                flex: 1,
                minWidth: 0,
                lineHeight: isUltraDense ? 1.14 : 1.2,
              }}
            >
              <div
                style={{
                  fontSize: isUltraDense ? '6.6pt' : '8.2pt',
                  fontWeight: 700,
                  color: '#334155',
                  letterSpacing: '0.25mm',
                }}
              >
                PEMERINTAH PROVINSI KALIMANTAN SELATAN
              </div>
              <div
                style={{
                  fontSize: isUltraDense ? '6.6pt' : '8.2pt',
                  fontWeight: 700,
                  color: '#334155',
                  letterSpacing: '0.25mm',
                }}
              >
                DINAS PENDIDIKAN DAN KEBUDAYAAN
              </div>
              <div
                style={{
                  fontSize: isUltraDense ? '11.2pt' : '13.8pt',
                  fontWeight: 800,
                  color: '#1F3864',
                  letterSpacing: '0.3mm',
                  marginTop: isUltraDense ? '0.15mm' : '0.35mm',
                }}
              >
                SMA NEGERI 1 ALALAK
              </div>
              <div
                style={{
                  fontSize: isUltraDense ? '7.5pt' : '8.8pt',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: isUltraDense ? '0.3mm' : '0.55mm',
                  letterSpacing: '0.18mm',
                }}
              >
                DAFTAR HADIR PESERTA · {attendanceConfig.examTitle || 'PENILAIAN SUMATIF'}
              </div>
              <div
                style={{
                  fontSize: isUltraDense ? '6.1pt' : '7.2pt',
                  fontWeight: 700,
                  color: '#44546A',
                  marginTop: '0.15mm',
                }}
              >
                TAHUN AJARAN {attendanceConfig.academicYear || '2026/2027'}
              </div>
            </div>
            <div
              style={{
                width: isUltraDense ? '19mm' : '24mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={LOGO_RIGHT_DATA_URI}
                alt="Lambang Sekolah SMAN 1 Alalak"
                style={{
                  height: isUltraDense ? '14.5mm' : '19.5mm',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
          <div style={{ height: '0.55mm', borderBottom: '0.35mm solid #C9A227' }} />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3mm',
            paddingBottom: '1.4mm',
            borderBottom: '0.55mm solid #1F3864',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '10.5pt', fontWeight: 800, color: '#1F3864' }}>
              DAFTAR HADIR PESERTA · {attendanceConfig.examTitle || 'PENILAIAN SUMATIF'}
            </div>
            <div style={{ fontSize: '7pt', fontWeight: 600, color: '#44546A', marginTop: '0.2mm' }}>
              Tahun Ajaran {attendanceConfig.academicYear || '2026/2027'}
            </div>
          </div>
          <div
            style={{
              backgroundColor: '#1F3864',
              color: '#FFFFFF',
              padding: '1mm 2.8mm',
              fontSize: '8.5pt',
              fontWeight: 800,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              flexShrink: 0,
            }}
          >
            {group.badgeLabel}
          </div>
        </div>
      )}

      {/* Session Metadata Box */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr auto',
          border: '0.35mm solid #1F3864',
          backgroundColor: '#F8FAFC',
          fontSize: isUltraDense ? '6.3pt' : '7.1pt',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div
          style={{
            padding: isUltraDense ? '0.8mm 1.8mm' : '1.2mm 2.2mm',
            borderRight: '0.25mm solid #CBD5E1',
            display: 'grid',
            gridTemplateColumns: '24mm 3mm 1fr',
            rowGap: isUltraDense ? '0.3mm' : '0.6mm',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontWeight: 700, color: '#44546A' }}>
            {group.groupKind === 'KELAS' ? 'Kelas' : 'Ruang Ujian'}
          </span>
          <span>:</span>
          <span style={{ fontWeight: 800, color: '#1F3864' }}>
            {group.badgeLabel}{' '}
            <span style={{ fontWeight: 500, color: '#475569', fontSize: isUltraDense ? '5.8pt' : '6.5pt' }}>
              ({group.classSummaryText})
            </span>
          </span>

          <span style={{ fontWeight: 700, color: '#44546A' }}>Mata Pelajaran</span>
          <span>:</span>
          <span style={{ fontWeight: 700, color: '#0F172A' }}>
            {attendanceConfig.subjectName.trim() || '_______________________________________'}
          </span>
        </div>

        <div
          style={{
            padding: isUltraDense ? '0.8mm 1.8mm' : '1.2mm 2.2mm',
            borderRight: '0.25mm solid #CBD5E1',
            display: 'grid',
            gridTemplateColumns: '22mm 3mm 1fr',
            rowGap: isUltraDense ? '0.3mm' : '0.6mm',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontWeight: 700, color: '#44546A' }}>Hari / Tanggal</span>
          <span>:</span>
          <span style={{ fontWeight: 700, color: '#0F172A' }}>
            {attendanceConfig.examDate.trim() || '_______________________________'}
          </span>

          <span style={{ fontWeight: 700, color: '#44546A' }}>Waktu / Pukul</span>
          <span>:</span>
          <span style={{ fontWeight: 700, color: '#0F172A' }}>
            {attendanceConfig.examTime.trim() || '_______________________________'}
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#1F3864',
            color: '#FFFFFF',
            padding: isUltraDense ? '0.8mm 2.2mm' : '1.2mm 2.6mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            minWidth: '22mm',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}
        >
          <div style={{ fontSize: '5.5pt', color: '#F3D06B', fontWeight: 700 }}>
            HAL {pageInGroup}/{totalPagesInGroup}
          </div>
          <div style={{ fontSize: isUltraDense ? '8.2pt' : '9pt', fontWeight: 800, lineHeight: 1.15 }}>
            {rows.length} SISWA
          </div>
          <div style={{ fontSize: '5.5pt', color: '#CBD5E1' }}>
            No. 1–{rows.length}
          </div>
        </div>
      </div>

      {/* Main Attendance Table with Staggered Signature Columns */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            fontSize: cellFontPt,
            lineHeight: isUltraDense ? 1.05 : 1.15,
            fontVariantNumeric: 'tabular-nums',
            border: '0.4mm solid #1F3864',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#1F3864',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: isUltraDense ? '6.0pt' : '6.8pt',
              }}
            >
              <th
                style={{
                  width: '7.5mm',
                  padding: isUltraDense ? '0.65mm 0.6mm' : '1.2mm 0.8mm',
                  border: '0.25mm solid #334E7B',
                  textAlign: 'center',
                }}
              >
                No
              </th>
              <th
                style={{
                  width: noPesertaW,
                  padding: isUltraDense ? '0.65mm 1.1mm' : '1.2mm 1.4mm',
                  border: '0.25mm solid #334E7B',
                  textAlign: 'left',
                }}
              >
                Nomor Peserta
              </th>
              <th
                style={{
                  padding: isUltraDense ? '0.65mm 1.4mm' : '1.2mm 1.8mm',
                  border: '0.25mm solid #334E7B',
                  textAlign: 'left',
                }}
              >
                Nama Lengkap Peserta
              </th>
              <th
                style={{
                  width: '13mm',
                  padding: isUltraDense ? '0.65mm 0.6mm' : '1.2mm 0.8mm',
                  border: '0.25mm solid #334E7B',
                  textAlign: 'center',
                }}
              >
                Kelas
              </th>
              {attendanceConfig.showDeskAndRoomCol && (
                <th
                  style={{
                    width: '18.5mm',
                    padding: isUltraDense ? '0.65mm 0.6mm' : '1.2mm 0.8mm',
                    border: '0.25mm solid #334E7B',
                    textAlign: 'center',
                  }}
                >
                  Ruang / Meja
                </th>
              )}
              <th
                style={{
                  width: sigColW,
                  padding: isUltraDense ? '0.65mm 1mm' : '1.2mm 1.2mm',
                  border: '0.25mm solid #334E7B',
                  textAlign: 'center',
                }}
              >
                Tanda Tangan Peserta
              </th>
              {attendanceConfig.showNotesCol && (
                <th
                  style={{
                    width: '12mm',
                    padding: isUltraDense ? '0.65mm 0.6mm' : '1.2mm 0.8mm',
                    border: '0.25mm solid #334E7B',
                    textAlign: 'center',
                  }}
                >
                  Ket.
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isOdd = row.rowNumber % 2 === 1;
              const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
              return (
                <tr key={`${group.id}-${row.student.no}`} style={{ backgroundColor: rowBg }}>
                  <td
                    style={{
                      padding: `${rowPadY} 0.8mm`,
                      border: '0.22mm solid #94A3B8',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: '#334155',
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    }}
                  >
                    {row.rowNumber}
                  </td>
                  <td
                    style={{
                      padding: `${rowPadY} 1.4mm`,
                      border: '0.22mm solid #94A3B8',
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      fontSize: isUltraDense ? '5.2pt' : isVeryDense ? '5.8pt' : isDense ? '6.3pt' : '6.8pt',
                      fontWeight: 700,
                      color: '#1F3864',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {attendanceConfig.showFullParticipantNo
                      ? formatParticipantNo(row.student.no)
                      : row.student.no}
                  </td>
                  <td
                    style={{
                      padding: `${rowPadY} 1.8mm`,
                      border: '0.22mm solid #94A3B8',
                      fontWeight: 600,
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.student.nama}
                  </td>
                  <td
                    style={{
                      padding: `${rowPadY} 0.8mm`,
                      border: '0.22mm solid #94A3B8',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: '#1F3864',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.student.kelas}
                  </td>
                  {attendanceConfig.showDeskAndRoomCol && (
                    <td
                      style={{
                        padding: `${rowPadY} 0.8mm`,
                        border: '0.22mm solid #94A3B8',
                        textAlign: 'center',
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: isUltraDense ? '5.2pt' : '6.4pt',
                        color: '#334155',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      R.{row.ruang} / {row.mejaLabel.replace('MEJA ', 'M.')}
                    </td>
                  )}
                  <td
                    style={{
                      padding: 0,
                      border: '0.22mm solid #94A3B8',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        height: '100%',
                        minHeight: sigMinH,
                      }}
                    >
                      <div
                        style={{
                          padding: `${rowPadY} 1.2mm`,
                          borderRight: '0.2mm dashed #CBD5E1',
                          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                          fontSize: isUltraDense ? '5.1pt' : '6.2pt',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {isOdd ? `${row.rowNumber}.` : ''}
                      </div>
                      <div
                        style={{
                          padding: `${rowPadY} 1.2mm`,
                          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                          fontSize: isUltraDense ? '5.1pt' : '6.2pt',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {!isOdd ? `${row.rowNumber}.` : ''}
                      </div>
                    </div>
                  </td>
                  {attendanceConfig.showNotesCol && (
                    <td
                      style={{
                        padding: `${rowPadY} 0.8mm`,
                        border: '0.22mm solid #94A3B8',
                        textAlign: 'center',
                      }}
                    />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: Attendance Summary (Left) + Pengawas Ruangan Signature (Right) */}
      {showSummary ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1.2fr',
            gap: '4mm',
            flexShrink: 0,
            marginTop: isUltraDense ? '1.2mm' : '2.8mm',
            alignItems: 'stretch',
          }}
        >
          {/* Left: Rekapitulasi Kehadiran */}
          <div
            style={{
              border: '0.35mm solid #1F3864',
              padding: isUltraDense ? '1.0mm 1.8mm' : '1.5mm 2.2mm',
              backgroundColor: '#F8FAFC',
              fontSize: isUltraDense ? '6.0pt' : '6.7pt',
              lineHeight: isUltraDense ? 1.28 : 1.45,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: '#1F3864',
                borderBottom: '0.25mm solid #CBD5E1',
                paddingBottom: '0.4mm',
                marginBottom: '0.5mm',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '2mm',
              }}
            >
              <span>REKAPITULASI KEHADIRAN PESERTA</span>
              {totalPagesInGroup > 1 && (
                <span style={{ fontWeight: 600, color: '#475569' }}>
                  Total {group.badgeLabel}: {group.rows.length}
                </span>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                rowGap: isUltraDense ? '0.25mm' : '0.5mm',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>1. Jumlah peserta lembar ini</span>
              <strong>: {rows.length} orang</strong>
              <span>2. Jumlah peserta yang hadir</span>
              <span>: ______ orang</span>
              <span>3. Jumlah peserta yang tidak hadir</span>
              <span>: ______ orang</span>
            </div>
            <div
              style={{
                marginTop: isUltraDense ? '0.6mm' : '1mm',
                paddingTop: '0.5mm',
                borderTop: '0.2mm dashed #CBD5E1',
                color: '#334155',
                fontSize: isUltraDense ? '5.7pt' : '6.3pt',
              }}
            >
              <div>Ket. Tidak Hadir (S / I / A) &amp; No. Peserta:</div>
              <div style={{ marginTop: isUltraDense ? '1.8mm' : '2.5mm', borderBottom: '0.2mm dotted #64748B' }} />
            </div>
          </div>

          {/* Right: TTD Pengawas Ruangan (Mengetahui, Alalak, ... 2026) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              padding: isUltraDense ? '0.4mm 1.5mm 0.2mm 1.5mm' : '0.8mm 1.5mm 0.5mm 1.5mm',
              fontSize: isUltraDense ? '6.3pt' : '7pt',
              lineHeight: 1.3,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '6mm',
                justifyContent: 'flex-end',
                textAlign: 'left',
              }}
            >
              <div style={{ minWidth: '46mm' }}>
                <div style={{ fontWeight: 600, color: '#1E293B' }}>Mengetahui,</div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>
                  {attendanceConfig.cityLabel || 'Alalak'},{' '}
                  {attendanceConfig.examDate.trim()
                    ? attendanceConfig.examDate.trim().includes('2026')
                      ? attendanceConfig.examDate.trim()
                      : `${attendanceConfig.examDate.trim()} 2026`
                    : '.............................2026'}
                </div>
                <div style={{ fontWeight: 700, color: '#1F3864', marginTop: '0.35mm' }}>
                  {attendanceConfig.twoProctors ? 'Pengawas Ruangan 1' : 'Pengawas Ruangan'}
                </div>
                <div style={{ height: isUltraDense ? '7.5mm' : '12mm' }} />
                <div
                  style={{
                    fontWeight: 700,
                    color: '#0F172A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attendanceConfig.proctor1Name.trim() ||
                    '( .......................................... )'}
                </div>
                <div style={{ fontSize: '5.8pt', color: '#475569', marginTop: '0.2mm' }}>NIP.</div>
              </div>

              {attendanceConfig.twoProctors && (
                <div style={{ minWidth: '42mm' }}>
                  <div style={{ fontWeight: 600, color: 'transparent' }}>&nbsp;</div>
                  <div style={{ fontWeight: 600, color: 'transparent' }}>&nbsp;</div>
                  <div style={{ fontWeight: 700, color: '#1F3864', marginTop: '0.35mm' }}>
                    Pengawas Ruangan 2
                  </div>
                  <div style={{ height: isUltraDense ? '7.5mm' : '12mm' }} />
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {attendanceConfig.proctor2Name.trim() ||
                      '( .......................................... )'}
                  </div>
                  <div style={{ fontSize: '5.8pt', color: '#475569', marginTop: '0.2mm' }}>NIP.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceSheetPagesBlock({
  pages,
  paperConfig,
  attendanceConfig,
  forPrint,
}: {
  pages: AttendancePageEntry[];
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>;
  attendanceConfig: AttendanceConfig;
  forPrint?: boolean;
}) {
  const { paperW, paperH } = getSeatingPaperDimensions(
    paperConfig,
    attendanceConfig.paperOrientation,
  );

  return (
    <div className={forPrint ? '' : 'space-y-8 flex flex-col items-center'}>
      {pages.map((entry, idx) => (
        <div key={entry.key} className={forPrint ? '' : 'flex flex-col items-center'}>
          {!forPrint && (
            <div className="mb-2 flex items-center gap-3 text-xs font-mono text-[#44546A]">
              <span className="font-semibold text-[#1F3864]">
                HALAMAN {idx + 1} · {entry.group.badgeLabel}
              </span>
              <span>·</span>
              <span>
                Bagian {entry.pageInGroup}/{entry.totalPagesInGroup} ({entry.rows.length} baris ·
                No. {entry.rows[0]?.rowNumber ?? 0}–
                {entry.rows[entry.rows.length - 1]?.rowNumber ?? 0})
              </span>
            </div>
          )}
          <AttendancePageMarkup
            entry={entry}
            paperW={paperW}
            paperH={paperH}
            attendanceConfig={attendanceConfig}
            forPrint={forPrint}
          />
        </div>
      ))}
    </div>
  );
}
