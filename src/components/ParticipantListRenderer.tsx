import React from 'react';
import type { ParticipantListConfig, PrepressConfig } from '../types/prepress';
import type { ParticipantListPageEntry } from '../utils/participantListBuilder';
import { getSeatingPaperDimensions } from '../utils/seatingPlanBuilder';

interface ParticipantListPagesBlockProps {
  pages: ParticipantListPageEntry[];
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>;
  listConfig: ParticipantListConfig;
  academicYear?: string;
  semester?: 'Ganjil' | 'Genap';
  forPrint?: boolean;
}

export const ParticipantListPagesBlock: React.FC<ParticipantListPagesBlockProps> = ({
  pages,
  paperConfig,
  listConfig,
  academicYear = '2026/2027',
  semester = 'Ganjil',
  forPrint = false,
}) => {
  const { paperW, paperH } = getSeatingPaperDimensions(paperConfig, listConfig.paperOrientation);
  const margin = Math.max(6, listConfig.marginMm);
  const semesterUpper = semester.toUpperCase();
  const resolvedTitle =
    listConfig.customTitle.trim() ||
    `DAFTAR NAMA PESERTA PENILAIAN SUMATIF SEMESTER ${semesterUpper}`;
  const normalizedYear = academicYear.replace(/\s*\/\s*/g, '-');
  const resolvedYearLabel =
    listConfig.customYearLabel.trim() || `TAHUN ${normalizedYear}`;

  return (
    <>
      {pages.map((page, pageIdx) => {
        const denseRow = page.rows.length > 26 || listConfig.paperOrientation === 'landscape';
        const bodyFontSize = denseRow ? '10pt' : '11pt';
        const rowPadY = denseRow ? '1.2mm' : '1.7mm';

        return (
          <div
            key={page.key}
            className="print-sheet-page"
            style={{
              position: 'relative',
              width: `${paperW}mm`,
              height: `${paperH}mm`,
              padding: `${margin}mm`,
              boxSizing: 'border-box',
              background: '#FFFFFF',
              color: '#000000',
              fontFamily: "'Times New Roman', Georgia, 'Liberation Serif', serif",
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: forPrint ? 'none' : '0 8px 28px rgba(15,23,42,0.14)',
              marginBottom: forPrint ? 0 : pageIdx < pages.length - 1 ? '16px' : 0,
            }}
          >
            {/* Formal Centered Serif Header Block matching reference document */}
            <div
              style={{
                textAlign: 'center',
                color: '#000000',
                flex: 'none',
                marginBottom: '4.5mm',
              }}
            >
              <div
                style={{
                  fontSize: '12pt',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                {resolvedTitle}
              </div>

              {listConfig.showYearHeader && (
                <div
                  style={{
                    fontSize: '11.5pt',
                    fontWeight: 700,
                    lineHeight: 1.35,
                    marginTop: '2.2mm',
                    textTransform: 'uppercase',
                  }}
                >
                  {resolvedYearLabel}
                </div>
              )}

              {listConfig.showRoomHeader && page.group.primaryHeading && (
                <div
                  style={{
                    fontSize: '13pt',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginTop: '2.2mm',
                    textTransform: 'uppercase',
                  }}
                >
                  {page.group.primaryHeading}
                </div>
              )}

              {listConfig.showTierHeader && page.group.secondaryHeading && (
                <div
                  style={{
                    fontSize: '11.5pt',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    marginTop: '2.2mm',
                    textTransform: 'uppercase',
                  }}
                >
                  {page.group.secondaryHeading}
                </div>
              )}
            </div>

            {/* 4-Column Participant Table (NO, NO PESERTA, NAMA, KELAS) */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                fontFamily: 'Arial, Helvetica, sans-serif',
                color: '#000000',
              }}
            >
              <colgroup>
                <col style={{ width: '13mm' }} />
                <col style={{ width: '56mm' }} />
                <col />
                <col style={{ width: '21mm' }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={{
                      border: '0.32mm solid #000000',
                      padding: '1.8mm 1.5mm',
                      fontSize: '10.5pt',
                      fontWeight: 700,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    NO
                  </th>
                  <th
                    style={{
                      border: '0.32mm solid #000000',
                      padding: '1.8mm 2mm',
                      fontSize: '10.5pt',
                      fontWeight: 700,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    NO PESERTA
                  </th>
                  <th
                    style={{
                      border: '0.32mm solid #000000',
                      padding: '1.8mm 2mm',
                      fontSize: '10.5pt',
                      fontWeight: 700,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    NAMA
                  </th>
                  <th
                    style={{
                      border: '0.32mm solid #000000',
                      padding: '1.8mm 1.5mm',
                      fontSize: '10.5pt',
                      fontWeight: 700,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                    }}
                  >
                    KELAS
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.student.no}>
                    <td
                      style={{
                        border: '0.32mm solid #000000',
                        padding: `${rowPadY} 1.5mm`,
                        fontSize: bodyFontSize,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.rowNumber}
                    </td>
                    <td
                      style={{
                        border: '0.32mm solid #000000',
                        padding: `${rowPadY} 2mm`,
                        fontSize: bodyFontSize,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.participantNo}
                    </td>
                    <td
                      style={{
                        border: '0.32mm solid #000000',
                        padding: `${rowPadY} 2.2mm`,
                        fontSize: bodyFontSize,
                        textAlign: 'left',
                        verticalAlign: 'top',
                        lineHeight: 1.25,
                      }}
                    >
                      {row.student.nama}
                    </td>
                    <td
                      style={{
                        border: '0.32mm solid #000000',
                        padding: `${rowPadY} 1.5mm`,
                        fontSize: bodyFontSize,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.student.kelas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {page.totalPagesInGroup > 1 && (
              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: '3mm',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '8pt',
                  color: '#334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{page.group.badgeLabel}</span>
                <span>
                  Halaman {page.pageInGroup} dari {page.totalPagesInGroup}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
