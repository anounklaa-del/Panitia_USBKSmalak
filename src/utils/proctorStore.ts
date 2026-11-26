import type { ScheduleRow, StudentRecord } from '../data/pasData';
import {
  PROCTOR_MATRIX_MASTER,
  PROCTORS_MASTER,
  type ProctorMatrixSession,
  type ProctorRecord,
} from '../data/proctorData';
import { extractClassTier, normalizeRoomLabel } from './deskStickerBuilder';
import {
  getLiveSchedulesMap,
  parseIndonesianDate,
  parseStartMinutes,
  toIsoDateKey,
  type ExamScheduleEntry,
} from './scheduleStore';

export const PROCTORS_STORAGE_KEY = 'pas_proctors_v1';
export const PROCTOR_MATRIX_STORAGE_KEY = 'pas_proctor_matrix_v2';

export interface ProctorDutyItem {
  sessionId: string;
  dayNo: number;
  date: string;
  shortDate: string;
  jamKe: 1 | 2 | 3;
  time: string;
  roomNo: number; // 1..10
  roomLabel: string; // "R. 01"
  subjects: string[];
  classes: string[];
}

export interface MatrixSessionScheduleMeta {
  subjects: string[];
  tiers: string[];
  classes: string[];
  summaryLabel: string;
  activeRoomCount: number;
}

let liveProctorsCache: ProctorRecord[] | null = null;
let liveMatrixCache: ProctorMatrixSession[] | null = null;

export function syncLiveProctorCache(
  proctors: ProctorRecord[],
  matrix: ProctorMatrixSession[],
) {
  liveProctorsCache = proctors;
  liveMatrixCache = matrix;
}

export function loadProctors(): ProctorRecord[] {
  try {
    const raw = localStorage.getItem(PROCTORS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        liveProctorsCache = parsed as ProctorRecord[];
        return parsed as ProctorRecord[];
      }
    }
  } catch {
    // ignore storage errors
  }
  liveProctorsCache = PROCTORS_MASTER;
  return PROCTORS_MASTER;
}

export function saveProctors(list: ProctorRecord[]) {
  liveProctorsCache = list;
  try {
    localStorage.setItem(PROCTORS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function resetProctorsToDefault(): ProctorRecord[] {
  liveProctorsCache = PROCTORS_MASTER;
  try {
    localStorage.removeItem(PROCTORS_STORAGE_KEY);
  } catch {
    // ignore
  }
  return PROCTORS_MASTER;
}

export function sortAndRenumberProctorMatrix(
  matrix: ProctorMatrixSession[],
): ProctorMatrixSession[] {
  if (matrix.length === 0) return [];
  const sorted = [...matrix].sort((a, b) => {
    const isoA = toIsoDateKey(a.date);
    const isoB = toIsoDateKey(b.date);
    if (isoA !== isoB) return isoA.localeCompare(isoB);
    const tA = parseStartMinutes(a.time);
    const tB = parseStartMinutes(b.time);
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id, 'id');
  });

  const dayOrder: string[] = [];
  const daySlotCounts = new Map<string, number>();

  return sorted.map((sess) => {
    const iso = toIsoDateKey(sess.date);
    let dayIdx = dayOrder.indexOf(iso);
    if (dayIdx === -1) {
      dayIdx = dayOrder.length;
      dayOrder.push(iso);
    }
    const dayNo = dayIdx + 1;
    const slotIdxInDay = daySlotCounts.get(iso) ?? 0;
    daySlotCounts.set(iso, slotIdxInDay + 1);

    const parsedDate = parseIndonesianDate(sess.date);
    const isFriday = parsedDate?.getDay() === 5;
    const jamKe: 1 | 2 | 3 =
      sess.jamKe === 1 || sess.jamKe === 2 || sess.jamKe === 3
        ? sess.jamKe
        : deriveJamKe(parseStartMinutes(sess.time), slotIdxInDay, isFriday);

    const rooms: Array<number | null> = Array.from({ length: 10 }, (_, idx) => {
      const val = sess.rooms?.[idx];
      return typeof val === 'number' && Number.isFinite(val) ? val : null;
    });

    return {
      ...sess,
      id: `d${dayNo}-s${slotIdxInDay + 1}`,
      dayNo,
      dayLabel: formatMatrixDayLabel(sess.date),
      shortDate: formatMatrixShortDate(sess.date),
      jamKe,
      time: normalizeMatrixTime(sess.time),
      rooms,
    };
  });
}

export function loadProctorMatrix(): ProctorMatrixSession[] {
  try {
    const raw = localStorage.getItem(PROCTOR_MATRIX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = sortAndRenumberProctorMatrix(parsed as ProctorMatrixSession[]);
        liveMatrixCache = normalized;
        return normalized;
      }
    }
  } catch {
    // ignore storage errors
  }
  liveMatrixCache = PROCTOR_MATRIX_MASTER;
  return PROCTOR_MATRIX_MASTER;
}

export function saveProctorMatrix(matrix: ProctorMatrixSession[]) {
  const normalized = sortAndRenumberProctorMatrix(matrix);
  liveMatrixCache = normalized;
  try {
    localStorage.setItem(PROCTOR_MATRIX_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function resetProctorMatrixToDefault(): ProctorMatrixSession[] {
  liveMatrixCache = PROCTOR_MATRIX_MASTER;
  try {
    localStorage.removeItem(PROCTOR_MATRIX_STORAGE_KEY);
  } catch {
    // ignore
  }
  return PROCTOR_MATRIX_MASTER;
}

export function getLiveProctors(): ProctorRecord[] {
  if (liveProctorsCache) return liveProctorsCache;
  return loadProctors();
}

export function getLiveProctorMatrix(): ProctorMatrixSession[] {
  if (liveMatrixCache) return liveMatrixCache;
  return loadProctorMatrix();
}

const UPPER_DAY_NAMES = [
  'MINGGU',
  'SENIN',
  'SELASA',
  'RABU',
  'KAMIS',
  "JUM'AT",
  'SABTU',
];
const EN_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatMatrixShortDate(dateStr: string): string {
  const d = parseIndonesianDate(dateStr);
  if (!d) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = EN_MONTH_SHORT[d.getMonth()] ?? 'Nov';
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mon}-${yy}`;
}

function formatMatrixDayLabel(dateStr: string): string {
  const d = parseIndonesianDate(dateStr);
  if (!d) return dateStr.split(',')[0]?.trim().toUpperCase() || '-';
  return UPPER_DAY_NAMES[d.getDay()] ?? 'SENIN';
}

function normalizeMatrixTime(timeStr: string): string {
  return timeStr.replace(/\s*[–—-]\s*/g, ' - ').trim();
}

function deriveJamKe(startMinutes: number, daySlotIdx: number, isFriday: boolean): 1 | 2 | 3 {
  if (startMinutes >= 470 && startMinutes <= 510) return 1; // ~08.00
  if (startMinutes >= 545 && startMinutes <= 585) return 2; // ~09.15
  if (startMinutes >= 615 && startMinutes <= 655) return isFriday ? 3 : 1; // ~10.30
  if (startMinutes >= 690 && startMinutes <= 730) return 2; // ~11.45
  if (startMinutes >= 780 && startMinutes <= 820) return 1; // ~13.15
  if (startMinutes >= 855 && startMinutes <= 900) return 2; // ~14.30
  return ((daySlotIdx % 2) + 1) as 1 | 2;
}

/**
 * Determines which rooms (1..10) have active exams during a slot.
 * Specifically keeps Ruang 09 empty (null) on Grade-XI-only sessions where XI 6
 * has no exam (e.g. Selasa, 8 Des 2026 jam 11.45 - 12.45).
 */
export function computeSessionRoomActiveFlags(
  activeClasses: Set<string>,
  roomToClasses: Map<number, Set<string>>,
): boolean[] {
  let hasX = false;
  let hasXI = false;
  let hasXII = false;
  for (const cls of activeClasses) {
    const tier = extractClassTier(cls);
    if (tier === 'X') hasX = true;
    else if (tier === 'XI') hasXI = true;
    else if (tier === 'XII') hasXII = true;
  }

  const xiOnlyWithoutXI6 = hasXI && !hasX && !hasXII && !activeClasses.has('XI 6');

  const flags: boolean[] = [];
  for (let r = 1; r <= 10; r++) {
    if (xiOnlyWithoutXI6 && r === 9) {
      flags.push(false);
      continue;
    }
    const classesInRoom = roomToClasses.get(r) ?? new Set();
    let hasExam = false;
    for (const cls of classesInRoom) {
      if (activeClasses.has(cls)) {
        hasExam = true;
        break;
      }
    }
    flags.push(hasExam);
  }
  return flags;
}

/**
 * Builds a proctor duty matrix strictly aligned with active ExamScheduleEntry slots
 * and actual StudentRecord room occupancy across Ruang 01..10.
 *
 * - Only time slots present in active `scheduleEntries` appear as rows.
 * - A room cell (`1..10`) is `null` (black block) whenever no student in that room
 *   has an active exam at that date & time (or Ruang 09 when XI 6 has no exam).
 * - Preserves valid manual room assignments from `preserveFromMatrix` when still
 *   active and conflict-free within the same session; fills remaining active rooms
 *   sequentially across `Aktif` proctors without double-booking in the same time slot.
 */
export function buildScheduleSyncedProctorMatrix(
  scheduleEntries: ExamScheduleEntry[],
  students: StudentRecord[],
  proctors: ProctorRecord[],
  preserveFromMatrix?: ProctorMatrixSession[],
): ProctorMatrixSession[] {
  const activeEntries = scheduleEntries.filter((e) => e.status === 'Aktif');
  if (activeEntries.length === 0) return [];

  // Map roomNo (1..10) -> Set of classes sitting in that room
  const roomToClasses = new Map<number, Set<string>>();
  for (let r = 1; r <= 10; r++) {
    roomToClasses.set(r, new Set());
  }
  for (const st of students) {
    const rNorm = normalizeRoomLabel(st.ruang);
    const rNum = Number(rNorm.replace(/\D/g, ''));
    if (rNum >= 1 && rNum <= 10 && st.kelas.trim()) {
      roomToClasses.get(rNum)!.add(st.kelas.trim());
    }
  }

  // Group active schedule entries into unique (isoDate, startMinutes) time slots
  interface SlotBucket {
    iso: string;
    date: string;
    startMinutes: number;
    time: string;
    classes: Set<string>;
  }
  const slotMap = new Map<string, SlotBucket>();

  for (const entry of activeEntries) {
    const iso = toIsoDateKey(entry.date);
    const startMin = parseStartMinutes(entry.time);
    const key = `${iso}||${startMin}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        iso,
        date: entry.date.trim(),
        startMinutes: startMin,
        time: normalizeMatrixTime(entry.time),
        classes: new Set(),
      });
    }
    const bucket = slotMap.get(key)!;
    for (const c of entry.classes) {
      if (c.trim()) bucket.classes.add(c.trim());
    }
  }

  const sortedSlots = [...slotMap.values()].sort((a, b) => {
    if (a.iso !== b.iso) return a.iso.localeCompare(b.iso);
    return a.startMinutes - b.startMinutes;
  });

  // Lookup existing manual assignments by (iso || startMinutes)
  const existingBySlot = new Map<string, ProctorMatrixSession>();
  if (preserveFromMatrix) {
    for (const s of preserveFromMatrix) {
      const key = `${toIsoDateKey(s.date)}||${parseStartMinutes(s.time)}`;
      existingBySlot.set(key, s);
    }
  }

  const activeProctors = [...proctors]
    .filter((p) => p.status === 'Aktif')
    .sort((a, b) => a.code - b.code);
  const allSortedProctors = [...proctors].sort((a, b) => a.code - b.code);
  const pool = activeProctors.length > 0 ? activeProctors : allSortedProctors;
  const activeCodeSet = new Set(pool.map((p) => p.code));

  let cursor = 0;
  const dayOrder: string[] = [];
  const daySlotCounts = new Map<string, number>();

  return sortedSlots.map((slot) => {
    let dayIdx = dayOrder.indexOf(slot.iso);
    if (dayIdx === -1) {
      dayIdx = dayOrder.length;
      dayOrder.push(slot.iso);
    }
    const dayNo = dayIdx + 1;
    const slotIdxInDay = daySlotCounts.get(slot.iso) ?? 0;
    daySlotCounts.set(slot.iso, slotIdxInDay + 1);

    const parsedDate = parseIndonesianDate(slot.date);
    const isFriday = parsedDate?.getDay() === 5;
    const jamKe = deriveJamKe(slot.startMinutes, slotIdxInDay, isFriday);

    const existing = existingBySlot.get(`${slot.iso}||${slot.startMinutes}`);
    const rooms: Array<number | null> = Array(10).fill(null);
    const usedInRow = new Set<number>();

    // Determine which rooms have active classes in this slot
    const roomHasExam = computeSessionRoomActiveFlags(slot.classes, roomToClasses);

    // Pass 1: Keep valid non-conflicting existing assignments for active rooms
    if (existing) {
      for (let rIdx = 0; rIdx < 10; rIdx++) {
        if (!roomHasExam[rIdx]) continue;
        const prevCode = existing.rooms[rIdx];
        if (
          prevCode !== null &&
          prevCode !== undefined &&
          activeCodeSet.has(prevCode) &&
          !usedInRow.has(prevCode)
        ) {
          rooms[rIdx] = prevCode;
          usedInRow.add(prevCode);
        }
      }
    }

    // Pass 2: Assign remaining active rooms sequentially from pool without same-slot collision
    for (let rIdx = 0; rIdx < 10; rIdx++) {
      if (!roomHasExam[rIdx] || rooms[rIdx] !== null) continue;
      if (pool.length === 0) continue;

      let chosen: number | null = null;
      for (let tries = 0; tries < pool.length; tries++) {
        const candidate = pool[(cursor + tries) % pool.length].code;
        if (!usedInRow.has(candidate)) {
          chosen = candidate;
          cursor = (cursor + tries + 1) % pool.length;
          break;
        }
      }
      if (chosen === null) {
        chosen = pool[cursor % pool.length].code;
        cursor = (cursor + 1) % pool.length;
      }
      rooms[rIdx] = chosen;
      usedInRow.add(chosen);
    }

    return {
      id: `d${dayNo}-s${slotIdxInDay + 1}`,
      dayNo,
      dayLabel: formatMatrixDayLabel(slot.date),
      date: slot.date,
      shortDate: formatMatrixShortDate(slot.date),
      jamKe,
      time: slot.time,
      rooms,
    };
  });
}

/**
 * Automatically migrates cached or cloud legacy proctor matrices that still have:
 * 1) Non-null Ruang 09 on Selasa, 8 Des 2026 jam 11.45-12.45 when XI 6 has no exam, or
 * 2) The legacy 20 -> 31 rotation gap between Rabu 2 Des 13.15 and Kamis 3 Des 08.00.
 */
export function migrateLegacyProctorMatrix(
  matrix: ProctorMatrixSession[],
  scheduleEntries: ExamScheduleEntry[],
  students: StudentRecord[],
  proctors: ProctorRecord[],
): { matrix: ProctorMatrixSession[]; changed: boolean } {
  if (matrix.length === 0) {
    return { matrix, changed: false };
  }

  const ordered = sortAndRenumberProctorMatrix(matrix);
  const selasa8Slot = ordered.find(
    (s) =>
      toIsoDateKey(s.date) === '2026-12-08' &&
      Math.abs(parseStartMinutes(s.time) - (11 * 60 + 45)) <= 15,
  );
  const hasXi6ExamOnSelasa8 = scheduleEntries.some(
    (e) =>
      e.status === 'Aktif' &&
      toIsoDateKey(e.date) === '2026-12-08' &&
      Math.abs(parseStartMinutes(e.time) - (11 * 60 + 45)) <= 15 &&
      e.classes.some((c) => c.trim() === 'XI 6'),
  );
  const hasLegacySelasa8Room9 =
    Boolean(selasa8Slot) && !hasXi6ExamOnSelasa8 && selasa8Slot?.rooms[8] !== null;

  const rabuLast = ordered.find(
    (s) =>
      toIsoDateKey(s.date) === '2026-12-02' &&
      Math.abs(parseStartMinutes(s.time) - (13 * 60 + 15)) <= 15,
  );
  const kamisFirst = ordered.find(
    (s) =>
      toIsoDateKey(s.date) === '2026-12-03' &&
      Math.abs(parseStartMinutes(s.time) - 8 * 60) <= 15,
  );
  const hasLegacyBtaGap =
    Boolean(rabuLast && kamisFirst) &&
    rabuLast?.rooms[9] === 20 &&
    kamisFirst?.rooms[0] === 31;

  if (!hasLegacySelasa8Room9 && !hasLegacyBtaGap) {
    const synced = buildScheduleSyncedProctorMatrix(
      scheduleEntries,
      students,
      proctors,
      ordered,
    );
    return {
      matrix: synced,
      changed: !areMatricesEqual(matrix, synced),
    };
  }

  const rebuilt = buildScheduleSyncedProctorMatrix(scheduleEntries, students, proctors);
  return {
    matrix: rebuilt,
    changed: !areMatricesEqual(matrix, rebuilt),
  };
}

/**
 * Checks if two ProctorMatrixSession arrays differ meaningfully in dates, times, or room assignments.
 */
export function areMatricesEqual(
  a: ProctorMatrixSession[],
  b: ProctorMatrixSession[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i];
    const sb = b[i];
    if (
      sa.id !== sb.id ||
      toIsoDateKey(sa.date) !== toIsoDateKey(sb.date) ||
      sa.time !== sb.time ||
      sa.jamKe !== sb.jamKe
    ) {
      return false;
    }
    for (let r = 0; r < 10; r++) {
      if (sa.rooms[r] !== sb.rooms[r]) return false;
    }
  }
  return true;
}

/**
 * Summarizes the exam subjects & class tiers scheduled during a matrix session.
 */
export function describeMatrixSession(
  session: ProctorMatrixSession,
  scheduleEntries: ExamScheduleEntry[],
): MatrixSessionScheduleMeta {
  const iso = toIsoDateKey(session.date);
  const startMin = parseStartMinutes(session.time);
  const subjects = new Set<string>();
  const classes = new Set<string>();
  const tiers = new Set<string>();

  for (const e of scheduleEntries) {
    if (e.status !== 'Aktif') continue;
    if (toIsoDateKey(e.date) !== iso) continue;
    if (Math.abs(parseStartMinutes(e.time) - startMin) > 15) continue;
    if (e.subject.trim()) subjects.add(e.subject.trim());
    for (const c of e.classes) {
      const clean = c.trim();
      if (!clean) continue;
      classes.add(clean);
      tiers.add(extractClassTier(clean));
    }
  }

  const tierOrder = ['X', 'XI', 'XII'];
  const sortedTiers = [...tiers].sort((a, b) => {
    const ia = tierOrder.indexOf(a);
    const ib = tierOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b, 'id');
  });
  const subjectList = [...subjects];
  const tierPrefix = sortedTiers.length > 0 ? `${sortedTiers.join('/')} · ` : '';
  const subjText =
    subjectList.length === 0
      ? 'Tidak Ada Ujian'
      : subjectList.join(', ');

  return {
    subjects: subjectList,
    tiers: sortedTiers,
    classes: [...classes],
    summaryLabel: `${tierPrefix}${subjText}`,
    activeRoomCount: session.rooms.filter((c) => c !== null).length,
  };
}

/**
 * Matches subjects strictly by date + exact start time (+/- 15m),
 * and optionally narrows to classes physically seated in `roomNo`.
 */
export function matchSubjectsForSlot(
  date: string,
  time: string,
  schedulesMap: Record<string, ScheduleRow[]> = getLiveSchedulesMap(),
  roomNo?: number,
  students?: StudentRecord[],
): { subjects: string[]; classes: string[] } {
  const iso = toIsoDateKey(date);
  const slotStart = parseStartMinutes(time);

  let allowedClasses: Set<string> | null = null;
  if (roomNo && students && students.length > 0) {
    allowedClasses = new Set<string>();
    const targetRoom = `R. ${String(roomNo).padStart(2, '0')}`;
    for (const st of students) {
      if (normalizeRoomLabel(st.ruang) === targetRoom && st.kelas.trim()) {
        allowedClasses.add(st.kelas.trim());
      }
    }
  }

  const matchedSubjects = new Set<string>();
  const matchedClasses = new Set<string>();

  for (const [kelas, rows] of Object.entries(schedulesMap)) {
    if (allowedClasses && !allowedClasses.has(kelas.trim())) continue;
    for (const [d, t, subj] of rows) {
      if (toIsoDateKey(d) !== iso) continue;
      const rStart = parseStartMinutes(t);
      if (Math.abs(rStart - slotStart) <= 15) {
        matchedSubjects.add(subj);
        matchedClasses.add(kelas.trim());
      }
    }
  }

  return {
    subjects: [...matchedSubjects],
    classes: [...matchedClasses],
  };
}

export function getProctorDutyList(
  proctorCode: number,
  matrix: ProctorMatrixSession[],
  schedulesMap: Record<string, ScheduleRow[]> = getLiveSchedulesMap(),
  filterIsoDate?: string,
  filterRoomNo?: number,
  students?: StudentRecord[],
): ProctorDutyItem[] {
  const orderedMatrix = sortAndRenumberProctorMatrix(matrix);
  const duties: ProctorDutyItem[] = [];
  for (const session of orderedMatrix) {
    if (filterIsoDate && toIsoDateKey(session.date) !== filterIsoDate) continue;
    session.rooms.forEach((assignedCode, idx) => {
      const roomNo = idx + 1;
      if (filterRoomNo && roomNo !== filterRoomNo) return;
      if (assignedCode === proctorCode) {
        const matched = matchSubjectsForSlot(
          session.date,
          session.time,
          schedulesMap,
          roomNo,
          students,
        );
        duties.push({
          sessionId: session.id,
          dayNo: session.dayNo,
          date: session.date,
          shortDate: session.shortDate,
          jamKe: session.jamKe,
          time: session.time,
          roomNo,
          roomLabel: `R. ${String(roomNo).padStart(2, '0')}`,
          subjects: matched.subjects,
          classes: matched.classes,
        });
      }
    });
  }
  return duties.sort((a, b) => {
    const isoA = toIsoDateKey(a.date);
    const isoB = toIsoDateKey(b.date);
    if (isoA !== isoB) return isoA.localeCompare(isoB);
    const tA = parseStartMinutes(a.time);
    const tB = parseStartMinutes(b.time);
    if (tA !== tB) return tA - tB;
    return a.roomNo - b.roomNo;
  });
}

export function findProctorForRoomSession(
  date: string,
  time: string,
  roomNoStr: string,
  proctors: ProctorRecord[] = getLiveProctors(),
  matrix: ProctorMatrixSession[] = getLiveProctorMatrix(),
): { proctor: ProctorRecord; session: ProctorMatrixSession } | null {
  const iso = toIsoDateKey(date);
  const roomNum = Number(roomNoStr.replace(/\D/g, ''));
  if (!roomNum || roomNum < 1 || roomNum > 10) return null;

  const targetMinutes = parseStartMinutes(time);
  const daySessions = matrix.filter((s) => toIsoDateKey(s.date) === iso);
  if (daySessions.length === 0) return null;

  const exactMatch = daySessions.find(
    (s) => Math.abs(parseStartMinutes(s.time) - targetMinutes) <= 15,
  );
  if (!exactMatch) return null;

  const code = exactMatch.rooms[roomNum - 1];
  if (code !== null && code !== undefined) {
    const found = proctors.find((p) => p.code === code);
    if (found) return { proctor: found, session: exactMatch };
  }
  return null;
}

export interface ScheduleSlotProctorSummary {
  session: ProctorMatrixSession | null;
  label: string;
  tooltip: string;
  assignments: Array<{
    roomNo: number;
    roomLabel: string;
    code: number;
    nama: string;
  }>;
}

/**
 * Resolves the active proctors assigned in `matrix` for a specific schedule `(date, time)` slot,
 * so Jadwal Ulangan can display accurate Kode Pengawas synchronized with Pengawas Ujian.
 */
export function summarizeProctorsForScheduleSlot(
  date: string,
  time: string,
  matrix: ProctorMatrixSession[],
  proctors: ProctorRecord[],
): ScheduleSlotProctorSummary {
  const iso = toIsoDateKey(date);
  const targetMinutes = parseStartMinutes(time);
  const session =
    matrix.find(
      (s) =>
        toIsoDateKey(s.date) === iso &&
        Math.abs(parseStartMinutes(s.time) - targetMinutes) <= 15,
    ) ?? null;

  if (!session) {
    return {
      session: null,
      label: '-',
      tooltip: 'Belum ada sesi pengawas untuk waktu ini',
      assignments: [],
    };
  }

  const proctorByCode = new Map(proctors.map((p) => [p.code, p]));
  const assignments: ScheduleSlotProctorSummary['assignments'] = [];
  session.rooms.forEach((code, idx) => {
    if (code === null || code === undefined) return;
    const found = proctorByCode.get(code);
    assignments.push({
      roomNo: idx + 1,
      roomLabel: `R. ${String(idx + 1).padStart(2, '0')}`,
      code,
      nama: found?.nama ?? `Kode ${code}`,
    });
  });

  if (assignments.length === 0) {
    return {
      session,
      label: 'Kosong',
      tooltip: 'Tidak ada pengawas ditugaskan pada sesi ini',
      assignments: [],
    };
  }

  const codes = assignments.map((a) => String(a.code).padStart(2, '0'));
  const label =
    codes.length === 1
      ? `Kode ${codes[0]}`
      : `Kode ${codes[0]}..${codes[codes.length - 1]} (${codes.length})`;
  const tooltip = assignments
    .map((a) => `${a.roomLabel}: [${String(a.code).padStart(2, '0')}] ${a.nama}`)
    .join('\n');

  return {
    session,
    label,
    tooltip,
    assignments,
  };
}
