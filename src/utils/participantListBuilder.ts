import type { StudentRecord } from '../data/pasData';
import type {
  ParticipantListConfig,
  PrepressConfig,
  StickerGroupingMode,
} from '../types/prepress';
import {
  buildDeskAssignmentLookup,
  compareNumericStrings,
  extractClassTier,
  formatParticipantNo,
  normalizeRoomLabel,
} from './deskStickerBuilder';
import { getSeatingPaperDimensions } from './seatingPlanBuilder';

type DeskAssignmentInfo = { ruang: string; mejaNo: number; mejaLabel: string };

export interface ParticipantListRow {
  rowNumber: number;
  student: StudentRecord;
  participantNo: string;
  ruangNormalized: string;
  ruangFormatted: string;
  tier: string;
  mejaLabel: string;
  mejaNo: number;
}

export interface ParticipantListGroup {
  id: string;
  badgeLabel: string;
  primaryHeading: string;
  secondaryHeading: string;
  classSummaryText: string;
  rows: ParticipantListRow[];
}

export interface ParticipantListPageEntry {
  key: string;
  group: ParticipantListGroup;
  pageInGroup: number;
  totalPagesInGroup: number;
  rows: ParticipantListRow[];
}

export function formatParticipantRoomLabel(ruang: string, useLeadingZero: boolean): string {
  const normalized = normalizeRoomLabel(ruang);
  if (useLeadingZero) return normalized;
  if (/^\d+$/.test(normalized)) {
    return String(Number(normalized));
  }
  return normalized;
}

function tierRank(tier: string): number {
  if (tier === 'X') return 1;
  if (tier === 'XI') return 2;
  if (tier === 'XII') return 3;
  return 9;
}

function sortStudentsForList(
  list: StudentRecord[],
  orderMode: ParticipantListConfig['orderMode'],
  deskLookup: Map<string, DeskAssignmentInfo>,
): StudentRecord[] {
  return [...list].sort((a, b) => {
    if (orderMode === 'meja_order') {
      const ma = deskLookup.get(a.no)?.mejaNo ?? 9999;
      const mb = deskLookup.get(b.no)?.mejaNo ?? 9999;
      if (ma !== mb) return ma - mb;
      return compareNumericStrings(a.no, b.no);
    }
    if (orderMode === 'nama_alpha') {
      const cmp = a.nama.localeCompare(b.nama, 'id');
      if (cmp !== 0) return cmp;
      return compareNumericStrings(a.no, b.no);
    }
    return compareNumericStrings(a.no, b.no);
  });
}

function formatClassBreakdown(students: StudentRecord[]): string {
  const counts = new Map<string, number>();
  for (const s of students) {
    const k = s.kelas.trim() || 'UMUM';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => compareNumericStrings(a, b))
    .map(([k, n]) => `${k} (${n})`)
    .join(', ');
}

export function computeAutoParticipantRowsPerPage(
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  listCfg: Pick<
    ParticipantListConfig,
    'paperOrientation' | 'marginMm' | 'showYearHeader' | 'showRoomHeader' | 'showTierHeader'
  >,
): number {
  const { paperH } = getSeatingPaperDimensions(paperCfg, listCfg.paperOrientation);
  const usableH = paperH - 2 * Math.max(6, listCfg.marginMm);
  const headerH =
    10 +
    (listCfg.showYearHeader ? 8 : 0) +
    (listCfg.showRoomHeader ? 9 : 0) +
    (listCfg.showTierHeader ? 8 : 0);
  const tableHeaderH = 9;
  const footerGapH = 6;
  const bodyAvail = Math.max(48, usableH - headerH - tableHeaderH - footerGapH);
  const targetRowH = listCfg.paperOrientation === 'landscape' ? 7.6 : 8.1;
  return Math.max(12, Math.min(34, Math.floor(bodyAvail / targetRowH)));
}

export function buildParticipantListGroups(
  allStudents: StudentRecord[],
  filteredCardStudents: StudentRecord[],
  deskLookup: Map<string, DeskAssignmentInfo>,
  listCfg: ParticipantListConfig,
  cardFilterDesc?: string,
  searchQuery?: string,
): ParticipantListGroup[] {
  const q = (searchQuery ?? '').trim().toLowerCase();
  const matchesSearch = (st: StudentRecord): boolean => {
    if (!q) return true;
    const fullNo = formatParticipantNo(st.no).toLowerCase();
    const roomFormatted = formatParticipantRoomLabel(st.ruang, listCfg.useLeadingZeroRoom);
    return (
      st.nama.toLowerCase().includes(q) ||
      st.no.toLowerCase().includes(q) ||
      fullNo.includes(q) ||
      st.kelas.toLowerCase().includes(q) ||
      `ruang ${roomFormatted}`.toLowerCase().includes(q) ||
      `ruang ${normalizeRoomLabel(st.ruang)}`.toLowerCase().includes(q)
    );
  };

  const buildRows = (list: StudentRecord[]): ParticipantListRow[] => {
    const sorted = sortStudentsForList(list, listCfg.orderMode, deskLookup);
    return sorted.map((student, idx) => {
      const desk = deskLookup.get(student.no);
      const ruangNormalized = normalizeRoomLabel(student.ruang);
      return {
        rowNumber: idx + 1,
        student,
        participantNo: formatParticipantNo(student.no),
        ruangNormalized,
        ruangFormatted: formatParticipantRoomLabel(student.ruang, listCfg.useLeadingZeroRoom),
        tier: extractClassTier(student.kelas),
        mejaLabel: desk?.mejaLabel ?? '-',
        mejaNo: desk?.mejaNo ?? idx + 1,
      };
    });
  };

  if (listCfg.groupingMode === 'card_filter') {
    const base = filteredCardStudents.filter(matchesSearch);
    if (base.length === 0) return [];
    const rooms = [...new Set(base.map((s) => formatParticipantRoomLabel(s.ruang, listCfg.useLeadingZeroRoom)))].sort(
      compareNumericStrings,
    );
    const tiers = [...new Set(base.map((s) => extractClassTier(s.kelas)))].sort(
      (a, b) => tierRank(a) - tierRank(b),
    );
    return [
      {
        id: 'CARD-FILTER-BATCH',
        badgeLabel: rooms.length === 1 ? `RUANG ${rooms[0]}` : `${rooms.length} RUANG`,
        primaryHeading:
          rooms.length === 1
            ? `RUANG ${rooms[0]}`
            : (cardFilterDesc || 'SEMUA PESERTA TERFILTER').toUpperCase(),
        secondaryHeading: tiers.length === 1 ? `KELAS ${tiers[0]}` : formatClassBreakdown(base),
        classSummaryText: formatClassBreakdown(base),
        rows: buildRows(base),
      },
    ];
  }

  if (listCfg.groupingMode === 'per_kelas') {
    const byClass = new Map<string, StudentRecord[]>();
    for (const s of allStudents) {
      if (!matchesSearch(s)) continue;
      const k = s.kelas.trim() || 'UMUM';
      if (listCfg.selectedClass && k !== listCfg.selectedClass) continue;
      if (listCfg.selectedTier && extractClassTier(k) !== listCfg.selectedTier) continue;
      if (!byClass.has(k)) byClass.set(k, []);
      byClass.get(k)!.push(s);
    }

    return [...byClass.keys()]
      .sort(compareNumericStrings)
      .map((kelas) => {
        const list = byClass.get(kelas) ?? [];
        const rooms = [
          ...new Set(
            list.map((s) => formatParticipantRoomLabel(s.ruang, listCfg.useLeadingZeroRoom)),
          ),
        ].sort(compareNumericStrings);
        const roomLabel =
          rooms.length === 1 ? `RUANG ${rooms[0]}` : `RUANG ${rooms.join(', ')}`;
        return {
          id: `KELAS-${kelas.replace(/\s+/g, '-')}`,
          badgeLabel: `KELAS ${kelas}`,
          primaryHeading: roomLabel,
          secondaryHeading: `KELAS ${kelas}`,
          classSummaryText: `${list.length} peserta · ${roomLabel}`,
          rows: buildRows(list),
        };
      });
  }

  if (listCfg.groupingMode === 'per_ruang') {
    const byRoom = new Map<string, StudentRecord[]>();
    for (const s of allStudents) {
      if (!matchesSearch(s)) continue;
      const r = normalizeRoomLabel(s.ruang);
      if (listCfg.selectedRoom && r !== listCfg.selectedRoom) continue;
      if (listCfg.selectedTier && extractClassTier(s.kelas) !== listCfg.selectedTier) continue;
      if (!byRoom.has(r)) byRoom.set(r, []);
      byRoom.get(r)!.push(s);
    }

    return [...byRoom.keys()]
      .sort(compareNumericStrings)
      .map((ruangNorm) => {
        const list = byRoom.get(ruangNorm) ?? [];
        const roomDisplay = formatParticipantRoomLabel(ruangNorm, listCfg.useLeadingZeroRoom);
        const tiers = [...new Set(list.map((s) => extractClassTier(s.kelas)))].sort(
          (a, b) => tierRank(a) - tierRank(b),
        );
        return {
          id: `RUANG-${ruangNorm}`,
          badgeLabel: `RUANG ${roomDisplay}`,
          primaryHeading: `RUANG ${roomDisplay}`,
          secondaryHeading:
            tiers.length === 1 ? `KELAS ${tiers[0]}` : `KELAS ${tiers.join(' / ')}`,
          classSummaryText: formatClassBreakdown(list),
          rows: buildRows(list),
        };
      });
  }

  // Default: 'per_ruang_jenjang' -> matches exact template ("RUANG 1" + "KELAS X")
  const byRoom = new Map<string, StudentRecord[]>();
  for (const s of allStudents) {
    if (!matchesSearch(s)) continue;
    const r = normalizeRoomLabel(s.ruang);
    if (listCfg.selectedRoom && r !== listCfg.selectedRoom) continue;
    if (!byRoom.has(r)) byRoom.set(r, []);
    byRoom.get(r)!.push(s);
  }

  const groups: ParticipantListGroup[] = [];
  for (const ruangNorm of [...byRoom.keys()].sort(compareNumericStrings)) {
    const roomList = byRoom.get(ruangNorm) ?? [];
    const roomDisplay = formatParticipantRoomLabel(ruangNorm, listCfg.useLeadingZeroRoom);
    const byTier = new Map<string, StudentRecord[]>();
    for (const s of roomList) {
      const tier = extractClassTier(s.kelas);
      if (listCfg.selectedTier && tier !== listCfg.selectedTier) continue;
      if (!byTier.has(tier)) byTier.set(tier, []);
      byTier.get(tier)!.push(s);
    }

    const sortedTiers = [...byTier.keys()].sort((a, b) => {
      const ra = tierRank(a);
      const rb = tierRank(b);
      return ra !== rb ? ra - rb : compareNumericStrings(a, b);
    });

    for (const tier of sortedTiers) {
      const list = byTier.get(tier) ?? [];
      groups.push({
        id: `RUANG-${ruangNorm}-KELAS-${tier.replace(/\s+/g, '-')}`,
        badgeLabel: `RUANG ${roomDisplay} · KELAS ${tier}`,
        primaryHeading: `RUANG ${roomDisplay}`,
        secondaryHeading: `KELAS ${tier}`,
        classSummaryText: formatClassBreakdown(list),
        rows: buildRows(list),
      });
    }
  }

  return groups;
}

export function buildParticipantListPages(
  allStudents: StudentRecord[],
  filteredCardStudents: StudentRecord[],
  stickerGroupingMode: StickerGroupingMode,
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  listCfg: ParticipantListConfig,
  cardFilterDesc?: string,
  searchQuery?: string,
): {
  pages: ParticipantListPageEntry[];
  groups: ParticipantListGroup[];
  effectiveRowsPerPage: number;
} {
  const deskLookup = buildDeskAssignmentLookup(allStudents, stickerGroupingMode);
  const groups = buildParticipantListGroups(
    allStudents,
    filteredCardStudents,
    deskLookup,
    listCfg,
    cardFilterDesc,
    searchQuery,
  );

  const isFitGroup = listCfg.rowsPerPage === 'fit_group';
  const fixedLimit =
    listCfg.rowsPerPage === 'auto'
      ? computeAutoParticipantRowsPerPage(paperCfg, listCfg)
      : listCfg.rowsPerPage === 'fit_group'
        ? 0
        : listCfg.rowsPerPage;

  const pages: ParticipantListPageEntry[] = [];
  for (const group of groups) {
    const limit = isFitGroup ? Math.max(1, group.rows.length) : fixedLimit;
    const totalPagesInGroup = Math.max(1, Math.ceil(group.rows.length / limit));
    for (let p = 0; p < totalPagesInGroup; p++) {
      const slice = group.rows.slice(p * limit, (p + 1) * limit);
      pages.push({
        key: `${group.id}-p${p + 1}`,
        group,
        pageInGroup: p + 1,
        totalPagesInGroup,
        rows: slice,
      });
    }
  }

  const effectiveRowsPerPage = isFitGroup
    ? Math.max(0, ...groups.map((g) => g.rows.length))
    : fixedLimit;

  return { pages, groups, effectiveRowsPerPage };
}

export function buildParticipantListCsv(groups: ParticipantListGroup[]): string {
  const header = ['Kelompok', 'No', 'No_Peserta', 'Nama', 'Kelas', 'Ruang', 'Meja'].join(',');
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header];

  for (const group of groups) {
    for (const row of group.rows) {
      lines.push(
        [
          csvEscape(group.badgeLabel),
          String(row.rowNumber),
          csvEscape(row.participantNo),
          csvEscape(row.student.nama),
          csvEscape(row.student.kelas),
          csvEscape(`RUANG ${row.ruangFormatted}`),
          csvEscape(row.mejaLabel),
        ].join(','),
      );
    }
  }

  return `\uFEFF${lines.join('\n')}`;
}
