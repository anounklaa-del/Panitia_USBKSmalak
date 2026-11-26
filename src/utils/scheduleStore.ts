import {
  SCHEDULES_PASTE_NOVEMBER,
  type ScheduleRow,
  type StudentRecord,
} from '../data/pasData';
import { compareNumericStrings, extractClassTier } from './deskStickerBuilder';

export type ScheduleStatus = 'Aktif' | 'Ditunda';
export type ScheduleTargetPreset = 'ALL' | 'X' | 'XI' | 'XII' | 'CUSTOM';

export interface ExamScheduleEntry {
  id: string;
  date: string; // e.g. "Senin, 30 Nov 2026"
  time: string; // e.g. "08.00 – 09.00"
  subject: string; // e.g. "Bahasa Indonesia"
  classes: string[]; // e.g. ['X1', 'X2', ...]
  kelasLabel: string; // e.g. "X, XI, XII" or "X1 – X6" or "XI 1"
  ruangLabel: string; // e.g. "R. 01 – 10"
  pengawas: string; // e.g. "Tim A"
  status: ScheduleStatus;
  isCombined: boolean; // true when targeting multi-class / Gabungan Semua Kelas
  notes?: string;
}

export interface CombinedScheduleRow {
  id: string;
  date: string;
  subject: string;
  classes: string[];
  kelasLabel: string;
  timeLabel: string;
  ruangLabel: string;
  pengawas: string;
  status: ScheduleStatus;
  hasMixedStatus: boolean;
  entryIds: string[];
  entries: ExamScheduleEntry[];
  isAllClasses: boolean;
}

export const SCHEDULE_STORAGE_KEY = 'pas_schedule_entries_v1';

const SUPERVISOR_TEAMS = ['Tim A', 'Tim B', 'Tim C'];

const ID_MONTH_MAP: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  may: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agu: 7,
  agt: 7,
  aug: 7,
  august: 7,
  agustus: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oct: 9,
  october: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  des: 11,
  dec: 11,
  december: 11,
  desember: 11,
};

const ID_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ID_MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const ID_MONTH_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const BASE_CLASSES_LIST = Object.keys(SCHEDULES_PASTE_NOVEMBER).sort(compareNumericStrings);

export function parseIndonesianDate(dateStr: string): Date | null {
  const clean = dateStr.trim();
  if (!clean) return null;

  // Handle ISO YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]) - 1;
    const d = Number(isoMatch[3]);
    const dt = new Date(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    const rawY = Number(slashMatch[3]);
    const year = rawY < 100 ? 2000 + rawY : rawY;
    const dt = new Date(year, month, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Handle "Senin, 30 Nov 2026", "30 Nov 2026", or "30-Nov-26" / "01-Dec-26"
  const afterComma = clean.includes(',') ? clean.split(',').slice(1).join(',').trim() : clean;
  const parts = afterComma.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').split(' ');
  if (parts.length >= 3) {
    const day = Number(parts[0]);
    const monthKey = parts[1].toLowerCase().replace(/[^a-z]/g, '');
    const rawYear = Number(parts[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const month = ID_MONTH_MAP[monthKey];
    if (!Number.isNaN(day) && month !== undefined && !Number.isNaN(year)) {
      const dt = new Date(year, month, day);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
}

export function formatIndonesianDate(date: Date): string {
  const dayName = ID_DAY_NAMES[date.getDay()];
  const dayNum = date.getDate();
  const monthShort = ID_MONTH_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthShort} ${year}`;
}

export function formatIndonesianDateLong(dateStr: string): string {
  const d = parseIndonesianDate(dateStr);
  if (!d) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')} ${ID_MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function toIsoDateKey(dateStr: string): string {
  const d = parseIndonesianDate(dateStr);
  if (!d) return dateStr.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function splitDayAndDate(dateStr: string): { dayLabel: string; dateLabel: string } {
  if (dateStr.includes(',')) {
    const [dayPart, ...rest] = dateStr.split(',');
    return {
      dayLabel: `${dayPart.trim()},`,
      dateLabel: rest.join(',').trim(),
    };
  }
  return { dayLabel: '', dateLabel: dateStr.trim() };
}

export function parseStartMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return 9999;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function summarizeClassesLabel(
  classes: string[],
  allKnownClasses: string[] = BASE_CLASSES_LIST,
): string {
  const unique = [...new Set(classes.map((c) => c.trim()).filter(Boolean))].sort(compareNumericStrings);
  if (unique.length === 0) return '-';

  const knownSet = new Set(allKnownClasses);
  if (allKnownClasses.length > 0 && unique.length >= knownSet.size && [...knownSet].every((c) => unique.includes(c))) {
    return 'X, XI, XII';
  }

  const xAll = BASE_CLASSES_LIST.filter((c) => extractClassTier(c) === 'X');
  const xiAll = BASE_CLASSES_LIST.filter((c) => extractClassTier(c) === 'XI');
  const xiiAll = BASE_CLASSES_LIST.filter((c) => extractClassTier(c) === 'XII');

  const tiersCovered: string[] = [];
  const remaining: string[] = [];

  const hasAllX = xAll.length > 0 && xAll.every((c) => unique.includes(c));
  const hasAllXI = xiAll.length > 0 && xiAll.every((c) => unique.includes(c));
  const hasAllXII = xiiAll.length > 0 && xiiAll.every((c) => unique.includes(c));

  if (hasAllX) tiersCovered.push('X');
  if (hasAllXI) tiersCovered.push('XI');
  if (hasAllXII) tiersCovered.push('XII');

  for (const c of unique) {
    const t = extractClassTier(c);
    if ((t === 'X' && hasAllX) || (t === 'XI' && hasAllXI) || (t === 'XII' && hasAllXII)) {
      continue;
    }
    remaining.push(c);
  }

  if (tiersCovered.length > 0 && remaining.length === 0) {
    return tiersCovered.join(', ');
  }

  if (unique.length <= 3) {
    return unique.join(', ');
  }

  const head = tiersCovered.length > 0 ? tiersCovered.join(', ') : `${unique[0]}–${unique[unique.length - 1]}`;
  return remaining.length > 0 ? `${head}, ${remaining.slice(0, 2).join(', ')}${remaining.length > 2 ? ` +${remaining.length - 2}` : ''}` : head;
}

export function buildDefaultScheduleEntries(): ExamScheduleEntry[] {
  const grouped = new Map<
    string,
    { date: string; time: string; subject: string; classes: Set<string> }
  >();

  for (const [kelas, rows] of Object.entries(SCHEDULES_PASTE_NOVEMBER)) {
    for (const [date, time, subject] of rows) {
      const key = `${toIsoDateKey(date)}||${time.trim()}||${subject.trim()}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: date.trim(),
          time: time.trim(),
          subject: subject.trim(),
          classes: new Set(),
        });
      }
      grouped.get(key)!.classes.add(kelas.trim());
    }
  }

  const sorted = [...grouped.values()].sort((a, b) => {
    const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
    const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
    if (da !== db) return da - db;
    const ta = parseStartMinutes(a.time);
    const tb = parseStartMinutes(b.time);
    if (ta !== tb) return ta - tb;
    return a.subject.localeCompare(b.subject, 'id');
  });

  // Track unique day index to cycle supervisor teams cleanly (Tim A, Tim B, Tim C)
  const dayOrder: string[] = [];
  return sorted.map((item, idx) => {
    const iso = toIsoDateKey(item.date);
    let dayIdx = dayOrder.indexOf(iso);
    if (dayIdx === -1) {
      dayIdx = dayOrder.length;
      dayOrder.push(iso);
    }
    const classes = [...item.classes].sort(compareNumericStrings);
    const label = summarizeClassesLabel(classes);
    return {
      id: `sch-${idx + 1}`,
      date: item.date,
      time: item.time,
      subject: item.subject,
      classes,
      kelasLabel: label,
      ruangLabel: 'R. 01 – 10',
      pengawas: SUPERVISOR_TEAMS[dayIdx % SUPERVISOR_TEAMS.length],
      status: 'Aktif',
      isCombined: classes.length > 1,
    };
  });
}

export function buildSchedulesByClass(
  entries: ExamScheduleEntry[],
  knownClasses: string[] = BASE_CLASSES_LIST,
): Record<string, ScheduleRow[]> {
  const byClassMap = new Map<string, Array<{ date: string; time: string; subject: string }>>();
  for (const k of knownClasses) {
    byClassMap.set(k, []);
  }

  for (const entry of entries) {
    if (entry.status !== 'Aktif') continue;
    for (const kelas of entry.classes) {
      const k = kelas.trim();
      if (!k) continue;
      if (!byClassMap.has(k)) byClassMap.set(k, []);
      const existing = byClassMap.get(k)!;
      const duplicate = existing.some(
        (r) =>
          toIsoDateKey(r.date) === toIsoDateKey(entry.date) &&
          r.time.trim() === entry.time.trim() &&
          r.subject.trim().toLowerCase() === entry.subject.trim().toLowerCase(),
      );
      if (!duplicate) {
        existing.push({
          date: entry.date.trim(),
          time: entry.time.trim(),
          subject: entry.subject.trim(),
        });
      }
    }
  }

  const out: Record<string, ScheduleRow[]> = {};
  const sortedClasses = [...byClassMap.keys()].sort(compareNumericStrings);
  for (const k of sortedClasses) {
    const sortedRows = [...(byClassMap.get(k) ?? [])].sort((a, b) => {
      const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
      const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
      if (da !== db) return da - db;
      const ta = parseStartMinutes(a.time);
      const tb = parseStartMinutes(b.time);
      if (ta !== tb) return ta - tb;
      return a.subject.localeCompare(b.subject, 'id');
    });
    out[k] = sortedRows.map((r) => [r.date, r.time, r.subject]);
  }
  return out;
}

/**
 * Merges matching (date + subject) across classes/shifts into combined rows
 * for "Jadwal Ulangan Gabungan Semua Kelas" display & printing.
 */
export function buildCombinedScheduleRows(
  entries: ExamScheduleEntry[],
  allKnownClasses: string[] = BASE_CLASSES_LIST,
): CombinedScheduleRow[] {
  const map = new Map<string, ExamScheduleEntry[]>();

  for (const entry of entries) {
    const key = `${toIsoDateKey(entry.date)}||${entry.subject.trim().toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  const rows: CombinedScheduleRow[] = [];
  for (const [key, list] of map.entries()) {
    const first = list[0];
    const classes = [...new Set(list.flatMap((e) => e.classes))].sort(compareNumericStrings);
    const times = [...new Set(list.map((e) => e.time.trim()).filter(Boolean))].sort(
      (a, b) => parseStartMinutes(a) - parseStartMinutes(b),
    );
    const rooms = [...new Set(list.map((e) => e.ruangLabel.trim()).filter(Boolean))];
    const supervisors = [...new Set(list.map((e) => e.pengawas.trim()).filter(Boolean))];
    const activeCount = list.filter((e) => e.status === 'Aktif').length;
    const status: ScheduleStatus = activeCount > 0 ? 'Aktif' : 'Ditunda';
    const hasMixedStatus = activeCount > 0 && activeCount < list.length;

    const kelasLabel = summarizeClassesLabel(classes, allKnownClasses);
    const isAllClasses =
      allKnownClasses.length > 0 && allKnownClasses.every((c) => classes.includes(c));

    rows.push({
      id: `cmb-${key}`,
      date: first.date,
      subject: first.subject,
      classes,
      kelasLabel,
      timeLabel: times.length <= 1 ? times[0] ?? first.time : `${times[0]} / ${times[times.length - 1]}`,
      ruangLabel: rooms.length === 1 ? rooms[0] : rooms.slice(0, 2).join(', '),
      pengawas: supervisors.length === 1 ? supervisors[0] : supervisors.slice(0, 2).join(', '),
      status,
      hasMixedStatus,
      entryIds: list.map((e) => e.id),
      entries: list,
      isAllClasses,
    });
  }

  return rows.sort((a, b) => {
    const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
    const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
    if (da !== db) return da - db;
    const ta = parseStartMinutes(a.timeLabel);
    const tb = parseStartMinutes(b.timeLabel);
    if (ta !== tb) return ta - tb;
    return a.subject.localeCompare(b.subject, 'id');
  });
}

let liveEntriesCache: ExamScheduleEntry[] | null = null;
let liveSchedulesMapCache: Record<string, ScheduleRow[]> | null = null;

export function syncLiveSchedulesCache(
  entries: ExamScheduleEntry[],
  knownClasses: string[] = BASE_CLASSES_LIST,
): Record<string, ScheduleRow[]> {
  liveEntriesCache = entries;
  liveSchedulesMapCache = buildSchedulesByClass(entries, knownClasses);
  return liveSchedulesMapCache;
}

function isBtaSubjectName(subject: string): boolean {
  const clean = subject.trim().toLowerCase();
  return (
    /\bbta\b/.test(clean) ||
    clean.includes('mulok/bta') ||
    clean.includes('mulok / bta') ||
    clean.includes('mulok-bta') ||
    clean.includes('mulok bta')
  );
}

/**
 * Automatically migrates cached or cloud legacy schedule entries where Class X
 * was included in BTA / MULOK/BTA, removing Class X from BTA and moving
 * Class X's schedule below it on Rabu, 2 Des 2026 (e.g. Biologi 14.30–15.30)
 * up into the 13.15 – 14.15 slot.
 */
export function migrateLegacyScheduleEntries(
  entries: ExamScheduleEntry[],
): { entries: ExamScheduleEntry[]; changed: boolean } {
  const TARGET_ISO = '2026-12-02';
  const SLOT_1315 = 13 * 60 + 15;
  const TIME_1315_LABEL = '13.15 – 14.15';

  let needsMigration = false;
  for (const e of entries) {
    const hasClassX = e.classes.some((c) => extractClassTier(c) === 'X');
    if (!hasClassX) continue;
    if (isBtaSubjectName(e.subject)) {
      needsMigration = true;
      break;
    }
    if (toIsoDateKey(e.date) === TARGET_ISO && parseStartMinutes(e.time) > SLOT_1315) {
      needsMigration = true;
      break;
    }
  }

  if (!needsMigration) {
    return { entries, changed: false };
  }

  const migrated: ExamScheduleEntry[] = [];
  const removedRabuBtaXClasses = new Set<string>();

  for (const e of entries) {
    const xClasses = e.classes.filter((c) => extractClassTier(c) === 'X');
    const nonXClasses = e.classes.filter((c) => extractClassTier(c) !== 'X');
    const isTargetRabu = toIsoDateKey(e.date) === TARGET_ISO;
    const start = parseStartMinutes(e.time);

    // 1. Remove Class X from any BTA / MULOK/BTA entry
    if (xClasses.length > 0 && isBtaSubjectName(e.subject)) {
      if (isTargetRabu) {
        for (const xc of xClasses) removedRabuBtaXClasses.add(xc);
      }
      if (nonXClasses.length > 0) {
        migrated.push({
          ...e,
          classes: nonXClasses,
          kelasLabel: summarizeClassesLabel(nonXClasses),
          isCombined: nonXClasses.length > 1,
        });
      }
      continue;
    }

    // 2. Move any Class X schedule below 13.15 on Rabu, 2 Des 2026 (e.g. 14.30–15.30 Biologi) UP to 13.15–14.15
    if (isTargetRabu && xClasses.length > 0 && start > SLOT_1315) {
      if (nonXClasses.length > 0) {
        migrated.push({
          ...e,
          classes: nonXClasses,
          kelasLabel: summarizeClassesLabel(nonXClasses),
          isCombined: nonXClasses.length > 1,
        });
      }
      migrated.push({
        ...e,
        id: nonXClasses.length > 0 ? `${e.id}-x-up` : e.id,
        time: TIME_1315_LABEL,
        classes: xClasses,
        kelasLabel: summarizeClassesLabel(xClasses),
        isCombined: xClasses.length > 1,
      });
      continue;
    }

    migrated.push(e);
  }

  // Ensure Class X has Biologi at 13.15–14.15 on Rabu, 2 Des 2026 if BTA was removed and no 13.15 X entry exists
  if (removedRabuBtaXClasses.size > 0) {
    const xAlreadyIn1315 = new Set<string>();
    for (const item of migrated) {
      if (
        toIsoDateKey(item.date) === TARGET_ISO &&
        parseStartMinutes(item.time) === SLOT_1315
      ) {
        for (const c of item.classes) {
          if (extractClassTier(c) === 'X') xAlreadyIn1315.add(c);
        }
      }
    }
    const missingX = [...removedRabuBtaXClasses]
      .filter((c) => !xAlreadyIn1315.has(c))
      .sort(compareNumericStrings);
    if (missingX.length > 0) {
      migrated.push({
        id: 'sch-rabu-x-bio-migrated',
        date: 'Rabu, 2 Des 2026',
        time: TIME_1315_LABEL,
        subject: 'Biologi',
        classes: missingX,
        kelasLabel: summarizeClassesLabel(missingX),
        ruangLabel: 'R. 01 – 10',
        pengawas: 'Tim C',
        status: 'Aktif',
        isCombined: missingX.length > 1,
      });
    }
  }

  // Merge any duplicate (date, time, subject) entries created by migration
  const deduped: ExamScheduleEntry[] = [];
  const mergeMap = new Map<string, ExamScheduleEntry>();
  for (const item of migrated) {
    const k = `${toIsoDateKey(item.date)}||${parseStartMinutes(item.time)}||${item.subject.trim().toLowerCase()}`;
    const existing = mergeMap.get(k);
    if (!existing) {
      const copy = { ...item, classes: [...new Set(item.classes)].sort(compareNumericStrings) };
      copy.kelasLabel = summarizeClassesLabel(copy.classes);
      copy.isCombined = copy.classes.length > 1;
      mergeMap.set(k, copy);
      deduped.push(copy);
    } else {
      const mergedClasses = [...new Set([...existing.classes, ...item.classes])].sort(
        compareNumericStrings,
      );
      existing.classes = mergedClasses;
      existing.kelasLabel = summarizeClassesLabel(mergedClasses);
      existing.isCombined = mergedClasses.length > 1;
    }
  }

  deduped.sort((a, b) => {
    const da = parseIndonesianDate(a.date)?.getTime() ?? 0;
    const db = parseIndonesianDate(b.date)?.getTime() ?? 0;
    if (da !== db) return da - db;
    const ta = parseStartMinutes(a.time);
    const tb = parseStartMinutes(b.time);
    if (ta !== tb) return ta - tb;
    return a.subject.localeCompare(b.subject, 'id');
  });

  return { entries: deduped, changed: true };
}

export function loadScheduleEntries(): ExamScheduleEntry[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { entries: migrated, changed } = migrateLegacyScheduleEntries(
          parsed as ExamScheduleEntry[],
        );
        if (changed) {
          saveScheduleEntries(migrated);
        } else {
          syncLiveSchedulesCache(migrated);
        }
        return migrated;
      }
    }
  } catch {
    // fallback to default
  }
  const defaults = buildDefaultScheduleEntries();
  syncLiveSchedulesCache(defaults);
  return defaults;
}

export function saveScheduleEntries(
  entries: ExamScheduleEntry[],
  knownClasses: string[] = BASE_CLASSES_LIST,
): Record<string, ScheduleRow[]> {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
  return syncLiveSchedulesCache(entries, knownClasses);
}

export function resetScheduleEntriesToDefault(): ExamScheduleEntry[] {
  const defaults = buildDefaultScheduleEntries();
  try {
    localStorage.removeItem(SCHEDULE_STORAGE_KEY);
  } catch {
    // ignore
  }
  syncLiveSchedulesCache(defaults);
  return defaults;
}

export function getLiveSchedulesMap(): Record<string, ScheduleRow[]> {
  if (liveSchedulesMapCache) return liveSchedulesMapCache;
  if (liveEntriesCache) {
    liveSchedulesMapCache = buildSchedulesByClass(liveEntriesCache);
    return liveSchedulesMapCache;
  }
  loadScheduleEntries();
  return liveSchedulesMapCache ?? SCHEDULES_PASTE_NOVEMBER;
}

export function getAllKnownClasses(students: StudentRecord[] = []): string[] {
  const set = new Set<string>(BASE_CLASSES_LIST);
  for (const s of students) {
    if (s.kelas.trim()) set.add(s.kelas.trim());
  }
  return [...set].sort(compareNumericStrings);
}
