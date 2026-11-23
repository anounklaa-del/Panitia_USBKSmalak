import {
  LOGO_LEFT_DATA_URI,
  LOGO_RIGHT_DATA_URI,
  type ScheduleRow,
  type StudentRecord,
} from '../data/pasData';
import type { IccProfileId, QrCornerPosition, QrPayloadFormat } from '../types/prepress';
import { applySoftProofToCanvas } from './cmykEngine';
import {
  computeFrontCardLayout,
  drawQrCodeOnCanvas,
  formatStudentQrPayload,
} from './qrGenerator';
import { getLiveSchedulesMap } from './scheduleStore';

const MM_TO_INCH = 1 / 25.4;

export interface CardRenderOptions {
  cardW: number;
  cardH: number;
  bleedMm: number;
  dpi: number;
  softProof?: boolean;
  iccProfile?: IccProfileId;
  foldEdge?: 'none' | 'top' | 'bottom';
  showQrCode?: boolean;
  qrCorner?: QrCornerPosition;
  qrFormat?: QrPayloadFormat;
  qrSizeMm?: number;
  showDeskOnCard?: boolean;
  deskLabel?: string;
}

let cachedLogos: Promise<[HTMLImageElement, HTMLImageElement]> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function getLoadedLogos(): Promise<[HTMLImageElement, HTMLImageElement]> {
  if (!cachedLogos) {
    cachedLogos = Promise.all([
      loadImage(LOGO_LEFT_DATA_URI),
      loadImage(LOGO_RIGHT_DATA_URI),
    ]);
  }
  return cachedLogos;
}

/**
 * Renders the Front Card (Kartu Ujian PAS) onto a Canvas at true >=300 DPI with optional 3mm outer bleed extension
 * and corner QR Code for digital exam room attendance.
 */
export async function renderFrontCardCanvas(
  student: StudentRecord,
  opts: CardRenderOptions,
): Promise<HTMLCanvasElement> {
  const [logoL, logoR] = await getLoadedLogos();
  const pxPerMm = opts.dpi * MM_TO_INCH;
  const totalWmm = opts.cardW + opts.bleedMm * 2;
  const totalHmm = opts.cardH + opts.bleedMm * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(totalWmm * pxPerMm));
  canvas.height = Math.max(16, Math.round(totalHmm * pxPerMm));

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const mm = (v: number) => v * pxPerMm;
  const bx = opts.bleedMm;
  const by = opts.bleedMm;

  const layout = computeFrontCardLayout(opts.cardW, opts.cardH, {
    showQrCode: opts.showQrCode ?? true,
    qrCorner: opts.qrCorner ?? 'bottom_right',
    qrSizeMm: opts.qrSizeMm ?? 13.5,
  });

  // Full bleed background white paper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const ix = bx + layout.ix;
  const iy = by + layout.iy;
  const iw = layout.iw;
  const ih = layout.ih;
  const hdH = layout.hdH;
  const bandH = layout.bandH;
  const ftH = layout.ftH;
  const bodyY = by + layout.bodyY;

  // Bleed extension strips for full-bleed band & footer edges
  if (opts.bleedMm > 0) {
    ctx.fillStyle = '#1F3864';
    ctx.fillRect(0, mm(iy + hdH), mm(ix + 0.5), mm(bandH));
    ctx.fillRect(mm(ix + iw - 0.5), mm(iy + hdH), mm(opts.bleedMm + layout.pad + 1), mm(bandH));
    ctx.fillStyle = '#E9EEF7';
    ctx.fillRect(0, mm(iy + ih - ftH), mm(ix + 0.5), mm(ftH + layout.pad + opts.bleedMm));
    ctx.fillRect(mm(ix + iw - 0.5), mm(iy + ih - ftH), mm(opts.bleedMm + layout.pad + 1), mm(ftH + layout.pad + opts.bleedMm));
  }

  // Inner card white surface
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(mm(ix), mm(iy), mm(iw), mm(ih));

  // Header Logos
  const lg1H = layout.logoLeft.h;
  const lg1W = (logoL.width / Math.max(1, logoL.height)) * lg1H;
  ctx.drawImage(logoL, mm(bx + layout.logoLeft.x), mm(by + layout.logoLeft.y), mm(lg1W), mm(lg1H));

  const lg2H = layout.logoRight.h;
  const lg2W = (logoR.width / Math.max(1, logoR.height)) * lg2H;
  const lg2X =
    layout.qr && layout.qr.corner === 'top_right'
      ? bx + layout.qr.x - 1.4 - lg2W
      : bx + layout.ix + layout.iw - 2.0 - lg2W;
  ctx.drawImage(logoR, mm(lg2X), mm(by + layout.logoRight.y), mm(lg2W), mm(lg2H));

  // Header Title
  const qrInHeader = Boolean(
    layout.qr && (layout.qr.corner === 'top_left' || layout.qr.corner === 'top_right'),
  );
  const textCenterX = mm(bx + layout.headerTextCenterX);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#1F3864';
  ctx.font = `700 ${mm(qrInHeader ? 2.33 : 2.65)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('PAS (PENILAIAN AKHIR SEMESTER)', textCenterX, mm(iy + 3.4));

  ctx.fillStyle = '#24407F';
  ctx.font = `700 ${mm(qrInHeader ? 4.3 : 4.94)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('SMAN 1 ALALAK', textCenterX, mm(iy + 7.9));

  ctx.fillStyle = '#44546A';
  ctx.font = `400 ${mm(qrInHeader ? 2.25 : 2.47)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('TAHUN AJARAN 2026-2027', textCenterX, mm(iy + 12.1));

  // Gold Divider Line below Header
  ctx.fillStyle = '#C9A227';
  ctx.fillRect(mm(ix), mm(iy + hdH - 0.8), mm(iw), mm(0.8));

  // Navy Band: KARTU UJIAN PAS
  ctx.fillStyle = '#1F3864';
  ctx.fillRect(mm(ix), mm(iy + hdH), mm(iw), mm(bandH));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${mm(3.65)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('KARTU UJIAN PAS', mm(ix + iw / 2), mm(iy + hdH + bandH / 2 + 0.1));

  // Student info rows
  const activeDeskLabel = (opts.showDeskOnCard ?? true) ? opts.deskLabel : undefined;
  const fields: Array<[string, string, boolean?]> = [
    ['NO. PESERTA', `2026/SMAN 1 ALALAK/${student.no}`, false],
    ['NAMA', student.nama, student.nama.length > 24],
    ['KELAS', student.kelas, false],
    ['RUANG', activeDeskLabel ? `${student.ruang} (${activeDeskLabel})` : student.ruang, false],
    ['USER NAME', student.user, false],
  ];

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fields.forEach(([label, value, compact], idx) => {
    const ry = by + layout.rows.startCenterY + idx * layout.rows.pitch;
    ctx.fillStyle = '#44546A';
    ctx.font = `700 ${mm(layout.rows.pitch < 4.7 ? 2.3 : 2.47)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(label, mm(bx + layout.rows.labelX), mm(ry));
    ctx.fillText(':', mm(bx + layout.rows.colonX), mm(ry));

    ctx.fillStyle = '#000000';
    const valFontMm = compact ? 2.75 : layout.rows.pitch < 4.7 ? 3.05 : 3.35;
    ctx.font = `700 ${mm(valFontMm)}px Arial, Helvetica, sans-serif`;
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      mm(bx + layout.rows.valueX),
      mm(ry - layout.rows.pitch / 2),
      mm(layout.rows.maxValueEndX - layout.rows.valueX),
      mm(layout.rows.pitch),
    );
    ctx.clip();
    ctx.fillText(value, mm(bx + layout.rows.valueX), mm(ry));
    ctx.restore();
  });

  // Photo box (2x3)
  const phX = bx + layout.photo.x;
  const phY = by + layout.photo.y;
  const phW = layout.photo.w;
  const phH = layout.photo.h;

  ctx.fillStyle = '#F5F7FB';
  ctx.fillRect(mm(phX), mm(phY), mm(phW), mm(phH));
  ctx.save();
  ctx.strokeStyle = '#9AA5BD';
  ctx.lineWidth = mm(0.25);
  ctx.setLineDash([mm(1.0), mm(0.8)]);
  ctx.strokeRect(mm(phX), mm(phY), mm(phW), mm(phH));
  ctx.restore();

  // Photo silhouette icon proportional to photo box
  const scaleIcon = phW / 20;
  ctx.strokeStyle = '#C3CADB';
  ctx.lineWidth = mm(0.75 * scaleIcon);
  ctx.beginPath();
  ctx.arc(mm(phX + phW / 2), mm(phY + 10.8 * scaleIcon), mm(3.2 * scaleIcon), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mm(phX + 4.1 * scaleIcon), mm(phY + 21.8 * scaleIcon));
  ctx.bezierCurveTo(
    mm(phX + 4.1 * scaleIcon),
    mm(phY + 16.7 * scaleIcon),
    mm(phX + 7.2 * scaleIcon),
    mm(phY + 15.2 * scaleIcon),
    mm(phX + phW / 2),
    mm(phY + 15.2 * scaleIcon),
  );
  ctx.bezierCurveTo(
    mm(phX + phW - 7.2 * scaleIcon),
    mm(phY + 15.2 * scaleIcon),
    mm(phX + phW - 4.1 * scaleIcon),
    mm(phY + 16.7 * scaleIcon),
    mm(phX + phW - 4.1 * scaleIcon),
    mm(phY + 21.8 * scaleIcon),
  );
  ctx.stroke();

  ctx.fillStyle = '#7A869F';
  ctx.textAlign = 'right';
  ctx.font = `700 ${mm(phW < 16 ? 1.62 : 1.94)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('FOTO 2x3', mm(phX + phW - 0.9), mm(phY + phH - 1.3));

  // QR Code Corner Placement (Digital Exam Room Attendance)
  if (layout.qr) {
    const qrPayload = formatStudentQrPayload(student, opts.qrFormat ?? 'full_no', activeDeskLabel);
    drawQrCodeOnCanvas(
      ctx,
      qrPayload,
      mm(bx + layout.qr.x),
      mm(by + layout.qr.y),
      mm(layout.qr.w),
      mm(layout.qr.h),
      'ABSENSI QR',
    );

    if (layout.qr.corner === 'bottom_left') {
      const noteX = bx + layout.qr.x + layout.qr.w + 2.2;
      const noteTop = by + layout.qr.y + 1.8;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1F3864';
      ctx.font = `700 ${mm(1.94)}px Arial, Helvetica, sans-serif`;
      ctx.fillText('SCAN QR ABSENSI RUANG', mm(noteX), mm(noteTop));
      ctx.fillStyle = '#44546A';
      ctx.font = `400 ${mm(1.76)}px "Courier New", monospace`;
      ctx.fillText(`2026/SMAN 1 ALALAK/${student.no}`, mm(noteX), mm(noteTop + 2.7));
      ctx.fillStyle = '#64748B';
      ctx.font = `400 ${mm(1.7)}px Arial, Helvetica, sans-serif`;
      ctx.fillText(
        `Ruang ${student.ruang}${activeDeskLabel ? ` · ${activeDeskLabel}` : ''} · ${student.kelas}`,
        mm(noteX),
        mm(noteTop + 5.1),
      );
      ctx.restore();
    }
  }

  // Footer
  ctx.fillStyle = '#E9EEF7';
  ctx.fillRect(mm(ix), mm(iy + ih - ftH), mm(iw), mm(ftH));
  ctx.fillStyle = '#44546A';
  ctx.textAlign = 'center';
  ctx.font = `italic ${mm(2.47)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('Kartu ini wajib dibawa selama ujian berlangsung', mm(ix + iw / 2), mm(iy + ih - ftH / 2));

  // Outer frame border
  ctx.strokeStyle = '#1F3864';
  ctx.lineWidth = mm(0.5);
  ctx.strokeRect(mm(ix), mm(iy), mm(iw), mm(ih));

  if (opts.softProof) {
    applySoftProofToCanvas(ctx, canvas.width, canvas.height, opts.iccProfile ?? 'FOGRA39');
  }

  return canvas;
}

/**
 * Renders the Back Card (Jadwal Paste November 2026) at >=300 DPI with dynamic fit for 14 or 17 rows
 * and full 3mm outer bleed extension.
 */
export function renderBackCardCanvas(
  kelas: string,
  opts: CardRenderOptions,
  schedulesMap?: Record<string, ScheduleRow[]>,
): HTMLCanvasElement {
  const pxPerMm = opts.dpi * MM_TO_INCH;
  const totalWmm = opts.cardW + opts.bleedMm * 2;
  const totalHmm = opts.cardH + opts.bleedMm * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(16, Math.round(totalWmm * pxPerMm));
  canvas.height = Math.max(16, Math.round(totalHmm * pxPerMm));

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const mm = (v: number) => v * pxPerMm;
  const bx = opts.bleedMm;
  const by = opts.bleedMm;
  const w = opts.cardW;
  const h = opts.cardH;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 1.25;
  const ix = bx + pad;
  const iy = by + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;

  const bandH = 5.6;
  const subH = 3.8;
  const ftH = 4.5;

  // Bleed color continuation
  if (opts.bleedMm > 0) {
    ctx.fillStyle = '#1F3864';
    ctx.fillRect(0, 0, mm(bx + pad), mm(iy + bandH));
    ctx.fillRect(mm(ix + iw), 0, mm(opts.bleedMm + pad), mm(iy + bandH));
    ctx.fillRect(0, 0, canvas.width, mm(iy));

    ctx.fillStyle = '#E9EEF7';
    ctx.fillRect(0, mm(iy + ih - ftH), canvas.width, mm(ftH + pad + opts.bleedMm));
  }

  // Card interior white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(mm(ix), mm(iy), mm(iw), mm(ih));

  // Header Band: JADWAL PAS • KELAS X1
  ctx.fillStyle = '#1F3864';
  ctx.fillRect(mm(ix), mm(iy), mm(iw), mm(bandH));
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${mm(3.35)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(`JADWAL PAS  \u2022  KELAS ${kelas}`, mm(ix + iw / 2), mm(iy + bandH / 2 + 0.1));

  // Subtitle: SMAN 1 ALALAK • TAHUN AJARAN 2026-2027
  ctx.fillStyle = '#1F3864';
  ctx.font = `700 ${mm(2.25)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('SMAN 1 ALALAK  \u2022  TAHUN AJARAN 2026-2027', mm(ix + iw / 2), mm(iy + bandH + subH / 2));

  // Schedule Table
  const liveMap = schedulesMap ?? getLiveSchedulesMap();
  const rows = liveMap[kelas] ?? [];
  const tblX = ix + 1.4;
  const tblW = iw - 2.8;
  const tblY = iy + bandH + subH;
  const tblAvailH = ih - bandH - subH - ftH - 0.6;

  const colDayW = tblW * 0.305;
  const colTimeW = tblW * 0.245;
  const hdrH = Math.min(3.8, tblAvailH * 0.082);
  const rowCount = Math.max(1, rows.length);
  const rowH = (tblAvailH - hdrH) / rowCount;

  // Table Header row
  ctx.fillStyle = '#E9EEF7';
  ctx.fillRect(mm(tblX), mm(tblY), mm(tblW), mm(hdrH));
  ctx.fillStyle = '#C9A227';
  ctx.fillRect(mm(tblX), mm(tblY + hdrH - 0.42), mm(tblW), mm(0.42));

  ctx.fillStyle = '#1F3864';
  ctx.font = `700 ${mm(2.2)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Hari / Waktu', mm(tblX + (colDayW + colTimeW) / 2), mm(tblY + hdrH / 2));
  ctx.fillText('Mata Pelajaran', mm(tblX + colDayW + colTimeW + (tblW - colDayW - colTimeW) / 2), mm(tblY + hdrH / 2));

  // Scale font smoothly for 17 rows (Class X) vs 14 rows (XI/XII)
  const fontSizeMm = rowCount >= 16 ? Math.min(2.02, rowH * 0.72) : Math.min(2.25, rowH * 0.72);

  rows.forEach(([day, time, subject], idx) => {
    const ry = tblY + hdrH + idx * rowH;
    if (idx % 2 === 1) {
      ctx.fillStyle = '#F8FAFD';
      ctx.fillRect(mm(tblX), mm(ry), mm(tblW), mm(rowH));
    }

    // Bottom divider
    ctx.fillStyle = '#C5CEE0';
    ctx.fillRect(mm(tblX), mm(ry + rowH - 0.1), mm(tblW), mm(0.1));

    const cy = ry + rowH / 2;

    // Day column
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.font = `400 ${mm(fontSizeMm)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(day, mm(tblX + 0.9), mm(cy));

    // Time column
    ctx.fillStyle = '#44546A';
    ctx.fillText(time, mm(tblX + colDayW + 0.6), mm(cy));

    // Subject column (auto-fit long subject like "Koding dan Kecerdasan Artifisial")
    ctx.fillStyle = '#1F3864';
    ctx.textAlign = 'center';
    const subjCenterX = tblX + colDayW + colTimeW + (tblW - colDayW - colTimeW) / 2;
    const maxSubjW = mm(tblW - colDayW - colTimeW - 1.4);
    let subjFontMm = fontSizeMm;
    ctx.font = `700 ${mm(subjFontMm)}px Arial, Helvetica, sans-serif`;
    while (ctx.measureText(subject).width > maxSubjW && subjFontMm > 1.35) {
      subjFontMm -= 0.08;
      ctx.font = `700 ${mm(subjFontMm)}px Arial, Helvetica, sans-serif`;
    }
    ctx.fillText(subject, mm(subjCenterX), mm(cy));
  });

  // Footer
  ctx.fillStyle = '#E9EEF7';
  ctx.fillRect(mm(ix), mm(iy + ih - ftH), mm(iw), mm(ftH));
  ctx.fillStyle = '#44546A';
  ctx.textAlign = 'center';
  ctx.font = `italic ${mm(2.22)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('Waktu dalam WITA  \u2022  Panitia PAS Semester 1 TP 2026/2027', mm(ix + iw / 2), mm(iy + ih - ftH / 2));

  // Card Inner Border
  ctx.strokeStyle = '#1F3864';
  ctx.lineWidth = mm(0.5);
  ctx.strokeRect(mm(ix), mm(iy), mm(iw), mm(ih));

  if (opts.softProof) {
    applySoftProofToCanvas(ctx, canvas.width, canvas.height, opts.iccProfile ?? 'FOGRA39');
  }

  return canvas;
}
