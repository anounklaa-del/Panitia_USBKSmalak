import type { StudentRecord } from '../data/pasData';
import type { ProctorMatrixSession, ProctorRecord } from '../data/proctorData';
import type { BeritaAcaraLayoutMode } from '../types/prepress';
import { compareNumericStrings, normalizeRoomLabel } from './deskStickerBuilder';
import {
  parseIndonesianDate,
  parseStartMinutes,
  toIsoDateKey,
  type ExamScheduleEntry,
} from './scheduleStore';

export const BERITA_ACARA_OVERRIDES_KEY = 'pas_berita_acara_overrides_v1';

export interface BeritaAcaraOverride {
  absentStudentNos?: string[];
  absentCount?: number;
  absentNumbersText?: string;
  baCopies?: number;
  attendanceCopies?: number;
  notes?: string;
  proctorNameOverride?: string;
  proctorNipOverride?: string;
}

export interface BeritaAcaraRecord {
  id: string;
  sessionId: string;
  dayNo: number;
  date: string;
  isoDate: string;
  dayName: string;
  dayNum: string;
  monthName: string;
  year: string;
  time: string;
  timeStart: string;
  timeEnd: string;
  roomNo: number;
  roomLabel: string;
  subjects: string[];
  subjectLabel: string;
  classes: string[];
  kelasLabel: string;
  proctorCode: number | null;
  proctorName: string;
  proctorNip: string;
  participants: StudentRecord[];
  registeredCount: number;
  presentCount: number;
  absentCount: number;
  absentStudentNos: string[];
  absentNumbersText: string;
  presentNumbersSummary: string;
  baCopies: number;
  attendanceCopies: number;
  notes: string;
  hasCustomOverride: boolean;
}

export interface BeritaAcaraPrintPage {
  key: string;
  items: BeritaAcaraRecord[];
  isTwoUp: boolean;
}

const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ID_MONTHS = [
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

export function loadBeritaAcaraOverrides(): Record<string, BeritaAcaraOverride> {
  try {
    const raw = localStorage.getItem(BERITA_ACARA_OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, BeritaAcaraOverride>;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function saveBeritaAcaraOverrides(map: Record<string, BeritaAcaraOverride>) {
  try {
    localStorage.setItem(BERITA_ACARA_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function splitTimeRange(timeStr: string): { timeStart: string; timeEnd: string } {
  const parts = timeStr
    .split(/\s*[–—-]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    timeStart: parts[0] ?? timeStr,
    timeEnd: parts[1] ?? '',
  };
}

function summarizeParticipantNumbers(list: StudentRecord[]): string {
  if (list.length === 0) return '-';
  const sorted = [...list].sort((a, b) => compareNumericStrings(a.no, b.no));
  if (sorted.length === 1) return sorted[0].no;
  return `${sorted[0].no} s.d. ${sorted[sorted.length - 1].no}`;
}

export function buildBeritaAcaraRecords(
  scheduleEntries: ExamScheduleEntry[],
  students: StudentRecord[],
  proctors: ProctorRecord[],
  matrix: ProctorMatrixSession[],
  overrides: Record<string, BeritaAcaraOverride> = {},
): BeritaAcaraRecord[] {
  const activeEntries = scheduleEntries.filter((e) => e.status === 'Aktif');
  if (activeEntries.length === 0) return [];

  const proctorByCode = new Map<number, ProctorRecord>();
  for (const p of proctors) {
    proctorByCode.set(p.code, p);
  }

  // Group students by normalized room number (1..10)
  const studentsByRoom = new Map<number, StudentRecord[]>();
  for (const st of students) {
    const rNorm = normalizeRoomLabel(st.ruang);
    const rNum = Number(rNorm.replace(/\D/g, ''));
    if (rNum >= 1 && rNum <= 10) {
      if (!studentsByRoom.has(rNum)) studentsByRoom.set(rNum, []);
      studentsByRoom.get(rNum)!.push(st);
    }
  }
  for (const list of studentsByRoom.values()) {
    list.sort((a, b) => compareNumericStrings(a.no, b.no));
  }

  // Index active schedule entries by isoDate
  const entriesByIso = new Map<string, ExamScheduleEntry[]>();
  for (const entry of activeEntries) {
    const iso = toIsoDateKey(entry.date);
    if (!entriesByIso.has(iso)) entriesByIso.set(iso, []);
    entriesByIso.get(iso)!.push(entry);
  }

  const records: BeritaAcaraRecord[] = [];

  for (const session of matrix) {
    const iso = toIsoDateKey(session.date);
    const slotStartMin = parseStartMinutes(session.time);
    const dayEntries = (entriesByIso.get(iso) ?? []).filter(
      (e) => Math.abs(parseStartMinutes(e.time) - slotStartMin) <= 15,
    );
    if (dayEntries.length === 0) continue;

    // Map class -> subject(s) in this slot
    const classToSubjects = new Map<string, Set<string>>();
    for (const entry of dayEntries) {
      for (const cls of entry.classes) {
        const clean = cls.trim();
        if (!clean) continue;
        if (!classToSubjects.has(clean)) classToSubjects.set(clean, new Set());
        if (entry.subject.trim()) classToSubjects.get(clean)!.add(entry.subject.trim());
      }
    }

    const parsedDate = parseIndonesianDate(session.date);
    const dayName = parsedDate
      ? ID_DAYS[parsedDate.getDay()]
      : session.date.split(',')[0]?.trim() || '-';
    const dayNum = parsedDate ? String(parsedDate.getDate()).padStart(2, '0') : '-';
    const monthName = parsedDate ? ID_MONTHS[parsedDate.getMonth()] : '-';
    const year = parsedDate ? String(parsedDate.getFullYear()) : '2026';
    const { timeStart, timeEnd } = splitTimeRange(session.time);

    for (let roomIdx = 0; roomIdx < 10; roomIdx++) {
      const roomNo = roomIdx + 1;
      const roomStudents = studentsByRoom.get(roomNo) ?? [];
      if (roomStudents.length === 0) continue;

      const participatingStudents: StudentRecord[] = [];
      const subjectsSet = new Set<string>();
      const classesSet = new Set<string>();

      for (const st of roomStudents) {
        const cls = st.kelas.trim();
        const subjs = classToSubjects.get(cls);
        if (subjs && subjs.size > 0) {
          participatingStudents.push(st);
          classesSet.add(cls);
          for (const s of subjs) subjectsSet.add(s);
        }
      }

      if (participatingStudents.length === 0) continue;

      const id = `${session.id}-r${String(roomNo).padStart(2, '0')}`;
      const roomLabel = `R. ${String(roomNo).padStart(2, '0')}`;
      const proctorCode = session.rooms[roomIdx] ?? null;
      const proctorObj = proctorCode !== null ? proctorByCode.get(proctorCode) : undefined;

      const subjects = [...subjectsSet];
      const classes = [...classesSet].sort(compareNumericStrings);

      const ov = overrides[id];
      const registeredCount = participatingStudents.length;

      let absentStudentNos = ov?.absentStudentNos
        ? ov.absentStudentNos.filter((no) => participatingStudents.some((st) => st.no === no))
        : [];
      let absentCount =
        typeof ov?.absentCount === 'number'
          ? Math.max(0, Math.min(registeredCount, ov.absentCount))
          : absentStudentNos.length;

      if (ov?.absentStudentNos && ov.absentCount === undefined) {
        absentCount = absentStudentNos.length;
      }

      const presentCount = Math.max(0, registeredCount - absentCount);
      const absentSet = new Set(absentStudentNos);
      const presentParticipants = participatingStudents.filter((st) => !absentSet.has(st.no));

      const absentNumbersText =
        ov?.absentNumbersText !== undefined
          ? ov.absentNumbersText
          : absentStudentNos.length > 0
            ? absentStudentNos.join(', ')
            : '-';

      records.push({
        id,
        sessionId: session.id,
        dayNo: session.dayNo,
        date: session.date,
        isoDate: iso,
        dayName,
        dayNum,
        monthName,
        year,
        time: session.time,
        timeStart,
        timeEnd,
        roomNo,
        roomLabel,
        subjects,
        subjectLabel: subjects.join(' / '),
        classes,
        kelasLabel: classes.join(', '),
        proctorCode,
        proctorName: ov?.proctorNameOverride?.trim() || proctorObj?.nama || 'Belum Ditugaskan',
        proctorNip: ov?.proctorNipOverride?.trim() ?? proctorObj?.nip ?? '',
        participants: participatingStudents,
        registeredCount,
        presentCount,
        absentCount,
        absentStudentNos,
        absentNumbersText,
        presentNumbersSummary: summarizeParticipantNumbers(presentParticipants),
        baCopies: ov?.baCopies ?? 2,
        attendanceCopies: ov?.attendanceCopies ?? 2,
        notes: ov?.notes ?? '',
        hasCustomOverride: Boolean(ov),
      });
    }
  }

  return records.sort((a, b) => {
    if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate);
    const tA = parseStartMinutes(a.time);
    const tB = parseStartMinutes(b.time);
    if (tA !== tB) return tA - tB;
    return a.roomNo - b.roomNo;
  });
}

export function buildBeritaAcaraPrintPages(
  records: BeritaAcaraRecord[],
  layoutMode: BeritaAcaraLayoutMode,
): BeritaAcaraPrintPage[] {
  if (records.length === 0) return [];

  if (layoutMode === 'one_up') {
    return records.map((rec) => ({
      key: `ba-1up-${rec.id}`,
      items: [rec],
      isTwoUp: false,
    }));
  }

  if (layoutMode === 'two_up_paired') {
    const pages: BeritaAcaraPrintPage[] = [];
    for (let i = 0; i < records.length; i += 2) {
      const pair = records.slice(i, i + 2);
      pages.push({
        key: `ba-pair-${pair.map((p) => p.id).join('_')}`,
        items: pair,
        isTwoUp: true,
      });
    }
    return pages;
  }

  // Default: two_up_duplicate (exact Format File Kedua: left & right identical copy on 1 landscape sheet)
  return records.map((rec) => ({
    key: `ba-2up-${rec.id}`,
    items: [rec, rec],
    isTwoUp: true,
  }));
}
