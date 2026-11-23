import React from 'react';
import type { StickerConfig, StickerGeometry } from '../types/prepress';
import { formatParticipantNo, type DeskStickerRecord } from '../utils/deskStickerBuilder';

export function DeskStickerMarkup({
  sticker,
  x,
  y,
  w,
  h,
  showEmptyTiers,
}: {
  sticker: DeskStickerRecord;
  x: number;
  y: number;
  w: number;
  h: number;
  showEmptyTiers: boolean;
}) {
  const visibleSlots = showEmptyTiers
    ? sticker.slots
    : sticker.slots.filter((slot) => slot.student !== null);
  const compactMode = visibleSlots.length > 3 || h < 54;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}mm`,
        top: `${y}mm`,
        width: `${w}mm`,
        height: `${h}mm`,
        border: '0.45mm solid #1F3864',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0F172A',
      }}
    >
      {/* Top School & Room/Desk Header */}
      <div
        style={{
          backgroundColor: '#1F3864',
          color: '#FFFFFF',
          padding: compactMode ? '1.2mm 2.2mm' : '1.6mm 2.5mm',
          borderBottom: '0.7mm solid #C9A227',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2mm',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, lineHeight: 1.15 }}>
          <div
            style={{
              fontSize: compactMode ? '5.8pt' : '6.5pt',
              fontWeight: 700,
              color: '#F3D06B',
              letterSpacing: '0.35mm',
              whiteSpace: 'nowrap',
            }}
          >
            NOMOR PESERTA
          </div>
          <div
            style={{
              fontSize: compactMode ? '7.8pt' : '8.8pt',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '0.15mm',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            SMA NEGERI 1 ALALAK
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            backgroundColor: '#FFFFFF',
            color: '#1F3864',
            border: '0.3mm solid #C9A227',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div
            style={{
              padding: compactMode ? '0.6mm 1.6mm' : '0.8mm 1.8mm',
              textAlign: 'center',
              borderRight: '0.3mm solid #CBD5E1',
            }}
          >
            <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#44546A', lineHeight: 1 }}>
              RUANG
            </div>
            <div
              style={{
                fontSize: compactMode ? '8pt' : '9pt',
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              {sticker.ruang}
            </div>
          </div>
          <div
            style={{
              padding: compactMode ? '0.6mm 1.8mm' : '0.8mm 2mm',
              textAlign: 'center',
              backgroundColor: '#FEF9E7',
            }}
          >
            <div style={{ fontSize: '5.5pt', fontWeight: 700, color: '#7C5808', lineHeight: 1 }}>
              MEJA
            </div>
            <div
              style={{
                fontSize: compactMode ? '8pt' : '9pt',
                fontWeight: 800,
                color: '#1F3864',
                lineHeight: 1.15,
              }}
            >
              {String(sticker.mejaNo).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      {/* Stacked Class Slots (X / XI / XII combined per desk) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {visibleSlots.map((slot, idx) => {
          const st = slot.student;
          const isLast = idx === visibleSlots.length - 1;
          const longName = (st?.nama.length ?? 0) > 25;
          return (
            <div
              key={`${sticker.id}-${slot.groupLabel}-${idx}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: compactMode ? '0.7mm 2.4mm' : '1mm 2.5mm',
                borderBottom: isLast ? 'none' : '0.25mm solid #CBD5E1',
                backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2mm',
                  lineHeight: 1.15,
                }}
              >
                <span
                  style={{
                    fontSize: compactMode ? '7.2pt' : '8pt',
                    fontWeight: 800,
                    color: st ? '#1F3864' : '#94A3B8',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {st ? st.kelas : slot.groupLabel}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: compactMode ? '6.8pt' : '7.5pt',
                    fontWeight: 700,
                    color: st ? '#334155' : '#94A3B8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st ? formatParticipantNo(st.no) : '—'}
                </span>
              </div>

              <div
                style={{
                  fontSize: longName
                    ? compactMode
                      ? '6.8pt'
                      : '7.4pt'
                    : compactMode
                      ? '7.8pt'
                      : '8.7pt',
                  fontWeight: 700,
                  color: st ? '#000000' : '#94A3B8',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '0.35mm',
                }}
              >
                {st ? st.nama : 'Kursi Kosong'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StickerCropMarksLayer({
  geo,
  showCropMarks,
}: {
  geo: StickerGeometry;
  showCropMarks: boolean;
}) {
  if (!showCropMarks) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 0; c < geo.cols; c++) {
    const x0 = geo.originX + c * (geo.stickerW + geo.gapXmm);
    xs.push(x0, x0 + geo.stickerW);
  }
  for (let r = 0; r < geo.rows; r++) {
    const y0 = geo.originY + r * (geo.stickerH + geo.gapYmm);
    ys.push(y0, y0 + geo.stickerH);
  }

  const ux = [...new Set(xs.map((v) => +v.toFixed(3)))];
  const uy = [...new Set(ys.map((v) => +v.toFixed(3)))];

  return (
    <svg
      width={`${geo.paperW}mm`}
      height={`${geo.paperH}mm`}
      viewBox={`0 0 ${geo.paperW} ${geo.paperH}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
    >
      {ux.map((x) => (
        <React.Fragment key={`sx-${x}`}>
          <line
            x1={x}
            y1={Math.max(1, geo.originY - 5)}
            x2={x}
            y2={Math.max(1.5, geo.originY - 1.2)}
            stroke="#111827"
            strokeWidth="0.2"
          />
          <line
            x1={x}
            y1={Math.min(geo.paperH - 1.5, geo.originY + geo.gridH + 1.2)}
            x2={x}
            y2={Math.min(geo.paperH - 1, geo.originY + geo.gridH + 5)}
            stroke="#111827"
            strokeWidth="0.2"
          />
        </React.Fragment>
      ))}
      {uy.map((y) => (
        <React.Fragment key={`sy-${y}`}>
          <line
            x1={Math.max(1, geo.originX - 5)}
            y1={y}
            x2={Math.max(1.5, geo.originX - 1.2)}
            y2={y}
            stroke="#111827"
            strokeWidth="0.2"
          />
          <line
            x1={Math.min(geo.paperW - 1.5, geo.originX + geo.gridW + 1.2)}
            y1={y}
            x2={Math.min(geo.paperW - 1, geo.originX + geo.gridW + 5)}
            y2={y}
            stroke="#111827"
            strokeWidth="0.2"
          />
        </React.Fragment>
      ))}
    </svg>
  );
}

export function StickerSheetPagesBlock({
  stickers,
  stickerConfig,
  geo,
  sheetIndices,
  forPrint,
}: {
  stickers: DeskStickerRecord[];
  stickerConfig: StickerConfig;
  geo: StickerGeometry;
  sheetIndices: number[];
  forPrint?: boolean;
}) {
  return (
    <div className={forPrint ? '' : 'space-y-8 flex flex-col items-center'}>
      {sheetIndices.map((sIdx) => {
        const slice = stickers.slice(
          sIdx * geo.stickersPerSheet,
          (sIdx + 1) * geo.stickersPerSheet,
        );
        const roomsInSheet = [...new Set(slice.map((s) => `R.${s.ruang}`))].join(', ');
        return (
          <div key={`sticker-sheet-${sIdx}`} className={forPrint ? '' : 'flex flex-col items-center'}>
            {!forPrint && (
              <div className="mb-2 flex items-center gap-3 text-xs font-mono text-[#44546A]">
                <span className="font-semibold text-[#1F3864]">
                  LEMBAR STIKER {sIdx + 1} · {roomsInSheet}
                </span>
                <span>·</span>
                <span>
                  {slice.length} stiker meja ({geo.stickerW}×{geo.stickerH} mm)
                </span>
              </div>
            )}
            <div
              className={`relative bg-white overflow-hidden ${
                forPrint ? 'print-sheet-page' : 'shadow-lg border border-[#CBD5E1]'
              }`}
              style={{
                width: `${geo.paperW}mm`,
                height: `${geo.paperH}mm`,
              }}
            >
              {slice.map((sticker, idx) => {
                const col = idx % geo.cols;
                const row = Math.floor(idx / geo.cols);
                const x = geo.originX + col * (geo.stickerW + geo.gapXmm);
                const y = geo.originY + row * (geo.stickerH + geo.gapYmm);
                return (
                  <DeskStickerMarkup
                    key={sticker.id}
                    sticker={sticker}
                    x={x}
                    y={y}
                    w={geo.stickerW}
                    h={geo.stickerH}
                    showEmptyTiers={stickerConfig.showEmptyTiers}
                  />
                );
              })}

              <StickerCropMarksLayer geo={geo} showCropMarks={stickerConfig.showCropMarks} />

              <div
                style={{
                  position: 'absolute',
                  left: `${geo.originX}mm`,
                  bottom: '3mm',
                  fontSize: '5.5pt',
                  fontFamily: 'monospace',
                  color: '#64748B',
                  pointerEvents: 'none',
                }}
              >
                STIKER MEJA PAS SMAN 1 ALALAK | {roomsInSheet} | LEMBAR {sIdx + 1} |{' '}
                {geo.stickerW}x{geo.stickerH}mm
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
