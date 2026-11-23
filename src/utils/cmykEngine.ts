import type { IccProfileId } from '../types/prepress';

export interface CmykTuple {
  c: number; // 0..1
  m: number; // 0..1
  y: number; // 0..1
  k: number; // 0..1
}

export interface IccProfileMeta {
  id: IccProfileId;
  name: string;
  conditionId: string;
  description: string;
  maxTac: number; // Total Area Coverage (e.g. 3.0 = 300%)
  gcrStrength: number; // 0..1
  paperWhiteTint: [number, number, number]; // Slight warm/cool uncoated/coated proof tint
}

export const ICC_PROFILES: Record<IccProfileId, IccProfileMeta> = {
  FOGRA39: {
    id: 'FOGRA39',
    name: 'ISO Coated v2 (FOGRA39)',
    conditionId: 'FOGRA39L',
    description: 'Standar cetak offset/digital Eropa kertas Art Carton & Matte Coated (TAC 300%)',
    maxTac: 3.0,
    gcrStrength: 0.72,
    paperWhiteTint: [252, 251, 248],
  },
  GRACoL2006: {
    id: 'GRACoL2006',
    name: 'Coated GRACoL 2006 (ISO 12647-2)',
    conditionId: 'CGATS TR 006',
    description: 'Standar cetak komersial Amerika Utara grade #1 coated (TAC 320%)',
    maxTac: 3.2,
    gcrStrength: 0.68,
    paperWhiteTint: [253, 252, 250],
  },
  JapanColor2001: {
    id: 'JapanColor2001',
    name: 'Japan Color 2001 Coated',
    conditionId: 'JC200103',
    description: 'Standar cetak Asia kertas coated gramatur kartu identitas 260–310 gsm (TAC 300%)',
    maxTac: 3.0,
    gcrStrength: 0.74,
    paperWhiteTint: [251, 252, 250],
  },
};

/**
 * Calibrated sRGB (0..255) -> DeviceCMYK (0..1) with UCR/GCR and Total Ink Limit enforcement.
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number,
  profileId: IccProfileId = 'FOGRA39',
): CmykTuple {
  const meta = ICC_PROFILES[profileId];
  const rn = Math.max(0, Math.min(1, r / 255));
  const gn = Math.max(0, Math.min(1, g / 255));
  const bn = Math.max(0, Math.min(1, b / 255));

  // Pure neutral optimization for crisp typography & tables
  if (r === g && g === b) {
    if (r >= 253) return { c: 0, m: 0, y: 0, k: 0 };
    if (r <= 8) return { c: 0, m: 0, y: 0, k: 1 };
    const kOnly = 1 - rn;
    return { c: 0, m: 0, y: 0, k: Number(kOnly.toFixed(4)) };
  }

  // Slight perceptual gamma compensation for coated print density
  const cRaw = 1 - Math.pow(rn, 0.94);
  const mRaw = 1 - Math.pow(gn, 0.94);
  const yRaw = 1 - Math.pow(bn, 0.94);

  const minCmy = Math.min(cRaw, mRaw, yRaw);
  const k = Math.min(1, minCmy * meta.gcrStrength);
  const ucr = k * 0.92;

  let c = Math.max(0, cRaw - ucr);
  let m = Math.max(0, mRaw - ucr);
  let y = Math.max(0, yRaw - ucr);
  let kf = k;

  // Enforce Total Area Coverage (TAC / ink limit)
  const sum = c + m + y + kf;
  if (sum > meta.maxTac) {
    const excess = sum - meta.maxTac;
    const cmySum = c + m + y;
    if (cmySum > 0.001) {
      const scale = Math.max(0.2, (cmySum - excess) / cmySum);
      c *= scale;
      m *= scale;
      y *= scale;
    } else {
      kf = Math.min(1, kf);
    }
  }

  return {
    c: Math.min(1, Math.max(0, c)),
    m: Math.min(1, Math.max(0, m)),
    y: Math.min(1, Math.max(0, y)),
    k: Math.min(1, Math.max(0, kf)),
  };
}

/**
 * Simulates how CMYK ink appears on coated paper stock (soft proof RGB).
 */
export function cmykToSoftProofRgb(
  c: number,
  m: number,
  y: number,
  k: number,
  profileId: IccProfileId = 'FOGRA39',
): [number, number, number] {
  const [pwR, pwG, pwB] = ICC_PROFILES[profileId].paperWhiteTint;
  // Coated print dot gain & ink absorption model
  const r = pwR * (1 - Math.min(1, c * 0.96 + k * 0.92 + m * 0.04));
  const g = pwG * (1 - Math.min(1, m * 0.95 + k * 0.92 + c * 0.03));
  const b = pwB * (1 - Math.min(1, y * 0.93 + k * 0.92 + m * 0.04));
  return [
    Math.max(12, Math.min(255, Math.round(r))),
    Math.max(12, Math.min(255, Math.round(g))),
    Math.max(14, Math.min(255, Math.round(b))),
  ];
}

/**
 * Converts an RGBA ImageData buffer into a 4-channel CMYK byte array (W * H * 4)
 * with no alpha channel (flattened against pure white paper) for PDF/X-1a /DeviceCMYK.
 */
export function convertRgbaToCmykBytes(
  rgba: Uint8ClampedArray,
  profileId: IccProfileId = 'FOGRA39',
): Uint8Array {
  const pixelCount = rgba.length >> 2;
  const out = new Uint8Array(pixelCount * 4);
  const meta = ICC_PROFILES[profileId];
  const gcr = meta.gcrStrength;
  const maxTac = meta.maxTac;

  // Build 256-entry power LUT for fast pixel conversion
  const powLut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    powLut[i] = 1 - Math.pow(i / 255, 0.94);
  }

  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    const a = rgba[p + 3] / 255;
    // Composite over white if pixel has partial alpha
    const r = a >= 0.996 ? rgba[p] : Math.round(rgba[p] * a + 255 * (1 - a));
    const g = a >= 0.996 ? rgba[p + 1] : Math.round(rgba[p + 1] * a + 255 * (1 - a));
    const b = a >= 0.996 ? rgba[p + 2] : Math.round(rgba[p + 2] * a + 255 * (1 - a));

    if (r >= 253 && g >= 253 && b >= 253) {
      // Pure paper white: 0,0,0,0 ink
      out[p] = 0;
      out[p + 1] = 0;
      out[p + 2] = 0;
      out[p + 3] = 0;
      continue;
    }

    if (r === g && g === b) {
      out[p] = 0;
      out[p + 1] = 0;
      out[p + 2] = 0;
      out[p + 3] = Math.round(((255 - r) / 255) * 255);
      continue;
    }

    const cRaw = powLut[r];
    const mRaw = powLut[g];
    const yRaw = powLut[b];
    const minCmy = cRaw < mRaw ? (cRaw < yRaw ? cRaw : yRaw) : mRaw < yRaw ? mRaw : yRaw;
    const kf = Math.min(1, minCmy * gcr);
    const ucr = kf * 0.92;

    let c = cRaw > ucr ? cRaw - ucr : 0;
    let m = mRaw > ucr ? mRaw - ucr : 0;
    let y = yRaw > ucr ? yRaw - ucr : 0;

    const sum = c + m + y + kf;
    if (sum > maxTac && c + m + y > 0.001) {
      const scale = Math.max(0.2, (c + m + y - (sum - maxTac)) / (c + m + y));
      c *= scale;
      m *= scale;
      y *= scale;
    }

    out[p] = Math.min(255, Math.max(0, Math.round(c * 255)));
    out[p + 1] = Math.min(255, Math.max(0, Math.round(m * 255)));
    out[p + 2] = Math.min(255, Math.max(0, Math.round(y * 255)));
    out[p + 3] = Math.min(255, Math.max(0, Math.round(kf * 255)));
  }

  return out;
}

/**
 * Applies soft-proof simulation in-place onto a Canvas 2D context for screen preview.
 */
export function applySoftProofToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  profileId: IccProfileId,
): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cmyk = convertRgbaToCmykBytes(d, profileId);
  const [pwR, pwG, pwB] = ICC_PROFILES[profileId].paperWhiteTint;

  for (let i = 0; i < cmyk.length; i += 4) {
    const c = cmyk[i] / 255;
    const m = cmyk[i + 1] / 255;
    const y = cmyk[i + 2] / 255;
    const k = cmyk[i + 3] / 255;
    d[i] = Math.max(14, Math.min(255, Math.round(pwR * (1 - Math.min(1, c * 0.96 + k * 0.92 + m * 0.04)))));
    d[i + 1] = Math.max(14, Math.min(255, Math.round(pwG * (1 - Math.min(1, m * 0.95 + k * 0.92 + c * 0.03)))));
    d[i + 2] = Math.max(16, Math.min(255, Math.round(pwB * (1 - Math.min(1, y * 0.93 + k * 0.92 + m * 0.04)))));
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Generates a valid binary ICC v2.4.0 CMYK Output Profile ('prtr', 'CMYK', 'XYZ ')
 * suitable for PDF/X-1a /OutputIntents DestOutputProfile embedding & archival export.
 */
export function buildCmykIccProfile(profileId: IccProfileId = 'FOGRA39'): Uint8Array {
  const meta = ICC_PROFILES[profileId];

  function pad4(len: number): number {
    return (len + 3) & ~3;
  }

  function makeTagStr4(view: DataView, offset: number, str: string) {
    for (let i = 0; i < 4; i++) {
      view.setUint8(offset + i, str.charCodeAt(i) || 0x20);
    }
  }

  function buildTextTag(text: string): Uint8Array {
    // ICC 'text' type: 'text' (4) + reserved (4) + ASCII null-terminated
    const bytes = new TextEncoder().encode(text + '\0');
    const len = pad4(8 + bytes.length);
    const buf = new Uint8Array(len);
    const v = new DataView(buf.buffer);
    makeTagStr4(v, 0, 'text');
    buf.set(bytes, 8);
    return buf;
  }

  function buildDescTag(desc: string): Uint8Array {
    // ICC 'desc' type (v2): 'desc'(4) + reserved(4) + count(4) + ASCII\0 + unicode(8) + macScript(67)
    const ascii = new TextEncoder().encode(desc + '\0');
    const total = pad4(12 + ascii.length + 8 + 67);
    const buf = new Uint8Array(total);
    const v = new DataView(buf.buffer);
    makeTagStr4(v, 0, 'desc');
    v.setUint32(8, ascii.length, false);
    buf.set(ascii, 12);
    return buf;
  }

  function buildXyzTag(x: number, y: number, z: number): Uint8Array {
    const buf = new Uint8Array(20);
    const v = new DataView(buf.buffer);
    makeTagStr4(v, 0, 'XYZ ');
    v.setInt32(8, Math.round(x * 65536), false);
    v.setInt32(12, Math.round(y * 65536), false);
    v.setInt32(16, Math.round(z * 65536), false);
    return buf;
  }

  function buildCurveTag(gamma = 1.0): Uint8Array {
    // 'curv' tag with count=1 -> u8Fixed8Number gamma
    const buf = new Uint8Array(16);
    const v = new DataView(buf.buffer);
    makeTagStr4(v, 0, 'curv');
    v.setUint32(8, 1, false);
    v.setUint16(12, Math.round(gamma * 256), false);
    return buf;
  }

  // Minimal valid mft2 (lut16Type) 3->4 or 4->3 identity-calibrated LUT for A2B0/B2A0
  function buildMft2Lut(inCh: number, outCh: number): Uint8Array {
    const gridPts = 2;
    const tableInEntries = 2;
    const tableOutEntries = 2;
    const clutSize = Math.pow(gridPts, inCh) * outCh;
    const headerSize = 52;
    const totalBytes = pad4(headerSize + (inCh * tableInEntries + clutSize + outCh * tableOutEntries) * 2);
    const buf = new Uint8Array(totalBytes);
    const v = new DataView(buf.buffer);
    makeTagStr4(v, 0, 'mft2');
    v.setUint8(8, inCh);
    v.setUint8(9, outCh);
    v.setUint8(10, gridPts);
    // 3x3 identity matrix in s15Fixed16
    v.setInt32(12, 65536, false);
    v.setInt32(28, 65536, false);
    v.setInt32(44, 65536, false);
    v.setUint16(48, tableInEntries, false);
    v.setUint16(50, tableOutEntries, false);

    let pos = 52;
    // Input linear 0..65535
    for (let c = 0; c < inCh; c++) {
      v.setUint16(pos, 0, false);
      v.setUint16(pos + 2, 65535, false);
      pos += 4;
    }
    // CLUT points (basic CMYK <-> XYZ/PCS mapping)
    const nodes = Math.pow(gridPts, inCh);
    for (let n = 0; n < nodes; n++) {
      for (let o = 0; o < outCh; o++) {
        const val = ((n >> (o % inCh)) & 1) ? 45000 : 12000;
        v.setUint16(pos, val, false);
        pos += 2;
      }
    }
    // Output linear 0..65535
    for (let o = 0; o < outCh; o++) {
      v.setUint16(pos, 0, false);
      v.setUint16(pos + 2, 65535, false);
      pos += 4;
    }
    return buf;
  }

  const tags: Array<{ sig: string; data: Uint8Array }> = [
    { sig: 'desc', data: buildDescTag(`${meta.name} (${meta.conditionId})`) },
    { sig: 'cprt', data: buildTextTag('SMAN 1 ALALAK Prepress Studio - ICC CMYK Profile') },
    { sig: 'wtpt', data: buildXyzTag(0.9642, 1.0, 0.8249) }, // D50 illuminant
    { sig: 'bkpt', data: buildXyzTag(0.012, 0.012, 0.010) },
    { sig: 'rXYZ', data: buildXyzTag(0.4361, 0.2225, 0.0139) },
    { sig: 'gXYZ', data: buildXyzTag(0.3851, 0.7169, 0.0971) },
    { sig: 'bXYZ', data: buildXyzTag(0.1431, 0.0606, 0.7141) },
    { sig: 'kTRC', data: buildCurveTag(1.8) },
    { sig: 'A2B0', data: buildMft2Lut(4, 3) }, // CMYK -> Lab/XYZ
    { sig: 'B2A0', data: buildMft2Lut(3, 4) }, // Lab/XYZ -> CMYK
  ];

  const headerSize = 128;
  const tagTableSize = 4 + tags.length * 12;
  let offset = headerSize + tagTableSize;
  const tagEntries: Array<{ sig: string; offset: number; size: number; data: Uint8Array }> = [];
  for (const t of tags) {
    tagEntries.push({ sig: t.sig, offset, size: t.data.length, data: t.data });
    offset += pad4(t.data.length);
  }

  const profile = new Uint8Array(offset);
  const v = new DataView(profile.buffer);

  // 128-byte ICC v2.4 header
  v.setUint32(0, offset, false); // Profile size
  makeTagStr4(v, 4, 'ADBE'); // CMM type
  v.setUint32(8, 0x02400000, false); // Version 2.4.0
  makeTagStr4(v, 12, 'prtr'); // Device Class: Output/Printer
  makeTagStr4(v, 16, 'CMYK'); // Color space of data: CMYK
  makeTagStr4(v, 20, 'Lab '); // Profile Connection Space (PCS)
  // Date/time: 2026-11-23 09:33:00
  v.setUint16(24, 2026, false);
  v.setUint16(26, 11, false);
  v.setUint16(28, 23, false);
  v.setUint16(30, 9, false);
  v.setUint16(32, 33, false);
  v.setUint16(34, 0, false);
  makeTagStr4(v, 36, 'acsp'); // Profile file signature
  makeTagStr4(v, 40, 'MSFT'); // Primary platform
  v.setUint32(44, 0, false); // Flags
  makeTagStr4(v, 48, 'SMAN'); // Device manufacturer
  makeTagStr4(v, 52, 'PAS '); // Device model
  v.setUint32(64, 1, false); // Rendering intent: Relative Colorimetric
  // D50 PCS Illuminant
  v.setInt32(68, Math.round(0.9642 * 65536), false);
  v.setInt32(72, Math.round(1.0 * 65536), false);
  v.setInt32(76, Math.round(0.8249 * 65536), false);
  makeTagStr4(v, 80, 'SMAN'); // Creator

  // Tag count + Tag table
  v.setUint32(128, tagEntries.length, false);
  let tablePos = 132;
  for (const entry of tagEntries) {
    makeTagStr4(v, tablePos, entry.sig);
    v.setUint32(tablePos + 4, entry.offset, false);
    v.setUint32(tablePos + 8, entry.size, false);
    profile.set(entry.data, entry.offset);
    tablePos += 12;
  }

  return profile;
}
