import React from 'react';
import {
  LOGO_LEFT_DATA_URI,
  LOGO_RIGHT_DATA_URI,
  type ScheduleRow,
  type StudentRecord,
} from '../data/pasData';
import type {
  PrepressConfig,
  QrCornerPosition,
  QrPayloadFormat,
  SheetGeometry,
} from '../types/prepress';
import { computeFrontCardLayout, formatStudentQrPayload } from '../utils/qrGenerator';
import { getLiveSchedulesMap } from '../utils/scheduleStore';
import { QrCodeSvg } from './QrCodeSvg';

export function FrontCardMarkup({
  student,
  x,
  y,
  w,
  h,
  bleed,
  showQrCode = true,
  qrCorner = 'bottom_right',
  qrFormat = 'full_no',
  qrSizeMm = 13.5,
  showDeskOnCard = true,
  deskLabel,
  academicYear = '2026/2027',
  onClick,
  isSelected,
}: {
  student: StudentRecord;
  x: number;
  y: number;
  w: number;
  h: number;
  bleed: number;
  showQrCode?: boolean;
  qrCorner?: QrCornerPosition;
  qrFormat?: QrPayloadFormat;
  qrSizeMm?: number;
  showDeskOnCard?: boolean;
  deskLabel?: string;
  academicYear?: string;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const layout = computeFrontCardLayout(w, h, {
    showQrCode,
    qrCorner,
    qrSizeMm,
  });
  const activeDeskLabel = showDeskOnCard ? deskLabel : undefined;
  const qrPayload = formatStudentQrPayload(student, qrFormat, activeDeskLabel);
  const qrInHeader = Boolean(layout.qr && (qrCorner === 'top_left' || qrCorner === 'top_right'));
  const qrInBody = Boolean(layout.qr && (qrCorner === 'bottom_left' || qrCorner === 'bottom_right'));

  const qrBoxNode = layout.qr ? (
    <div
      style={{
        position: 'absolute',
        left: `${layout.qr.x - layout.ix}mm`,
        top: `${layout.qr.y - (qrInHeader ? layout.iy : layout.bodyY)}mm`,
        width: `${layout.qr.w}mm`,
        height: `${layout.qr.h}mm`,
        border: '0.24mm solid #1F3864',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 3,
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QrCodeSvg
          payloadOverride={qrPayload}
          style={{
            width: `${Math.min(layout.qr.w, layout.qr.h - layout.qr.labelH) - 0.3}mm`,
            height: `${Math.min(layout.qr.w, layout.qr.h - layout.qr.labelH) - 0.3}mm`,
          }}
        />
      </div>
      <div
        style={{
          height: `${layout.qr.labelH}mm`,
          flex: 'none',
          background: '#1F3864',
          color: '#FFFFFF',
          fontSize: qrInHeader ? '3.5pt' : '4pt',
          fontWeight: 700,
          letterSpacing: '0.15mm',
          lineHeight: `${layout.qr.labelH}mm`,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        ABSENSI QR
      </div>
    </div>
  ) : null;

  return (
    <div
      onClick={onClick}
      title={onClick ? `Klik untuk pratinjau 3D / inspeksi: ${student.nama} (${student.kelas})` : undefined}
      style={{
        position: 'absolute',
        left: `${x}mm`,
        top: `${y}mm`,
        width: `${w}mm`,
        height: `${h}mm`,
        padding: '1.25mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: isSelected ? 'inset 0 0 0 0.6mm #C9A227' : undefined,
      }}
    >
      {bleed > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${-bleed}mm`,
            top: '16.25mm',
            width: `${w + bleed * 2}mm`,
            height: '6mm',
            background: '#1F3864',
            opacity: 0.14,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          height: '100%',
          border: '0.5mm solid #1F3864',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#fff',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            position: 'relative',
            height: `${layout.hdH}mm`,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '1.2mm',
            paddingLeft:
              qrInHeader && qrCorner === 'top_left' && layout.qr
                ? `${layout.qr.w + 2.8}mm`
                : '2mm',
            paddingRight:
              qrInHeader && qrCorner === 'top_right' && layout.qr
                ? `${layout.qr.w + 2.8}mm`
                : '2mm',
            borderBottom: '0.8mm solid #C9A227',
          }}
        >
          {qrInHeader && qrBoxNode}
          <img
            src={LOGO_LEFT_DATA_URI}
            alt=""
            style={{ height: `${layout.logoLeft.h}mm`, width: 'auto', flexShrink: 0 }}
          />
          <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: qrInHeader ? '6.6pt' : '7.5pt', fontWeight: 700, color: '#1F3864', whiteSpace: 'nowrap' }}>
              PAS (PENILAIAN AKHIR SEMESTER)
            </div>
            <div style={{ fontSize: qrInHeader ? '12.2pt' : '14pt', fontWeight: 700, color: '#24407F', whiteSpace: 'nowrap' }}>
              SMAN 1 ALALAK
            </div>
            <div style={{ fontSize: qrInHeader ? '6.4pt' : '7pt', color: '#44546A', whiteSpace: 'nowrap' }}>
              TAHUN AJARAN {academicYear.replace(/\s*\/\s*/g, '-')}
            </div>
          </div>
          <img
            src={LOGO_RIGHT_DATA_URI}
            alt=""
            style={{ height: `${layout.logoRight.h}mm`, width: 'auto', flexShrink: 0 }}
          />
        </div>

        {/* Navy Band */}
        <div
          style={{
            height: `${layout.bandH}mm`,
            flex: 'none',
            background: '#1F3864',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '10.5pt',
            letterSpacing: '0.9mm',
            lineHeight: `${layout.bandH}mm`,
            whiteSpace: 'nowrap',
          }}
        >
          KARTU UJIAN PAS
        </div>

        {/* Body */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
          }}
        >
          {(
            [
              ['NO. PESERTA', `2026/SMAN 1 ALALAK/${student.no}`, false],
              ['NAMA', student.nama, student.nama.length > 24],
              ['KELAS', student.kelas, false],
              ['RUANG', activeDeskLabel ? `${student.ruang} (${activeDeskLabel})` : student.ruang, false],
              ['USER NAME', student.user, false],
            ] as Array<[string, string, boolean]>
          ).map(([label, val, sm], idx) => {
            const topMm = layout.rows.startCenterY - layout.bodyY - layout.rows.pitch / 2 + idx * layout.rows.pitch;
            const maxW = layout.rows.maxValueEndX - layout.rows.valueX;
            return (
              <div
                key={label}
                style={{
                  position: 'absolute',
                  left: `${layout.rows.labelX - layout.ix}mm`,
                  top: `${topMm}mm`,
                  height: `${layout.rows.pitch}mm`,
                  width: `${layout.rows.maxValueEndX - layout.rows.labelX}mm`,
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '21mm',
                    flex: 'none',
                    fontSize: layout.rows.pitch < 4.7 ? '6.6pt' : '7pt',
                    fontWeight: 700,
                    color: '#44546A',
                  }}
                >
                  {label}
                </span>
                <span style={{ width: '2.3mm', flex: 'none', color: '#44546A' }}>:</span>
                <strong
                  style={{
                    fontSize: sm ? '7.8pt' : layout.rows.pitch < 4.7 ? '8.8pt' : '9.5pt',
                    maxWidth: `${maxW}mm`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {val}
                </strong>
              </div>
            );
          })}

          {/* Photo Slot */}
          <div
            style={{
              position: 'absolute',
              left: `${layout.photo.x - layout.ix}mm`,
              top: `${layout.photo.y - layout.bodyY}mm`,
              width: `${layout.photo.w}mm`,
              height: `${layout.photo.h}mm`,
              border: '0.25mm dashed #9aa5bd',
              background: '#f5f7fb',
            }}
          >
            <svg
              viewBox="0 0 40 46"
              style={{
                position: 'absolute',
                left: `${layout.photo.w * 0.16}mm`,
                top: `${layout.photo.h * 0.16}mm`,
                width: `${layout.photo.w * 0.68}mm`,
                height: `${layout.photo.h * 0.54}mm`,
              }}
            >
              <circle cx="20" cy="14" r="9" fill="none" stroke="#c3cadb" strokeWidth="2.4" />
              <path
                d="M3 46C3 31 11 27 20 27S37 31 37 46"
                fill="none"
                stroke="#c3cadb"
                strokeWidth="2.4"
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                right: '0.9mm',
                bottom: '0.7mm',
                fontSize: layout.photo.w < 16 ? '4.6pt' : '5.5pt',
                fontWeight: 700,
                color: '#7a869f',
              }}
            >
              FOTO 2x3
            </span>
          </div>

          {qrInBody && qrBoxNode}

          {qrInBody && qrCorner === 'bottom_left' && layout.qr && (
            <div
              style={{
                position: 'absolute',
                left: `${layout.qr.x - layout.ix + layout.qr.w + 2.2}mm`,
                top: `${layout.qr.y - layout.bodyY + 1.2}mm`,
                width: `${layout.photo.x - (layout.qr.x + layout.qr.w + 3.5)}mm`,
                lineHeight: 1.25,
              }}
            >
              <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#1F3864' }}>
                SCAN QR ABSENSI RUANG
              </div>
              <div
                style={{
                  fontSize: '5pt',
                  fontFamily: 'monospace',
                  color: '#44546A',
                  marginTop: '0.5mm',
                  wordBreak: 'break-all',
                }}
              >
                2026/SMAN 1 ALALAK/{student.no}
              </div>
              <div style={{ fontSize: '4.8pt', color: '#64748B', marginTop: '0.4mm' }}>
                Ruang {student.ruang}
                {activeDeskLabel ? ` · ${activeDeskLabel}` : ''} · {student.kelas}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            height: `${layout.ftH}mm`,
            flex: 'none',
            background: '#E9EEF7',
            color: '#44546A',
            fontStyle: 'italic',
            fontSize: '7pt',
            textAlign: 'center',
            lineHeight: `${layout.ftH}mm`,
          }}
        >
          Kartu ini wajib dibawa selama ujian berlangsung
        </div>
      </div>
    </div>
  );
}

export function BackCardMarkup({
  kelas,
  x,
  y,
  w,
  h,
  rotate180,
  ghostOverlay,
  schedulesMap,
}: {
  kelas: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate180?: boolean;
  ghostOverlay?: boolean;
  schedulesMap?: Record<string, ScheduleRow[]>;
}) {
  const rows = (schedulesMap ?? getLiveSchedulesMap())[kelas] ?? [];
  const isDense = rows.length >= 16;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}mm`,
        top: `${y}mm`,
        width: `${w}mm`,
        height: `${h}mm`,
        padding: '1.25mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        transform: rotate180 ? 'rotate(180deg)' : undefined,
        opacity: ghostOverlay ? 0.34 : 1,
        pointerEvents: ghostOverlay ? 'none' : 'auto',
        zIndex: ghostOverlay ? 4 : 1,
      }}
    >
      <div
        style={{
          height: '100%',
          border: `0.5mm solid ${ghostOverlay ? '#EC008C' : '#1F3864'}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: ghostOverlay ? 'rgba(236, 0, 140, 0.04)' : '#fff',
        }}
      >
        <div
          style={{
            height: '5.6mm',
            flex: 'none',
            background: '#1F3864',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '9.5pt',
            letterSpacing: '0.6mm',
            lineHeight: '5.6mm',
            whiteSpace: 'nowrap',
          }}
        >
          JADWAL PAS &nbsp;•&nbsp; KELAS {kelas}
        </div>
        <div
          style={{
            flex: 'none',
            fontSize: '6.6pt',
            fontWeight: 700,
            color: '#1F3864',
            textAlign: 'center',
            lineHeight: '3.8mm',
          }}
        >
          SMAN 1 ALALAK &nbsp;•&nbsp; TAHUN AJARAN 2026-2027
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '0 1.4mm',
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 'none',
              display: 'grid',
              gridTemplateColumns: '52mm 1fr',
              alignItems: 'center',
              background: '#E9EEF7',
              borderBottom: '0.45mm solid #C9A227',
              fontWeight: 700,
              color: '#1F3864',
              height: '3.8mm',
              fontSize: '6.6pt',
              padding: '0 0.8mm',
            }}
          >
            <span style={{ textAlign: 'center' }}>Hari / Waktu</span>
            <span style={{ textAlign: 'center' }}>Mata Pelajaran</span>
          </div>
          {rows.map(([day, time, subj], i) => (
            <div
              key={`${day}-${time}-${i}`}
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                lineHeight: 1,
                display: 'grid',
                gridTemplateColumns: '28mm 24mm 1fr',
                alignItems: 'center',
                fontSize: isDense ? '5.65pt' : '6.35pt',
                borderBottom: '0.1mm solid #c5cee0',
                background: i % 2 === 1 ? '#f8fafd' : 'transparent',
                padding: '0 0.8mm',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{day}</span>
              <span style={{ color: '#44546A', whiteSpace: 'nowrap' }}>{time}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: '#1F3864',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  fontSize: subj.length > 26 ? '4.95pt' : undefined,
                }}
              >
                {subj}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            height: '4.5mm',
            flex: 'none',
            background: '#E9EEF7',
            color: '#44546A',
            fontStyle: 'italic',
            fontSize: '6.5pt',
            textAlign: 'center',
            lineHeight: '4.5mm',
          }}
        >
          Waktu dalam WITA &nbsp;•&nbsp; Panitia PAS Semester 1 TP 2026/2027
        </div>
      </div>
    </div>
  );
}

export function PrepressMarksLayer({
  geo,
  cfg,
  offsetX,
  offsetY,
  calibMode,
}: {
  geo: SheetGeometry;
  cfg: PrepressConfig;
  offsetX: number;
  offsetY: number;
  calibMode?: 1 | 2;
}) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 0; c < geo.cols; c++) {
    const x = offsetX + c * (geo.slotW + geo.gapXmm);
    xs.push(+x.toFixed(3), +(x + geo.slotW).toFixed(3));
  }
  for (let r = 0; r < geo.rows; r++) {
    const y = offsetY + r * (geo.slotH + geo.gapYmm);
    ys.push(+y.toFixed(3), +(y + geo.slotH).toFixed(3));
  }
  const ux = [...new Set(xs)];
  const uy = [...new Set(ys)];
  const tickX = Math.max(0.8, Math.min(3.8, offsetX - 0.5));
  const tickY = Math.max(0.8, Math.min(3.8, offsetY - 0.5));

  if (calibMode) {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        {ux.map((x) =>
          uy.map((y) =>
            calibMode === 1 ? (
              <React.Fragment key={`cal-${x}-${y}`}>
                <i
                  style={{
                    position: 'absolute',
                    left: `${x - 2}mm`,
                    top: `${y - 0.12}mm`,
                    width: '4mm',
                    height: '0.24mm',
                    background: '#000',
                  }}
                />
                <i
                  style={{
                    position: 'absolute',
                    left: `${x - 0.12}mm`,
                    top: `${y - 2}mm`,
                    width: '0.24mm',
                    height: '4mm',
                    background: '#000',
                  }}
                />
              </React.Fragment>
            ) : (
              <i
                key={`cal2-${x}-${y}`}
                style={{
                  position: 'absolute',
                  left: `${x - 1.5}mm`,
                  top: `${y - 1.5}mm`,
                  width: '3mm',
                  height: '3mm',
                  border: '0.25mm solid #000',
                  borderRadius: '50%',
                }}
              />
            ),
          ),
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {cfg.bleedMm > 0 && cfg.showBleedGuide && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.max(0.3, offsetX - cfg.bleedMm)}mm`,
            top: `${Math.max(0.3, offsetY - cfg.bleedMm)}mm`,
            width: `${Math.min(geo.paperW - 0.6, geo.gridW + cfg.bleedMm * 2)}mm`,
            height: `${Math.min(geo.paperH - 0.6, geo.gridH + cfg.bleedMm * 2)}mm`,
            border: '0.22mm dashed #00AEEF',
            boxSizing: 'border-box',
          }}
        />
      )}

      {cfg.showFoldMarks &&
        Array.from({ length: geo.rows }).map((_, r) => {
          const slotTop = offsetY + r * (geo.slotH + geo.gapYmm);
          const foldY = geo.isFoldable ? slotTop + geo.cardH : slotTop + geo.cardH / 2;
          return (
            <React.Fragment key={`fold-${r}`}>
              <i
                style={{
                  position: 'absolute',
                  left: `${Math.max(0.2, offsetX - 3.6)}mm`,
                  top: `${foldY}mm`,
                  width: `${Math.min(3.2, Math.max(1, offsetX - 0.5))}mm`,
                  borderTop: '0.28mm dashed #EC008C',
                }}
              />
              <i
                style={{
                  position: 'absolute',
                  left: `${offsetX + geo.gridW + 0.4}mm`,
                  top: `${foldY}mm`,
                  width: `${Math.min(3.2, Math.max(1, geo.paperW - (offsetX + geo.gridW) - 0.5))}mm`,
                  borderTop: '0.28mm dashed #EC008C',
                }}
              />
              {geo.isFoldable && (
                <i
                  style={{
                    position: 'absolute',
                    left: `${offsetX}mm`,
                    top: `${foldY}mm`,
                    width: `${geo.gridW}mm`,
                    borderTop: '0.25mm dashed #EC008C',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

      {cfg.cropStyle !== 'none' && (
        <>
          {ux.map((x) => (
            <React.Fragment key={`cx-${x}`}>
              <i
                style={{
                  position: 'absolute',
                  left: `${x - 0.12}mm`,
                  top: `${Math.max(0, offsetY - tickY)}mm`,
                  width: '0.24mm',
                  height: `${tickY}mm`,
                  background: '#000',
                }}
              />
              <i
                style={{
                  position: 'absolute',
                  left: `${x - 0.12}mm`,
                  top: `${offsetY + geo.gridH}mm`,
                  width: '0.24mm',
                  height: `${tickY}mm`,
                  background: '#000',
                }}
              />
              {cfg.cropStyle === 'full' && (
                <i
                  style={{
                    position: 'absolute',
                    left: `${x - 0.06}mm`,
                    top: `${offsetY}mm`,
                    width: '0.12mm',
                    height: `${geo.gridH}mm`,
                    background: '#7b879e',
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {uy.map((y) => (
            <React.Fragment key={`cy-${y}`}>
              <i
                style={{
                  position: 'absolute',
                  left: `${Math.max(0, offsetX - tickX)}mm`,
                  top: `${y - 0.12}mm`,
                  width: `${tickX}mm`,
                  height: '0.24mm',
                  background: '#000',
                }}
              />
              <i
                style={{
                  position: 'absolute',
                  left: `${offsetX + geo.gridW}mm`,
                  top: `${y - 0.12}mm`,
                  width: `${tickX}mm`,
                  height: '0.24mm',
                  background: '#000',
                }}
              />
              {cfg.cropStyle === 'full' && (
                <i
                  style={{
                    position: 'absolute',
                    left: `${offsetX}mm`,
                    top: `${y - 0.06}mm`,
                    width: `${geo.gridW}mm`,
                    height: '0.12mm',
                    background: '#7b879e',
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {cfg.cropStyle === 'crop' &&
            ux.map((x) =>
              uy.map((y) => (
                <React.Fragment key={`cr-${x}-${y}`}>
                  <i
                    style={{
                      position: 'absolute',
                      left: `${x - 1}mm`,
                      top: `${y - 0.1}mm`,
                      width: '2mm',
                      height: '0.2mm',
                      background: '#000',
                    }}
                  />
                  <i
                    style={{
                      position: 'absolute',
                      left: `${x - 0.1}mm`,
                      top: `${y - 1}mm`,
                      width: '0.2mm',
                      height: '2mm',
                      background: '#000',
                    }}
                  />
                </React.Fragment>
              )),
            )}
        </>
      )}
    </div>
  );
}

/**
 * Renders one or more imposed physical sheets (used by both screen preview and @media print full-batch engine).
 */
export const SheetPagesBlock: React.FC<{
  students: StudentRecord[];
  config: PrepressConfig;
  geo: SheetGeometry;
  sheetIndices: number[];
  deskLookup?: Record<string, string>;
  schedulesMap?: Record<string, ScheduleRow[]>;
  selectedStudentNo?: string;
  academicYear?: string;
  onSelectStudent?: (s: StudentRecord) => void;
  isPrintDom?: boolean;
}> = ({
  students,
  config,
  geo,
  sheetIndices,
  deskLookup,
  schedulesMap,
  selectedStudentNo,
  academicYear = '2026/2027',
  onSelectStudent,
  isPrintDom = false,
}) => {
  if (config.imposition === 'calibration') {
    return (
      <>
        <section
          className="print-sheet-page relative bg-white mx-auto mb-8 shadow-md overflow-hidden"
          style={{ width: `${geo.paperW}mm`, height: `${geo.paperH}mm` }}
        >
          <span className="no-print absolute left-1.5 top-1 font-mono text-[8pt] text-slate-500">
            TES KALIBRASI PRESISI · DEPAN (Tanda +)
          </span>
          <PrepressMarksLayer
            geo={geo}
            cfg={config}
            offsetX={geo.originX}
            offsetY={geo.originY}
            calibMode={1}
          />
        </section>
        <section
          className="print-sheet-page relative bg-white mx-auto mb-8 shadow-md overflow-hidden"
          style={{ width: `${geo.paperW}mm`, height: `${geo.paperH}mm` }}
        >
          <span className="no-print absolute left-1.5 top-1 font-mono text-[8pt] text-slate-500">
            TES KALIBRASI PRESISI · BELAKANG (Lingkaran ○ harus tepat di tengah + | dx:{config.dx} dy:{config.dy})
          </span>
          <PrepressMarksLayer
            geo={geo}
            cfg={config}
            offsetX={geo.backOriginX + config.dx}
            offsetY={geo.backOriginY + config.dy}
            calibMode={2}
          />
        </section>
      </>
    );
  }

  // Respect reverse back-only ordering if requested
  const orderedIndices =
    config.imposition === 'back' && config.reverseBackOrder
      ? [...sheetIndices].reverse()
      : sheetIndices;

  return (
    <>
      {orderedIndices.map((sIdx) => {
        const sheetChunk = students.slice(
          sIdx * geo.cardsPerSheet,
          (sIdx + 1) * geo.cardsPerSheet,
        );

        if (config.imposition === 'foldable') {
          return (
            <section
              key={`fold-sheet-${sIdx}`}
              className="print-sheet-page relative bg-white mx-auto mb-8 shadow-md overflow-hidden"
              style={{ width: `${geo.paperW}mm`, height: `${geo.paperH}mm` }}
            >
              <span className="no-print absolute left-1.5 top-1 font-mono text-[8pt] text-slate-500">
                Lembar {sIdx + 1} · LIPAT &amp; TEMPEL PRESISI (Paste November Terbalik di Atas + Garis Lipat + Depan di Bawah)
              </span>
              <PrepressMarksLayer
                geo={geo}
                cfg={config}
                offsetX={geo.originX}
                offsetY={geo.originY}
              />
              {sheetChunk.map((st, idx) => {
                const col = idx % geo.cols;
                const row = Math.floor(idx / geo.cols);
                const x = geo.originX + col * (geo.slotW + geo.gapXmm);
                const y = geo.originY + row * (geo.slotH + geo.gapYmm);
                return (
                  <React.Fragment key={st.no}>
                    <BackCardMarkup
                      kelas={st.kelas}
                      x={x}
                      y={y}
                      w={geo.cardW}
                      h={geo.cardH}
                      rotate180
                      schedulesMap={schedulesMap}
                    />
                    <FrontCardMarkup
                      student={st}
                      x={x}
                      y={y + geo.cardH}
                      w={geo.cardW}
                      h={geo.cardH}
                      bleed={config.bleedMm}
                      showQrCode={config.showQrCode}
                      qrCorner={config.qrCorner}
                      qrFormat={config.qrFormat}
                      qrSizeMm={config.qrSizeMm}
                      showDeskOnCard={config.showDeskOnCard}
                      deskLabel={deskLookup?.[st.no]}
                      academicYear={academicYear}
                      isSelected={!isPrintDom && st.no === selectedStudentNo}
                      onClick={onSelectStudent ? () => onSelectStudent(st) : undefined}
                    />
                  </React.Fragment>
                );
              })}
            </section>
          );
        }

        return (
          <React.Fragment key={`duplex-sheet-${sIdx}`}>
            {config.imposition !== 'back' && (
              <section
                className="print-sheet-page relative bg-white mx-auto mb-8 shadow-md overflow-hidden"
                style={{ width: `${geo.paperW}mm`, height: `${geo.paperH}mm` }}
              >
                <span className="no-print absolute left-1.5 top-1 font-mono text-[8pt] text-slate-500">
                  Lembar {sIdx + 1} · DEPAN ({geo.paperW}×{geo.paperH} mm)
                </span>
                <PrepressMarksLayer
                  geo={geo}
                  cfg={config}
                  offsetX={geo.originX}
                  offsetY={geo.originY}
                />
                {sheetChunk.map((st, idx) => {
                  const col = idx % geo.cols;
                  const row = Math.floor(idx / geo.cols);
                  const x = geo.originX + col * (geo.slotW + geo.gapXmm);
                  const y = geo.originY + row * (geo.slotH + geo.gapYmm);
                  return (
                    <React.Fragment key={`f-${st.no}`}>
                      <FrontCardMarkup
                        student={st}
                        x={x}
                        y={y}
                        w={geo.cardW}
                        h={geo.cardH}
                        bleed={config.bleedMm}
                        showQrCode={config.showQrCode}
                        qrCorner={config.qrCorner}
                        qrFormat={config.qrFormat}
                        qrSizeMm={config.qrSizeMm}
                        showDeskOnCard={config.showDeskOnCard}
                        deskLabel={deskLookup?.[st.no]}
                        academicYear={academicYear}
                        isSelected={!isPrintDom && st.no === selectedStudentNo}
                        onClick={onSelectStudent ? () => onSelectStudent(st) : undefined}
                      />
                      {!isPrintDom && config.xrayAlignmentOverlay && (
                        <BackCardMarkup
                          kelas={st.kelas}
                          x={x + config.dx}
                          y={y + config.dy}
                          w={geo.cardW}
                          h={geo.cardH}
                          ghostOverlay
                          schedulesMap={schedulesMap}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </section>
            )}

            {config.imposition !== 'front' && (
              <section
                className="print-sheet-page relative bg-white mx-auto mb-8 shadow-md overflow-hidden"
                style={{ width: `${geo.paperW}mm`, height: `${geo.paperH}mm` }}
              >
                <span className="no-print absolute left-1.5 top-1 font-mono text-[8pt] text-slate-500">
                  Lembar {sIdx + 1} · BELAKANG PASTE NOVEMBER (Simetris {config.flipMode === 'long' ? 'Long-Edge' : 'Short-Edge'} · dx:{config.dx} dy:{config.dy})
                </span>
                {config.cutOnBack && (
                  <PrepressMarksLayer
                    geo={geo}
                    cfg={config}
                    offsetX={geo.backOriginX + config.dx}
                    offsetY={geo.backOriginY + config.dy}
                  />
                )}
                {sheetChunk.map((st, idx) => {
                  let col = idx % geo.cols;
                  let row = Math.floor(idx / geo.cols);
                  if (config.flipMode === 'long') col = geo.cols - 1 - col;
                  else row = geo.rows - 1 - row;
                  const x = geo.backOriginX + col * (geo.slotW + geo.gapXmm) + config.dx;
                  const y = geo.backOriginY + row * (geo.slotH + geo.gapYmm) + config.dy;
                  return (
                    <BackCardMarkup
                      key={`b-${st.no}`}
                      kelas={st.kelas}
                      x={x}
                      y={y}
                      w={geo.cardW}
                      h={geo.cardH}
                      schedulesMap={schedulesMap}
                    />
                  );
                })}
              </section>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
