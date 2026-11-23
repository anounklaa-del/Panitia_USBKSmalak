import { type StudentRecord } from '../data/pasData';
import {
  computeSheetGeometry,
  type PrepressConfig,
  type SheetGeometry,
  type StickerGroupingMode,
} from '../types/prepress';
import { renderBackCardCanvas, renderFrontCardCanvas } from './cardRenderer';
import {
  buildCmykIccProfile,
  convertRgbaToCmykBytes,
  ICC_PROFILES,
} from './cmykEngine';
import { buildDeskAssignmentLookup } from './deskStickerBuilder';

const MM_TO_PT = 72 / 25.4;
const pt = (mm: number) => +(mm * MM_TO_PT).toFixed(3);

/**
 * Compresses raw Uint8Array with RFC 1950 zlib/deflate format required by PDF /FlateDecode.
 */
async function deflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    writer.write(copy).catch(() => {});
    writer.close().catch(() => {});
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
  // Minimal valid uncompressed zlib (BTYPE=00) fallback if CompressionStream is unavailable
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < data.length) {
    const chunkLen = Math.min(65535, data.length - offset);
    const isFinal = offset + chunkLen >= data.length ? 1 : 0;
    const hdr = new Uint8Array(5);
    hdr[0] = isFinal;
    hdr[1] = chunkLen & 0xff;
    hdr[2] = (chunkLen >> 8) & 0xff;
    const nlen = ~chunkLen & 0xffff;
    hdr[3] = nlen & 0xff;
    hdr[4] = (nlen >> 8) & 0xff;
    blocks.push(hdr);
    blocks.push(data.subarray(offset, offset + chunkLen));
    offset += chunkLen;
  }
  // Adler-32 checksum
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = new Uint8Array(4);
  const dv = new DataView(adler.buffer);
  dv.setUint32(0, ((s2 << 16) | s1) >>> 0, false);
  blocks.push(adler);

  const total = blocks.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const b of blocks) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}

interface CmykXObject {
  id: number;
  name: string;
  widthPx: number;
  heightPx: number;
  compressedCmyk: Uint8Array;
}

interface PdfObjectEntry {
  id: number;
  bytes: Uint8Array;
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const c of chunks) len += c.length;
  const res = new Uint8Array(len);
  let pos = 0;
  for (const c of chunks) {
    res.set(c, pos);
    pos += c.length;
  }
  return res;
}

const enc = new TextEncoder();

function buildMarksAndBleedContentStream(
  geo: SheetGeometry,
  cfg: PrepressConfig,
  offsetX: number,
  offsetY: number,
  pageTitle: string,
  pageSide: 'front' | 'back' | 'foldable' | 'calib-front' | 'calib-back',
): string {
  const cmds: string[] = [];
  const ph = geo.paperH;
  const pw = geo.paperW;
  // Convert top-down mm (y=0 at top) to PDF bottom-up pt
  const py = (yTopMm: number) => pt(ph - yTopMm);
  const px = (xMm: number) => pt(xMm);

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

  // Calibration test mode (+ front, O back)
  if (pageSide === 'calib-front' || pageSide === 'calib-back') {
    cmds.push('0.45 w');
    cmds.push('0 0 0 1 K');
    for (const x of ux) {
      for (const y of uy) {
        if (pageSide === 'calib-front') {
          cmds.push(`${px(x - 2.2)} ${py(y)} m ${px(x + 2.2)} ${py(y)} l S`);
          cmds.push(`${px(x)} ${py(y - 2.2)} m ${px(x)} ${py(y + 2.2)} l S`);
        } else {
          // 1.5mm radius circle approximated with 4 Bezier curves
          const r = 1.5;
          const k = 0.5522847498 * r;
          const cx = x;
          const cy = y;
          cmds.push(`${px(cx + r)} ${py(cy)} m`);
          cmds.push(`${px(cx + r)} ${py(cy - k)} ${px(cx + k)} ${py(cy - r)} ${px(cx)} ${py(cy - r)} c`);
          cmds.push(`${px(cx - k)} ${py(cy - r)} ${px(cx - r)} ${py(cy - k)} ${px(cx - r)} ${py(cy)} c`);
          cmds.push(`${px(cx - r)} ${py(cy + k)} ${px(cx - k)} ${py(cy + r)} ${px(cx)} ${py(cy + r)} c`);
          cmds.push(`${px(cx + k)} ${py(cy + r)} ${px(cx + r)} ${py(cy + k)} ${px(cx + r)} ${py(cy)} c S`);
        }
      }
    }
    // 10mm scale verification ruler at bottom
    const ry = ph - 6;
    cmds.push('0.5 w 0 0 0 1 K');
    cmds.push(`${px(10)} ${py(ry)} m ${px(110)} ${py(ry)} l S`);
    for (let i = 0; i <= 10; i++) {
      const tx = 10 + i * 10;
      cmds.push(`${px(tx)} ${py(ry - 1.5)} m ${px(tx)} ${py(ry + 1.5)} l S`);
    }
    return cmds.join('\n');
  }

  // 1. 3mm Bleed Boundary Guide (100% Cyan hairline [2 2] dash)
  if (cfg.bleedMm > 0 && cfg.showBleedGuide) {
    cmds.push('q 0.35 w 1 0 0 0 K [2 2] 0 d');
    const bleedLeft = Math.max(0.5, offsetX - cfg.bleedMm);
    const bleedTop = Math.max(0.5, offsetY - cfg.bleedMm);
    const bleedRight = Math.min(pw - 0.5, offsetX + geo.gridW + cfg.bleedMm);
    const bleedBottom = Math.min(ph - 0.5, offsetY + geo.gridH + cfg.bleedMm);
    cmds.push(
      `${px(bleedLeft)} ${py(bleedBottom)} ${pt(bleedRight - bleedLeft)} ${pt(bleedBottom - bleedTop)} re S`,
    );
    cmds.push('Q');
  }

  // 2. Fold / Crease Marks (Magenta + Registration dashed ticks along fold axes)
  if (cfg.showFoldMarks) {
    cmds.push('q 0.45 w 0 1 0 0 K [3 2] 0 d');
    for (let r = 0; r < geo.rows; r++) {
      const slotTop = offsetY + r * (geo.slotH + geo.gapYmm);
      const foldY = geo.isFoldable ? slotTop + geo.cardH : slotTop + geo.cardH / 2;
      // Outer wing crease ticks left & right
      const tickLen = Math.min(4.5, Math.max(1.8, offsetX - 0.5));
      cmds.push(`${px(offsetX - tickLen)} ${py(foldY)} m ${px(offsetX - 0.4)} ${py(foldY)} l S`);
      cmds.push(`${px(offsetX + geo.gridW + 0.4)} ${py(foldY)} m ${px(offsetX + geo.gridW + tickLen)} ${py(foldY)} l S`);
      if (geo.isFoldable) {
        // Dashed internal center fold crease across full card width
        for (let c = 0; c < geo.cols; c++) {
          const cx = offsetX + c * (geo.slotW + geo.gapXmm);
          cmds.push(`${px(cx)} ${py(foldY)} m ${px(cx + geo.cardW)} ${py(foldY)} l S`);
        }
      }
    }
    cmds.push('Q');
  }

  // 3. Crop Marks & Trim Grid in CMYK Registration Black (1 1 1 1 K)
  if (cfg.cropStyle !== 'none') {
    const tickX = Math.max(1.2, Math.min(4.2, offsetX - 0.4));
    const tickY = Math.max(1.2, Math.min(4.2, offsetY - 0.4));
    cmds.push('q 0.55 w 1 1 1 1 K');
    for (const x of ux) {
      cmds.push(`${px(x)} ${py(offsetY - tickY)} m ${px(x)} ${py(offsetY - 0.3)} l S`);
      cmds.push(`${px(x)} ${py(offsetY + geo.gridH + 0.3)} m ${px(x)} ${py(offsetY + geo.gridH + tickY)} l S`);
      if (cfg.cropStyle === 'full') {
        cmds.push('0.25 w 0 0 0 0.55 K');
        cmds.push(`${px(x)} ${py(offsetY)} m ${px(x)} ${py(offsetY + geo.gridH)} l S`);
        cmds.push('0.55 w 1 1 1 1 K');
      }
    }
    for (const y of uy) {
      cmds.push(`${px(offsetX - tickX)} ${py(y)} m ${px(offsetX - 0.3)} ${py(y)} l S`);
      cmds.push(`${px(offsetX + geo.gridW + 0.3)} ${py(y)} m ${px(offsetX + geo.gridW + tickX)} ${py(y)} l S`);
      if (cfg.cropStyle === 'full') {
        cmds.push('0.25 w 0 0 0 0.55 K');
        cmds.push(`${px(offsetX)} ${py(y)} m ${px(offsetX + geo.gridW)} ${py(y)} l S`);
        cmds.push('0.55 w 1 1 1 1 K');
      }
    }
    if (cfg.cropStyle === 'crop') {
      cmds.push('0.35 w 1 1 1 1 K');
      for (const x of ux) {
        for (const y of uy) {
          cmds.push(`${px(x - 1.1)} ${py(y)} m ${px(x + 1.1)} ${py(y)} l S`);
          cmds.push(`${px(x)} ${py(y - 1.1)} m ${px(x)} ${py(y + 1.1)} l S`);
        }
      }
    }
    cmds.push('Q');
  }

  // 4. CMYK Prepress Control Strip & Registration Bullseye in Bottom Margin (if >= 6mm margin)
  const bottomSpace = ph - (offsetY + geo.gridH);
  if (bottomSpace >= 5.2) {
    const barY = ph - 3.6;
    const swatches: Array<[number, number, number, number]> = [
      [1, 0, 0, 0], // Cyan
      [0, 1, 0, 0], // Magenta
      [0, 0, 1, 0], // Yellow
      [0, 0, 0, 1], // Black
      [1, 1, 0, 0], // Blue
      [0, 1, 1, 0], // Red
      [0.88, 0.72, 0.25, 0.26], // SMAN Navy
      [0.12, 0.32, 0.9, 0.06], // SMAN Gold
    ];
    cmds.push('q');
    swatches.forEach(([c, m, y, k], idx) => {
      cmds.push(`${c} ${m} ${y} ${k} k`);
      cmds.push(`${px(10 + idx * 3.4)} ${py(barY + 2.2)} ${pt(3.0)} ${pt(2.2)} re f`);
    });
    // Slug text
    cmds.push('0 0 0 1 k BT /F1 6 Tf');
    cmds.push(`${px(40)} ${py(barY + 1.5)} Td (${pageTitle.replace(/[()\\]/g, '')} | PDF/X-1a CMYK ${cfg.iccProfile} ${cfg.dpi}DPI) Tj ET`);
    cmds.push('Q');
  }

  return cmds.join('\n');
}

/**
 * Builds a complete binary PDF/X-1a:2001 CMYK document with:
 * - /DeviceCMYK color space across all pages & 300+ DPI card bitmaps
 * - Embedded binary CMYK ICC OutputIntent profile
 * - Exact /MediaBox, /BleedBox (+3mm), /TrimBox, /CropBox
 * - Vector Crop Marks, 3mm Bleed Guides, Fold Marks, and Registration Swatches
 */
export async function generatePdfX1aDocument(
  students: StudentRecord[],
  cfg: PrepressConfig,
  onProgress?: (pct: number, label: string) => void,
  modeOverride?: PrepressConfig['imposition'],
  deskLookup?: Record<string, string>,
  groupingMode: StickerGroupingMode = 'tier_room',
): Promise<Uint8Array> {
  const effectiveCfg: PrepressConfig = modeOverride
    ? { ...cfg, imposition: modeOverride }
    : cfg;
  const resolvedDeskLookup: Record<string, string> =
    deskLookup ??
    Object.fromEntries(
      Array.from(buildDeskAssignmentLookup(students, groupingMode).entries()).map(([no, v]) => [
        no,
        v.mejaLabel,
      ]),
    );
  const geo = computeSheetGeometry(effectiveCfg);
  const iccMeta = ICC_PROFILES[effectiveCfg.iccProfile];
  const iccBytes = buildCmykIccProfile(effectiveCfg.iccProfile);
  const compressedIcc = await deflateZlib(iccBytes);

  let nextId = 1;
  const allocId = () => nextId++;

  const catalogId = allocId(); // 1
  const pagesId = allocId(); // 2
  const fontId = allocId(); // 3
  const iccStreamId = allocId(); // 4
  const infoId = allocId(); // 5

  const extraObjects: PdfObjectEntry[] = [];
  const xObjects = new Map<string, CmykXObject>();

  // Cache Back CMYK XObject per class (dramatically reduces file size & compute!)
  const backCache = new Map<string, CmykXObject>();
  const minGap = Math.min(geo.gapXmm, geo.gapYmm);
  const cardBleed = Math.min(effectiveCfg.bleedMm, minGap > 0 ? Math.min(effectiveCfg.bleedMm, minGap / 2) : effectiveCfg.bleedMm);
  // Individual card render uses cardBleed on outer edges
  const renderOpts = {
    cardW: effectiveCfg.cardW,
    cardH: effectiveCfg.cardH,
    bleedMm: cardBleed,
    dpi: effectiveCfg.dpi,
    softProof: false,
    iccProfile: effectiveCfg.iccProfile,
    showQrCode: effectiveCfg.showQrCode,
    qrCorner: effectiveCfg.qrCorner,
    qrFormat: effectiveCfg.qrFormat,
    qrSizeMm: effectiveCfg.qrSizeMm,
  };

  const getBackXObject = async (kelas: string): Promise<CmykXObject> => {
    const existing = backCache.get(kelas);
    if (existing) return existing;
    const canvas = renderBackCardCanvas(kelas, renderOpts);
    const ctx = canvas.getContext('2d')!;
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cmyk = convertRgbaToCmykBytes(rgba, effectiveCfg.iccProfile);
    const compressedCmyk = await deflateZlib(cmyk);
    const id = allocId();
    const xo: CmykXObject = {
      id,
      name: `ImB_${id}`,
      widthPx: canvas.width,
      heightPx: canvas.height,
      compressedCmyk,
    };
    backCache.set(kelas, xo);
    xObjects.set(xo.name, xo);
    return xo;
  };

  const makeFrontXObject = async (s: StudentRecord): Promise<CmykXObject> => {
    const canvas = await renderFrontCardCanvas(s, {
      ...renderOpts,
      showDeskOnCard: effectiveCfg.showDeskOnCard,
      deskLabel: resolvedDeskLookup[s.no],
    });
    const ctx = canvas.getContext('2d')!;
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const cmyk = convertRgbaToCmykBytes(rgba, effectiveCfg.iccProfile);
    const compressedCmyk = await deflateZlib(cmyk);
    const id = allocId();
    const xo: CmykXObject = {
      id,
      name: `ImF_${id}`,
      widthPx: canvas.width,
      heightPx: canvas.height,
      compressedCmyk,
    };
    xObjects.set(xo.name, xo);
    return xo;
  };

  interface PagePlan {
    title: string;
    side: 'front' | 'back' | 'foldable' | 'calib-front' | 'calib-back';
    offsetX: number;
    offsetY: number;
    placements: Array<{ xMm: number; yMm: number; xo: CmykXObject; rotate180?: boolean }>;
    usedNames: string[];
  }

  const pagePlans: PagePlan[] = [];
  const totalCards = students.length;
  const perSheet = geo.cardsPerSheet;
  const numSheets = Math.max(1, Math.ceil(totalCards / perSheet));

  if (effectiveCfg.imposition === 'calibration') {
    pagePlans.push({
      title: 'Tes Kalibrasi DEPAN (+)',
      side: 'calib-front',
      offsetX: geo.originX,
      offsetY: geo.originY,
      placements: [],
      usedNames: [],
    });
    pagePlans.push({
      title: 'Tes Kalibrasi BELAKANG (O)',
      side: 'calib-back',
      offsetX: geo.backOriginX + effectiveCfg.dx,
      offsetY: geo.backOriginY + effectiveCfg.dy,
      placements: [],
      usedNames: [],
    });
  } else {
    for (let sIdx = 0; sIdx < numSheets; sIdx++) {
      const chunk = students.slice(sIdx * perSheet, (sIdx + 1) * perSheet);
      onProgress?.(
        Math.round(((sIdx + 0.5) / numSheets) * 90),
        `Merender lembar CMYK ${sIdx + 1}/${numSheets}...`,
      );

      if (effectiveCfg.imposition === 'foldable') {
        const placements: PagePlan['placements'] = [];
        const usedNames = new Set<string>();
        for (let k = 0; k < chunk.length; k++) {
          const st = chunk[k];
          const col = k % geo.cols;
          const row = Math.floor(k / geo.cols);
          const xMm = geo.originX + col * (geo.slotW + geo.gapXmm);
          const yTopMm = geo.originY + row * (geo.slotH + geo.gapYmm);

          const frontXo = await makeFrontXObject(st);
          const backXo = await getBackXObject(st.kelas);
          usedNames.add(frontXo.name);
          usedNames.add(backXo.name);

          // Top half: Back rotated 180 deg so when folded down over hinge crease, front & back face upright!
          placements.push({
            xMm: xMm - cardBleed,
            yMm: yTopMm - cardBleed,
            xo: backXo,
            rotate180: true,
          });
          // Bottom half: Front upright
          placements.push({
            xMm: xMm - cardBleed,
            yMm: yTopMm + geo.cardH - cardBleed,
            xo: frontXo,
            rotate180: false,
          });
        }
        pagePlans.push({
          title: `Lembar ${sIdx + 1} LIPAT-TEMPEL`,
          side: 'foldable',
          offsetX: geo.originX,
          offsetY: geo.originY,
          placements,
          usedNames: [...usedNames],
        });
      } else {
        // Front sheet
        if (effectiveCfg.imposition !== 'back') {
          const placements: PagePlan['placements'] = [];
          const usedNames = new Set<string>();
          for (let k = 0; k < chunk.length; k++) {
            const st = chunk[k];
            const col = k % geo.cols;
            const row = Math.floor(k / geo.cols);
            const xMm = geo.originX + col * (geo.slotW + geo.gapXmm);
            const yMm = geo.originY + row * (geo.slotH + geo.gapYmm);
            const xo = await makeFrontXObject(st);
            usedNames.add(xo.name);
            placements.push({ xMm: xMm - cardBleed, yMm: yMm - cardBleed, xo });
          }
          pagePlans.push({
            title: `Lembar ${sIdx + 1} DEPAN`,
            side: 'front',
            offsetX: geo.originX,
            offsetY: geo.originY,
            placements,
            usedNames: [...usedNames],
          });
        }

        // Mirrored symmetric Back sheet
        if (effectiveCfg.imposition !== 'front') {
          const placements: PagePlan['placements'] = [];
          const usedNames = new Set<string>();
          for (let k = 0; k < chunk.length; k++) {
            const st = chunk[k];
            let col = k % geo.cols;
            let row = Math.floor(k / geo.cols);
            if (effectiveCfg.flipMode === 'long') col = geo.cols - 1 - col;
            else row = geo.rows - 1 - row;
            const xMm = geo.backOriginX + col * (geo.slotW + geo.gapXmm) + effectiveCfg.dx;
            const yMm = geo.backOriginY + row * (geo.slotH + geo.gapYmm) + effectiveCfg.dy;
            const xo = await getBackXObject(st.kelas);
            usedNames.add(xo.name);
            placements.push({ xMm: xMm - cardBleed, yMm: yMm - cardBleed, xo });
          }
          pagePlans.push({
            title: `Lembar ${sIdx + 1} BELAKANG`,
            side: 'back',
            offsetX: geo.backOriginX + effectiveCfg.dx,
            offsetY: geo.backOriginY + effectiveCfg.dy,
            placements,
            usedNames: [...usedNames],
          });
        }
      }
    }

    if (effectiveCfg.imposition === 'back' && effectiveCfg.reverseBackOrder) {
      pagePlans.reverse();
    }
  }

  onProgress?.(94, 'Menyusun objek PDF/X-1a CMYK & ICC Profile...');

  // Build Page & Content objects
  const pageIds: number[] = [];
  const pwPt = pt(geo.paperW);
  const phPt = pt(geo.paperH);
  const bleedInset = Math.max(0, Math.min(effectiveCfg.bleedMm, Math.min(geo.originX, geo.originY)));
  const trimLeft = pt(geo.originX);
  const trimBottom = pt(geo.paperH - (geo.originY + geo.gridH));
  const trimRight = pt(geo.originX + geo.gridW);
  const trimTop = pt(geo.paperH - geo.originY);

  const bleedLeft = pt(Math.max(0, geo.originX - bleedInset));
  const bleedBottom = pt(Math.max(0, geo.paperH - (geo.originY + geo.gridH + bleedInset)));
  const bleedRight = pt(Math.min(geo.paperW, geo.originX + geo.gridW + bleedInset));
  const bleedTop = pt(Math.min(geo.paperH, geo.paperH - (geo.originY - bleedInset)));

  for (const plan of pagePlans) {
    const pageId = allocId();
    const contentId = allocId();
    pageIds.push(pageId);

    const drawW = pt(geo.cardW + cardBleed * 2);
    const drawH = pt(geo.cardH + cardBleed * 2);

    const imgStreamCmds: string[] = [];
    for (const p of plan.placements) {
      const xPt = pt(p.xMm);
      const yBottomPt = pt(geo.paperH - (p.yMm + geo.cardH + cardBleed * 2));
      imgStreamCmds.push('q');
      // Clip to exact slot + edge bleed when gap=0 so neighboring cards don't overlap trim
      if (minGap === 0 && cardBleed > 0) {
        const clipX = pt(p.xMm + cardBleed);
        const clipY = pt(geo.paperH - (p.yMm + cardBleed + geo.cardH));
        // Still allow outer perimeter bleed
        imgStreamCmds.push(`${clipX - pt(cardBleed)} ${clipY - pt(cardBleed)} ${drawW} ${drawH} re W n`);
      }
      if (p.rotate180) {
        imgStreamCmds.push(`-${drawW} 0 0 -${drawH} ${xPt + drawW} ${yBottomPt + drawH} cm`);
      } else {
        imgStreamCmds.push(`${drawW} 0 0 ${drawH} ${xPt} ${yBottomPt} cm`);
      }
      imgStreamCmds.push(`/${p.xo.name} Do`);
      imgStreamCmds.push('Q');
    }

    const marksStream = buildMarksAndBleedContentStream(
      geo,
      effectiveCfg,
      plan.offsetX,
      plan.offsetY,
      plan.title,
      plan.side,
    );
    const fullStreamStr = `${imgStreamCmds.join('\n')}\n${marksStream}\n`;
    const compressedStream = await deflateZlib(enc.encode(fullStreamStr));

    extraObjects.push({
      id: contentId,
      bytes: concatUint8([
        enc.encode(`${contentId} 0 obj\n<< /Length ${compressedStream.length} /Filter /FlateDecode >>\nstream\n`),
        compressedStream,
        enc.encode(`\nendstream\nendobj\n`),
      ]),
    });

    const xObjEntries = plan.usedNames
      .map((n) => `/${n} ${xObjects.get(n)!.id} 0 R`)
      .join(' ');

    extraObjects.push({
      id: pageId,
      bytes: enc.encode(
        `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R ` +
          `/MediaBox [0 0 ${pwPt} ${phPt}] ` +
          `/CropBox [0 0 ${pwPt} ${phPt}] ` +
          `/BleedBox [${bleedLeft} ${bleedBottom} ${bleedRight} ${bleedTop}] ` +
          `/TrimBox [${trimLeft} ${trimBottom} ${trimRight} ${trimTop}] ` +
          `/Resources << /Font << /F1 ${fontId} 0 R >> /XObject << ${xObjEntries} >> >> ` +
          `/Contents ${contentId} 0 R >>\nendobj\n`,
      ),
    });
  }

  // Emit all CMYK XObject images
  for (const xo of xObjects.values()) {
    extraObjects.push({
      id: xo.id,
      bytes: concatUint8([
        enc.encode(
          `${xo.id} 0 obj\n<< /Type /XObject /Subtype /Image ` +
            `/Width ${xo.widthPx} /Height ${xo.heightPx} ` +
            `/ColorSpace /DeviceCMYK /BitsPerComponent 8 ` +
            `/Filter /FlateDecode /Length ${xo.compressedCmyk.length} >>\nstream\n`,
        ),
        xo.compressedCmyk,
        enc.encode(`\nendstream\nendobj\n`),
      ]),
    });
  }

  const now = new Date();
  const pdfDate = `D:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes(),
  ).padStart(2, '0')}00+08'00'`;

  const coreObjects: PdfObjectEntry[] = [
    {
      id: catalogId,
      bytes: enc.encode(
        `${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R ` +
          `/OutputIntents [ << /Type /OutputIntent /S /GTS_PDFX ` +
          `/OutputCondition (${iccMeta.name}) ` +
          `/OutputConditionIdentifier (${iccMeta.conditionId}) ` +
          `/RegistryName (http://www.color.org) ` +
          `/Info (${iccMeta.name} - CMYK Prepress) ` +
          `/DestOutputProfile ${iccStreamId} 0 R >> ] >>\nendobj\n`,
      ),
    },
    {
      id: pagesId,
      bytes: enc.encode(
        `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`,
      ),
    },
    {
      id: fontId,
      bytes: enc.encode(
        `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
      ),
    },
    {
      id: iccStreamId,
      bytes: concatUint8([
        enc.encode(
          `${iccStreamId} 0 obj\n<< /N 4 /Alternate /DeviceCMYK /Filter /FlateDecode /Length ${compressedIcc.length} >>\nstream\n`,
        ),
        compressedIcc,
        enc.encode(`\nendstream\nendobj\n`),
      ]),
    },
    {
      id: infoId,
      bytes: enc.encode(
        `${infoId} 0 obj\n<< /Title (Kartu Ujian PAS SMAN 1 ALALAK - Paste November 2026) ` +
          `/Author (Panitia PAS SMAN 1 ALALAK) ` +
          `/Creator (Prepress Studio SMAN 1 ALALAK) ` +
          `/Producer (PDF/X-1a CMYK Engine v2.0) ` +
          `/CreationDate (${pdfDate}) ` +
          `/ModDate (${pdfDate}) ` +
          `/GTS_PDFXVersion (PDF/X-1a:2001) ` +
          `/GTS_PDFXConformance (PDF/X-1a:2001) ` +
          `/Trapped /False >>\nendobj\n`,
      ),
    },
  ];

  const allObjects = [...coreObjects, ...extraObjects].sort((a, b) => a.id - b.id);

  // Assemble PDF binary + xref
  const header = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x33, 0x0a, // %PDF-1.3\n
    0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // binary hint comment
  ]);

  const parts: Uint8Array[] = [header];
  const offsets: number[] = new Array(allObjects.length + 1).fill(0);
  let cursor = header.length;

  for (const obj of allObjects) {
    offsets[obj.id] = cursor;
    parts.push(obj.bytes);
    cursor += obj.bytes.length;
  }

  const xrefPos = cursor;
  const maxId = allObjects.length;
  let xrefStr = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xrefStr += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  const docIdHex = Array.from({ length: 32 }, (_, i) => ((i * 7 + maxId) % 16).toString(16)).join('');
  xrefStr += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${docIdHex}><${docIdHex}>] >>\nstartxref\n${xrefPos}\n%%EOF\n`;

  parts.push(enc.encode(xrefStr));
  onProgress?.(100, 'PDF/X-1a CMYK selesai dibuat.');
  return concatUint8(parts);
}
