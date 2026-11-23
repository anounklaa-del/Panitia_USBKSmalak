import { LOGO_LEFT_DATA_URI } from '../data/pasData';
import type { BeritaAcaraConfig, PrepressConfig } from '../types/prepress';
import type { BeritaAcaraPrintPage, BeritaAcaraRecord } from './beritaAcaraStore';
import { getBeritaAcaraPaperDimensions } from '../components/BeritaAcaraDocumentRenderer';

const MM_TO_PT = 72 / 25.4;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawDottedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
  lineW: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([lineW * 1.5, lineW * 2.2]);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = lineW;
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawInlineValue(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  isBlank: boolean,
  dotsPlaceholder: string,
): number {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = '#000000';
  const display = isBlank || !text.trim() ? dotsPlaceholder : text.trim();
  const measured = Math.min(maxWidth, ctx.measureText(display).width);
  ctx.fillText(display, x, y, maxWidth);
  if (!isBlank && text.trim()) {
    drawDottedLine(ctx, x, y + 3, x + measured, 1.2);
  }
  ctx.restore();
  return measured;
}

function renderSingleSlipToCanvas(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  record: BeritaAcaraRecord,
  baConfig: BeritaAcaraConfig,
  academicYear: string,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  pxPerMm: number,
  compact: boolean,
) {
  const px = (mm: number) => mm * pxPerMm;
  const ptToPx = (pt: number) => (pt * 25.4 / 72) * pxPerMm;
  const isBlank = baConfig.fillMode === 'blank';

  const left = px(xMm);
  const top = px(yMm);
  const width = px(wMm);
  const height = px(hMm);

  const fontFamily = '"Times New Roman", Georgia, serif';
  const kopTitleFont = `bold ${ptToPx(compact ? 7.5 : 8.8)}px ${fontFamily}`;
  const kopSchoolFont = `bold ${ptToPx(compact ? 8.5 : 9.8)}px ${fontFamily}`;
  const kopAddrFont = `${ptToPx(compact ? 6.4 : 7.4)}px ${fontFamily}`;
  const headingFont = `bold ${ptToPx(compact ? 9.2 : 10.6)}px ${fontFamily}`;
  const bodyFont = `${ptToPx(compact ? 7.6 : 8.8)}px ${fontFamily}`;
  const bodyBoldFont = `bold ${ptToPx(compact ? 7.6 : 8.8)}px ${fontFamily}`;
  const footFont = `${ptToPx(compact ? 6.6 : 7.5)}px ${fontFamily}`;

  // Kop Surat
  const logoBoxW = px(compact ? 12 : 14.5);
  const logoH = px(compact ? 11.5 : 13.5);
  if (logoImg) {
    const ratio = logoImg.width / Math.max(1, logoImg.height);
    const drawW = Math.min(logoBoxW, logoH * ratio);
    const drawH = drawW / ratio;
    ctx.drawImage(
      logoImg,
      left + (logoBoxW - drawW) / 2,
      top + px(0.5),
      drawW,
      drawH,
    );
  }

  const textCenterX = left + logoBoxW + (width - logoBoxW) / 2;
  let curY = top + ptToPx(compact ? 7.5 : 8.8);
  const yearDash = (academicYear || '2026/2027').replace('/', '-');
  const periodTitle =
    baConfig.examPeriodTitle.trim() ||
    'PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER GANJIL';
  const schoolAddress =
    baConfig.schoolAddress.trim() ||
    'Jalan Brigjen. H. Hasan Basri KM. 11 Handil Bakti Kec. Alalak Kab. Batola ,70582';

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = kopTitleFont;
  ctx.fillText(periodTitle, textCenterX, curY, width - logoBoxW - px(2));
  curY += ptToPx(compact ? 9 : 10.6);
  ctx.fillText(`TAHUN PELAJARAN ${yearDash}`, textCenterX, curY, width - logoBoxW - px(2));
  curY += ptToPx(compact ? 10 : 11.5);
  ctx.font = kopSchoolFont;
  ctx.fillText('SMA NEGERI 1 ALALAK', textCenterX, curY, width - logoBoxW - px(2));
  curY += ptToPx(compact ? 8 : 9.4);
  ctx.font = kopAddrFont;
  ctx.fillText(schoolAddress, textCenterX, curY, width - logoBoxW - px(2));

  const ruleY = Math.max(curY + px(1.5), top + logoH + px(1.8));
  ctx.beginPath();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = px(0.65);
  ctx.moveTo(left, ruleY);
  ctx.lineTo(left + width, ruleY);
  ctx.stroke();

  // BERITA ACARA heading
  curY = ruleY + px(compact ? 5.2 : 6.8);
  ctx.font = headingFont;
  ctx.textAlign = 'center';
  ctx.fillText('BERITA ACARA', left + width / 2, curY);
  const titleW = ctx.measureText('BERITA ACARA').width;
  ctx.beginPath();
  ctx.lineWidth = px(0.28);
  ctx.moveTo(left + width / 2 - titleW / 2, curY + px(0.6));
  ctx.lineTo(left + width / 2 + titleW / 2, curY + px(0.6));
  ctx.stroke();

  // Body lines
  ctx.textAlign = 'left';
  ctx.font = bodyFont;
  const lineH = ptToPx(compact ? 10.6 : 12.6);
  curY += px(compact ? 5.2 : 6.8);

  // Opening sentence
  let cx = left;
  const writeSeg = (txt: string, f: string = bodyFont) => {
    ctx.font = f;
    ctx.fillText(txt, cx, curY);
    cx += ctx.measureText(txt).width;
  };
  writeSeg('Pada hari ini ');
  cx += drawInlineValue(ctx, record.dayName, cx, curY, px(18), bodyBoldFont, isBlank, '…………..') + px(0.8);
  writeSeg('Tanggal ');
  cx += drawInlineValue(ctx, record.dayNum, cx, curY, px(8), bodyBoldFont, isBlank, '……') + px(0.8);
  writeSeg('Bulan ');
  cx += drawInlineValue(ctx, record.monthName, cx, curY, px(20), bodyBoldFont, isBlank, '…………..') + px(0.8);
  writeSeg('Tahun ');
  cx += drawInlineValue(ctx, record.year, cx, curY, px(10), bodyBoldFont, isBlank, '2026') + px(0.8);
  writeSeg('SMA Negeri 1 Alalak');

  // Section a
  curY += lineH * 1.15;
  const numColW = px(4.5);
  const bodyX = left + numColW;
  ctx.font = bodyFont;
  ctx.fillText('a.', left, curY);
  cx = bodyX;
  writeSeg('Telah menyelenggarakan Penilaian Sumatif dari pukul ');
  cx += drawInlineValue(ctx, record.timeStart, cx, curY, px(14), bodyBoldFont, isBlank, '………..') + px(0.8);
  writeSeg('sampai ');
  drawInlineValue(ctx, record.timeEnd, cx, curY, px(14), bodyBoldFont, isBlank, '…………..');

  const labelW = px(compact ? 26 : 31);
  const colonX = bodyX + labelW;
  const valX = colonX + px(2.8);
  const valMaxW = left + width - valX;

  curY += lineH;
  ctx.fillText('Ruang/ kelas', bodyX, curY);
  ctx.fillText(':', colonX, curY);
  const rkStr = `${record.roomLabel} / ${record.kelasLabel}`;
  drawInlineValue(ctx, rkStr, valX, curY, valMaxW, bodyBoldFont, isBlank, '……………….. / …………..');

  curY += lineH;
  ctx.fillText('Jumlah Peserta', bodyX, curY);

  curY += lineH;
  ctx.fillText('Seharusnya', bodyX, curY);
  ctx.fillText(':', colonX, curY);
  drawInlineValue(
    ctx,
    `${record.registeredCount} Orang`,
    valX,
    curY,
    valMaxW,
    bodyBoldFont,
    isBlank,
    '…………………………..',
  );

  curY += lineH;
  ctx.fillText('Yang Hadir', bodyX, curY);
  ctx.fillText(':', colonX, curY);
  const hadirText = `${record.presentCount} Orang, yakni nomor ${record.presentNumbersSummary}`;
  drawInlineValue(
    ctx,
    hadirText,
    valX,
    curY,
    valMaxW,
    bodyFont,
    isBlank,
    '………………. Orang, yakni nomor ……………………………',
  );

  curY += lineH;
  ctx.fillText('Yang tidak hadir', bodyX, curY);
  ctx.fillText(':', colonX, curY);
  const absText = `${record.absentCount} Orang yakni nomor ${record.absentNumbersText}`;
  drawInlineValue(
    ctx,
    absText,
    valX,
    curY,
    valMaxW,
    bodyFont,
    isBlank,
    '……………. Orang yakni nomor ……………………………',
  );

  // Section b
  curY += lineH * 1.25;
  ctx.fillText('b.', left, curY);
  ctx.fillText('Sampul Penilaian Sumatif', bodyX, curY);
  const bColonX = bodyX + px(compact ? 33 : 38);
  ctx.fillText(':', bColonX, curY);
  const subjVal = isBlank ? '……………………………………' : record.subjectLabel;
  const sw = drawInlineValue(
    ctx,
    subjVal,
    bColonX + px(2.5),
    curY,
    left + width - bColonX - px(8),
    bodyBoldFont,
    isBlank,
    '……………………………………',
  );
  ctx.font = bodyFont;
  ctx.fillText('*)', bColonX + px(3.5) + sw, curY);

  curY += lineH;
  ctx.fillText(
    'Telah diterima soal melalui Link Sekolah oleh peserta di ruangan masing-masing',
    bodyX,
    curY,
    width - numColW,
  );

  curY += lineH;
  cx = bodyX;
  writeSeg('Berita acara sebanyak ');
  cx += drawInlineValue(ctx, String(record.baCopies), cx, curY, px(10), bodyBoldFont, isBlank, '……….') + px(0.8);
  writeSeg('eksemplar dan daftar hadir sebanyak ');
  cx += drawInlineValue(ctx, String(record.attendanceCopies), cx, curY, px(10), bodyBoldFont, isBlank, '…….') + px(0.8);
  writeSeg('eksemplar.');

  // Section c
  curY += lineH * 1.25;
  ctx.fillText('c.', left, curY);
  ctx.fillText('Catatan selama pelaksanaan Penilaian Sumatif semester ganjil :', bodyX, curY, width - numColW);

  curY += lineH * 1.1;
  if (!isBlank && record.notes.trim()) {
    ctx.font = bodyBoldFont;
    ctx.fillText(record.notes.trim(), bodyX, curY, width - numColW);
    drawDottedLine(ctx, bodyX, curY + px(0.8), left + width, px(0.22));
    curY += lineH;
    drawDottedLine(ctx, bodyX, curY + px(0.8), left + width, px(0.22));
  } else {
    drawDottedLine(ctx, bodyX, curY + px(0.4), left + width, px(0.22));
    curY += lineH;
    drawDottedLine(ctx, bodyX, curY + px(0.4), left + width, px(0.22));
  }

  curY += lineH * 1.05;
  ctx.font = bodyFont;
  ctx.fillText('Berita acara ini dibuat dengan sesungguhnya,', bodyX, curY);

  // Signature Table
  curY += px(compact ? 3.5 : 5);
  const boxW = width * (compact ? 0.68 : 0.62);
  const boxX = left + (width - boxW) / 2;
  const hdrH = px(compact ? 5.2 : 6.2);
  const sigRowH = px(compact ? 11.5 : 13.5);
  const infoRowH = px(compact ? 5.5 : 6.5);
  const boxH = hdrH + sigRowH + infoRowH * 2;
  const colSplitX = boxX + boxW * 0.34;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = px(0.28);
  ctx.strokeRect(boxX, curY, boxW, boxH);

  // Header line
  ctx.beginPath();
  ctx.moveTo(boxX, curY + hdrH);
  ctx.lineTo(boxX + boxW, curY + hdrH);
  ctx.moveTo(colSplitX, curY + hdrH);
  ctx.lineTo(colSplitX, curY + boxH);
  ctx.stroke();

  ctx.font = bodyBoldFont;
  ctx.textAlign = 'center';
  ctx.fillText('Pengawas', boxX + boxW / 2, curY + hdrH * 0.68);

  ctx.textAlign = 'left';
  ctx.font = bodyFont;
  const padX = px(2.2);
  ctx.fillText('Tanda Tangan', boxX + padX, curY + hdrH + sigRowH - px(2.2));
  ctx.fillText('…………………………', colSplitX + padX, curY + hdrH + sigRowH - px(2.2));

  const namaY = curY + hdrH + sigRowH + infoRowH * 0.68;
  ctx.fillText('Nama', boxX + padX, namaY);
  ctx.font = isBlank ? bodyFont : bodyBoldFont;
  ctx.fillText(
    isBlank ? '…………………………' : record.proctorName,
    colSplitX + padX,
    namaY,
    boxX + boxW - colSplitX - padX * 2,
  );

  const nipY = curY + hdrH + sigRowH + infoRowH * 1.68;
  ctx.font = bodyFont;
  ctx.fillText('NIP', boxX + padX, nipY);
  ctx.fillText(
    isBlank || !record.proctorNip.trim() ? '…………………………' : record.proctorNip,
    colSplitX + padX,
    nipY,
    boxX + boxW - colSplitX - padX * 2,
  );

  // Footnote
  const footY = Math.min(top + height - px(1), curY + boxH + px(compact ? 5.2 : 6.5));
  ctx.font = footFont;
  ctx.fillText(
    '*) Diisi dengan mata pelajaran yang di Penilaian Sumatif (Semester Ganjil)',
    left,
    footY,
    width,
  );
}

function buildMultiPageJpegPdf(
  pages: Array<{ widthPt: number; heightPt: number; widthPx: number; heightPx: number; jpegBytes: Uint8Array }>,
): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let bytePos = 0;

  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    bytePos += b.length;
  };
  const pushStr = (s: string) => pushBytes(enc.encode(s));

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const pageObjIds: number[] = [];
  let nextId = 3;

  const pageEntries: Array<{
    pageId: number;
    contentId: number;
    imgId: number;
    widthPt: number;
    heightPt: number;
    widthPx: number;
    heightPx: number;
    jpegBytes: Uint8Array;
  }> = [];

  for (const p of pages) {
    const imgId = nextId++;
    const contentId = nextId++;
    const pageId = nextId++;
    pageObjIds.push(pageId);
    pageEntries.push({ ...p, imgId, contentId, pageId });
  }

  // Object 1: Catalog
  offsets[1] = bytePos;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets[2] = bytePos;
  pushStr(
    `2 0 obj\n<< /Type /Pages /Count ${pageObjIds.length} /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] >>\nendobj\n`,
  );

  for (const entry of pageEntries) {
    // Image XObject
    offsets[entry.imgId] = bytePos;
    pushStr(
      `${entry.imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${entry.widthPx} /Height ${entry.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${entry.jpegBytes.length} >>\nstream\n`,
    );
    pushBytes(entry.jpegBytes);
    pushStr('\nendstream\nendobj\n');

    // Content Stream
    const streamStr = `q\n${entry.widthPt.toFixed(3)} 0 0 ${entry.heightPt.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`;
    const streamBytes = enc.encode(streamStr);
    offsets[entry.contentId] = bytePos;
    pushStr(
      `${entry.contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`,
    );
    pushBytes(streamBytes);
    pushStr('\nendstream\nendobj\n');

    // Page Object
    offsets[entry.pageId] = bytePos;
    pushStr(
      `${entry.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${entry.widthPt.toFixed(3)} ${entry.heightPt.toFixed(3)}] /Resources << /XObject << /Im0 ${entry.imgId} 0 R >> >> /Contents ${entry.contentId} 0 R >>\nendobj\n`,
    );
  }

  const xrefOffset = bytePos;
  const totalObjs = nextId;
  pushStr(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjs; i++) {
    const off = String(offsets[i] ?? 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );

  const out = new Uint8Array(bytePos);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

export async function exportBeritaAcaraPdfBlob(
  pages: BeritaAcaraPrintPage[],
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  baConfig: BeritaAcaraConfig,
  academicYear: string,
): Promise<Blob> {
  const { paperW, paperH } = getBeritaAcaraPaperDimensions(
    paperConfig,
    baConfig.layoutMode,
  );
  const dpi = 180;
  const pxPerMm = dpi / 25.4;
  const widthPx = Math.round(paperW * pxPerMm);
  const heightPx = Math.round(paperH * pxPerMm);

  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage(LOGO_LEFT_DATA_URI);
  } catch {
    logoImg = null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;

  const pdfPages: Array<{
    widthPt: number;
    heightPt: number;
    widthPx: number;
    heightPx: number;
    jpegBytes: Uint8Array;
  }> = [];

  for (const page of pages) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, widthPx, heightPx);

    if (page.isTwoUp) {
      const marginX = 8;
      const marginY = 8;
      const gap = 10;
      const slipW = (paperW - marginX * 2 - gap) / 2;
      const slipH = paperH - marginY * 2;

      // Dashed center cut guide
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4 * pxPerMm, 3 * pxPerMm]);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 0.25 * pxPerMm;
      ctx.moveTo((paperW / 2) * pxPerMm, 4 * pxPerMm);
      ctx.lineTo((paperW / 2) * pxPerMm, (paperH - 4) * pxPerMm);
      ctx.stroke();
      ctx.restore();

      renderSingleSlipToCanvas(
        ctx,
        logoImg,
        page.items[0],
        baConfig,
        academicYear,
        marginX,
        marginY,
        slipW,
        slipH,
        pxPerMm,
        true,
      );
      if (page.items[1]) {
        renderSingleSlipToCanvas(
          ctx,
          logoImg,
          page.items[1],
          baConfig,
          academicYear,
          marginX + slipW + gap,
          marginY,
          slipW,
          slipH,
          pxPerMm,
          true,
        );
      }
    } else {
      const marginX = Math.max(14, (paperW - 175) / 2);
      const marginY = 14;
      renderSingleSlipToCanvas(
        ctx,
        logoImg,
        page.items[0],
        baConfig,
        academicYear,
        marginX,
        marginY,
        paperW - marginX * 2,
        paperH - marginY * 2,
        pxPerMm,
        false,
      );
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const jpegBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      jpegBytes[i] = binaryStr.charCodeAt(i);
    }

    pdfPages.push({
      widthPt: paperW * MM_TO_PT,
      heightPt: paperH * MM_TO_PT,
      widthPx,
      heightPx,
      jpegBytes,
    });
  }

  const pdfBytes = buildMultiPageJpegPdf(pdfPages);
  return new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
}
