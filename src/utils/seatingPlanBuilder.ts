import type { StudentRecord } from '../data/pasData';
import type {
  PrepressConfig,
  SeatingConfig,
  SeatingNumberingOrder,
  SeatingOrientation,
  SeatingStudentOrder,
  SeatingVariant,
  StickerGroupingMode,
} from '../types/prepress';
import { PAPER_DIMENSIONS } from '../types/prepress';
import {
  buildDeskAssignmentLookup,
  buildDeskStickers,
  compareNumericStrings,
  extractClassTier,
  formatParticipantNo,
  normalizeRoomLabel,
  type DeskStickerRecord,
} from './deskStickerBuilder';

export interface ClassRoomSummary {
  kelas: string;
  count: number;
  firstNo: string;
  lastNo: string;
  firstMeja: string;
  lastMeja: string;
}

export interface RoomSeatingPlan {
  id: string;
  ruang: string;
  badgeLabel: string;
  classLabel?: string;
  subClassListLabel?: string;
  desks: DeskStickerRecord[];
  orderedStudents: StudentRecord[];
  seatDesksByStudentNo: Record<string, { mejaNo: number; mejaLabel: string }>;
  totalDesks: number;
  totalStudents: number;
  classSummaries: ClassRoomSummary[];
}

export interface SeatingPageEntry {
  key: string;
  roomPlan: RoomSeatingPlan;
  mode: 'kelas' | 'panitia';
}

export function getSeatingPaperDimensions(
  paperCfg: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>,
  paperOrientation: 'portrait' | 'landscape',
): { paperW: number; paperH: number } {
  const [rawW, rawH] =
    paperCfg.paper === 'custom'
      ? [Math.max(80, paperCfg.customW), Math.max(80, paperCfg.customH)]
      : [PAPER_DIMENSIONS[paperCfg.paper][0], PAPER_DIMENSIONS[paperCfg.paper][1]];
  if (paperOrientation === 'landscape') {
    return { paperW: Math.max(rawW, rawH), paperH: Math.min(rawW, rawH) };
  }
  return { paperW: Math.min(rawW, rawH), paperH: Math.max(rawW, rawH) };
}

function summarizeClasses(
  students: StudentRecord[],
  seatDesksByStudentNo: Record<string, { mejaNo: number; mejaLabel: string }>,
): ClassRoomSummary[] {
  const classBuckets = new Map<string, StudentRecord[]>();
  for (const st of students) {
    const k = st.kelas || 'UMUM';
    if (!classBuckets.has(k)) classBuckets.set(k, []);
    classBuckets.get(k)!.push(st);
  }
  return [...classBuckets.entries()]
    .sort(([a], [b]) => compareNumericStrings(a, b))
    .map(([kelas, list]) => {
      const sorted = [...list].sort((a, b) => compareNumericStrings(a.no, b.no));
      const mejaNums = sorted
        .map((s) => seatDesksByStudentNo[s.no])
        .filter(Boolean)
        .sort((a, b) => a.mejaNo - b.mejaNo);
      return {
        kelas,
        count: sorted.length,
        firstNo: sorted[0]?.no ?? '-',
        lastNo: sorted[sorted.length - 1]?.no ?? '-',
        firstMeja: mejaNums[0]?.mejaLabel ?? '-',
        lastMeja: mejaNums[mejaNums.length - 1]?.mejaLabel ?? '-',
      };
    });
}

function orderStudentsForPlan(
  rawStudents: StudentRecord[],
  desks: DeskStickerRecord[],
  studentOrder: SeatingStudentOrder,
): StudentRecord[] {
  if ((studentOrder === 'desk_order' || studentOrder === 'interleave_class') && desks.length > 0) {
    const orderedByDesk: StudentRecord[] = [];
    const seen = new Set<string>();
    for (const d of desks) {
      for (const slot of d.slots) {
        if (slot.student && !seen.has(slot.student.no)) {
          seen.add(slot.student.no);
          orderedByDesk.push(slot.student);
        }
      }
    }
    for (const s of rawStudents) {
      if (!seen.has(s.no)) {
        seen.add(s.no);
        orderedByDesk.push(s);
      }
    }
    return orderedByDesk;
  }
  return [...rawStudents].sort((a, b) => compareNumericStrings(a.no, b.no));
}

function classGroupSortRank(label: string): number {
  if (label === 'KELAS X') return 1;
  if (label === 'KELAS XI') return 2;
  if (label === 'KELAS XII') return 3;
  return 99;
}

export function getAvailableSeatingClassOptions(
  students: StudentRecord[],
  classGrouping: SeatingConfig['classGrouping'],
  selectedRoom?: string,
): string[] {
  const keys = new Set<string>();
  for (const s of students) {
    if (selectedRoom && normalizeRoomLabel(s.ruang) !== selectedRoom) continue;
    const key =
      classGrouping === 'tier_per_room'
        ? `KELAS ${extractClassTier(s.kelas)}`
        : s.kelas.trim() || 'UMUM';
    keys.add(key);
  }
  return [...keys].sort((a, b) => {
    const ra = classGroupSortRank(a);
    const rb = classGroupSortRank(b);
    if (ra !== rb) return ra - rb;
    return compareNumericStrings(a, b);
  });
}

export function buildRoomSeatingPlans(
  allStudents: StudentRecord[],
  filteredCardStudents: StudentRecord[],
  groupingMode: StickerGroupingMode,
  seatingCfg: Pick<
    SeatingConfig,
    'seatingMode' | 'classGrouping' | 'selectedClassTier' | 'dataSource' | 'selectedRoom' | 'studentOrder'
  >,
  cardFilterDesc?: string,
): RoomSeatingPlan[] {
  const globalDeskLookup = buildDeskAssignmentLookup(allStudents, groupingMode);
  const buildSeatMap = (list: StudentRecord[]) => {
    const out: Record<string, { mejaNo: number; mejaLabel: string }> = {};
    for (const s of list) {
      const found = globalDeskLookup.get(s.no);
      if (found) out[s.no] = { mejaNo: found.mejaNo, mejaLabel: found.mejaLabel };
    }
    return out;
  };

  if (seatingCfg.seatingMode === 'per_kelas') {
    const sourcePool =
      seatingCfg.dataSource === 'card_filter' ? filteredCardStudents : allStudents;
    const roomFilter =
      seatingCfg.dataSource === 'room' ? seatingCfg.selectedRoom || undefined : undefined;
    const classFilter = seatingCfg.selectedClassTier || undefined;

    const byRoom = new Map<string, StudentRecord[]>();
    for (const s of sourcePool) {
      const r = normalizeRoomLabel(s.ruang);
      if (roomFilter && r !== roomFilter) continue;
      if (!byRoom.has(r)) byRoom.set(r, []);
      byRoom.get(r)!.push(s);
    }

    const sortedRooms = [...byRoom.keys()].sort(compareNumericStrings);
    const plans: RoomSeatingPlan[] = [];

    for (const ruang of sortedRooms) {
      const roomList = byRoom.get(ruang) ?? [];
      const classBuckets = new Map<string, StudentRecord[]>();
      for (const s of roomList) {
        const key =
          seatingCfg.classGrouping === 'tier_per_room'
            ? `KELAS ${extractClassTier(s.kelas)}`
            : s.kelas.trim() || 'UMUM';
        if (classFilter && key !== classFilter) continue;
        if (!classBuckets.has(key)) classBuckets.set(key, []);
        classBuckets.get(key)!.push(s);
      }

      const sortedClassKeys = [...classBuckets.keys()].sort((a, b) => {
        const ra = classGroupSortRank(a);
        const rb = classGroupSortRank(b);
        if (ra !== rb) return ra - rb;
        return compareNumericStrings(a, b);
      });

      for (const classKey of sortedClassKeys) {
        const groupStudents = [...(classBuckets.get(classKey) ?? [])].sort((a, b) => {
          if (seatingCfg.studentOrder === 'desk_order') {
            const ma = globalDeskLookup.get(a.no)?.mejaNo ?? 9999;
            const mb = globalDeskLookup.get(b.no)?.mejaNo ?? 9999;
            if (ma !== mb) return ma - mb;
          }
          return compareNumericStrings(a.no, b.no);
        });
        const seatDesksByStudentNo = buildSeatMap(groupStudents);
        const subClassListLabel = [...new Set(groupStudents.map((s) => s.kelas))]
          .sort(compareNumericStrings)
          .join(', ');
        const desks = buildDeskStickers(groupStudents, groupingMode);

        plans.push({
          id: `ROOM-${ruang}-${classKey.replace(/\s+/g, '-')}`,
          ruang,
          badgeLabel: `RUANG ${ruang} · ${classKey}`,
          classLabel: classKey,
          subClassListLabel,
          desks,
          orderedStudents: groupStudents,
          seatDesksByStudentNo,
          totalDesks: groupStudents.length,
          totalStudents: groupStudents.length,
          classSummaries: summarizeClasses(groupStudents, seatDesksByStudentNo),
        });
      }
    }

    return plans;
  }

  if (
    seatingCfg.dataSource === 'card_filter' &&
    filteredCardStudents.length > 0 &&
    filteredCardStudents.length <= 72
  ) {
    const desks = buildDeskStickers(filteredCardStudents, groupingMode);
    const orderedStudents = orderStudentsForPlan(
      filteredCardStudents,
      desks,
      seatingCfg.studentOrder,
    );
    const seatDesksByStudentNo = buildSeatMap(orderedStudents);
    const uniqueRooms = [
      ...new Set(filteredCardStudents.map((s) => normalizeRoomLabel(s.ruang))),
    ].sort(compareNumericStrings);
    const roomText =
      uniqueRooms.length === 1 ? uniqueRooms[0] : `${uniqueRooms[0]}–${uniqueRooms[uniqueRooms.length - 1]}`;
    return [
      {
        id: 'CARD-FILTER-BATCH',
        ruang: roomText,
        badgeLabel: cardFilterDesc || (uniqueRooms.length === 1 ? `RUANG ${roomText}` : 'FILTER KARTU'),
        desks,
        orderedStudents,
        seatDesksByStudentNo,
        totalDesks: desks.length,
        totalStudents: orderedStudents.length,
        classSummaries: summarizeClasses(orderedStudents, seatDesksByStudentNo),
      },
    ];
  }

  const sourcePool =
    seatingCfg.dataSource === 'card_filter' ? filteredCardStudents : allStudents;
  const roomFilter =
    seatingCfg.dataSource === 'room' ? seatingCfg.selectedRoom || undefined : undefined;

  const stickers = buildDeskStickers(sourcePool, groupingMode, roomFilter);
  const desksByRoom = new Map<string, DeskStickerRecord[]>();
  for (const st of stickers) {
    if (!desksByRoom.has(st.ruang)) desksByRoom.set(st.ruang, []);
    desksByRoom.get(st.ruang)!.push(st);
  }

  const studentsByRoom = new Map<string, StudentRecord[]>();
  for (const s of sourcePool) {
    const r = normalizeRoomLabel(s.ruang);
    if (roomFilter && r !== roomFilter) continue;
    if (!studentsByRoom.has(r)) studentsByRoom.set(r, []);
    studentsByRoom.get(r)!.push(s);
  }

  const rooms = [...studentsByRoom.keys()].sort(compareNumericStrings);

  return rooms.map((ruang) => {
    const desks = desksByRoom.get(ruang) ?? [];
    const roomStudents = studentsByRoom.get(ruang) ?? [];
    const orderedStudents = orderStudentsForPlan(
      roomStudents,
      desks,
      seatingCfg.studentOrder,
    );
    const seatDesksByStudentNo = buildSeatMap(orderedStudents);

    return {
      id: `ROOM-${ruang}`,
      ruang,
      badgeLabel: `RUANG ${ruang}`,
      desks,
      orderedStudents,
      seatDesksByStudentNo,
      totalDesks: desks.length,
      totalStudents: orderedStudents.length,
      classSummaries: summarizeClasses(orderedStudents, seatDesksByStudentNo),
    };
  });
}

export interface GridMatrixResult<T> {
  cols: number;
  rows: number;
  cells: Array<Array<{ item: T | null; placeholderNo: number }>>;
}

export function placeItemsInGrid<T>(
  items: T[],
  requestedCols: number,
  numberingOrder: SeatingNumberingOrder,
  orientation: SeatingOrientation,
): GridMatrixResult<T> {
  const cols = Math.max(2, Math.min(10, requestedCols || 4));
  const rows = Math.max(1, Math.ceil(items.length / cols));

  const matrix: Array<Array<{ item: T | null; placeholderNo: number }>> = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => ({ item: null, placeholderNo: 0 })),
  );

  const totalSlots = cols * rows;
  for (let idx = 0; idx < totalSlots; idx++) {
    let col = 0;
    let rowFromFront = 0;

    if (numberingOrder === 'snake_col') {
      col = Math.floor(idx / rows);
      const posInCol = idx % rows;
      const colStart = col * rows;
      const occupiedInCol = Math.max(0, Math.min(rows, items.length - colStart));
      if (col % 2 === 1 && posInCol < occupiedInCol) {
        rowFromFront = occupiedInCol - 1 - posInCol;
      } else {
        rowFromFront = posInCol;
      }
    } else if (numberingOrder === 'col_top') {
      col = Math.floor(idx / rows);
      rowFromFront = idx % rows;
    } else {
      rowFromFront = Math.floor(idx / cols);
      col = idx % cols;
    }

    const displayRow = orientation === 'front_bottom' ? rows - 1 - rowFromFront : rowFromFront;
    const item = items[idx] ?? null;
    matrix[displayRow][col] = {
      item,
      placeholderNo: idx + 1,
    };
  }

  return { cols, rows, cells: matrix };
}

export interface DeskGridResult {
  cols: number;
  rows: number;
  cells: Array<Array<{ desk: DeskStickerRecord | null; placeholderNo: number }>>;
}

export function placeDesksInGrid(
  desks: DeskStickerRecord[],
  requestedCols: number,
  numberingOrder: SeatingNumberingOrder,
  orientation: SeatingOrientation,
): DeskGridResult {
  const generic = placeItemsInGrid(desks, requestedCols, numberingOrder, orientation);
  return {
    cols: generic.cols,
    rows: generic.rows,
    cells: generic.cells.map((row) =>
      row.map((cell) => ({
        desk: cell.item,
        placeholderNo: cell.placeholderNo,
      })),
    ),
  };
}

export function buildSeatingPages(
  plans: RoomSeatingPlan[],
  variant: SeatingVariant,
): SeatingPageEntry[] {
  const pages: SeatingPageEntry[] = [];
  for (const roomPlan of plans) {
    if (variant === 'kelas' || variant === 'both') {
      pages.push({
        key: `${roomPlan.id}-kelas`,
        roomPlan,
        mode: 'kelas',
      });
    }
    if (variant === 'panitia' || variant === 'both') {
      pages.push({
        key: `${roomPlan.id}-panitia`,
        roomPlan,
        mode: 'panitia',
      });
    }
  }
  return pages;
}

export function buildCommitteeSummaryCsv(
  plans: RoomSeatingPlan[],
  seatingMode: SeatingConfig['seatingMode'],
): string {
  const lines = ['Ruang,Mode_Denah,Jumlah_Posisi,Total_Peserta,Rincian_Kelas,Daftar_Penempatan'];
  const isCardPerSeat = seatingMode === 'student_card' || seatingMode === 'per_kelas';
  for (const p of plans) {
    const classStr = p.classSummaries
      .map((c) => `${c.kelas} (${c.firstNo}-${c.lastNo} | ${c.firstMeja}-${c.lastMeja}: ${c.count})`)
      .join(' | ');
    const listStr = isCardPerSeat
      ? p.orderedStudents
          .map((s, idx) => {
            const meja = p.seatDesksByStudentNo[s.no]?.mejaLabel ?? '-';
            return `Kursi ${String(idx + 1).padStart(2, '0')} [${meja}]=[${s.kelas}:${formatParticipantNo(s.no)} ${s.nama} | User:${s.user}]`;
          })
          .join(' ; ')
      : p.desks
          .map((d) => {
            const names = d.slots
              .filter((s) => s.student)
              .map(
                (s) =>
                  `${s.student!.kelas}:${formatParticipantNo(s.student!.no)} ${s.student!.nama} (User:${s.student!.user})`,
              )
              .join(' / ');
            return `${d.mejaLabel}=[${names}]`;
          })
          .join(' ; ');
    lines.push(
      [
        `"${p.badgeLabel}"`,
        `"${
          seatingMode === 'per_kelas'
            ? 'Denah Per Kelas'
            : seatingMode === 'student_card'
              ? 'Kartu per Kursi + Urutan Meja'
              : 'Meja Gabungan X/XI/XII'
        }"`,
        String(isCardPerSeat ? p.totalStudents : p.totalDesks),
        String(p.totalStudents),
        `"${classStr.replace(/"/g, '""')}"`,
        `"${listStr.replace(/"/g, '""')}"`,
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function describeNumberingOrder(order: SeatingConfig['numberingOrder']): string {
  if (order === 'snake_col') return 'Zig-Zag / Ular per Banjar';
  if (order === 'col_top') return 'Lurus Depan → Belakang per Banjar';
  return 'Lurus Kiri → Kanan per Baris';
}
