import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  Mail,
  Monitor,
  Phone,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import type { CommitteeMember } from '../data/committeeData';
import { LOGO_RIGHT_DATA_URI, type StudentRecord } from '../data/pasData';
import type { ProctorMatrixSession, ProctorRecord } from '../data/proctorData';
import {
  PAPER_DIMENSIONS,
  type AttendanceConfig,
  type BeritaAcaraConfig,
  type ExamOrderMode,
  type MainWorkspaceTab,
  type PaperPreset,
  type ParticipantNumberFormat,
  type PrepressConfig,
  type SchoolSettings,
  type SeatingConfig,
  type StickerConfig,
  type StickerGroupingMode,
} from '../types/prepress';
import {
  changeOwnPassword,
  fetchManagedAccounts,
  type AuthUser,
  type ManagedAccount,
} from '../utils/authClient';
import type { BeritaAcaraOverride } from '../utils/beritaAcaraStore';
import type { ExamScheduleEntry } from '../utils/scheduleStore';

type SettingsSubTab =
  | 'identitas'
  | 'tahun_pelajaran'
  | 'pengguna'
  | 'hak_akses'
  | 'konfigurasi_ujian'
  | 'backup_restore';

export interface SystemBackupPayload {
  version: number;
  exportedAt: string;
  schoolSettings: SchoolSettings;
  prepressConfig: PrepressConfig;
  stickerConfig: StickerConfig;
  seatingConfig: SeatingConfig;
  attendanceConfig: AttendanceConfig;
  beritaAcaraConfig: BeritaAcaraConfig;
  students: StudentRecord[];
  committeeMembers: CommitteeMember[];
  scheduleEntries: ExamScheduleEntry[];
  proctors: ProctorRecord[];
  proctorMatrix: ProctorMatrixSession[];
  beritaAcaraOverrides: Record<string, BeritaAcaraOverride>;
}

interface SystemSettingsWorkspaceProps {
  schoolSettings: SchoolSettings;
  academicYear: string;
  paperConfig: PrepressConfig;
  stickerConfig: StickerConfig;
  seatingConfig: SeatingConfig;
  attendanceConfig: AttendanceConfig;
  beritaAcaraConfig: BeritaAcaraConfig;
  students: StudentRecord[];
  committeeMembers: CommitteeMember[];
  scheduleEntries: ExamScheduleEntry[];
  proctors: ProctorRecord[];
  proctorMatrix: ProctorMatrixSession[];
  beritaAcaraOverrides: Record<string, BeritaAcaraOverride>;
  authToken: string;
  authUser: AuthUser;
  onUpdateSchoolSettings: (patch: Partial<SchoolSettings>) => void;
  onAcademicYearChange: (year: string) => void;
  onUpdatePaperConfig: (patch: Partial<PrepressConfig>) => void;
  onUpdateStickerConfig: (patch: Partial<StickerConfig>) => void;
  onUpdateBaConfig: (patch: Partial<BeritaAcaraConfig>) => void;
  onRestoreBackup: (payload: Partial<SystemBackupPayload>) => void;
  onResetAllConfigs: () => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

function triggerJsonDownload(data: unknown, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const SystemSettingsWorkspace: React.FC<SystemSettingsWorkspaceProps> = ({
  schoolSettings,
  academicYear,
  paperConfig,
  stickerConfig,
  seatingConfig,
  attendanceConfig,
  beritaAcaraConfig,
  students,
  committeeMembers,
  scheduleEntries,
  proctors,
  proctorMatrix,
  beritaAcaraOverrides,
  authToken,
  authUser,
  onUpdateSchoolSettings,
  onAcademicYearChange,
  onUpdatePaperConfig,
  onUpdateStickerConfig,
  onUpdateBaConfig,
  onRestoreBackup,
  onResetAllConfigs,
  onNavigateTab,
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>('identitas');
  const [draft, setDraft] = useState<SchoolSettings>(schoolSettings);
  const [draftAcademicYear, setDraftAcademicYear] = useState<string>(academicYear);
  const [customAcademicYear, setCustomAcademicYear] = useState<string>(academicYear);
  const [draftExamTitle, setDraftExamTitle] = useState<string>(beritaAcaraConfig.examPeriodTitle);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Help modals (FAQ & Contact Admin)
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Change own password state inside Pengguna tab
  const [currPw, setCurrPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [managedAccounts, setManagedAccounts] = useState<ManagedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  useEffect(() => {
    setDraft(schoolSettings);
  }, [schoolSettings]);

  useEffect(() => {
    setDraftAcademicYear(academicYear);
    setCustomAcademicYear(academicYear);
  }, [academicYear]);

  useEffect(() => {
    setDraftExamTitle(beritaAcaraConfig.examPeriodTitle);
  }, [beritaAcaraConfig.examPeriodTitle]);

  useEffect(() => {
    if (subTab === 'pengguna' && authUser.role === 'admin') {
      setAccountsLoading(true);
      fetchManagedAccounts(authToken)
        .then((res) => setManagedAccounts(res.accounts))
        .catch(() => undefined)
        .finally(() => setAccountsLoading(false));
    }
  }, [subTab, authUser.role, authToken]);

  const handleSaveSchoolSettings = (ev?: React.FormEvent) => {
    if (ev) ev.preventDefault();
    setErrorFeedback(null);
    if (!draft.schoolName.trim() || !draft.npsn.trim() || !draft.principalName.trim()) {
      setErrorFeedback('Nama Sekolah, NPSN, dan Kepala Sekolah wajib diisi.');
      return;
    }
    const nowLabel = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    onUpdateSchoolSettings({
      ...draft,
      schoolName: draft.schoolName.trim(),
      npsn: draft.npsn.trim(),
      principalName: draft.principalName.trim(),
      address: draft.address.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      documentUploadDeadlineDays: Math.max(1, Math.min(30, Number(draft.documentUploadDeadlineDays) || 3)),
      lastSavedAt: nowLabel,
    });
    if (draft.address.trim()) {
      onUpdateBaConfig({ schoolAddress: draft.address.trim() });
    }
    setSaveFeedback('Pengaturan identitas sekolah & preferensi umum berhasil disimpan.');
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleLogoUpload = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      setErrorFeedback('Ukuran file logo maksimal 1,2 MB.');
      ev.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setDraft((prev) => ({ ...prev, logoDataUri: result }));
        onUpdateSchoolSettings({ logoDataUri: result });
        setSaveFeedback(`Logo sekolah diperbarui dari "${file.name}".`);
        setTimeout(() => setSaveFeedback(null), 4000);
      }
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
  };

  const handleSaveAcademicYear = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrorFeedback(null);
    const chosenYear = (draftAcademicYear === 'custom' ? customAcademicYear : draftAcademicYear).trim();
    if (!/^\d{4}\/\d{4}$/.test(chosenYear)) {
      setErrorFeedback('Format Tahun Pelajaran harus YYYY/YYYY, mis. 2026/2027.');
      return;
    }
    onAcademicYearChange(chosenYear);
    onUpdateSchoolSettings({ semester: draft.semester });
    if (draftExamTitle.trim()) {
      onUpdateBaConfig({ examPeriodTitle: draftExamTitle.trim() });
    }
    setSaveFeedback(`Tahun Pelajaran aktif diperbarui ke ${chosenYear} (${draft.semester}).`);
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleChangeOwnPassword = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrorFeedback(null);
    setSaveFeedback(null);
    if (newPw !== confirmPw) {
      setErrorFeedback('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    setPwBusy(true);
    try {
      await changeOwnPassword(authToken, currPw, newPw);
      setCurrPw('');
      setNewPw('');
      setConfirmPw('');
      setSaveFeedback(`Kata sandi akun "${authUser.username}" berhasil diperbarui.`);
    } catch (err) {
      setErrorFeedback(err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.');
    } finally {
      setPwBusy(false);
    }
  };

  const handleExportBackup = () => {
    const payload: SystemBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      schoolSettings,
      prepressConfig: paperConfig,
      stickerConfig,
      seatingConfig,
      attendanceConfig,
      beritaAcaraConfig,
      students,
      committeeMembers,
      scheduleEntries,
      proctors,
      proctorMatrix,
      beritaAcaraOverrides,
    };
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(payload, `SMAN1ALALAK_PAS_Backup_${dateStamp}.json`);
    setSaveFeedback('Berkas cadangan penuh (.json) berhasil diunduh.');
    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleImportBackup = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setErrorFeedback(null);
    setSaveFeedback(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<SystemBackupPayload>;
      if (!parsed || typeof parsed !== 'object' || (!parsed.students && !parsed.schoolSettings && !parsed.scheduleEntries)) {
        throw new Error('Struktur file cadangan tidak valid.');
      }
      onRestoreBackup(parsed);
      setSaveFeedback(`Data berhasil dipulihkan dari "${file.name}".`);
    } catch (err) {
      setErrorFeedback(err instanceof Error ? err.message : 'Gagal membaca file cadangan JSON.');
    } finally {
      ev.target.value = '';
    }
  };

  const activeLogoSrc = draft.logoDataUri || LOGO_RIGHT_DATA_URI;

  const subTabs: Array<{ id: SettingsSubTab; label: string; icon: React.ReactNode }> = [
    { id: 'identitas', label: 'Identitas Sekolah', icon: <Building2 className="w-4 h-4" /> },
    { id: 'tahun_pelajaran', label: 'Tahun Pelajaran', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'pengguna', label: 'Pengguna', icon: <User className="w-4 h-4" /> },
    { id: 'hak_akses', label: 'Hak Akses', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'konfigurasi_ujian', label: 'Konfigurasi Ujian', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'backup_restore', label: 'Backup & Restore', icon: <Database className="w-4 h-4" /> },
  ];

  const academicYearPresets = ['2025/2026', '2026/2027', '2027/2028'];
  const isPresetYear = academicYearPresets.includes(draftAcademicYear);

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-6">
      <div className="max-w-[1380px] mx-auto space-y-4">
        {/* Royal Blue Hero Header Banner */}
        <section
          className="relative rounded-2xl px-6 py-4 text-white shadow-[0_6px_22px_rgba(13,60,142,0.22)] overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            background: 'linear-gradient(125deg, #0B3A8A 0%, #1556C4 52%, #0F46A8 100%)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute -top-10 right-[26%] w-28 h-48 bg-white/[0.05] rotate-[28deg]" />
            <div className="absolute -top-10 right-[16%] w-16 h-48 bg-white/[0.04] rotate-[28deg]" />
          </div>

          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl lg:text-2xl tracking-tight leading-tight">
                Pengaturan
              </h1>
              <p className="text-xs text-[#DBEAFE] mt-0.5 italic">
                Kelola seluruh pengaturan sistem sesuai kebutuhan
              </p>
            </div>
          </div>

          <nav
            aria-label="Breadcrumb"
            className="relative z-10 flex items-center gap-1.5 text-xs text-[#DBEAFE] whitespace-nowrap shrink-0"
          >
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            <span className="font-semibold text-white">Pengaturan</span>
          </nav>
        </section>

        {/* 6-Tab Settings Navigation Strip */}
        <div
          role="tablist"
          aria-label="Kategori Pengaturan Sistem"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
        >
          {subTabs.map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSubTab(t.id);
                  setErrorFeedback(null);
                  setSaveFeedback(null);
                }}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all duration-150 whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-[#1D64D8] to-[#154EB8] border-[#154EB8] text-white shadow-[0_4px_12px_rgba(29,100,216,0.28)]'
                    : 'bg-white border-[#DCE5F2] text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#BFDBFE]'
                }`}
              >
                <span className={active ? 'text-white' : 'text-[#1D4ED8]'}>{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Feedback Alerts */}
        {errorFeedback && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs"
          >
            <span className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorFeedback}
            </span>
            <button type="button" onClick={() => setErrorFeedback(null)} className="p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {saveFeedback && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs"
          >
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {saveFeedback}
            </span>
            <button type="button" onClick={() => setSaveFeedback(null)} className="p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main 12-Col Layout: Left Primary Workspace (8 cols) + Right System Info & Help (4 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT WORKSPACE COLUMN */}
          <div className="xl:col-span-8 space-y-4">
            {subTab === 'identitas' && (
              <form onSubmit={handleSaveSchoolSettings} className="space-y-4">
                {/* Identitas Sekolah Card */}
                <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                      Identitas Sekolah
                    </h2>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* School Crest Preview + Upload */}
                    <div className="md:col-span-4 flex flex-col items-center p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="w-32 h-32 flex items-center justify-center mb-3 bg-white rounded-xl border border-[#E2E8F0] p-2">
                        <img
                          src={activeLogoSrc}
                          alt={`Logo ${draft.schoolName}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1D64D8] hover:bg-[#1552B8] text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        Ubah Logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {draft.logoDataUri && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, logoDataUri: '' }));
                            onUpdateSchoolSettings({ logoDataUri: '' });
                          }}
                          className="mt-2 text-[11px] font-semibold text-[#64748B] hover:text-[#1D4ED8]"
                        >
                          Kembalikan Logo Bawaan
                        </button>
                      )}
                    </div>

                    {/* Identity Fields */}
                    <div className="md:col-span-8 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-name"
                          className="sm:col-span-4 font-semibold text-[#334155]"
                        >
                          Nama Sekolah <span className="text-[#DC2626]">*</span>
                        </label>
                        <input
                          id="school-name"
                          type="text"
                          required
                          value={draft.schoolName}
                          onChange={(e) => setDraft({ ...draft, schoolName: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] font-medium focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-npsn"
                          className="sm:col-span-4 font-semibold text-[#334155]"
                        >
                          NPSN <span className="text-[#DC2626]">*</span>
                        </label>
                        <input
                          id="school-npsn"
                          type="text"
                          required
                          value={draft.npsn}
                          onChange={(e) => setDraft({ ...draft, npsn: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white font-mono text-[#131C31] tabular-nums focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-start gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-address"
                          className="sm:col-span-4 font-semibold text-[#334155] sm:pt-2"
                        >
                          Alamat
                        </label>
                        <textarea
                          id="school-address"
                          rows={2}
                          value={draft.address}
                          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] leading-relaxed focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-principal"
                          className="sm:col-span-4 font-semibold text-[#334155]"
                        >
                          Kepala Sekolah <span className="text-[#DC2626]">*</span>
                        </label>
                        <input
                          id="school-principal"
                          type="text"
                          required
                          value={draft.principalName}
                          onChange={(e) => setDraft({ ...draft, principalName: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-email"
                          className="sm:col-span-4 font-semibold text-[#334155]"
                        >
                          Email Sekolah
                        </label>
                        <input
                          id="school-email"
                          type="email"
                          value={draft.email}
                          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-1.5 sm:gap-3">
                        <label
                          htmlFor="school-phone"
                          className="sm:col-span-4 font-semibold text-[#334155]"
                        >
                          Telepon
                        </label>
                        <input
                          id="school-phone"
                          type="text"
                          value={draft.phone}
                          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                          className="sm:col-span-8 px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white font-mono text-[#131C31] tabular-nums focus:border-[#1D4ED8]"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pengaturan Umum Card */}
                <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                      <Settings className="w-4 h-4" />
                    </div>
                    <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                      Pengaturan Umum
                    </h2>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    {/* Left Dropdowns */}
                    <div className="space-y-3.5">
                      <div>
                        <label
                          htmlFor="pref-num-format"
                          className="block font-semibold text-[#1E293B] mb-1.5"
                        >
                          Format Penomoran Peserta
                        </label>
                        <select
                          id="pref-num-format"
                          value={draft.participantNumberFormat}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              participantNumberFormat: e.target.value as ParticipantNumberFormat,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                        >
                          <option value="nis">NIS</option>
                          <option value="pas_card">Format Kartu PAS (01-26-XXX)</option>
                          <option value="seq_year">Nomor Urut + Tahun Pelajaran</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="pref-exam-order"
                          className="block font-semibold text-[#1E293B] mb-1.5"
                        >
                          Urutan Nomor Ujian
                        </label>
                        <select
                          id="pref-exam-order"
                          value={draft.examOrderMode}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              examOrderMode: e.target.value as ExamOrderMode,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                        >
                          <option value="urut_absen">Urut Absen</option>
                          <option value="urut_nama">Urut Abjad Nama (A–Z)</option>
                          <option value="urut_ruang">Urut Ruang &amp; Kelas</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="pref-room-digits"
                          className="block font-semibold text-[#1E293B] mb-1.5"
                        >
                          Jumlah Digit Pada Nomor Ruang
                        </label>
                        <select
                          id="pref-room-digits"
                          value={draft.roomDigitCount}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              roomDigitCount: (Number(e.target.value) as 1 | 2 | 3) || 2,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                        >
                          <option value={2}>2 Digit (01, 02, ...)</option>
                          <option value={1}>1 Digit (1, 2, ...)</option>
                          <option value={3}>3 Digit (001, 002, ...)</option>
                        </select>
                      </div>
                    </div>

                    {/* Right Toggles & Deadline */}
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-[#1E293B]">
                              Aktifkan Notifikasi
                            </div>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Terima notifikasi jadwal ujian dan pengumuman
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.enableNotifications}
                            aria-label="Aktifkan Notifikasi"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                enableNotifications: !draft.enableNotifications,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                              draft.enableNotifications ? 'bg-[#1D64D8]' : 'bg-[#CBD5E1]'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                                draft.enableNotifications ? 'translate-x-5.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold text-[#1E293B]">
                              Tampilkan Identitas Peserta
                            </div>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Tampilkan foto dan identitas pada daftar hadir
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.showStudentIdentityOnAttendance}
                            aria-label="Tampilkan Identitas Peserta"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                showStudentIdentityOnAttendance:
                                  !draft.showStudentIdentityOnAttendance,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                              draft.showStudentIdentityOnAttendance
                                ? 'bg-[#1D64D8]'
                                : 'bg-[#CBD5E1]'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                                draft.showStudentIdentityOnAttendance
                                  ? 'translate-x-5.5'
                                  : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <label
                              htmlFor="pref-upload-days"
                              className="block font-semibold text-[#1E293B]"
                            >
                              Batas Waktu Upload Dokumen
                            </label>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Maksimal {draft.documentUploadDeadlineDays} hari setelah ujian
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              id="pref-upload-days"
                              type="number"
                              min={1}
                              max={30}
                              value={draft.documentUploadDeadlineDays}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  documentUploadDeadlineDays: Math.max(
                                    1,
                                    Math.min(30, Number(e.target.value) || 1),
                                  ),
                                })
                              }
                              className="w-16 px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] font-mono text-center text-[#131C31] tabular-nums"
                            />
                            <span className="text-xs text-[#475569] font-medium">hari</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D64D8] hover:bg-[#1552B8] text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Simpan Pengaturan
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </form>
            )}

            {subTab === 'tahun_pelajaran' && (
              <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                    Pengaturan Tahun Pelajaran &amp; Periode Ujian
                  </h2>
                </div>

                <form onSubmit={handleSaveAcademicYear} className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1.5">
                        Tahun Pelajaran Aktif
                      </label>
                      <select
                        value={isPresetYear ? draftAcademicYear : 'custom'}
                        onChange={(e) => setDraftAcademicYear(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white font-display font-bold text-[#131C31]"
                      >
                        {academicYearPresets.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                        <option value="custom">Tahun Kustom (YYYY/YYYY)...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#334155] mb-1.5">
                        Semester Aktif
                      </label>
                      <select
                        value={draft.semester}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            semester: e.target.value === 'Genap' ? 'Genap' : 'Ganjil',
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31] font-semibold"
                      >
                        <option value="Ganjil">Semester Ganjil</option>
                        <option value="Genap">Semester Genap</option>
                      </select>
                    </div>
                  </div>

                  {(!isPresetYear || draftAcademicYear === 'custom') && (
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1.5">
                        Masukkan Tahun Pelajaran Kustom (YYYY/YYYY)
                      </label>
                      <input
                        type="text"
                        value={customAcademicYear}
                        onChange={(e) => setCustomAcademicYear(e.target.value)}
                        placeholder="2026/2027"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono text-[#131C31]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      Judul Periode Ujian (Kop Dokumen Resmi)
                    </label>
                    <input
                      type="text"
                      value={draftExamTitle}
                      onChange={(e) => setDraftExamTitle(e.target.value)}
                      placeholder="PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER GANJIL"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                    />
                    <p className="text-[11px] text-[#64748B] mt-1">
                      Tersinkron langsung ke kop Berita Acara dan label tahun ajaran pada Daftar
                      Hadir &amp; Rekapitulasi.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D64D8] hover:bg-[#1552B8] text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Tahun Pelajaran
                    </button>
                  </div>
                </form>
              </section>
            )}

            {subTab === 'pengguna' && (
              <div className="space-y-4">
                <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                        Profil Akun Aktif &amp; Ubah Kata Sandi
                      </h2>
                    </div>
                    {authUser.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('accounts')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Kelola Semua Akun Login
                      </button>
                    )}
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2.5">
                      <div className="font-semibold text-[#475569]">Informasi Sesi Masuk</div>
                      <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl px-4">
                        <div className="py-2.5 flex justify-between gap-2">
                          <span className="text-[#64748B]">Username</span>
                          <span className="font-mono font-bold text-[#131C31]">
                            {authUser.username}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-2">
                          <span className="text-[#64748B]">Nama Tampilan</span>
                          <span className="font-semibold text-[#131C31]">
                            {authUser.displayName}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-2">
                          <span className="text-[#64748B]">Peran Akses</span>
                          <span className="font-semibold text-[#1D4ED8]">
                            {authUser.role === 'admin' ? 'Administrator' : 'Panitia Ujian'}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between gap-2">
                          <span className="text-[#64748B]">Jabatan</span>
                          <span className="text-[#1E293B]">{authUser.jabatan}</span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleChangeOwnPassword} className="space-y-3">
                      <div className="font-semibold text-[#475569]">Ganti Kata Sandi Saya</div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPw ? 'text' : 'password'}
                          required
                          value={currPw}
                          onChange={(e) => setCurrPw(e.target.value)}
                          placeholder="Kata sandi saat ini"
                          autoComplete="current-password"
                          className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Kata sandi baru"
                        autoComplete="new-password"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                      />
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Konfirmasi kata sandi baru"
                        autoComplete="new-password"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                      />
                      <button
                        type="submit"
                        disabled={pwBusy}
                        className="w-full py-2 px-4 rounded-lg bg-[#1D64D8] hover:bg-[#1552B8] disabled:opacity-60 text-white font-bold transition-colors"
                      >
                        {pwBusy ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                      </button>
                    </form>
                  </div>
                </section>

                {authUser.role === 'admin' && (
                  <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
                      <h3 className="font-display font-bold text-sm text-[#131C31]">
                        Ringkasan Akun Terdaftar ({managedAccounts.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('accounts')}
                        className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                      >
                        Buka Pengelola Akun Penuh →
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#475569]">
                            <th className="py-2.5 px-4">Username</th>
                            <th className="py-2.5 px-4">Nama Lengkap</th>
                            <th className="py-2.5 px-4">Peran</th>
                            <th className="py-2.5 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {accountsLoading ? (
                            <tr>
                              <td colSpan={4} className="py-4 px-4 text-[#64748B]">
                                Memuat akun...
                              </td>
                            </tr>
                          ) : (
                            managedAccounts.map((acc) => (
                              <tr key={acc.username}>
                                <td className="py-2.5 px-4 font-mono font-semibold text-[#131C31]">
                                  {acc.username}
                                </td>
                                <td className="py-2.5 px-4 text-[#1E293B]">{acc.displayName}</td>
                                <td className="py-2.5 px-4 font-semibold text-[#1F3864]">
                                  {acc.role === 'admin' ? 'Administrator' : 'Panitia'}
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-[#059669]">
                                  {acc.active ? 'Aktif' : 'Nonaktif'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}

            {subTab === 'hak_akses' && (
              <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                      Matriks Hak Akses Peran (RBAC)
                    </h2>
                    <p className="text-[11px] text-[#64748B]">
                      Perbandingan wewenang antara Administrator dan Panitia Ujian.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#475569]">
                        <th className="py-3 px-5">Modul &amp; Fitur</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">Panitia</th>
                        <th className="py-3 px-4 text-center whitespace-nowrap">Administrator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {[
                        { feature: 'Dashboard & Ringkasan Ujian', panitia: true, admin: true },
                        { feature: 'Kelola Data Peserta & Impor CSV', panitia: true, admin: true },
                        { feature: 'Kelola Jadwal & Matriks Pengawas', panitia: true, admin: true },
                        { feature: 'Cetak Kartu 2D, Mockup 3D & Stiker Meja', panitia: true, admin: true },
                        { feature: 'Denah Ruang, Daftar Hadir & Berita Acara', panitia: true, admin: true },
                        { feature: 'Ekspor PDF/X-1a CMYK & Arsip ZIP', panitia: true, admin: true },
                        { feature: 'Pengaturan Identitas Sekolah & Ujian', panitia: true, admin: true },
                        { feature: 'Tambah, Nonaktifkan & Reset Akun Login', panitia: false, admin: true },
                      ].map((row) => (
                        <tr key={row.feature} className="hover:bg-[#F8FAFC]">
                          <td className="py-3 px-5 font-medium text-[#1E293B]">{row.feature}</td>
                          <td className="py-3 px-4 text-center">
                            {row.panitia ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                                <Check className="w-3.5 h-3.5" /> Diizinkan
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] font-medium">Terbatas Admin</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8]">
                              <Check className="w-3.5 h-3.5" /> Penuh
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {subTab === 'konfigurasi_ujian' && (
              <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                    Konfigurasi Cetak &amp; Perangkat Ujian
                  </h2>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1.5">
                        Ukuran Kertas Cetak Utama
                      </label>
                      <select
                        value={paperConfig.paper}
                        onChange={(e) =>
                          onUpdatePaperConfig({ paper: e.target.value as PaperPreset })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                      >
                        {Object.entries(PAPER_DIMENSIONS).map(([k, [, , label]]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#334155] mb-1.5">
                        Pengelompokan Nomor Meja
                      </label>
                      <select
                        value={stickerConfig.groupingMode}
                        onChange={(e) =>
                          onUpdateStickerConfig({
                            groupingMode: e.target.value as StickerGroupingMode,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                      >
                        <option value="tier_room">2 Kelas Berbeda / Meja (X–XI–XII)</option>
                        <option value="sequential">Berurutan Langsung per Ruang</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1.5">
                      Format Default Berita Acara
                    </label>
                    <select
                      value={beritaAcaraConfig.layoutMode}
                      onChange={(e) =>
                        onUpdateBaConfig({
                          layoutMode: e.target.value as BeritaAcaraConfig['layoutMode'],
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                    >
                      <option value="one_up">Per Lembar (1-Up Potret Penuh)</option>
                      <option value="two_up_duplicate">2-Up Lanskap Duplikat</option>
                      <option value="two_up_paired">2-Up Lanskap Berpasangan (2 Ruang / Lembar)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0]">
                    <span className="text-[11px] text-[#64748B]">
                      Perubahan konfigurasi kertas dan pengelompokan meja langsung diterapkan ke
                      seluruh modul cetak.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSaveFeedback('Konfigurasi ujian dan pracetak aktif telah disimpan.');
                        setTimeout(() => setSaveFeedback(null), 3500);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D64D8] hover:bg-[#1552B8] text-white font-bold"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Terapkan Konfigurasi
                    </button>
                  </div>
                </div>
              </section>
            )}

            {subTab === 'backup_restore' && (
              <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                    Backup &amp; Restore Data Ujian
                  </h2>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] flex flex-col justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-sm text-[#131C31] mb-1">
                        Unduh Cadangan Lengkap (.JSON)
                      </div>
                      <p className="text-[#64748B] leading-relaxed">
                        Simpan salinan seluruh data peserta ({students.length}), panitia (
                        {committeeMembers.length}), jadwal ({scheduleEntries.length}), pengawas (
                        {proctors.length}), catatan berita acara, dan pengaturan sekolah.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D64D8] hover:bg-[#1552B8] text-white font-bold transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Unduh File Cadangan (.json)
                    </button>
                  </div>

                  <div className="p-4 rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] flex flex-col justify-between gap-3">
                    <div>
                      <div className="font-display font-bold text-sm text-[#131C31] mb-1">
                        Pulihkan dari File Cadangan
                      </div>
                      <p className="text-[#64748B] leading-relaxed">
                        Muat berkas <code className="font-mono">.json</code> hasil ekspor aplikasi
                        ini untuk mengembalikan data peserta, jadwal, dan konfigurasi sekolah.
                      </p>
                    </div>
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-[#EFF6FF] border border-[#1D64D8] text-[#1D64D8] font-bold cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Pilih File Cadangan (.json)
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={handleImportBackup}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-[#64748B]">
                    Ingin mengembalikan pengaturan tampilan &amp; identitas sekolah ke bawaan?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetAllConfigs();
                      setSaveFeedback('Pengaturan sistem telah dikembalikan ke bawaan awal.');
                      setTimeout(() => setSaveFeedback(null), 4000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:text-[#B91C1C] text-[#475569] font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Pengaturan Bawaan
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT SIDEBAR RAIL: Informasi Sistem + Info & Bantuan + Motivational Banner */}
          <aside className="xl:col-span-4 space-y-4">
            {/* Informasi Sistem */}
            <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                  Informasi Sistem
                </h2>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="divide-y divide-[#F1F5F9]">
                  <div className="pb-2.5 flex items-center justify-between gap-3">
                    <span className="text-[#475569]">Nama Aplikasi</span>
                    <span className="font-semibold text-[#131C31] text-right">
                      Sistem Manajemen Panitia Ulangan
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[#475569]">Peran Sesi Aktif</span>
                    <span className="font-semibold text-[#1D4ED8] text-right">
                      {authUser.role === 'admin' ? 'Administrator' : 'Panitia'} ({authUser.username})
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[#475569]">Tahun Pelajaran Aktif</span>
                    <span className="font-mono font-semibold text-[#131C31] tabular-nums">
                      {academicYear} ({schoolSettings.semester})
                    </span>
                  </div>
                  <div className="pt-2.5 flex items-center justify-between gap-3">
                    <span className="text-[#475569]">Terakhir Diperbarui</span>
                    <span className="font-mono text-[#131C31] tabular-nums text-right">
                      {schoolSettings.lastSavedAt || 'Pengaturan Awal'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] text-[#1E3A8A] text-[11.5px] leading-relaxed">
                  <Info className="w-4 h-4 text-[#1D64D8] shrink-0 mt-0.5" />
                  <span>
                    Pastikan data identitas sekolah selalu diperbarui agar laporan dan berita acara
                    sesuai dengan informasi yang benar.
                  </span>
                </div>
              </div>
            </section>

            {/* Info & Bantuan */}
            <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#FFFBEB] text-[#D97706] flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <h2 className="font-display font-bold text-[15px] text-[#131C31]">
                  Info &amp; Bantuan
                </h2>
              </div>

              <div className="p-3.5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onNavigateTab('docs')}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#E0ECFF] text-[#1D64D8] flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#131C31] group-hover:text-[#1D4ED8] truncate">
                        Panduan Penggunaan Sistem
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        Lihat dokumentasi dan panduan lengkap
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#1D4ED8] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setFaqModalOpen(true)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#E0ECFF] text-[#1D64D8] flex items-center justify-center shrink-0">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#131C31] group-hover:text-[#1D4ED8] truncate">
                        FAQ
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        Pertanyaan yang sering diajukan
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#1D4ED8] shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-left transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#E0ECFF] text-[#1D64D8] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#131C31] group-hover:text-[#1D4ED8] truncate">
                        Hubungi Admin
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        Jika mengalami kendala sistem
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#1D4ED8] shrink-0" />
                </button>
              </div>
            </section>

            {/* Bottom Right Motivational Banner */}
            <section
              className="rounded-2xl px-5 py-4 text-white shadow-[0_4px_16px_rgba(13,60,142,0.22)] flex items-center gap-4 overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, #0D3C8E 0%, #1759C9 60%, #1F6AE0 100%)',
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-[#FACC15]" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-extrabold text-base leading-tight italic">
                  Sukses Ulangan
                </div>
                <div className="text-sm font-semibold text-[#FEF08A] italic mt-0.5">
                  Raih Prestasi Terbaik!
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* FAQ Modal */}
      {faqModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-faq-title"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 id="modal-faq-title" className="font-display font-bold text-base text-[#131C31]">
                Pertanyaan yang Sering Diajukan (FAQ)
              </h3>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
              {[
                {
                  q: 'Bagaimana cara mencetak Berita Acara format 2 kolom lanskap?',
                  a: 'Buka menu Berita Acara di sidebar, pilih filter tanggal/ruang bila perlu, lalu klik Cetak BA atau Export PDF. Format 2-Up Lanskap (Format File Kedua) aktif secara bawaan.',
                },
                {
                  q: 'Bagaimana cara mengubah logo atau kop alamat sekolah?',
                  a: 'Di tab Identitas Sekolah pada menu Pengaturan ini, klik "Ubah Logo" untuk mengunggah gambar logo baru dan ubah kolom Alamat, lalu tekan Simpan Pengaturan.',
                },
                {
                  q: 'Siapa yang dapat menambahkan akun login panitia baru?',
                  a: 'Hanya Administrator (akun admin) yang memiliki wewenang membuat, menonaktifkan, atau mengatur ulang kata sandi akun login Panitia melalui menu Akun & Hak Akses.',
                },
                {
                  q: 'Bagaimana cara mengamankan data sebelum mengganti perangkat?',
                  a: 'Gunakan tab Backup & Restore pada Pengaturan untuk mengunduh cadangan berformat .json yang berisi seluruh peserta, jadwal, pengawas, serta pengaturan.',
                },
              ].map((item) => (
                <div key={item.q} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="font-bold text-[#131C31] mb-1">{item.q}</div>
                  <p className="text-[#475569] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Admin Modal */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-contact-admin-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3
                id="modal-contact-admin-title"
                className="font-display font-bold text-base text-[#131C31]"
              >
                Kontak Administrator &amp; Sekretariat
              </h3>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="font-bold text-[#131C31]">{draft.schoolName}</div>
                <div className="flex items-center gap-2 text-[#475569]">
                  <Mail className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>{draft.email || 'sman1alalak@gmail.com'}</span>
                </div>
                <div className="flex items-center gap-2 text-[#475569]">
                  <Phone className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span className="font-mono tabular-nums">{draft.phone || '0511-1234567'}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-[#334155]">Koordinator &amp; Proktor Panitia</div>
                {committeeMembers
                  .filter((m) =>
                    m.jabatan === 'Ketua Panitia' || m.jabatan === 'Proktor' || m.jabatan === 'Teknisi',
                  )
                  .slice(0, 3)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0]"
                    >
                      <span className="font-semibold text-[#131C31]">{m.nama}</span>
                      <span className="text-[#1D4ED8] font-medium">{m.jabatan}</span>
                    </div>
                  ))}
              </div>

              {authUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setContactModalOpen(false);
                    onNavigateTab('accounts');
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white font-bold"
                >
                  Buka Manajemen Akun &amp; Hak Akses
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
