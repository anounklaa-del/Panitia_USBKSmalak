import { type ScheduleRow, type StudentRecord } from '../data/pasData';
import type { AttendanceConfig, PrepressConfig } from '../types/prepress';
import {
  buildDeskAssignmentLookup,
  compareNumericStrings,
  extractClassTier,
  formatParticipantNo,
  normalizeRoomLabel,
} from './deskStickerBuilder';
import { getLiveSchedulesMap } from './scheduleStore';
import { getSeatingPaperDimensions } from './seatingPlanBuilder';

type DeskAssignmentInfo = { ruang: string; mejaNo: number; mejaLabel: string };

export interface AttendanceRowItem {
  rowNumber: number;
  student: StudentRecord;
  ruang: string;
  mejaLabel: string;
  mejaNo: number;
}

export interface AttendanceGroup {
  id: string;
  badgeLabel: string;
  groupKind: 'RUANG' | 'KELAS' | 'FILTER';
  groupTitle: string;
  classSummaryText: string;
  rows: AttendanceRowItem[];
}

export interface AttendancePageEntry {
  key: string;
  group: AttendanceGroup;
  pageInGroup: number;
  totalPagesInGroup: number;
  isLastPageOfGroup: boolean;
  rows: AttendanceRowItem[];
}

export interface ScheduleSessionOption {
  id: string;
  date: string;
  time: string;
  subject: string;
  tiersLabel: string;
}

export function getSortedClassList(students: StudentRecord[]): string[] {
  return [...new Set(students.map((s) => s.kelas.trim()).filter(Boolean))].sort(compareNumericStrings);
}

export function getAvailableScheduleSessions(
  schedulesMap?: Record<string, ScheduleRow[]>,
): ScheduleSessionOption[] {
  const source = schedulesMap ?? getLiveSchedulesMap();
  const map = new Map<string, { date: string; time: string; subject: string; tiers: Set<string> }>();
  for (const [kelas, rows] of Object.entries(source)) {
    const tier = extractClassTier(kelas);
    for (const [date, time, subject] of rows) {
      const key = `${date}|${time}|${subject}`;
      if (!map.has(key)) {
        map.set(key, { date, time, subject, tiers: new Set() });
      }
      if (tier) map.get(key)!.tiers.add(tier);
    }
  }
  return [...map.entries()].map(([id, info]) => ({
    id,
    date: info.date,
    time: info.time,
    subject: info.subject,
    tiersLabel: [...info.tiers].sort().join('/'),
  }));
}

export function computeAutoAttendanceRowsPerPage(
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  attendanceCfg: Pick<
    AttendanceConfig,
    'paperOrientation' | 'marginMm' | 'showSchoolHeader' | 'showSummaryAndSignatures'
  >,
): number {
  const { paperH } = getSeatingPaperDimensions(paperCfg, attendanceCfg.paperOrientation);
  const usableH = paperH - 2 * Math.max(4, attendanceCfg.marginMm);
  const kopH = attendanceCfg.showSchoolHeader ? 22 : 10;
  const sessionH = 15;
  const tableHeaderH = 7;
  const footerH = attendanceCfg.showSummaryAndSignatures ? 38 : 6;
  const gapsH = 8;
  const bodyAvail = Math.max(48, usableH - kopH - sessionH - tableHeaderH - footerH - gapsH);
  const targetRowH = attendanceCfg.paperOrientation === 'landscape' ? 6.2 : 6.6;
  return Math.max(12, Math.min(36, Math.floor(bodyAvail / targetRowH)));
}

function sortAttendanceStudents(
  list: StudentRecord[],
  orderMode: AttendanceConfig['orderMode'],
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
    const k = s.kelas || 'UMUM';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => compareNumericStrings(a, b))
    .map(([k, n]) => `${k} (${n})`)
    .join(', ');
}

export function buildAttendanceGroups(
  allStudents: StudentRecord[],
  filteredCardStudents: StudentRecord[],
  deskLookup: Map<string, DeskAssignmentInfo>,
  attendanceCfg: AttendanceConfig,
  cardFilterDesc?: string,
): AttendanceGroup[] {
  const buildRows = (list: StudentRecord[]): AttendanceRowItem[] => {
    const sorted = sortAttendanceStudents(list, attendanceCfg.orderMode, deskLookup);
    return sorted.map((student, idx) => {
      const desk = deskLookup.get(student.no);
      return {
        rowNumber: idx + 1,
        student,
        ruang: normalizeRoomLabel(student.ruang),
        mejaLabel: desk?.mejaLabel ?? '-',
        mejaNo: desk?.mejaNo ?? idx + 1,
      };
    });
  };

  if (attendanceCfg.groupingMode === 'card_filter') {
    if (filteredCardStudents.length === 0) return [];
    const rows = buildRows(filteredCardStudents);
    const rooms = [...new Set(filteredCardStudents.map((s) => normalizeRoomLabel(s.ruang)))].sort(
      compareNumericStrings,
    );
    return [
      {
        id: 'FILTER-BATCH',
        badgeLabel: rooms.length === 1 ? `RUANG ${rooms[0]}` : `${rooms.length} RUANG`,
        groupKind: 'FILTER',
        groupTitle: cardFilterDesc || 'Filter Kartu Peserta Aktif',
        classSummaryText: formatClassBreakdown(filteredCardStudents),
        rows,
      },
    ];
  }

  if (attendanceCfg.groupingMode === 'per_ruang_jenjang') {
    const tierOrder = (k: string) => (k === 'KELAS X' ? 1 : k === 'KELAS XI' ? 2 : k === 'KELAS XII' ? 3 : 9);
    const byRoom = new Map<string, StudentRecord[]>();
    for (const s of allStudents) {
      const r = normalizeRoomLabel(s.ruang);
      if (attendanceCfg.selectedRoom && r !== attendanceCfg.selectedRoom) continue;
      if (!byRoom.has(r)) byRoom.set(r, []);
      byRoom.get(r)!.push(s);
    }
    const groups: AttendanceGroup[] = [];
    for (const ruang of [...byRoom.keys()].sort(compareNumericStrings)) {
      const roomList = byRoom.get(ruang) ?? [];
      const byTier = new Map<string, StudentRecord[]>();
      for (const s of roomList) {
        const tierKey = `KELAS ${extractClassTier(s.kelas)}`;
        if (!byTier.has(tierKey)) byTier.set(tierKey, []);
        byTier.get(tierKey)!.push(s);
      }
      const sortedTiers = [...byTier.keys()].sort((a, b) => {
        const ra = tierOrder(a);
        const rb = tierOrder(b);
        return ra !== rb ? ra - rb : compareNumericStrings(a, b);
      });
      for (const tierKey of sortedTiers) {
        const list = byTier.get(tierKey) ?? [];
        groups.push({
          id: `RUANG-${ruang}-${tierKey.replace(/\s+/g, '-')}`,
          badgeLabel: `RUANG ${ruang} · ${tierKey}`,
          groupKind: 'RUANG',
          groupTitle: `Ruang ${ruang} · ${tierKey}`,
          classSummaryText: formatClassBreakdown(list),
          rows: buildRows(list),
        });
      }
    }
    return groups;
  }

  if (attendanceCfg.groupingMode === 'per_kelas') {
    const byClass = new Map<string, StudentRecord[]>();
    for (const s of allStudents) {
      const k = s.kelas.trim() || 'UMUM';
      if (attendanceCfg.selectedClass && k !== attendanceCfg.selectedClass) continue;
      if (!byClass.has(k)) byClass.set(k, []);
      byClass.get(k)!.push(s);
    }
    return [...byClass.keys()]
      .sort(compareNumericStrings)
      .map((kelas) => {
        const list = byClass.get(kelas) ?? [];
        const rooms = [...new Set(list.map((s) => normalizeRoomLabel(s.ruang)))].sort(
          compareNumericStrings,
        );
        return {
          id: `KELAS-${kelas.replace(/\s+/g, '-')}`,
          badgeLabel: `KELAS ${kelas}`,
          groupKind: 'KELAS' as const,
          groupTitle: `Kelas ${kelas}`,
          classSummaryText:
            rooms.length > 0 ? `Ruang Ujian: ${rooms.map((r) => `R.${r}`).join(', ')}` : '-',
          rows: buildRows(list),
        };
      });
  }

  // Default: per_ruang
  const byRoom = new Map<string, StudentRecord[]>();
  for (const s of allStudents) {
    const r = normalizeRoomLabel(s.ruang);
    if (attendanceCfg.selectedRoom && r !== attendanceCfg.selectedRoom) continue;
    if (!byRoom.has(r)) byRoom.set(r, []);
    byRoom.get(r)!.push(s);
  }
  return [...byRoom.keys()]
    .sort(compareNumericStrings)
    .map((ruang) => {
      const list = byRoom.get(ruang) ?? [];
      return {
        id: `RUANG-${ruang}`,
        badgeLabel: `RUANG ${ruang}`,
        groupKind: 'RUANG' as const,
        groupTitle: `Ruang Ujian ${ruang}`,
        classSummaryText: formatClassBreakdown(list),
        rows: buildRows(list),
      };
    });
}

export function buildAttendancePages(
  allStudents: StudentRecord[],
  filteredCardStudents: StudentRecord[],
  groupingMode: 'tier_room' | 'class_room',
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  attendanceCfg: AttendanceConfig,
  cardFilterDesc?: string,
): { pages: AttendancePageEntry[]; groups: AttendanceGroup[]; effectiveRowsPerPage: number } {
  const deskLookup = buildDeskAssignmentLookup(allStudents, groupingMode);
  const groups = buildAttendanceGroups(
    allStudents,
    filteredCardStudents,
    deskLookup,
    attendanceCfg,
    cardFilterDesc,
  );
  const isFitGroup = attendanceCfg.rowsPerPage === 'fit_group';
  const fixedLimit =
    attendanceCfg.rowsPerPage === 'auto'
      ? computeAutoAttendanceRowsPerPage(paperCfg, attendanceCfg)
      : attendanceCfg.rowsPerPage === 'fit_group'
        ? 0
        : attendanceCfg.rowsPerPage;

  const pages: AttendancePageEntry[] = [];
  for (const group of groups) {
    const limit = isFitGroup ? Math.max(1, group.rows.length) : fixedLimit;
    const totalPagesInGroup = Math.max(1, Math.ceil(group.rows.length / limit));
    for (let p = 0; p < totalPagesInGroup; p++) {
      const slice = group.rows
        .slice(p * limit, (p + 1) * limit)
        .map((item, idx) => ({
          ...item,
          rowNumber: idx + 1,
        }));
      pages.push({
        key: `${group.id}-p${p + 1}`,
        group,
        pageInGroup: p + 1,
        totalPagesInGroup,
        isLastPageOfGroup: p === totalPagesInGroup - 1,
        rows: slice,
      });
    }
  }

  const effectiveRowsPerPage = isFitGroup
    ? Math.max(0, ...groups.map((g) => g.rows.length))
    : fixedLimit;

  return { pages, groups, effectiveRowsPerPage };
}

export function buildAttendanceCsv(
  groups: AttendanceGroup[],
  attendanceCfg: AttendanceConfig,
): string {
  const header = [
    'Kelompok',
    'No_Urut',
    'Nomor_Peserta',
    'Nama_Peserta',
    'Kelas',
    'Ruang',
    'No_Meja',
    'Mata_Pelajaran',
    'Hari_Tanggal',
    'Waktu',
    'Paraf_Kehadiran',
    'Keterangan',
  ].join(',');

  const lines = [header];
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  for (const g of groups) {
    for (const row of g.rows) {
      lines.push(
        [
          csvEscape(g.badgeLabel),
          String(row.rowNumber),
          csvEscape(
            attendanceCfg.showFullParticipantNo
              ? formatParticipantNo(row.student.no)
              : row.student.no,
          ),
          csvEscape(row.student.nama),
          csvEscape(row.student.kelas),
          csvEscape(`RUANG ${row.ruang}`),
          csvEscape(row.mejaLabel),
          csvEscape(attendanceCfg.subjectName || ''),
          csvEscape(attendanceCfg.examDate || ''),
          csvEscape(attendanceCfg.examTime || ''),
          '""',
          '""',
        ].join(','),
      );
    }
  }
  return `\uFEFF${lines.join('\n')}`;
}
