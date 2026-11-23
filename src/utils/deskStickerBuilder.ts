import type { StudentRecord } from '../data/pasData';
import type { StickerGroupingMode } from '../types/prepress';

export interface DeskStickerSlot {
  groupLabel: string; // e.g. 'X', 'XI', 'XII', or specific class label
  student: StudentRecord | null;
}

export interface DeskStickerRecord {
  id: string;
  ruang: string;
  mejaNo: number;
  mejaLabel: string;
  slots: DeskStickerSlot[];
}

export function formatParticipantNo(no: string): string {
  const clean = no.trim();
  if (!clean) return '2026/SMAN 1 ALALAK/---';
  if (clean.includes('/')) return clean;
  return `2026/SMAN 1 ALALAK/${clean}`;
}

export function normalizeRoomLabel(ruang: string): string {
  const raw = ruang.trim();
  if (!raw) return '01';
  const num = Number(raw);
  if (!Number.isNaN(num) && /^\d+$/.test(raw) && num < 10 && raw.length === 1) {
    return `0${num}`;
  }
  return raw;
}

export function compareNumericStrings(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
    return na - nb;
  }
  return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
}

export function extractClassTier(kelas: string): string {
  const k = kelas.trim().toUpperCase();
  if (k.startsWith('XII') || /^12(\b|\s|-|$)/.test(k)) return 'XII';
  if (k.startsWith('XI') || /^11(\b|\s|-|$)/.test(k)) return 'XI';
  if (k.startsWith('X') || /^10(\b|\s|-|$)/.test(k)) return 'X';
  return k || 'UMUM';
}

function tierSortRank(tier: string): number {
  if (tier === 'X') return 1;
  if (tier === 'XI') return 2;
  if (tier === 'XII') return 3;
  return 9;
}

export function getSortedRoomList(students: StudentRecord[]): string[] {
  const rooms = new Set<string>();
  for (const s of students) {
    rooms.add(normalizeRoomLabel(s.ruang));
  }
  return [...rooms].sort(compareNumericStrings);
}

export function buildDeskStickers(
  students: StudentRecord[],
  groupingMode: StickerGroupingMode,
  roomFilter?: string,
): DeskStickerRecord[] {
  const byRoom = new Map<string, StudentRecord[]>();
  for (const s of students) {
    const room = normalizeRoomLabel(s.ruang);
    if (roomFilter && room !== roomFilter) continue;
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room)!.push(s);
  }

  const sortedRooms = [...byRoom.keys()].sort(compareNumericStrings);
  const result: DeskStickerRecord[] = [];

  for (const room of sortedRooms) {
    const roomStudents = [...(byRoom.get(room) ?? [])].sort((a, b) =>
      compareNumericStrings(a.no, b.no),
    );

    const groupMap = new Map<string, StudentRecord[]>();
    for (const st of roomStudents) {
      const key =
        groupingMode === 'tier_room' ? extractClassTier(st.kelas) : st.kelas.trim() || 'UMUM';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(st);
    }

    const groupKeys = [...groupMap.keys()].sort((a, b) => {
      if (groupingMode === 'tier_room') {
        const ra = tierSortRank(a);
        const rb = tierSortRank(b);
        if (ra !== rb) return ra - rb;
      }
      return compareNumericStrings(a, b);
    });

    const maxDesks = Math.max(0, ...groupKeys.map((k) => groupMap.get(k)?.length ?? 0));
    for (let i = 0; i < maxDesks; i++) {
      const mejaNo = i + 1;
      const mejaStr = String(mejaNo).padStart(2, '0');
      const slots: DeskStickerSlot[] = groupKeys.map((gk) => ({
        groupLabel: gk,
        student: groupMap.get(gk)?.[i] ?? null,
      }));
      result.push({
        id: `${room}-MEJA-${mejaStr}`,
        ruang: room,
        mejaNo,
        mejaLabel: `MEJA ${mejaStr}`,
        slots,
      });
    }
  }

  return result;
}

export function buildDeskAssignmentLookup(
  students: StudentRecord[],
  groupingMode: StickerGroupingMode,
): Map<string, { ruang: string; mejaNo: number; mejaLabel: string }> {
  const stickers = buildDeskStickers(students, groupingMode);
  const map = new Map<string, { ruang: string; mejaNo: number; mejaLabel: string }>();
  for (const st of stickers) {
    for (const slot of st.slots) {
      if (slot.student) {
        map.set(slot.student.no, {
          ruang: st.ruang,
          mejaNo: st.mejaNo,
          mejaLabel: st.mejaLabel,
        });
      }
    }
  }
  return map;
}

export function buildDeskStickerCsv(stickers: DeskStickerRecord[]): string {
  const maxSlots = Math.max(1, ...stickers.map((s) => s.slots.length));
  const headers = ['Ruang', 'Meja'];
  for (let i = 1; i <= maxSlots; i++) {
    headers.push(`Kelas_${i}`, `No_Peserta_${i}`, `Nama_${i}`);
  }
  const lines = [headers.join(',')];
  for (const st of stickers) {
    const row = [`"RUANG ${st.ruang}"`, `"${st.mejaLabel}"`];
    for (let i = 0; i < maxSlots; i++) {
      const slot = st.slots[i];
      if (slot?.student) {
        row.push(
          `"${slot.student.kelas}"`,
          `"${formatParticipantNo(slot.student.no)}"`,
          `"${slot.student.nama.replace(/"/g, '""')}"`,
        );
      } else {
        row.push('""', '""', '""');
      }
    }
    lines.push(row.join(','));
  }
  return lines.join('\n');
}
