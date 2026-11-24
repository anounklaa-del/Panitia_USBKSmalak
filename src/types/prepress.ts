export type PaperPreset = 'A4' | 'F4' | 'SRA4' | 'Legal' | 'Letter' | 'custom';

export type ImpositionMode = 'duplex' | 'foldable' | 'front' | 'back' | 'calibration';

export type CropMarkStyle = 'full' | 'crop' | 'none';

export type FlipMode = 'long' | 'short';

export type MarginMode = 'auto' | 'manual';

export type IccProfileId = 'FOGRA39' | 'GRACoL2006' | 'JapanColor2001';

export type QrCornerPosition = 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left';
export type QrPayloadFormat = 'full_no' | 'short_no' | 'json';

export type MainWorkspaceTab =
  | 'dashboard'
  | 'committee'
  | 'schedule'
  | 'proctor'
  | 'studio'
  | 'sticker'
  | 'seating'
  | 'attendance'
  | 'berita_acara'
  | 'rules_bell'
  | 'students'
  | 'mockup3d'
  | 'export'
  | 'docs'
  | 'settings'
  | 'accounts';

export type BeritaAcaraLayoutMode = 'two_up_duplicate' | 'two_up_paired' | 'one_up';
export type BeritaAcaraFillMode = 'filled' | 'blank';

export interface BeritaAcaraConfig {
  layoutMode: BeritaAcaraLayoutMode;
  fillMode: BeritaAcaraFillMode;
  examPeriodTitle: string;
  schoolAddress: string;
  selectedDate: string;
  selectedSubject: string;
  selectedRoom: string;
  selectedProctorCode: string;
  zoomPct: number;
}

export const DEFAULT_BERITA_ACARA_CONFIG: BeritaAcaraConfig = {
  layoutMode: 'one_up',
  fillMode: 'filled',
  examPeriodTitle: 'PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER GANJIL',
  schoolAddress: 'Jalan Brigjen. H. Hasan Basri KM. 11 Handil Bakti Kec. Alalak Kab. Batola ,70582',
  selectedDate: '',
  selectedSubject: '',
  selectedRoom: '',
  selectedProctorCode: '',
  zoomPct: 72,
};

export type SeatingVariant = 'kelas' | 'panitia' | 'both';
export type SeatingMode = 'student_card' | 'desk_combined' | 'per_kelas';
export type SeatingClassGrouping = 'tier_per_room' | 'exact_class_per_room';
export type SeatingDataSource = 'room' | 'card_filter';
export type SeatingStudentOrder = 'desk_order' | 'card_order' | 'interleave_class';
export type SeatingNumberingOrder = 'snake_col' | 'col_top' | 'row_left';
export type SeatingOrientation = 'front_top' | 'front_bottom';
export type SeatingDoorSide = 'left' | 'right';

export interface SeatingConfig {
  seatingMode: SeatingMode;
  classGrouping: SeatingClassGrouping;
  selectedClassTier: string;
  dataSource: SeatingDataSource;
  studentOrder: SeatingStudentOrder;
  selectedRoom: string;
  variant: SeatingVariant;
  cols: number;
  numberingOrder: SeatingNumberingOrder;
  orientation: SeatingOrientation;
  doorSide: SeatingDoorSide;
  paperOrientation: 'portrait' | 'landscape';
  marginMm: number;
  showEmptyDesks: boolean;
  showStudentNames: boolean;
  showUserAndFullNo: boolean;
  showSchoolHeader: boolean;
  examTitle: string;
  committeeChairName: string;
  zoomPct: number;
}

export const DEFAULT_SEATING_CONFIG: SeatingConfig = {
  seatingMode: 'student_card',
  classGrouping: 'tier_per_room',
  selectedClassTier: '',
  dataSource: 'room',
  studentOrder: 'desk_order',
  selectedRoom: '',
  variant: 'both',
  cols: 6,
  numberingOrder: 'snake_col',
  orientation: 'front_top',
  doorSide: 'left',
  paperOrientation: 'portrait',
  marginMm: 8,
  showEmptyDesks: true,
  showStudentNames: true,
  showUserAndFullNo: true,
  showSchoolHeader: true,
  examTitle: 'PENILAIAN AKHIR SEMESTER (PAS) GANJIL 2026/2027',
  committeeChairName: 'Panitia Pelaksana PAS SMAN 1 Alalak',
  zoomPct: 56,
};

export type AttendanceGroupingMode = 'per_ruang' | 'per_ruang_jenjang' | 'per_kelas' | 'card_filter';
export type AttendanceOrderMode = 'no_peserta' | 'meja_order' | 'nama_alpha';

export interface AttendanceConfig {
  groupingMode: AttendanceGroupingMode;
  selectedRoom: string;
  selectedClass: string;
  orderMode: AttendanceOrderMode;
  rowsPerPage: 'fit_group' | 'auto' | 20 | 25 | 30 | 35;
  paperOrientation: 'portrait' | 'landscape';
  marginMm: number;
  showSchoolHeader: boolean;
  showFullParticipantNo: boolean;
  showDeskAndRoomCol: boolean;
  showNotesCol: boolean;
  showSummaryAndSignatures: boolean;
  twoProctors: boolean;
  examTitle: string;
  academicYear: string;
  subjectName: string;
  examDate: string;
  examTime: string;
  proctor1Name: string;
  proctor2Name: string;
  committeeChairName: string;
  committeeChairNip: string;
  cityLabel: string;
  zoomPct: number;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  groupingMode: 'per_ruang',
  selectedRoom: '',
  selectedClass: '',
  orderMode: 'no_peserta',
  rowsPerPage: 'fit_group',
  paperOrientation: 'portrait',
  marginMm: 8,
  showSchoolHeader: true,
  showFullParticipantNo: true,
  showDeskAndRoomCol: true,
  showNotesCol: true,
  showSummaryAndSignatures: true,
  twoProctors: false,
  examTitle: 'PENILAIAN AKHIR SEMESTER (PAS) GANJIL',
  academicYear: '2026/2027',
  subjectName: '',
  examDate: '',
  examTime: '',
  proctor1Name: '',
  proctor2Name: '',
  committeeChairName: 'Ketua Panitia PAS SMAN 1 Alalak',
  committeeChairNip: '',
  cityLabel: 'Alalak',
  zoomPct: 58,
};

export type StickerGroupingMode = 'tier_room' | 'class_room';

export interface StickerConfig {
  selectedRoom: string;
  stickerW: number;
  stickerH: number;
  gapXmm: number;
  gapYmm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  showCropMarks: boolean;
  showEmptyTiers: boolean;
  groupingMode: StickerGroupingMode;
  zoomPct: number;
  searchQuery: string;
}

export interface StickerGeometry {
  paperW: number;
  paperH: number;
  stickerW: number;
  stickerH: number;
  gapXmm: number;
  gapYmm: number;
  cols: number;
  rows: number;
  gridW: number;
  gridH: number;
  originX: number;
  originY: number;
  marginRightActual: number;
  marginBottomActual: number;
  overflowsPaper: boolean;
  stickersPerSheet: number;
}

export const DEFAULT_STICKER_CONFIG: StickerConfig = {
  selectedRoom: '',
  stickerW: 96,
  stickerH: 52,
  gapXmm: 4,
  gapYmm: 3,
  marginTopMm: 12.5,
  marginBottomMm: 12.5,
  marginLeftMm: 7,
  marginRightMm: 7,
  showCropMarks: true,
  showEmptyTiers: true,
  groupingMode: 'tier_room',
  zoomPct: 58,
  searchQuery: '',
};

export interface PrepressConfig {
  paper: PaperPreset;
  customW: number;
  customH: number;
  cardW: number;
  cardH: number;
  gapXmm: number;
  gapYmm: number;
  marginMode: MarginMode;
  marginMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  bleedMm: number;
  showBleedGuide: boolean;
  showFoldMarks: boolean;
  cropStyle: CropMarkStyle;
  cutOnBack: boolean;
  flipMode: FlipMode;
  dx: number;
  dy: number;
  imposition: ImpositionMode;
  reverseBackOrder: boolean;
  selectedClass: string;
  selectedRoom: string;
  noFrom: string;
  noTo: string;
  zoomPct: number;
  dpi: 300 | 450 | 600;
  iccProfile: IccProfileId;
  cmykSoftProof: boolean;
  xrayAlignmentOverlay: boolean;
  showQrCode: boolean;
  qrCorner: QrCornerPosition;
  qrFormat: QrPayloadFormat;
  qrSizeMm: number;
  showDeskOnCard: boolean;
}

export interface SheetGeometry {
  paperW: number;
  paperH: number;
  slotW: number;
  slotH: number;
  cardW: number;
  cardH: number;
  gapXmm: number;
  gapYmm: number;
  bleedMm: number;
  cols: number;
  rows: number;
  gridW: number;
  gridH: number;
  originX: number;
  originY: number;
  backOriginX: number;
  backOriginY: number;
  marginRightActual: number;
  marginBottomActual: number;
  overflowsPaper: boolean;
  cardsPerSheet: number;
  isFoldable: boolean;
}

export interface AssetCheckItem {
  id: string;
  label: string;
  category: 'Geometri' | 'Warna & PDF/X' | 'Arsip & Dokumentasi';
  passed: boolean;
  detail: string;
}

export interface ArchiveEfficiencyMetrics {
  totalStudents: number;
  filteredStudents: number;
  cardsPerSheet: number;
  totalSheets: number;
  totalPages: number;
  paperUtilizationPct: number;
  wasteAreaMm2: number;
  estimatedPdfSizeMb: number;
  estimatedZipSizeMb: number;
  compressionRatioPct: number;
  manualTimeMinutes: number;
  automatedTimeMinutes: number;
  timeSavedPct: number;
}

export const PAPER_DIMENSIONS: Record<Exclude<PaperPreset, 'custom'>, [number, number, string]> = {
  A4: [210, 297, 'A4 (210 × 297 mm)'],
  F4: [215, 330, 'F4 / Folio (215 × 330 mm)'],
  SRA4: [225, 320, 'SRA4 Oversize Bleed (225 × 320 mm)'],
  Legal: [215.9, 355.6, 'Legal (215,9 × 355,6 mm)'],
  Letter: [215.9, 279.4, 'Letter (215,9 × 279,4 mm)'],
};

export const DEFAULT_PREPRESS_CONFIG: PrepressConfig = {
  paper: 'A4',
  customW: 210,
  customH: 297,
  cardW: 101.6,
  cardH: 68.4,
  gapXmm: 0,
  gapYmm: 0,
  marginMode: 'auto',
  marginMm: 3.4,
  marginTopMm: 11.7,
  marginBottomMm: 11.7,
  marginLeftMm: 3.4,
  marginRightMm: 3.4,
  bleedMm: 3.0,
  showBleedGuide: true,
  showFoldMarks: true,
  cropStyle: 'full',
  cutOnBack: true,
  flipMode: 'long',
  dx: 0,
  dy: 0,
  imposition: 'duplex',
  reverseBackOrder: false,
  selectedClass: '',
  selectedRoom: '',
  noFrom: '',
  noTo: '',
  zoomPct: 58,
  dpi: 300,
  iccProfile: 'FOGRA39',
  cmykSoftProof: false,
  xrayAlignmentOverlay: false,
  showQrCode: true,
  qrCorner: 'bottom_right',
  qrFormat: 'full_no',
  qrSizeMm: 13.5,
  showDeskOnCard: true,
};

export function computeSheetGeometry(cfg: PrepressConfig): SheetGeometry {
  const [paperW, paperH] =
    cfg.paper === 'custom'
      ? [Math.max(50, cfg.customW), Math.max(50, cfg.customH)]
      : [PAPER_DIMENSIONS[cfg.paper][0], PAPER_DIMENSIONS[cfg.paper][1]];

  const gapXmm = Math.max(0, cfg.gapXmm ?? 0);
  const gapYmm = Math.max(0, cfg.gapYmm ?? 0);

  const isFoldable = cfg.imposition === 'foldable';
  const slotW = cfg.cardW;
  const slotH = isFoldable ? cfg.cardH * 2 : cfg.cardH;

  const isManualMargin = cfg.marginMode === 'manual';
  const availW = isManualMargin
    ? paperW - Math.max(0, cfg.marginLeftMm) - Math.max(0, cfg.marginRightMm)
    : paperW - 2 * Math.max(0, cfg.marginMm);
  const availH = isManualMargin
    ? paperH - Math.max(0, cfg.marginTopMm) - Math.max(0, cfg.marginBottomMm)
    : paperH - 2 * Math.max(0, cfg.marginMm);

  const cols = Math.max(1, Math.floor((availW + gapXmm + 0.001) / (slotW + gapXmm)));
  const rows = Math.max(1, Math.floor((availH + gapYmm + 0.001) / (slotH + gapYmm)));

  const gridW = cols * slotW + (cols - 1) * gapXmm;
  const gridH = rows * slotH + (rows - 1) * gapYmm;

  const originX = isManualMargin ? Math.max(0, cfg.marginLeftMm) : (paperW - gridW) / 2;
  const originY = isManualMargin ? Math.max(0, cfg.marginTopMm) : (paperH - gridH) / 2;

  // Mirror back origin cleanly when manual margins are asymmetric so front/back align 0.0mm
  const backOriginX = cfg.flipMode === 'long' ? paperW - (originX + gridW) : originX;
  const backOriginY = cfg.flipMode === 'short' ? paperH - (originY + gridH) : originY;

  const marginRightActual = +(paperW - (originX + gridW)).toFixed(2);
  const marginBottomActual = +(paperH - (originY + gridH)).toFixed(2);
  const overflowsPaper =
    originX + gridW > paperW + 0.05 ||
    originY + gridH > paperH + 0.05 ||
    marginRightActual < -0.05 ||
    marginBottomActual < -0.05;

  return {
    paperW,
    paperH,
    slotW,
    slotH,
    cardW: cfg.cardW,
    cardH: cfg.cardH,
    gapXmm,
    gapYmm,
    bleedMm: cfg.bleedMm,
    cols,
    rows,
    gridW,
    gridH,
    originX,
    originY,
    backOriginX,
    backOriginY,
    marginRightActual,
    marginBottomActual,
    overflowsPaper,
    cardsPerSheet: cols * rows,
    isFoldable,
  };
}

export function computeStickerGeometry(
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  stickerCfg: StickerConfig,
): StickerGeometry {
  const [paperW, paperH] =
    paperCfg.paper === 'custom'
      ? [Math.max(50, paperCfg.customW), Math.max(50, paperCfg.customH)]
      : [PAPER_DIMENSIONS[paperCfg.paper][0], PAPER_DIMENSIONS[paperCfg.paper][1]];

  const stickerW = Math.max(30, stickerCfg.stickerW || 96);
  const stickerH = Math.max(25, stickerCfg.stickerH || 64);
  const gapXmm = Math.max(0, stickerCfg.gapXmm ?? 0);
  const gapYmm = Math.max(0, stickerCfg.gapYmm ?? 0);
  const originX = Math.max(0, stickerCfg.marginLeftMm ?? 0);
  const originY = Math.max(0, stickerCfg.marginTopMm ?? 0);
  const marginRight = Math.max(0, stickerCfg.marginRightMm ?? 0);
  const marginBottom = Math.max(0, stickerCfg.marginBottomMm ?? 0);

  const availW = paperW - originX - marginRight;
  const availH = paperH - originY - marginBottom;

  const cols = Math.max(1, Math.floor((availW + gapXmm + 0.001) / (stickerW + gapXmm)));
  const rows = Math.max(1, Math.floor((availH + gapYmm + 0.001) / (stickerH + gapYmm)));

  const gridW = cols * stickerW + (cols - 1) * gapXmm;
  const gridH = rows * stickerH + (rows - 1) * gapYmm;

  const marginRightActual = +(paperW - (originX + gridW)).toFixed(2);
  const marginBottomActual = +(paperH - (originY + gridH)).toFixed(2);
  const overflowsPaper =
    originX + gridW > paperW + 0.05 ||
    originY + gridH > paperH + 0.05 ||
    marginRightActual < -0.05 ||
    marginBottomActual < -0.05;

  return {
    paperW,
    paperH,
    stickerW,
    stickerH,
    gapXmm,
    gapYmm,
    cols,
    rows,
    gridW,
    gridH,
    originX,
    originY,
    marginRightActual,
    marginBottomActual,
    overflowsPaper,
    stickersPerSheet: cols * rows,
  };
}

export type ParticipantNumberFormat = 'nis' | 'pas_card' | 'seq_year';
export type ExamOrderMode = 'urut_absen' | 'urut_nama' | 'urut_ruang';

export interface SchoolSettings {
  schoolName: string;
  npsn: string;
  address: string;
  principalName: string;
  principalNip: string;
  email: string;
  phone: string;
  logoDataUri: string;
  semester: 'Ganjil' | 'Genap';
  participantNumberFormat: ParticipantNumberFormat;
  examOrderMode: ExamOrderMode;
  roomDigitCount: 1 | 2 | 3;
  enableNotifications: boolean;
  showStudentIdentityOnAttendance: boolean;
  documentUploadDeadlineDays: number;
  lastSavedAt: string;
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'SMA NEGERI 1 ALALAK',
  npsn: '30304567',
  address: 'Jalan Brigjen. H. Hasan Basri KM. 11 Handil Bakti Kec. Alalak Kab. Batola ,70582',
  principalName: 'Drs. H. Ahmad, M.Pd',
  principalNip: '196805121993031005',
  email: 'sman1alalak@gmail.com',
  phone: '0511-1234567',
  logoDataUri: '',
  semester: 'Ganjil',
  participantNumberFormat: 'nis',
  examOrderMode: 'urut_absen',
  roomDigitCount: 2,
  enableNotifications: true,
  showStudentIdentityOnAttendance: true,
  documentUploadDeadlineDays: 3,
  lastSavedAt: '',
};

