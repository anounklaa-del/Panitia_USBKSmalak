import QRCode from 'qrcode';
import type { StudentRecord } from '../data/pasData';
import type { QrCornerPosition, QrPayloadFormat } from '../types/prepress';
import { formatParticipantNo } from './deskStickerBuilder';

export interface QrSymbolData {
  size: number;
  quiet: number;
  viewBoxSize: number;
  pathData: string;
  modules: Uint8Array;
}

const qrCache = new Map<string, QrSymbolData>();

export function formatStudentQrPayload(
  student: StudentRecord,
  format: QrPayloadFormat = 'full_no',
  mejaLabel?: string,
): string {
  if (format === 'short_no') {
    return String(student.no || '').trim();
  }
  if (format === 'json') {
    return JSON.stringify({
      no: formatParticipantNo(student.no),
      nama: student.nama,
      kelas: student.kelas,
      ruang: student.ruang,
      ...(mejaLabel ? { meja: mejaLabel } : {}),
    });
  }
  return formatParticipantNo(student.no);
}

/**
 * Generates deterministic, cached QR symbol data + single merged SVG path for fast rendering across 619+ cards.
 */
export function getQrSymbolData(payload: string): QrSymbolData {
  const key = payload || 'EMPTY';
  const cached = qrCache.get(key);
  if (cached) return cached;

  const qr = QRCode.create(key, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const quiet = 2;
  const segments: string[] = [];

  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (qr.modules.get(r, c)) {
        const start = c;
        while (c < size && qr.modules.get(r, c)) {
          c++;
        }
        const len = c - start;
        segments.push(`M${start + quiet} ${r + quiet}h${len}v1h-${len}z`);
      } else {
        c++;
      }
    }
  }

  const symbol: QrSymbolData = {
    size,
    quiet,
    viewBoxSize: size + quiet * 2,
    pathData: segments.join(''),
    modules: qr.modules.data,
  };
  qrCache.set(key, symbol);
  return symbol;
}

/**
 * Draws a crisp, scanner-ready QR code + micro caption bar directly on a Canvas at target pixel coordinates.
 */
export function drawQrCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  payload: string,
  xPx: number,
  yPx: number,
  widthPx: number,
  heightPx: number,
  labelText = 'ABSENSI QR',
): void {
  const sym = getQrSymbolData(payload);
  const labelH = Math.max(8, Math.round(widthPx * 0.14));
  const qrSquarePx = Math.min(widthPx, heightPx - labelH);

  // Outer pure white background + hairline border
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(xPx, yPx, widthPx, heightPx);

  // Crisp QR modules (100% K / #000000 on pure #FFFFFF)
  const cell = qrSquarePx / sym.viewBoxSize;
  const qrOffsetX = xPx + (widthPx - qrSquarePx) / 2;
  const qrOffsetY = yPx;

  ctx.fillStyle = '#000000';
  for (let r = 0; r < sym.size; r++) {
    let c = 0;
    while (c < sym.size) {
      if (sym.modules[r * sym.size + c]) {
        const start = c;
        while (c < sym.size && sym.modules[r * sym.size + c]) {
          c++;
        }
        const rx = Math.floor(qrOffsetX + (start + sym.quiet) * cell);
        const ry = Math.floor(qrOffsetY + (r + sym.quiet) * cell);
        const rw = Math.ceil(qrOffsetX + (c + sym.quiet) * cell) - rx;
        const rh = Math.ceil(qrOffsetY + (r + 1 + sym.quiet) * cell) - ry;
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        c++;
      }
    }
  }

  // Micro label bar at bottom
  const barY = yPx + heightPx - labelH;
  ctx.fillStyle = '#1F3864';
  ctx.fillRect(xPx, barY, widthPx, labelH);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(6, Math.round(labelH * 0.62))}px Arial, Helvetica, sans-serif`;
  ctx.fillText(labelText, xPx + widthPx / 2, barY + labelH / 2 + 0.3);

  // Hairline frame
  ctx.strokeStyle = '#1F3864';
  ctx.lineWidth = Math.max(1, widthPx * 0.015);
  ctx.strokeRect(xPx, yPx, widthPx, heightPx);
  ctx.restore();
}

export interface FrontCardQrOpts {
  showQrCode?: boolean;
  qrCorner?: QrCornerPosition;
  qrSizeMm?: number;
}

export interface FrontCardLayout {
  pad: number;
  ix: number;
  iy: number;
  iw: number;
  ih: number;
  hdH: number;
  bandH: number;
  ftH: number;
  bodyY: number;
  bodyH: number;
  logoLeft: { x: number; y: number; h: number };
  logoRight: { x: number; y: number; h: number };
  headerTextCenterX: number;
  photo: { x: number; y: number; w: number; h: number };
  rows: {
    startCenterY: number;
    pitch: number;
    labelX: number;
    colonX: number;
    valueX: number;
    maxValueEndX: number;
  };
  qr: {
    enabled: boolean;
    corner: QrCornerPosition;
    x: number;
    y: number;
    w: number;
    h: number;
    labelH: number;
  } | null;
}

/**
 * Single source of truth for millimeter coordinates inside the Front Card (101.6 × 68.4 mm default),
 * shared across DOM/Print, 300+ DPI CMYK Canvas (PDF/X-1a & 3D Mockup), and Layered SVG export.
 */
export function computeFrontCardLayout(
  cardW: number,
  cardH: number,
  opts: FrontCardQrOpts = {},
): FrontCardLayout {
  const pad = 1.25;
  const ix = pad;
  const iy = pad;
  const iw = cardW - pad * 2;
  const ih = cardH - pad * 2;
  const hdH = 15;
  const bandH = 6;
  const ftH = 5;
  const bodyY = iy + hdH + bandH;
  const bodyH = ih - hdH - bandH - ftH;

  const showQr = opts.showQrCode ?? true;
  const corner: QrCornerPosition = opts.qrCorner ?? 'bottom_right';
  const rawQrSize = Math.max(10.5, Math.min(17.5, opts.qrSizeMm ?? 13.5));

  // Default classic geometry (no QR or header-agnostic parts)
  let logoLeft = { x: ix + 2.0, y: iy + (hdH - 11.5) / 2, h: 11.5 };
  let logoRight = { x: ix + iw - 2.0 - 10.0, y: iy + (hdH - 10.0) / 2, h: 10.0 };
  let headerTextCenterX = ix + iw / 2;

  let photo = {
    x: ix + iw - 2.5 - 20,
    y: bodyY + (bodyH - 30) / 2,
    w: 20,
    h: 30,
  };

  let rowPitch = 5.2;
  let startCenterY = bodyY + (bodyH - 5 * rowPitch) / 2 + rowPitch / 2;
  let maxValueEndX = photo.x - 1.5;

  let qr: FrontCardLayout['qr'] = null;

  if (showQr) {
    if (corner === 'bottom_right') {
      const labelH = 1.9;
      const qrSize = Math.min(rawQrSize, 17.0);
      const qrTotalH = qrSize + labelH;
      const rightEdge = ix + iw - 2.0;

      if (qrSize <= 14.5) {
        // Stack FOTO 2x3 neatly above the QR code in the right column
        const availPhotoH = Math.max(14, bodyH - qrTotalH - 3.4);
        const photoH = +Math.min(22.5, availPhotoH).toFixed(2);
        const photoW = +(photoH * (2 / 3)).toFixed(2);
        const colW = Math.max(qrSize, photoW);
        const colX = rightEdge - colW;
        photo = {
          x: +(colX + (colW - photoW) / 2).toFixed(2),
          y: +(bodyY + 1.0).toFixed(2),
          w: photoW,
          h: photoH,
        };
        qr = {
          enabled: true,
          corner,
          x: +(colX + (colW - qrSize) / 2).toFixed(2),
          y: +(bodyY + bodyH - 1.1 - qrTotalH).toFixed(2),
          w: qrSize,
          h: qrTotalH,
          labelH,
        };
        maxValueEndX = +(colX - 1.8).toFixed(2);
      } else {
        // Larger QR sits at bottom-right; FOTO 2x3 shifts immediately to its left
        const photoW = 16;
        const photoH = 24;
        const qrX = +(rightEdge - qrSize).toFixed(2);
        qr = {
          enabled: true,
          corner,
          x: qrX,
          y: +(bodyY + bodyH - 1.1 - qrTotalH).toFixed(2),
          w: qrSize,
          h: qrTotalH,
          labelH,
        };
        photo = {
          x: +(qrX - 1.8 - photoW).toFixed(2),
          y: +(bodyY + (bodyH - photoH) / 2).toFixed(2),
          w: photoW,
          h: photoH,
        };
        maxValueEndX = +(photo.x - 1.6).toFixed(2);
      }
    } else if (corner === 'bottom_left') {
      const labelH = 1.9;
      const qrSize = Math.min(rawQrSize, 15.5);
      const qrTotalH = qrSize + labelH;
      const qrX = +(ix + 2.2).toFixed(2);
      const qrY = +(bodyY + bodyH - 1.0 - qrTotalH).toFixed(2);
      qr = {
        enabled: true,
        corner,
        x: qrX,
        y: qrY,
        w: qrSize,
        h: qrTotalH,
        labelH,
      };
      const availRowsH = Math.max(18, qrY - bodyY - 1.2);
      rowPitch = +Math.min(5.0, availRowsH / 5).toFixed(2);
      startCenterY = +(bodyY + 0.8 + rowPitch / 2).toFixed(2);
    } else if (corner === 'top_right') {
      const labelH = 1.6;
      const qrSize = +Math.min(11.6, rawQrSize).toFixed(2);
      const qrTotalH = qrSize + labelH;
      const qrX = +(ix + iw - 1.4 - qrSize).toFixed(2);
      const qrY = +(iy + (hdH - 0.8 - qrTotalH) / 2).toFixed(2);
      qr = {
        enabled: true,
        corner,
        x: qrX,
        y: qrY,
        w: qrSize,
        h: qrTotalH,
        labelH,
      };
      logoLeft = { x: ix + 1.8, y: iy + (hdH - 0.8 - 10.5) / 2, h: 10.5 };
      logoRight = { x: +(qrX - 1.4 - 8.5).toFixed(2), y: iy + (hdH - 0.8 - 8.5) / 2, h: 8.5 };
      headerTextCenterX = +((logoLeft.x + 10.5 + logoRight.x) / 2).toFixed(2);
    } else if (corner === 'top_left') {
      const labelH = 1.6;
      const qrSize = +Math.min(11.6, rawQrSize).toFixed(2);
      const qrTotalH = qrSize + labelH;
      const qrX = +(ix + 1.4).toFixed(2);
      const qrY = +(iy + (hdH - 0.8 - qrTotalH) / 2).toFixed(2);
      qr = {
        enabled: true,
        corner,
        x: qrX,
        y: qrY,
        w: qrSize,
        h: qrTotalH,
        labelH,
      };
      logoLeft = { x: +(qrX + qrSize + 1.4).toFixed(2), y: iy + (hdH - 0.8 - 8.5) / 2, h: 8.5 };
      logoRight = { x: ix + iw - 1.8 - 9.5, y: iy + (hdH - 0.8 - 9.5) / 2, h: 9.5 };
      headerTextCenterX = +((logoLeft.x + 9.0 + logoRight.x) / 2).toFixed(2);
    }
  }

  return {
    pad,
    ix,
    iy,
    iw,
    ih,
    hdH,
    bandH,
    ftH,
    bodyY,
    bodyH,
    logoLeft,
    logoRight,
    headerTextCenterX,
    photo,
    rows: {
      startCenterY,
      pitch: rowPitch,
      labelX: ix + 2.5,
      colonX: ix + 23.5,
      valueX: ix + 25.8,
      maxValueEndX,
    },
    qr,
  };
}
