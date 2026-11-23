import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Box,
  LayoutGrid,
  LogOut,
  Menu,
  Printer,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserPlus,
} from 'lucide-react';
import { AccountAccessManager } from './components/AccountAccessManager';
import { AppSidebar, WORKSPACE_META } from './components/AppSidebar';
import { CommitteeAvatar } from './components/CommitteeAvatars';
import { CommitteeManager } from './components/CommitteeManager';
import { DashboardOverview } from './components/DashboardOverview';
import { AttendanceSheetPagesBlock } from './components/AttendanceSheetRenderer';
import { AttendanceSheetStudio } from './components/AttendanceSheetStudio';
import {
  BeritaAcaraPagesBlock,
  getBeritaAcaraPaperDimensions,
} from './components/BeritaAcaraDocumentRenderer';
import { BeritaAcaraWorkspace } from './components/BeritaAcaraWorkspace';
import { CardSheetPreview } from './components/CardSheetPreview';
import { StickerSheetPagesBlock } from './components/DeskStickerRenderer';
import { DeskStickerStudio } from './components/DeskStickerStudio';
import { ExportArchivePanel } from './components/ExportArchivePanel';
import { ExamScheduleManager } from './components/ExamScheduleManager';
import { LoginGate } from './components/LoginGate';
import { Mockup3DViewer } from './components/Mockup3DViewer';
import { SheetPagesBlock } from './components/PrintSheetRenderer';
import { ProctorManager } from './components/ProctorManager';
import {
  ProctorRosterPrintBlock,
  type ProctorPrintMode,
} from './components/ProctorRosterPrintRenderer';
import { ProductionDocsPanel } from './components/ProductionDocsPanel';
import { QrCodeSvg } from './components/QrCodeSvg';
import {
  ScheduleRosterPrintBlock,
  type SchedulePrintMode,
} from './components/ScheduleRosterPrintRenderer';
import { SeatingSheetPagesBlock } from './components/SeatingPlanRenderer';
import { SeatingPlanStudio } from './components/SeatingPlanStudio';
import { SettingsDrawer } from './components/SettingsDrawer';
import { StudentDataManager } from './components/StudentDataManager';
import { StudentRosterPrintBlock } from './components/StudentRosterPrintRenderer';
import {
  SystemSettingsWorkspace,
  type SystemBackupPayload,
} from './components/SystemSettingsWorkspace';
import {
  COMMITTEE_MASTER,
  type CommitteeMember,
} from './data/committeeData';
import {
  LOGO_RIGHT_DATA_URI,
  STUDENTS_MASTER,
  type StudentRecord,
} from './data/pasData';
import type {
  ProctorMatrixSession,
  ProctorRecord,
  ProctorStatus,
} from './data/proctorData';
import {
  computeSheetGeometry,
  computeStickerGeometry,
  DEFAULT_ATTENDANCE_CONFIG,
  DEFAULT_BERITA_ACARA_CONFIG,
  DEFAULT_PREPRESS_CONFIG,
  DEFAULT_SCHOOL_SETTINGS,
  DEFAULT_SEATING_CONFIG,
  DEFAULT_STICKER_CONFIG,
  PAPER_DIMENSIONS,
  type AttendanceConfig,
  type BeritaAcaraConfig,
  type CropMarkStyle,
  type FlipMode,
  type ImpositionMode,
  type MainWorkspaceTab,
  type PaperPreset,
  type PrepressConfig,
  type QrCornerPosition,
  type QrPayloadFormat,
  type SchoolSettings,
  type SeatingConfig,
  type StickerConfig,
} from './types/prepress';
import { buildStructuredZipArchive } from './utils/archiveExporter';
import { buildAttendancePages } from './utils/attendanceBuilder';
import { logoutSession, type AuthUser } from './utils/authClient';
import {
  buildBeritaAcaraPrintPages,
  buildBeritaAcaraRecords,
  loadBeritaAcaraOverrides,
  saveBeritaAcaraOverrides,
  type BeritaAcaraOverride,
  type BeritaAcaraRecord,
} from './utils/beritaAcaraStore';
import {
  buildDeskAssignmentLookup,
  buildDeskStickers,
  getSortedRoomList,
  normalizeRoomLabel,
} from './utils/deskStickerBuilder';
import { formatStudentQrPayload, getQrSymbolData } from './utils/qrGenerator';
import {
  areMatricesEqual,
  buildScheduleSyncedProctorMatrix,
  getProctorDutyList,
  loadProctorMatrix,
  loadProctors,
  resetProctorMatrixToDefault,
  resetProctorsToDefault,
  saveProctorMatrix,
  saveProctors,
  syncLiveProctorCache,
  type ProctorDutyItem,
} from './utils/proctorStore';
import {
  buildCombinedScheduleRows,
  buildSchedulesByClass,
  getAllKnownClasses,
  loadScheduleEntries,
  resetScheduleEntriesToDefault,
  saveScheduleEntries,
  syncLiveSchedulesCache,
  type CombinedScheduleRow,
  type ExamScheduleEntry,
  type ScheduleStatus,
} from './utils/scheduleStore';
import {
  buildRoomSeatingPlans,
  buildSeatingPages,
  getSeatingPaperDimensions,
} from './utils/seatingPlanBuilder';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('pas_students_custom_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage failure
    }
    return STUDENTS_MASTER;
  });
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(() => {
    try {
      const saved = localStorage.getItem('pas_committee_members_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage failure
    }
    return COMMITTEE_MASTER;
  });
  const [config, setConfig] = useState<PrepressConfig>(() => {
    try {
      const saved = localStorage.getItem('pas_prepress_v2_cfg');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PrepressConfig> & { gapMm?: number };
        const migratedGap =
          typeof parsed.gapMm === 'number'
            ? {
                gapXmm: parsed.gapXmm ?? parsed.gapMm,
                gapYmm: parsed.gapYmm ?? parsed.gapMm,
              }
            : {};
        return { ...DEFAULT_PREPRESS_CONFIG, ...parsed, ...migratedGap };
      }
    } catch {
      // ignore storage failure
    }
    return DEFAULT_PREPRESS_CONFIG;
  });
  const [stickerConfig, setStickerConfig] = useState<StickerConfig>(() => {
    try {
      const saved = localStorage.getItem('pas_sticker_cfg_v2');
      if (saved) return { ...DEFAULT_STICKER_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore storage failure
    }
    return DEFAULT_STICKER_CONFIG;
  });
  const [seatingConfig, setSeatingConfig] = useState<SeatingConfig>(() => {
    try {
      const saved = localStorage.getItem('pas_seating_cfg_v3');
      if (saved) return { ...DEFAULT_SEATING_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore storage failure
    }
    return DEFAULT_SEATING_CONFIG;
  });
  const [attendanceConfig, setAttendanceConfig] = useState<AttendanceConfig>(() => {
    try {
      const saved = localStorage.getItem('pas_attendance_cfg_v3');
      if (saved) return { ...DEFAULT_ATTENDANCE_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore storage failure
    }
    return DEFAULT_ATTENDANCE_CONFIG;
  });
  const [activeTab, setActiveTab] = useState<MainWorkspaceTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pas_sidebar_collapsed_v1') === '1';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [selectedStudentNo, setSelectedStudentNo] = useState<string>(STUDENTS_MASTER[0].no);
  const [sheetIndex, setSheetIndex] = useState<number>(0);
  const [stickerSheetIndex, setStickerSheetIndex] = useState<number>(0);
  const [seatingPageIndex, setSeatingPageIndex] = useState<number>(0);
  const [attendancePageIndex, setAttendancePageIndex] = useState<number>(0);
  const [printScope, setPrintScope] = useState<'all' | 'current'>('all');
  const [stickerPrintScope, setStickerPrintScope] = useState<'all' | 'current'>('all');
  const [seatingPrintScope, setSeatingPrintScope] = useState<'all' | 'current'>('all');
  const [attendancePrintScope, setAttendancePrintScope] = useState<'all' | 'current'>('all');
  const [zipBusy, setZipBusy] = useState(false);
  const [scheduleEntries, setScheduleEntries] = useState<ExamScheduleEntry[]>(() =>
    loadScheduleEntries(),
  );
  const [schedulePrintPayload, setSchedulePrintPayload] = useState<{
    mode: SchedulePrintMode;
    combinedRows: CombinedScheduleRow[];
    sessionRows: ExamScheduleEntry[];
    selectedClass?: string;
    filterSummary?: string;
  } | null>(null);
  const [proctors, setProctors] = useState<ProctorRecord[]>(() => loadProctors());
  const [proctorMatrix, setProctorMatrix] = useState<ProctorMatrixSession[]>(() =>
    buildScheduleSyncedProctorMatrix(scheduleEntries, students, proctors, loadProctorMatrix()),
  );
  const [proctorPrintPayload, setProctorPrintPayload] = useState<{
    mode: ProctorPrintMode;
    proctors: ProctorRecord[];
    matrix: ProctorMatrixSession[];
    filterSummary?: string;
  } | null>(null);
  const [beritaAcaraConfig, setBeritaAcaraConfig] = useState<BeritaAcaraConfig>(() => {
    try {
      const saved = localStorage.getItem('pas_berita_acara_cfg_v1');
      if (saved) return { ...DEFAULT_BERITA_ACARA_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore storage failure
    }
    return DEFAULT_BERITA_ACARA_CONFIG;
  });
  const [beritaAcaraOverrides, setBeritaAcaraOverrides] = useState<
    Record<string, BeritaAcaraOverride>
  >(() => loadBeritaAcaraOverrides());
  const [beritaAcaraPrintRecords, setBeritaAcaraPrintRecords] = useState<
    BeritaAcaraRecord[] | null
  >(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    try {
      const saved = localStorage.getItem('pas_school_settings_v1');
      if (saved) return { ...DEFAULT_SCHOOL_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore storage failure
    }
    return DEFAULT_SCHOOL_SETTINGS;
  });
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);
  const pendingPrintRef = useRef(false);

  const persistStudents = (next: StudentRecord[]) => {
    setStudents(next);
    try {
      localStorage.setItem('pas_students_custom_v1', JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const updateConfig = (patch: Partial<PrepressConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_prepress_v2_cfg', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const updateStickerConfig = (patch: Partial<StickerConfig>) => {
    setStickerConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_sticker_cfg_v2', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const updateSeatingConfig = (patch: Partial<SeatingConfig>) => {
    setSeatingConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_seating_cfg_v3', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const updateAttendanceConfig = (patch: Partial<AttendanceConfig>) => {
    setAttendanceConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_attendance_cfg_v3', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const updateBeritaAcaraConfig = (patch: Partial<BeritaAcaraConfig>) => {
    setBeritaAcaraConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_berita_acara_cfg_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleSaveBeritaAcaraOverride = (id: string, override: BeritaAcaraOverride | null) => {
    setBeritaAcaraOverrides((prev) => {
      const next = { ...prev };
      if (override === null) {
        delete next[id];
      } else {
        next[id] = override;
      }
      saveBeritaAcaraOverrides(next);
      return next;
    });
  };

  const updateSchoolSettings = (patch: Partial<SchoolSettings>) => {
    setSchoolSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('pas_school_settings_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleRestoreBackup = (payload: Partial<SystemBackupPayload>) => {
    if (payload.schoolSettings) {
      updateSchoolSettings({ ...DEFAULT_SCHOOL_SETTINGS, ...payload.schoolSettings });
    }
    if (payload.prepressConfig) {
      updateConfig(payload.prepressConfig);
    }
    if (payload.stickerConfig) {
      updateStickerConfig(payload.stickerConfig);
    }
    if (payload.seatingConfig) {
      updateSeatingConfig(payload.seatingConfig);
    }
    if (payload.attendanceConfig) {
      updateAttendanceConfig(payload.attendanceConfig);
    }
    if (payload.beritaAcaraConfig) {
      updateBeritaAcaraConfig(payload.beritaAcaraConfig);
    }
    if (Array.isArray(payload.students) && payload.students.length > 0) {
      persistStudents(payload.students);
      setSelectedStudentNo(payload.students[0].no);
    }
    if (Array.isArray(payload.committeeMembers) && payload.committeeMembers.length > 0) {
      persistCommitteeMembers(payload.committeeMembers);
    }
    if (Array.isArray(payload.scheduleEntries)) {
      persistScheduleEntries(payload.scheduleEntries);
    }
    if (Array.isArray(payload.proctors) && payload.proctors.length > 0) {
      persistProctors(payload.proctors);
    }
    if (Array.isArray(payload.proctorMatrix)) {
      persistProctorMatrix(payload.proctorMatrix);
    }
    if (payload.beritaAcaraOverrides && typeof payload.beritaAcaraOverrides === 'object') {
      setBeritaAcaraOverrides(payload.beritaAcaraOverrides);
      saveBeritaAcaraOverrides(payload.beritaAcaraOverrides);
    }
  };

  const handleResetAllConfigs = () => {
    updateSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
    updateConfig(DEFAULT_PREPRESS_CONFIG);
    updateStickerConfig(DEFAULT_STICKER_CONFIG);
    updateSeatingConfig(DEFAULT_SEATING_CONFIG);
    updateAttendanceConfig(DEFAULT_ATTENDANCE_CONFIG);
    updateBeritaAcaraConfig(DEFAULT_BERITA_ACARA_CONFIG);
  };

  const handleAddStudent = (record: StudentRecord) => {
    const next = [...students, record];
    persistStudents(next);
    setSelectedStudentNo(record.no);
  };

  const handleUpdateStudent = (originalNo: string, updated: StudentRecord) => {
    const next = students.map((s) => (s.no === originalNo ? updated : s));
    persistStudents(next);
    if (selectedStudentNo === originalNo) setSelectedStudentNo(updated.no);
  };

  const handleDeleteStudent = (no: string) => {
    const next = students.filter((s) => s.no !== no);
    if (next.length === 0) return;
    persistStudents(next);
    if (selectedStudentNo === no) setSelectedStudentNo(next[0].no);
  };

  const handleResetStudents = () => {
    setStudents(STUDENTS_MASTER);
    setSelectedStudentNo(STUDENTS_MASTER[0].no);
    setSheetIndex(0);
    setStickerSheetIndex(0);
    setCsvFeedback(null);
    try {
      localStorage.removeItem('pas_students_custom_v1');
    } catch {
      // ignore
    }
  };

  const persistCommitteeMembers = (next: CommitteeMember[]) => {
    setCommitteeMembers(next);
    try {
      localStorage.setItem('pas_committee_members_v1', JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const handleAddCommitteeMember = (member: CommitteeMember) => {
    persistCommitteeMembers([member, ...committeeMembers]);
  };

  const handleUpdateCommitteeMember = (id: string, updated: CommitteeMember) => {
    persistCommitteeMembers(committeeMembers.map((m) => (m.id === id ? updated : m)));
  };

  const handleDeleteCommitteeMember = (id: string) => {
    const next = committeeMembers.filter((m) => m.id !== id);
    if (next.length === 0) return;
    persistCommitteeMembers(next);
  };

  const handleResetCommitteeMembers = () => {
    setCommitteeMembers(COMMITTEE_MASTER);
    try {
      localStorage.removeItem('pas_committee_members_v1');
    } catch {
      // ignore
    }
  };

  const activeChair = useMemo(
    () =>
      committeeMembers.find((m) => m.jabatan === 'Ketua Panitia' && m.status === 'Aktif') ??
      committeeMembers.find((m) => m.jabatan === 'Ketua Panitia') ??
      committeeMembers[0],
    [committeeMembers],
  );

  const knownClasses = useMemo(() => getAllKnownClasses(students), [students]);
  const schedulesByClass = useMemo(() => {
    const map = buildSchedulesByClass(scheduleEntries, knownClasses);
    syncLiveSchedulesCache(scheduleEntries, knownClasses);
    return map;
  }, [scheduleEntries, knownClasses]);
  const combinedScheduleRows = useMemo(
    () => buildCombinedScheduleRows(scheduleEntries, knownClasses),
    [scheduleEntries, knownClasses],
  );

  const persistScheduleEntries = (next: ExamScheduleEntry[]) => {
    setScheduleEntries(next);
    saveScheduleEntries(next, knownClasses);
  };

  const handleAddScheduleEntries = (newEntries: ExamScheduleEntry[]) => {
    persistScheduleEntries([...scheduleEntries, ...newEntries]);
  };

  const handleUpdateScheduleEntries = (nextEntries: ExamScheduleEntry[]) => {
    persistScheduleEntries(nextEntries);
  };

  const handleToggleScheduleStatus = (entryIds: string[], nextStatus: ScheduleStatus) => {
    const targetSet = new Set(entryIds);
    persistScheduleEntries(
      scheduleEntries.map((e) => (targetSet.has(e.id) ? { ...e, status: nextStatus } : e)),
    );
  };

  const handleDeleteScheduleEntries = (entryIds: string[]) => {
    const targetSet = new Set(entryIds);
    persistScheduleEntries(scheduleEntries.filter((e) => !targetSet.has(e.id)));
  };

  const handleResetSchedules = () => {
    const defaults = resetScheduleEntriesToDefault();
    setScheduleEntries(defaults);
  };

  useEffect(() => {
    setProctorMatrix((prev) => {
      const synced = buildScheduleSyncedProctorMatrix(
        scheduleEntries,
        students,
        proctors,
        prev,
      );
      if (areMatricesEqual(prev, synced)) return prev;
      saveProctorMatrix(synced);
      return synced;
    });
  }, [scheduleEntries, students, proctors]);

  useEffect(() => {
    syncLiveProctorCache(proctors, proctorMatrix);
  }, [proctors, proctorMatrix]);

  const dutiesByCode = useMemo(() => {
    const map = new Map<number, ProctorDutyItem[]>();
    for (const p of proctors) {
      map.set(
        p.code,
        getProctorDutyList(p.code, proctorMatrix, schedulesByClass, undefined, undefined, students),
      );
    }
    return map;
  }, [proctors, proctorMatrix, schedulesByClass, students]);

  const persistProctors = (next: ProctorRecord[]) => {
    setProctors(next);
    saveProctors(next);
  };

  const persistProctorMatrix = (next: ProctorMatrixSession[]) => {
    setProctorMatrix(next);
    saveProctorMatrix(next);
  };

  const handleAddProctor = (proctor: ProctorRecord) => {
    persistProctors([...proctors, proctor].sort((a, b) => a.code - b.code));
  };

  const handleUpdateProctor = (id: string, updated: ProctorRecord) => {
    persistProctors(
      proctors.map((p) => (p.id === id ? updated : p)).sort((a, b) => a.code - b.code),
    );
  };

  const handleToggleProctorStatus = (id: string, nextStatus: ProctorStatus) => {
    persistProctors(
      proctors.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)),
    );
  };

  const handleDeleteProctor = (id: string) => {
    const target = proctors.find((p) => p.id === id);
    const next = proctors.filter((p) => p.id !== id);
    if (next.length === 0) return;
    persistProctors(next);
    if (target) {
      persistProctorMatrix(
        proctorMatrix.map((sess) => ({
          ...sess,
          rooms: sess.rooms.map((c) => (c === target.code ? null : c)),
        })),
      );
    }
  };

  const handleUpdateMatrixSlot = (
    sessionId: string,
    roomIdx: number,
    proctorCode: number | null,
  ) => {
    persistProctorMatrix(
      proctorMatrix.map((sess) => {
        if (sess.id !== sessionId) return sess;
        const nextRooms = [...sess.rooms];
        nextRooms[roomIdx] = proctorCode;
        return { ...sess, rooms: nextRooms };
      }),
    );
  };

  const handleResyncProctorsFromSchedule = () => {
    const fresh = buildScheduleSyncedProctorMatrix(scheduleEntries, students, proctors);
    persistProctorMatrix(fresh);
  };

  const handleResetProctors = () => {
    const defaultProctors = resetProctorsToDefault();
    const defaultMatrix = resetProctorMatrixToDefault();
    setProctors(defaultProctors);
    setProctorMatrix(
      buildScheduleSyncedProctorMatrix(scheduleEntries, students, defaultProctors, defaultMatrix),
    );
  };

  const classList = useMemo(
    () => [...new Set(students.map((s) => s.kelas))],
    [students],
  );
  const roomList = useMemo(() => getSortedRoomList(students), [students]);

  const deskLookup = useMemo(() => {
    return Object.fromEntries(
      Array.from(buildDeskAssignmentLookup(students, stickerConfig.groupingMode).entries()).map(
        ([no, info]) => [no, info.mejaLabel],
      ),
    );
  }, [students, stickerConfig.groupingMode]);

  const filteredStudents = useMemo(() => {
    const fromNum = config.noFrom ? Number(config.noFrom) : 0;
    const toNum = config.noTo ? Number(config.noTo) : 1e9;
    return students.filter((s) => {
      if (config.selectedClass && s.kelas !== config.selectedClass) return false;
      if (config.selectedRoom && normalizeRoomLabel(s.ruang) !== config.selectedRoom) return false;
      const n = Number(s.no);
      if (!Number.isNaN(n) && (n < fromNum || n > toNum)) return false;
      return true;
    });
  }, [students, config.selectedClass, config.selectedRoom, config.noFrom, config.noTo]);

  const cardFilterDesc = useMemo(() => {
    const parts: string[] = [];
    if (config.selectedClass) parts.push(`Kelas ${config.selectedClass}`);
    if (config.selectedRoom) parts.push(`RUANG ${config.selectedRoom}`);
    if (config.noFrom || config.noTo) {
      parts.push(`No. ${config.noFrom || '001'}–${config.noTo || 'akhir'}`);
    }
    return parts.join(' · ') || 'Semua Kartu Aktif';
  }, [config.selectedClass, config.selectedRoom, config.noFrom, config.noTo]);

  const selectedStudent = useMemo(() => {
    return (
      filteredStudents.find((s) => s.no === selectedStudentNo) ??
      filteredStudents[0] ??
      students[0]
    );
  }, [filteredStudents, selectedStudentNo, students]);

  const geo = useMemo(() => computeSheetGeometry(config), [config]);
  const totalSheets = Math.max(1, Math.ceil(filteredStudents.length / geo.cardsPerSheet));
  const safeSheetIdx = Math.min(sheetIndex, totalSheets - 1);

  const printSheetIndices = useMemo(() => {
    if (printScope === 'current') return [safeSheetIdx];
    return Array.from({ length: totalSheets }, (_, i) => i);
  }, [printScope, safeSheetIdx, totalSheets]);

  const totalCardPrintPages = useMemo(() => {
    if (config.imposition === 'calibration') return 2;
    const sheetCount = printSheetIndices.length;
    return config.imposition === 'duplex' ? sheetCount * 2 : sheetCount;
  }, [config.imposition, printSheetIndices.length]);

  const filteredStickers = useMemo(() => {
    const base = buildDeskStickers(
      students,
      stickerConfig.groupingMode,
      stickerConfig.selectedRoom || undefined,
    );
    const q = stickerConfig.searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((st) => {
      if (st.mejaLabel.toLowerCase().includes(q) || `ruang ${st.ruang}`.toLowerCase().includes(q)) {
        return true;
      }
      return st.slots.some(
        (slot) =>
          slot.student &&
          (slot.student.nama.toLowerCase().includes(q) ||
            slot.student.no.toLowerCase().includes(q) ||
            slot.student.kelas.toLowerCase().includes(q)),
      );
    });
  }, [
    students,
    stickerConfig.groupingMode,
    stickerConfig.selectedRoom,
    stickerConfig.searchQuery,
  ]);

  const stickerGeo = useMemo(
    () => computeStickerGeometry(config, stickerConfig),
    [config, stickerConfig],
  );
  const totalStickerSheets = Math.max(
    1,
    Math.ceil(filteredStickers.length / stickerGeo.stickersPerSheet),
  );
  const safeStickerSheetIdx = Math.min(stickerSheetIndex, totalStickerSheets - 1);
  const printStickerIndices = useMemo(() => {
    if (stickerPrintScope === 'current') return [safeStickerSheetIdx];
    return Array.from({ length: totalStickerSheets }, (_, i) => i);
  }, [stickerPrintScope, safeStickerSheetIdx, totalStickerSheets]);

  const seatingRoomPlans = useMemo(
    () =>
      buildRoomSeatingPlans(
        students,
        filteredStudents,
        stickerConfig.groupingMode,
        seatingConfig,
        cardFilterDesc,
      ),
    [students, filteredStudents, stickerConfig.groupingMode, seatingConfig, cardFilterDesc],
  );
  const seatingPages = useMemo(
    () => buildSeatingPages(seatingRoomPlans, seatingConfig.variant),
    [seatingRoomPlans, seatingConfig.variant],
  );
  const safeSeatingPageIdx = Math.min(seatingPageIndex, Math.max(0, seatingPages.length - 1));
  const printSeatingPages = useMemo(() => {
    if (seatingPrintScope === 'current') {
      return seatingPages[safeSeatingPageIdx] ? [seatingPages[safeSeatingPageIdx]] : [];
    }
    return seatingPages;
  }, [seatingPages, seatingPrintScope, safeSeatingPageIdx]);

  const seatingDims = useMemo(
    () => getSeatingPaperDimensions(config, seatingConfig.paperOrientation),
    [config, seatingConfig.paperOrientation],
  );

  const attendanceResult = useMemo(
    () =>
      buildAttendancePages(
        students,
        filteredStudents,
        stickerConfig.groupingMode,
        config,
        attendanceConfig,
        cardFilterDesc,
      ),
    [students, filteredStudents, stickerConfig.groupingMode, config, attendanceConfig, cardFilterDesc],
  );
  const attendancePages = attendanceResult.pages;
  const safeAttendancePageIdx = Math.min(
    attendancePageIndex,
    Math.max(0, attendancePages.length - 1),
  );
  const printAttendancePages = useMemo(() => {
    if (attendancePrintScope === 'current') {
      return attendancePages[safeAttendancePageIdx]
        ? [attendancePages[safeAttendancePageIdx]]
        : [];
    }
    return attendancePages;
  }, [attendancePages, attendancePrintScope, safeAttendancePageIdx]);

  const attendanceDims = useMemo(
    () => getSeatingPaperDimensions(config, attendanceConfig.paperOrientation),
    [config, attendanceConfig.paperOrientation],
  );

  const beritaAcaraRecords = useMemo(
    () =>
      buildBeritaAcaraRecords(
        scheduleEntries,
        students,
        proctors,
        proctorMatrix,
        beritaAcaraOverrides,
      ),
    [scheduleEntries, students, proctors, proctorMatrix, beritaAcaraOverrides],
  );

  const beritaAcaraFilteredRecords = useMemo(() => {
    return beritaAcaraRecords.filter((rec) => {
      if (beritaAcaraConfig.selectedDate && rec.date !== beritaAcaraConfig.selectedDate) {
        return false;
      }
      if (
        beritaAcaraConfig.selectedSubject &&
        !rec.subjects.includes(beritaAcaraConfig.selectedSubject)
      ) {
        return false;
      }
      if (beritaAcaraConfig.selectedRoom && rec.roomLabel !== beritaAcaraConfig.selectedRoom) {
        return false;
      }
      if (
        beritaAcaraConfig.selectedProctorCode &&
        String(rec.proctorCode ?? '') !== beritaAcaraConfig.selectedProctorCode
      ) {
        return false;
      }
      return true;
    });
  }, [
    beritaAcaraRecords,
    beritaAcaraConfig.selectedDate,
    beritaAcaraConfig.selectedSubject,
    beritaAcaraConfig.selectedRoom,
    beritaAcaraConfig.selectedProctorCode,
  ]);

  const beritaAcaraPrintPages = useMemo(
    () =>
      buildBeritaAcaraPrintPages(
        beritaAcaraPrintRecords ?? beritaAcaraFilteredRecords,
        beritaAcaraConfig.layoutMode,
      ),
    [beritaAcaraPrintRecords, beritaAcaraFilteredRecords, beritaAcaraConfig.layoutMode],
  );

  const beritaAcaraDims = useMemo(
    () => getBeritaAcaraPaperDimensions(config, beritaAcaraConfig.layoutMode),
    [config, beritaAcaraConfig.layoutMode],
  );

  const totalPrintPages =
    activeTab === 'sticker'
      ? printStickerIndices.length
      : activeTab === 'seating'
        ? printSeatingPages.length
        : activeTab === 'attendance'
          ? printAttendancePages.length
          : activeTab === 'berita_acara'
            ? beritaAcaraPrintPages.length
            : totalCardPrintPages;

  const missingScheduleCount = useMemo(
    () =>
      filteredStudents.filter(
        (s) => !schedulesByClass[s.kelas] || schedulesByClass[s.kelas].length === 0,
      ).length,
    [filteredStudents, schedulesByClass],
  );

  // Trigger native browser print after React flushes any scope change to print-only DOM
  useEffect(() => {
    if (!pendingPrintRef.current) return;
    pendingPrintRef.current = false;
    const timer = requestAnimationFrame(() => {
      window.print();
    });
    return () => cancelAnimationFrame(timer);
  }, [
    printScope,
    stickerPrintScope,
    seatingPrintScope,
    attendancePrintScope,
    safeSheetIdx,
    safeStickerSheetIdx,
    safeSeatingPageIdx,
    safeAttendancePageIdx,
    filteredStudents,
    filteredStickers,
    seatingPages,
    attendancePages,
    schedulePrintPayload,
    proctorPrintPayload,
    beritaAcaraPrintRecords,
    beritaAcaraConfig,
    beritaAcaraOverrides,
    beritaAcaraRecords,
    proctors,
    proctorMatrix,
    config,
    stickerConfig,
    seatingConfig,
    attendanceConfig,
  ]);

  const handleDirectPrint = (scopeOverride?: 'all' | 'current') => {
    const targetScope = scopeOverride ?? printScope;
    if (targetScope !== printScope) {
      pendingPrintRef.current = true;
      setPrintScope(targetScope);
    } else {
      window.print();
    }
  };

  const handleStickerPrint = (scopeOverride?: 'all' | 'current') => {
    const targetScope = scopeOverride ?? stickerPrintScope;
    if (targetScope !== stickerPrintScope) {
      pendingPrintRef.current = true;
      setStickerPrintScope(targetScope);
    } else {
      window.print();
    }
  };

  const handleSeatingPrint = (scopeOverride?: 'all' | 'current') => {
    const targetScope = scopeOverride ?? seatingPrintScope;
    if (targetScope !== seatingPrintScope) {
      pendingPrintRef.current = true;
      setSeatingPrintScope(targetScope);
    } else {
      window.print();
    }
  };

  const handleAttendancePrint = (scopeOverride?: 'all' | 'current') => {
    const targetScope = scopeOverride ?? attendancePrintScope;
    if (targetScope !== attendancePrintScope) {
      pendingPrintRef.current = true;
      setAttendancePrintScope(targetScope);
    } else {
      window.print();
    }
  };

  const handleSchedulePrint = (payload: {
    mode: SchedulePrintMode;
    combinedRows: CombinedScheduleRow[];
    sessionRows: ExamScheduleEntry[];
    selectedClass?: string;
    filterSummary?: string;
  }) => {
    pendingPrintRef.current = true;
    setSchedulePrintPayload(payload);
  };

  const handleProctorPrint = (payload: {
    mode: ProctorPrintMode;
    proctors: ProctorRecord[];
    matrix: ProctorMatrixSession[];
    filterSummary?: string;
  }) => {
    pendingPrintRef.current = true;
    setProctorPrintPayload(payload);
  };

  const handleBeritaAcaraPrint = (recordsToPrint: BeritaAcaraRecord[]) => {
    pendingPrintRef.current = true;
    setBeritaAcaraPrintRecords(recordsToPrint);
  };

  const handleCsvUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const delim = text.includes('\t')
      ? '\t'
      : text.includes(';') && !text.includes(',')
        ? ';'
        : ',';
    const rows = text
      .split(/\r?\n/)
      .filter((x) => x.trim())
      .map((line) => line.split(delim).map((v) => v.trim().replace(/^"|"$/g, '')));
    if (rows.length > 0 && /no/i.test(rows[0][0]) && Number.isNaN(Number(rows[0][0]))) {
      rows.shift();
    }
    const parsed: StudentRecord[] = rows
      .filter((r) => r[0])
      .map((r) => ({
        no: r[0],
        nama: r[1] || '',
        kelas: r[2] || '',
        ruang: r[3] || '',
        user: r[4] || r[0],
        ...(r[5] ? { nisn: r[5] } : {}),
        ...(r[6] ? { jurusan: r[6] } : {}),
        ...(r[7] === 'L' || r[7] === 'P' ? { jenisKelamin: r[7] } : {}),
        ...(r[8] === 'Lulus' || r[8] === 'Susulan' || r[8] === 'Nonaktif'
          ? { status: r[8] }
          : {}),
      }));
    if (parsed.length > 0) {
      persistStudents(parsed);
      setSelectedStudentNo(parsed[0].no);
      setSheetIndex(0);
      setStickerSheetIndex(0);
      setCsvFeedback(`Terimpor ${parsed.length} data siswa dari ${file.name}`);
    }
    ev.target.value = '';
  };

  const handleQuickArchiveDownload = async () => {
    if (zipBusy) return;
    setZipBusy(true);
    try {
      const batch = filteredStudents.length > 0 ? filteredStudents : [selectedStudent];
      const res = await buildStructuredZipArchive(
        batch,
        config,
        undefined,
        students,
        stickerConfig.groupingMode,
      );
      const slug = config.selectedClass
        ? config.selectedClass.replace(/\s+/g, '_')
        : `${batch.length}Siswa`;
      triggerBlobDownload(res.blob, `SMAN1ALALAK_PAS2026_Arsip_Pracetak_${slug}.zip`);
    } finally {
      setZipBusy(false);
    }
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pas_sidebar_collapsed_v1', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelectWorkspaceTab = (tab: MainWorkspaceTab) => {
    if (tab === 'accounts' && authUser?.role !== 'admin') {
      return;
    }
    setSettingsOpen(false);
    setActiveTab(tab);
  };

  const handleAuthenticated = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    if (authToken) {
      void logoutSession(authToken);
    }
    setAuthToken(null);
    setAuthUser(null);
    setSettingsOpen(false);
    setActiveTab('dashboard');
  };

  const handleResetCardFilter = () => {
    updateConfig({ selectedClass: '', selectedRoom: '', noFrom: '', noTo: '' });
    setSheetIndex(0);
  };

  const handleQuickJumpRoom = (
    room: string,
    targetTab: 'studio' | 'sticker' | 'seating' | 'attendance',
  ) => {
    if (targetTab === 'studio') {
      updateConfig({ selectedRoom: room, selectedClass: '', noFrom: '', noTo: '' });
      setSheetIndex(0);
    } else if (targetTab === 'sticker') {
      updateStickerConfig({ selectedRoom: room });
      setStickerSheetIndex(0);
    } else if (targetTab === 'seating') {
      updateSeatingConfig({ selectedRoom: room, seatingMode: 'student_card', dataSource: 'room' });
      setSeatingPageIndex(0);
    } else if (targetTab === 'attendance') {
      updateAttendanceConfig({ selectedRoom: room, groupingMode: 'per_ruang' });
      setAttendancePageIndex(0);
    }
    setActiveTab(targetTab);
  };

  const handleUseScheduleForAttendance = (session: {
    subject: string;
    date: string;
    time: string;
  }) => {
    updateAttendanceConfig({
      subjectName: session.subject,
      examDate: session.date,
      examTime: session.time,
    });
    setAttendancePageIndex(0);
    setActiveTab('attendance');
  };

  const hasActiveCardFilter = Boolean(
    config.selectedClass || config.selectedRoom || config.noFrom || config.noTo,
  );
  const hasSettingsDrawer =
    activeTab === 'studio' ||
    activeTab === 'mockup3d' ||
    activeTab === 'sticker' ||
    activeTab === 'seating' ||
    activeTab === 'attendance';
  const routeMeta = WORKSPACE_META[activeTab];

  const activePageW =
    activeTab === 'seating'
      ? seatingDims.paperW
      : activeTab === 'attendance'
        ? attendanceDims.paperW
        : activeTab === 'berita_acara'
          ? beritaAcaraDims.paperW
          : activeTab === 'students' || activeTab === 'schedule' || activeTab === 'proctor'
            ? 210
            : geo.paperW;
  const activePageH =
    activeTab === 'seating'
      ? seatingDims.paperH
      : activeTab === 'attendance'
        ? attendanceDims.paperH
        : activeTab === 'berita_acara'
          ? beritaAcaraDims.paperH
          : activeTab === 'students' || activeTab === 'schedule' || activeTab === 'proctor'
            ? 297
            : geo.paperH;

  if (!authToken || !authUser) {
    return <LoginGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      {/* Dynamic @page physical dimensions for 1:1mm browser printing */}
      <style>{`@page { size: ${activePageW}mm ${activePageH}mm; margin: 0; }`}</style>

      {/* Interactive Screen Application: Navy Sidebar + Royal Blue Top Header + Main Workspace + Footer */}
      <div className="screen-only flex flex-col h-screen w-screen overflow-hidden bg-[#EBF1FA] text-[#131C31]">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AppSidebar
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            onSelectTab={handleSelectWorkspaceTab}
            onToggleCollapsed={toggleSidebarCollapsed}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            userRole={authUser.role}
            schoolLogoUri={schoolSettings.logoDataUri}
            counts={{
              committeeMembers: committeeMembers.length,
              totalStudents: students.length,
              scheduleSessions: combinedScheduleRows.length,
              proctors: proctors.length,
              filteredStudents: filteredStudents.length,
              stickers: filteredStickers.length,
              seatingPages: seatingPages.length,
              attendancePages: attendancePages.length,
              beritaAcara: beritaAcaraRecords.length,
            }}
            academicYear={attendanceConfig.academicYear || '2026/2027'}
            onAcademicYearChange={(year) => updateAttendanceConfig({ academicYear: year })}
            paper={config.paper}
            dpi={config.dpi}
            hasActiveCardFilter={hasActiveCardFilter}
            cardFilterDesc={cardFilterDesc}
            onResetCardFilter={handleResetCardFilter}
          />

          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Royal Blue Top Header Bar */}
            <header
              className="no-print relative h-16 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0 overflow-hidden shadow-[0_2px_10px_rgba(3,21,56,0.18)]"
              style={{
                background: 'linear-gradient(90deg, #092F71 0%, #0E3F91 55%, #0A3173 100%)',
              }}
            >
              {/* Subtle Diagonal Translucent Bands matching reference header */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                <div className="absolute -top-10 right-[28%] w-24 h-40 bg-white/[0.04] rotate-[28deg]" />
                <div className="absolute -top-10 right-[21%] w-12 h-40 bg-white/[0.03] rotate-[28deg]" />
              </div>

              <div className="relative z-10 flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setMobileSidebarOpen(true);
                    } else {
                      toggleSidebarCollapsed();
                    }
                  }}
                  aria-label="Toggle menu navigasi"
                  title="Tampilkan atau ciutkan menu samping"
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceTab('dashboard')}
                  title="Dashboard SMA Negeri 1 Alalak"
                  className={`${
                    sidebarCollapsed ? 'flex' : 'flex lg:hidden'
                  } w-9 h-9 items-center justify-center shrink-0 hover:opacity-90 transition-opacity`}
                >
                  <img
                    src={schoolSettings.logoDataUri || LOGO_RIGHT_DATA_URI}
                    alt={`Logo ${schoolSettings.schoolName}`}
                    className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                  />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display font-bold text-sm sm:text-[15px] text-white truncate whitespace-nowrap">
                      Sistem Manajemen Panitia Ulangan
                    </span>
                    {activeTab !== 'dashboard' && (
                      <span className="hidden md:inline-block text-xs font-medium text-[#FFD43B] truncate whitespace-nowrap">
                        · {routeMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold tracking-wider text-[#CBD5E1] uppercase truncate whitespace-nowrap">
                    {schoolSettings.schoolName || 'SMA NEGERI 1 ALALAK'}
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-2.5 shrink-0">
                {hasSettingsDrawer && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((prev) => !prev)}
                    aria-expanded={settingsOpen}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 ${
                      settingsOpen
                        ? 'bg-[#FFD43B] border-[#FFD43B] text-[#092252] shadow-xs'
                        : 'bg-white/12 border-white/25 hover:bg-white/20 text-white'
                    }`}
                    title="Buka atau tutup menu pengaturan untuk tampilan ini"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Pengaturan
                  </button>
                )}

                {activeTab !== 'dashboard' &&
                  activeTab !== 'committee' &&
                  activeTab !== 'students' &&
                  activeTab !== 'schedule' &&
                  activeTab !== 'proctor' &&
                  activeTab !== 'settings' &&
                  activeTab !== 'accounts' && (
                  <button
                    type="button"
                    onClick={() =>
                      activeTab === 'sticker'
                        ? handleStickerPrint()
                        : activeTab === 'seating'
                          ? handleSeatingPrint()
                          : activeTab === 'attendance'
                            ? handleAttendancePrint()
                            : activeTab === 'berita_acara'
                              ? handleBeritaAcaraPrint(beritaAcaraFilteredRecords)
                              : handleDirectPrint()
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-[#092252] text-xs font-bold shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
                    title={
                      activeTab === 'sticker'
                        ? `Cetak langsung ${totalPrintPages} halaman Stiker Meja`
                        : activeTab === 'seating'
                          ? `Cetak langsung ${totalPrintPages} halaman Denah Tempat Duduk`
                          : activeTab === 'attendance'
                            ? `Cetak langsung ${totalPrintPages} halaman Daftar Hadir Peserta`
                            : activeTab === 'berita_acara'
                              ? `Cetak langsung ${totalPrintPages} halaman Berita Acara`
                              : `Cetak langsung ${totalCardPrintPages} halaman Kartu PAS`
                    }
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {activeTab === 'sticker'
                      ? `Cetak Stiker (${totalPrintPages})`
                      : activeTab === 'seating'
                        ? `Cetak Denah (${totalPrintPages})`
                        : activeTab === 'attendance'
                          ? `Cetak Absen (${totalPrintPages})`
                          : activeTab === 'berita_acara'
                            ? `Cetak BA (${totalPrintPages})`
                            : `Cetak Kartu (${totalCardPrintPages})`}
                  </button>
                )}

                <button
                  type="button"
                  disabled={zipBusy}
                  onClick={handleQuickArchiveDownload}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-60 text-white text-xs font-semibold transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
                >
                  <Archive className="w-3.5 h-3.5 text-[#FFD43B]" />
                  {zipBusy ? 'Mengemas ZIP...' : 'Unduh ZIP'}
                </button>

                {/* Signed-in User Chip + Logout Action */}
                <div className="flex items-center gap-2 pl-2.5 ml-1 border-l border-white/15 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectWorkspaceTab(
                        authUser.role === 'admin' ? 'accounts' : 'committee',
                      )
                    }
                    title={
                      authUser.role === 'admin'
                        ? 'Buka Manajemen Akun Login (Admin)'
                        : 'Buka Manajemen Panitia Ulangan'
                    }
                    className="hidden md:flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity shrink-0"
                  >
                    {authUser.role === 'admin' ? (
                      <div className="w-9 h-9 rounded-full ring-2 ring-[#FFD43B]/70 bg-[#1F3864] text-[#FFD43B] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4.5 h-4.5" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/30 bg-white shrink-0">
                        <CommitteeAvatar
                          variant={activeChair?.avatarVariant ?? 'ketua'}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                    <div className="leading-tight">
                      <div className="text-xs font-bold text-white whitespace-nowrap">
                        {authUser.displayName}
                      </div>
                      <div className="text-[10.5px] text-[#CBD5E1] whitespace-nowrap">
                        {authUser.role === 'admin' ? 'Administrator' : 'Panitia'} ·{' '}
                        <span className="font-mono text-[#FFD43B]">{authUser.username}</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    title={`Keluar dari sesi (${authUser.username})`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-[#DC2626] border border-white/20 hover:border-[#DC2626] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Keluar</span>
                  </button>
                </div>
              </div>
            </header>

          {/* Main Split Workspace */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <SettingsDrawer
              open={settingsOpen && (activeTab === 'studio' || activeTab === 'mockup3d')}
              onClose={() => setSettingsOpen(false)}
              title="Pengaturan Kartu & Cetak"
              subtitle="Kertas, bleed, imposisi, filter siswa & QR"
            >
              {/* Section 1: Paper, Trim Size, Bleed, Manual Margins & Spacing */}
              <div>
                <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
                  Kertas, Ukuran, Bleed &amp; Jarak
                </h2>

                <label className="block text-[#44546A] font-medium mb-1">Ukuran Kertas</label>
                <select
                  value={config.paper}
                  onChange={(e) => updateConfig({ paper: e.target.value as PaperPreset })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2"
                >
                  {Object.entries(PAPER_DIMENSIONS).map(([k, [, , label]]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                  <option value="custom">Kustom (mm)...</option>
                </select>

                {config.paper === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[#44546A] mb-0.5">Lebar Kertas mm</label>
                      <input
                        type="number"
                        step="0.5"
                        value={config.customW}
                        onChange={(e) => updateConfig({ customW: Number(e.target.value) || 210 })}
                        className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[#44546A] mb-0.5">Tinggi Kertas mm</label>
                      <input
                        type="number"
                        step="0.5"
                        value={config.customH}
                        onChange={(e) => updateConfig({ customH: Number(e.target.value) || 297 })}
                        className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Lebar mm</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.cardW}
                      onChange={(e) => updateConfig({ cardW: Math.max(40, Number(e.target.value) || 101.6) })}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Tinggi mm</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.cardH}
                      onChange={(e) => updateConfig({ cardH: Math.max(30, Number(e.target.value) || 68.4) })}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Bleed mm</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="6"
                      value={config.bleedMm}
                      onChange={(e) => updateConfig({ bleedMm: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                </div>

                {/* Manual Card Spacing (Jarak Antar Kartu) */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[#44546A] font-medium">Jarak Antar Kartu Manual (mm)</label>
                    <div className="flex items-center gap-1">
                      {[0, 3, 6].map((presetGap) => (
                        <button
                          key={presetGap}
                          type="button"
                          onClick={() => updateConfig({ gapXmm: presetGap, gapYmm: presetGap })}
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] border transition-colors ${
                            config.gapXmm === presetGap && config.gapYmm === presetGap
                              ? 'bg-[#1F3864] text-white border-[#1F3864]'
                              : 'bg-[#F8FAFC] text-[#44546A] border-[#E2E8F0] hover:bg-[#EEF2FA]'
                          }`}
                        >
                          {presetGap}mm
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#64748B] mb-0.5">Jarak Kolom / X (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={config.gapXmm}
                        onChange={(e) => updateConfig({ gapXmm: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#64748B] mb-0.5">Jarak Baris / Y (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={config.gapYmm}
                        onChange={(e) => updateConfig({ gapYmm: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                {/* Manual vs Symmetric Auto Paper Margins */}
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[#44546A] font-medium">Margin Kertas</label>
                    <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateConfig({ marginMode: 'auto' })}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                          config.marginMode === 'auto'
                            ? 'bg-[#1F3864] text-white shadow-2xs'
                            : 'text-[#475569] hover:text-[#131C31]'
                        }`}
                      >
                        Otomatis
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            marginMode: 'manual',
                            marginLeftMm: +geo.originX.toFixed(2),
                            marginRightMm: +geo.marginRightActual.toFixed(2),
                            marginTopMm: +geo.originY.toFixed(2),
                            marginBottomMm: +geo.marginBottomActual.toFixed(2),
                          })
                        }
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                          config.marginMode === 'manual'
                            ? 'bg-[#1F3864] text-white shadow-2xs'
                            : 'text-[#475569] hover:text-[#131C31]'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  {config.marginMode === 'auto' ? (
                    <div>
                      <label className="block text-[11px] text-[#64748B] mb-0.5">
                        Margin Minimum Simetris (mm)
                      </label>
                      <input
                        type="number"
                        step="0.2"
                        min="0"
                        value={config.marginMm}
                        onChange={(e) => updateConfig({ marginMm: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-[#64748B] mb-0.5">Atas (Top) mm</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={config.marginTopMm}
                            onChange={(e) => updateConfig({ marginTopMm: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#64748B] mb-0.5">Bawah (Bottom) mm</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={config.marginBottomMm}
                            onChange={(e) => updateConfig({ marginBottomMm: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#64748B] mb-0.5">Kiri (Left) mm</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={config.marginLeftMm}
                            onChange={(e) => updateConfig({ marginLeftMm: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#64748B] mb-0.5">Kanan (Right) mm</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={config.marginRightMm}
                            onChange={(e) => updateConfig({ marginRightMm: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`mt-2.5 p-3 rounded-xl border font-mono text-[11px] tabular-nums ${
                    geo.overflowsPaper
                      ? 'bg-[#FEF3C7] border-[#D97706] text-[#92400E]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#1F3864]'
                  }`}
                >
                  <div>
                    Grid: <strong>{geo.cols} × {geo.rows} = {geo.cardsPerSheet} kartu/lembar</strong>
                  </div>
                  <div className={geo.overflowsPaper ? 'text-[#92400E]' : 'text-[#55637A]'}>
                    Depan: Kiri {geo.originX.toFixed(1)} · Kanan {geo.marginRightActual.toFixed(1)} · Atas {geo.originY.toFixed(1)} · Bawah {geo.marginBottomActual.toFixed(1)} mm
                  </div>
                  {config.marginMode === 'manual' && (
                    <div className="text-[#55637A]">
                      Mirror Belakang ({config.flipMode}): X {geo.backOriginX.toFixed(1)} · Y {geo.backOriginY.toFixed(1)} mm
                    </div>
                  )}
                  {geo.overflowsPaper && (
                    <div className="font-semibold mt-1">
                      Perhatian: Kartu melebihi batas ukuran kertas. Kurangi margin atau jarak.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Crop Marks, Fold Marks & Duplex Symmetry */}
              <div className="pt-4 border-t border-[#E2E8F0]">
                <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
                  Presisi Potong, Lipat &amp; Bolak-Balik
                </h2>

                <label className="block text-[#44546A] font-medium mb-1">Mode Imposisi Cetak</label>
                <select
                  value={config.imposition}
                  onChange={(e) => updateConfig({ imposition: e.target.value as ImpositionMode })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5"
                >
                  <option value="duplex">Duplex Bolak-Balik Simetris (Depan-Belakang)</option>
                  <option value="foldable">Lipat &amp; Tempel Presisi (1 Sisi + Garis Lipat)</option>
                  <option value="front">Depan Saja</option>
                  <option value="back">Belakang Saja (Paste November)</option>
                  <option value="calibration">Tes Kalibrasi Presisi (+ / ○)</option>
                </select>

                <label className="block text-[#44546A] font-medium mb-1">Garis Potong (Crop Marks)</label>
                <select
                  value={config.cropStyle}
                  onChange={(e) => updateConfig({ cropStyle: e.target.value as CropMarkStyle })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2"
                >
                  <option value="full">Garis Tipis Penuh + Crop Marks Tepi</option>
                  <option value="crop">Sudut Crop Marks + Tanda Silang</option>
                  <option value="none">Tanpa Garis Potong</option>
                </select>

                <label className="flex items-center gap-2 text-[#334155] mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cutOnBack}
                    onChange={(e) => updateConfig({ cutOnBack: e.target.checked })}
                    className="accent-[#1F3864]"
                  />
                  Cetak crop &amp; fold marks juga di sisi belakang
                </label>

                <label className="block text-[#44546A] font-medium mb-1">Cara Balik Kertas (Duplex)</label>
                <select
                  value={config.flipMode}
                  onChange={(e) => updateConfig({ flipMode: e.target.value as FlipMode })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2"
                >
                  <option value="long">Balik Sisi Panjang (Long-edge) — Umum</option>
                  <option value="short">Balik Sisi Pendek (Short-edge)</option>
                </select>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Kalibrasi X (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.dx}
                      onChange={(e) => updateConfig({ dx: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Kalibrasi Y (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={config.dy}
                      onChange={(e) => updateConfig({ dy: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                </div>

                {config.imposition === 'back' && (
                  <label className="flex items-center gap-2 text-[#334155] mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.reverseBackOrder}
                      onChange={(e) => updateConfig({ reverseBackOrder: e.target.checked })}
                      className="accent-[#1F3864]"
                    />
                    Urutan terbalik (duplex manual)
                  </label>
                )}
              </div>

              {/* Section 3: Student Filter & Paste November Class Selector */}
              <div className="pt-4 border-t border-[#E2E8F0]">
                <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] mb-2">
                  Filter Siswa &amp; Sampel 3D
                </h2>

                <label className="block text-[#44546A] font-medium mb-1">Kelas (Jadwal Paste November)</label>
                <select
                  value={config.selectedClass}
                  onChange={(e) => {
                    updateConfig({ selectedClass: e.target.value });
                    setSheetIndex(0);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2"
                >
                  <option value="">Semua Kelas ({students.length} siswa)</option>
                  {classList.map((k) => (
                    <option key={k} value={k}>
                      {k} ({schedulesByClass[k]?.length ?? 0} mapel)
                    </option>
                  ))}
                </select>

                <label className="block text-[#44546A] font-medium mb-1">Ruang Ujian</label>
                <select
                  value={config.selectedRoom}
                  onChange={(e) => {
                    updateConfig({ selectedRoom: e.target.value });
                    setSheetIndex(0);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2"
                >
                  <option value="">Semua Ruang ({roomList.length} ruang)</option>
                  {roomList.map((r) => (
                    <option key={r} value={r}>
                      RUANG {r}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div>
                    <label className="block text-[#44546A] mb-0.5">No. dari</label>
                    <input
                      type="number"
                      placeholder="001"
                      value={config.noFrom}
                      onChange={(e) => {
                        updateConfig({ noFrom: e.target.value });
                        setSheetIndex(0);
                      }}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[#44546A] mb-0.5">Sampai</label>
                    <input
                      type="number"
                      placeholder="620"
                      value={config.noTo}
                      onChange={(e) => {
                        updateConfig({ noTo: e.target.value });
                        setSheetIndex(0);
                      }}
                      className="w-full px-2 py-1 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                    />
                  </div>
                </div>

                <label className="block text-[#44546A] font-medium mb-1">
                  Siswa Aktif (Mockup 3D &amp; SVG)
                </label>
                <select
                  value={selectedStudent.no}
                  onChange={(e) => setSelectedStudentNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] mb-2.5"
                >
                  {filteredStudents.slice(0, 120).map((s) => (
                    <option key={s.no} value={s.no}>
                      #{s.no} — {s.nama} ({s.kelas})
                    </option>
                  ))}
                </select>

                <label className="flex items-start gap-2 text-[#334155] mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showDeskOnCard}
                    onChange={(e) => updateConfig({ showDeskOnCard: e.target.checked })}
                    className="accent-[#1F3864] mt-0.5"
                  />
                  <span>
                    Sinkron No. Meja pada Kartu (
                    <span className="font-mono text-[#1F3864]">
                      {selectedStudent.ruang} ({deskLookup[selectedStudent.no] ?? 'MEJA 01'})
                    </span>
                    )
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setActiveTab('students');
                  }}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 mb-2 rounded-lg bg-[#EEF2FA] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#1F3864] font-semibold transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Tambah / Kelola Data Manual
                </button>

                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-[#94A3B8] hover:border-[#1F3864] hover:bg-[#F8FAFC] text-[#1F3864] font-medium cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Impor CSV Siswa Baru
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </label>
                {csvFeedback && (
                  <p className="text-[11px] text-[#059669] mt-1.5 font-medium">{csvFeedback}</p>
                )}
                {missingScheduleCount > 0 && (
                  <p className="text-[11px] text-[#B45309] mt-1.5 font-medium">
                    {missingScheduleCount} siswa memakai kelas di luar jadwal Paste November.
                  </p>
                )}
              </div>

              {/* Section 3B: QR Code Absensi Digital (Sudut Kartu) */}
              <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-[#1F3864]" />
                    Kode QR Absensi Ruang
                  </h2>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1F3864] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showQrCode}
                      onChange={(e) => updateConfig({ showQrCode: e.target.checked })}
                      className="accent-[#1F3864]"
                    />
                    Aktif
                  </label>
                </div>

                {config.showQrCode && (
                  <>
                    <div>
                      <label className="block text-[#44546A] font-medium mb-1">
                        Posisi Sudut Kartu Ujian
                      </label>
                      <select
                        value={config.qrCorner}
                        onChange={(e) =>
                          updateConfig({ qrCorner: e.target.value as QrCornerPosition })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                      >
                        <option value="bottom_right">Sudut Kanan Bawah (Bawaan)</option>
                        <option value="bottom_left">Sudut Kiri Bawah (+ Info Scan)</option>
                        <option value="top_right">Sudut Kanan Atas (Header)</option>
                        <option value="top_left">Sudut Kiri Atas (Header)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[#44546A] font-medium mb-1">
                          Data Tersandi (Payload)
                        </label>
                        <select
                          value={config.qrFormat}
                          onChange={(e) =>
                            updateConfig({ qrFormat: e.target.value as QrPayloadFormat })
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                        >
                          <option value="full_no">No. Peserta Lengkap</option>
                          <option value="short_no">No. Urut Saja</option>
                          <option value="json">JSON Lengkap Siswa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#44546A] font-medium mb-1">
                          Ukuran mm
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="11"
                          max="17"
                          value={config.qrSizeMm}
                          onChange={(e) =>
                            updateConfig({
                              qrSizeMm: Math.max(10.5, Math.min(17.5, Number(e.target.value) || 13.5)),
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-[#CBD5E1] font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                      <div className="w-14 h-14 p-1 rounded-lg bg-white border border-[#1F3864] shrink-0">
                        <QrCodeSvg
                          student={selectedStudent}
                          format={config.qrFormat}
                          mejaLabel={
                            config.showDeskOnCard ? deskLookup[selectedStudent.no] : undefined
                          }
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#1F3864] truncate">
                          Uji Scan #{selectedStudent.no}
                        </div>
                        <div className="font-mono text-[10px] text-[#475569] break-all leading-tight mt-0.5">
                          {formatStudentQrPayload(
                            selectedStudent,
                            config.qrFormat,
                            config.showDeskOnCard ? deskLookup[selectedStudent.no] : undefined,
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const payload = formatStudentQrPayload(
                              selectedStudent,
                              config.qrFormat,
                              config.showDeskOnCard ? deskLookup[selectedStudent.no] : undefined,
                            );
                            const sym = getQrSymbolData(payload);
                            const svgStr = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sym.viewBoxSize} ${sym.viewBoxSize}" width="240" height="240" shape-rendering="crispEdges"><rect width="${sym.viewBoxSize}" height="${sym.viewBoxSize}" fill="#FFFFFF"/><path d="${sym.pathData}" fill="#000000"/></svg>`;
                            triggerBlobDownload(
                              new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }),
                              `QR_Peserta_${selectedStudent.no}.svg`,
                            );
                          }}
                          className="mt-1.5 text-[10px] font-semibold text-[#1F3864] underline hover:text-[#24407F]"
                        >
                          Unduh QR SVG ({selectedStudent.no})
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Section 4: Direct Print Command */}
              <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
                <h2 className="font-display font-bold text-[11px] uppercase tracking-wider text-[#64748B]">
                  Perintah Cetak Langsung
                </h2>

                <div>
                  <label className="block text-[#44546A] font-medium mb-1">Cakupan Halaman Cetak</label>
                  <select
                    value={printScope}
                    onChange={(e) => setPrintScope(e.target.value as 'all' | 'current')}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                  >
                    <option value="all">
                      Semua Lembar ({totalSheets} lembar · {config.imposition === 'duplex' ? totalSheets * 2 : totalSheets} hal)
                    </option>
                    <option value="current">
                      Hanya Lembar Aktif (Lembar {safeSheetIdx + 1})
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleDirectPrint()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
                >
                  <Printer className="w-4 h-4 text-[#C9A227]" />
                  Cetak Langsung ({totalPrintPages} Halaman)
                </button>

                <div className="p-3 rounded-xl bg-[#EEF2FA] border border-[#DCE2EE] text-[11px] text-[#334155] leading-relaxed">
                  <strong className="text-[#1F3864]">Saat dialog cetak:</strong> pilih skala{' '}
                  <strong>100% / Actual size</strong>, margin <strong>None</strong>, matikan header &amp; footer, ukuran kertas sama ({config.paper}), aktifkan <strong>Duplex ({config.flipMode === 'long' ? 'Long-edge' : 'Short-edge'})</strong>.
                </div>
              </div>
            </SettingsDrawer>

            <main className="flex-1 min-w-0 h-full overflow-hidden">
              {activeTab === 'dashboard' && (
                <DashboardOverview
                  students={students}
                  filteredStudents={filteredStudents}
                  committeeMembers={committeeMembers}
                  schedulesMap={schedulesByClass}
                  scheduleEntries={scheduleEntries}
                  config={config}
                  stickerConfig={stickerConfig}
                  seatingConfig={seatingConfig}
                  attendanceConfig={attendanceConfig}
                  stats={{
                    cardsPerSheet: geo.cardsPerSheet,
                    cardSheets: totalSheets,
                    stickerCount: filteredStickers.length,
                    stickerSheets: totalStickerSheets,
                    seatingPages: seatingPages.length,
                    attendancePages: attendancePages.length,
                    missingScheduleCount,
                  }}
                  onNavigateTab={handleSelectWorkspaceTab}
                  onQuickJumpRoom={handleQuickJumpRoom}
                  onUseScheduleForAttendance={handleUseScheduleForAttendance}
                  onPrintCards={() => handleDirectPrint()}
                />
              )}
              {activeTab === 'committee' && (
                <CommitteeManager
                  members={committeeMembers}
                  onAddMember={handleAddCommitteeMember}
                  onUpdateMember={handleUpdateCommitteeMember}
                  onDeleteMember={handleDeleteCommitteeMember}
                  onResetMembers={handleResetCommitteeMembers}
                  onNavigateTab={handleSelectWorkspaceTab}
                />
              )}
              {(activeTab === 'studio' || activeTab === 'mockup3d') && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="no-print bg-white border-b border-[#E2E8F0] px-4 py-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('studio')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        activeTab === 'studio'
                          ? 'bg-[#1F3864] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Lembar Cetak 2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('mockup3d')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        activeTab === 'mockup3d'
                          ? 'bg-[#1F3864] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5" />
                      Pratinjau Mockup 3D
                    </button>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B] truncate tabular-nums">
                    Sampel aktif: #{selectedStudent.no} {selectedStudent.nama} ({selectedStudent.kelas})
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {activeTab === 'studio' ? (
                    <CardSheetPreview
                      students={filteredStudents}
                      config={config}
                      selectedStudent={selectedStudent}
                      deskLookup={deskLookup}
                      schedulesMap={schedulesByClass}
                      sheetIndex={safeSheetIdx}
                      onSheetIndexChange={setSheetIndex}
                      onSelectStudent={(s) => setSelectedStudentNo(s.no)}
                      onConfigChange={updateConfig}
                      onPrintBatch={handleDirectPrint}
                    />
                  ) : (
                    <Mockup3DViewer
                      student={selectedStudent}
                      config={config}
                      deskLabel={deskLookup[selectedStudent.no]}
                      schedulesMap={schedulesByClass}
                    />
                  )}
                </div>
              </div>
            )}
            {activeTab === 'sticker' && (
              <DeskStickerStudio
                students={students}
                paperConfig={config}
                stickerConfig={stickerConfig}
                sheetIndex={safeStickerSheetIdx}
                onSheetIndexChange={setStickerSheetIndex}
                onPaperConfigChange={updateConfig}
                onStickerConfigChange={updateStickerConfig}
                onPrintStickers={handleStickerPrint}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
              />
            )}
            {activeTab === 'seating' && (
              <SeatingPlanStudio
                students={students}
                filteredCardStudents={filteredStudents}
                cardFilterDesc={cardFilterDesc}
                groupingMode={stickerConfig.groupingMode}
                paperConfig={config}
                seatingConfig={seatingConfig}
                schedulesMap={schedulesByClass}
                pageIndex={safeSeatingPageIdx}
                onPageIndexChange={setSeatingPageIndex}
                onPaperConfigChange={updateConfig}
                onSeatingConfigChange={updateSeatingConfig}
                onPrintSeating={handleSeatingPrint}
                onInspectStudentCard={(st) => {
                  setSelectedStudentNo(st.no);
                  setSettingsOpen(false);
                  setActiveTab('studio');
                }}
                onNavigateTab={handleSelectWorkspaceTab}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
              />
            )}
            {activeTab === 'attendance' && (
              <AttendanceSheetStudio
                students={students}
                filteredCardStudents={filteredStudents}
                cardFilterDesc={cardFilterDesc}
                groupingMode={stickerConfig.groupingMode}
                paperConfig={config}
                attendanceConfig={attendanceConfig}
                schedulesMap={schedulesByClass}
                pageIndex={safeAttendancePageIdx}
                onPageIndexChange={setAttendancePageIndex}
                onPaperConfigChange={updateConfig}
                onAttendanceConfigChange={updateAttendanceConfig}
                onPrintAttendance={handleAttendancePrint}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
              />
            )}
            {activeTab === 'berita_acara' && (
              <BeritaAcaraWorkspace
                records={beritaAcaraRecords}
                proctors={proctors}
                paperConfig={config}
                baConfig={beritaAcaraConfig}
                academicYear={attendanceConfig.academicYear || '2026/2027'}
                onBaConfigChange={updateBeritaAcaraConfig}
                onSaveOverride={handleSaveBeritaAcaraOverride}
                onPrintRecords={handleBeritaAcaraPrint}
                onNavigateTab={handleSelectWorkspaceTab}
              />
            )}
            {activeTab === 'students' && (
              <StudentDataManager
                students={students}
                groupingMode={stickerConfig.groupingMode}
                schedulesMap={schedulesByClass}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onResetStudents={handleResetStudents}
                onImportCsv={handleCsvUpload}
                onInspectStudentCard={(st) => {
                  setSelectedStudentNo(st.no);
                  setSettingsOpen(false);
                  setActiveTab('studio');
                }}
                onNavigateTab={handleSelectWorkspaceTab}
                onPrintRoster={() => window.print()}
                csvFeedback={csvFeedback}
              />
            )}
            {activeTab === 'schedule' && (
              <ExamScheduleManager
                entries={scheduleEntries}
                schedulesMap={schedulesByClass}
                students={students}
                committeeMembers={committeeMembers}
                proctors={proctors}
                proctorMatrix={proctorMatrix}
                academicYear={attendanceConfig.academicYear || '2026/2027'}
                onAddEntries={handleAddScheduleEntries}
                onUpdateEntries={handleUpdateScheduleEntries}
                onToggleStatus={handleToggleScheduleStatus}
                onDeleteEntries={handleDeleteScheduleEntries}
                onResetDefaults={handleResetSchedules}
                onPrintSchedule={handleSchedulePrint}
                onNavigateTab={handleSelectWorkspaceTab}
                onInspectClassCard={(kelas) => {
                  updateConfig({ selectedClass: kelas, selectedRoom: '', noFrom: '', noTo: '' });
                  setSheetIndex(0);
                  const firstInClass = students.find((s) => s.kelas === kelas);
                  if (firstInClass) setSelectedStudentNo(firstInClass.no);
                  setSettingsOpen(false);
                  setActiveTab('studio');
                }}
                onUseScheduleForAttendance={handleUseScheduleForAttendance}
              />
            )}
            {activeTab === 'proctor' && (
              <ProctorManager
                proctors={proctors}
                matrix={proctorMatrix}
                schedulesMap={schedulesByClass}
                scheduleEntries={scheduleEntries}
                students={students}
                academicYear={attendanceConfig.academicYear || '2026/2027'}
                onAddProctor={handleAddProctor}
                onUpdateProctor={handleUpdateProctor}
                onToggleProctorStatus={handleToggleProctorStatus}
                onDeleteProctor={handleDeleteProctor}
                onUpdateMatrixSlot={handleUpdateMatrixSlot}
                onResyncFromSchedule={handleResyncProctorsFromSchedule}
                onResetAll={handleResetProctors}
                onPrintProctors={handleProctorPrint}
                onNavigateTab={handleSelectWorkspaceTab}
              />
            )}
            {activeTab === 'settings' && (
              <SystemSettingsWorkspace
                schoolSettings={schoolSettings}
                academicYear={attendanceConfig.academicYear || '2026/2027'}
                paperConfig={config}
                stickerConfig={stickerConfig}
                seatingConfig={seatingConfig}
                attendanceConfig={attendanceConfig}
                beritaAcaraConfig={beritaAcaraConfig}
                students={students}
                committeeMembers={committeeMembers}
                scheduleEntries={scheduleEntries}
                proctors={proctors}
                proctorMatrix={proctorMatrix}
                beritaAcaraOverrides={beritaAcaraOverrides}
                authToken={authToken}
                authUser={authUser}
                onUpdateSchoolSettings={updateSchoolSettings}
                onAcademicYearChange={(year) => updateAttendanceConfig({ academicYear: year })}
                onUpdatePaperConfig={updateConfig}
                onUpdateStickerConfig={updateStickerConfig}
                onUpdateBaConfig={updateBeritaAcaraConfig}
                onRestoreBackup={handleRestoreBackup}
                onResetAllConfigs={handleResetAllConfigs}
                onNavigateTab={handleSelectWorkspaceTab}
              />
            )}
            {activeTab === 'accounts' && authUser.role === 'admin' && (
              <AccountAccessManager
                authToken={authToken}
                currentUser={authUser}
                committeeMembers={committeeMembers}
                onNavigateTab={handleSelectWorkspaceTab}
              />
            )}
            {(activeTab === 'export' || activeTab === 'docs') && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="bg-white border-b border-[#E2E8F0] px-6 py-2 flex items-center gap-2 shrink-0">
                  <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('export')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        activeTab === 'export'
                          ? 'bg-[#1F3864] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      Ekspor PDF/X-1a &amp; Arsip ZIP
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('docs')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                        activeTab === 'docs'
                          ? 'bg-[#1F3864] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      Panduan Produksi &amp; Laporan Efisiensi
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {activeTab === 'docs' ? (
                    <ProductionDocsPanel
                      filteredStudents={filteredStudents}
                      config={config}
                      schedulesMap={schedulesByClass}
                    />
                  ) : (
                    <ExportArchivePanel
                      filteredStudents={filteredStudents}
                      allStudents={students}
                      selectedStudent={selectedStudent}
                      config={config}
                      groupingMode={stickerConfig.groupingMode}
                      schedulesMap={schedulesByClass}
                      onConfigChange={updateConfig}
                    />
                  )}
                </div>
              </div>
            )}
            </main>
            </div>
          </div>
        </div>

        {/* Bottom Dark Navy Institutional Footer */}
        <footer className="no-print h-9 px-4 lg:px-6 bg-[#03173C] border-t border-white/10 text-white/85 flex items-center justify-between gap-4 text-[11px] shrink-0">
          <span className="truncate">
            &copy; 2026 SMA Negeri 1 Alalak. Semua Hak Dilindungi.
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-block w-28 h-[1.5px] bg-gradient-to-r from-transparent via-[#FACC15] to-[#FACC15]" />
            <span className="italic text-white/90 whitespace-nowrap">
              &ldquo;Pendidikan Bermutu, Masa Depan Maju&rdquo;
            </span>
          </div>
        </footer>
      </div>

      {/* Dedicated Full-Batch 1:1mm Native Print DOM (hidden on screen, printed cleanly at 100% scale) */}
      <div
        className="print-only-root"
        style={{
          filter:
            activeTab !== 'sticker' &&
            activeTab !== 'seating' &&
            activeTab !== 'attendance' &&
            activeTab !== 'berita_acara' &&
            activeTab !== 'students' &&
            activeTab !== 'schedule' &&
            activeTab !== 'proctor' &&
            config.cmykSoftProof
              ? 'contrast(0.95) saturate(0.92) sepia(0.04)'
              : undefined,
        }}
      >
        {activeTab === 'sticker'
          ? filteredStickers.length > 0 && (
              <StickerSheetPagesBlock
                stickers={filteredStickers}
                stickerConfig={stickerConfig}
                geo={stickerGeo}
                sheetIndices={printStickerIndices}
                forPrint
              />
            )
          : activeTab === 'seating'
            ? printSeatingPages.length > 0 && (
                <SeatingSheetPagesBlock
                  pages={printSeatingPages}
                  paperConfig={config}
                  seatingConfig={seatingConfig}
                  forPrint
                />
              )
            : activeTab === 'attendance'
              ? printAttendancePages.length > 0 && (
                  <AttendanceSheetPagesBlock
                    pages={printAttendancePages}
                    paperConfig={config}
                    attendanceConfig={attendanceConfig}
                    forPrint
                  />
                )
              : activeTab === 'berita_acara'
                ? beritaAcaraPrintPages.length > 0 && (
                    <BeritaAcaraPagesBlock
                      pages={beritaAcaraPrintPages}
                      paperConfig={config}
                      baConfig={beritaAcaraConfig}
                      academicYear={attendanceConfig.academicYear || '2026/2027'}
                      forPrint
                    />
                  )
                : activeTab === 'students'
                  ? students.length > 0 && (
                      <StudentRosterPrintBlock
                        students={students}
                        groupingMode={stickerConfig.groupingMode}
                        academicYear={attendanceConfig.academicYear || '2026/2027'}
                      />
                    )
                  : activeTab === 'schedule'
                    ? (
                      <ScheduleRosterPrintBlock
                        mode={schedulePrintPayload?.mode ?? 'combined'}
                        combinedRows={schedulePrintPayload?.combinedRows ?? combinedScheduleRows}
                        sessionRows={schedulePrintPayload?.sessionRows ?? scheduleEntries}
                        selectedClass={schedulePrintPayload?.selectedClass}
                        filterSummary={schedulePrintPayload?.filterSummary}
                        academicYear={attendanceConfig.academicYear || '2026/2027'}
                        totalStudents={students.length}
                        totalRooms={roomList.length}
                        chairName={activeChair?.nama}
                        chairNip={activeChair?.nip}
                      />
                    )
                    : activeTab === 'proctor'
                      ? (
                        <ProctorRosterPrintBlock
                          mode={proctorPrintPayload?.mode ?? 'both'}
                          proctors={
                            proctorPrintPayload?.proctors ??
                            [...proctors].sort((a, b) => a.code - b.code)
                          }
                          matrix={proctorPrintPayload?.matrix ?? proctorMatrix}
                          dutiesByCode={dutiesByCode}
                          scheduleEntries={scheduleEntries}
                          academicYear={attendanceConfig.academicYear || '2026/2027'}
                          filterSummary={proctorPrintPayload?.filterSummary}
                          chairName={activeChair?.nama}
                          chairNip={activeChair?.nip}
                        />
                      )
                      : filteredStudents.length > 0 && (
                        <SheetPagesBlock
                          students={filteredStudents}
                          config={config}
                          geo={geo}
                          sheetIndices={printSheetIndices}
                          deskLookup={deskLookup}
                          schedulesMap={schedulesByClass}
                          isPrintDom
                        />
                      )}
      </div>
    </>
  );
}
