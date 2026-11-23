import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Home,
  Info,
  Network,
  Pencil,
  Printer,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  COMMITTEE_MASTER,
  COMMITTEE_ROLES,
  ROLE_TO_AVATAR,
  type CommitteeAttendanceStatus,
  type CommitteeMember,
  type CommitteeRole,
} from '../data/committeeData';
import type { MainWorkspaceTab } from '../types/prepress';
import { CommitteeAvatar } from './CommitteeAvatars';

interface CommitteeManagerProps {
  members: CommitteeMember[];
  onAddMember: (member: CommitteeMember) => void;
  onUpdateMember: (id: string, updated: CommitteeMember) => void;
  onDeleteMember: (id: string) => void;
  onResetMembers: () => void;
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

type ActiveModal =
  | null
  | { type: 'form'; editing?: CommitteeMember }
  | { type: 'detail'; member: CommitteeMember }
  | { type: 'structure' }
  | { type: 'assignments' }
  | { type: 'schedules' }
  | { type: 'attendance' }
  | { type: 'report' };

const PAGE_SIZE = 5;

function exportCommitteeExcelCsv(members: CommitteeMember[]) {
  const header = 'No,Nama,NIP/NUPTK,Jabatan,Status,Tugas,Jadwal Tugas,Ruang Tugas,Kehadiran';
  const rows = members.map((m, idx) =>
    [
      String(idx + 1),
      m.nama,
      m.nip,
      m.jabatan,
      m.status,
      m.tugas,
      m.jadwalTugas,
      m.ruangTugas,
      m.kehadiran,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  const bom = '\uFEFF';
  const blob = new Blob([bom + [header, ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Daftar_Panitia_Ulangan_SMAN1ALALAK_${members.length}Orang.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const CommitteeTeamIllustration: React.FC = () => (
  <svg viewBox="0 0 260 190" className="w-full h-auto max-h-[185px]" aria-hidden="true">
    <defs>
      <linearGradient id="skyBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#DCEBFF" />
        <stop offset="100%" stopColor="#F0F7FF" />
      </linearGradient>
    </defs>
    {/* Circular soft sky background */}
    <circle cx="130" cy="96" r="88" fill="url(#skyBg)" />
    {/* Clouds */}
    <ellipse cx="72" cy="48" rx="18" ry="7" fill="#FFFFFF" opacity="0.85" />
    <ellipse cx="186" cy="42" rx="22" ry="8" fill="#FFFFFF" opacity="0.85" />
    {/* School building silhouette in background */}
    <path d="M54 90 L130 56 L206 90 Z" fill="#D97706" />
    <path d="M62 90 L130 61 L198 90 Z" fill="#EA580C" />
    <rect x="64" y="90" width="132" height="58" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1" />
    {/* Windows */}
    <rect x="74" y="98" width="14" height="18" rx="2" fill="#93C5FD" />
    <rect x="94" y="98" width="14" height="18" rx="2" fill="#93C5FD" />
    <rect x="152" y="98" width="14" height="18" rx="2" fill="#93C5FD" />
    <rect x="172" y="98" width="14" height="18" rx="2" fill="#93C5FD" />
    {/* Greenery */}
    <circle cx="48" cy="134" r="18" fill="#22C55E" opacity="0.9" />
    <circle cx="212" cy="132" r="20" fill="#16A34A" opacity="0.9" />

    {/* Back Left Male Teacher */}
    <g transform="translate(36, 72)">
      <path d="M8 94 C10 68 20 62 32 62 C44 62 54 68 56 94 Z" fill="#E2E8F0" />
      <path d="M26 62 L32 82 L38 62 Z" fill="#1D4ED8" />
      <circle cx="32" cy="42" r="13" fill="#F6D0B5" />
      <path d="M19 40 C19 29 25 26 32 26 C39 26 45 29 45 40 C42 34 37 33 32 33 C27 33 22 34 19 40 Z" fill="#1E293B" />
      <circle cx="27" cy="42" r="1.4" fill="#1E293B" />
      <circle cx="37" cy="42" r="1.4" fill="#1E293B" />
      <path d="M29 48 Q32 50 35 48" fill="none" stroke="#9A5B3C" strokeWidth="1.5" strokeLinecap="round" />
    </g>

    {/* Back Left-Center Hijab Teacher */}
    <g transform="translate(64, 78)">
      <path d="M8 90 C10 66 20 60 30 60 C40 60 50 66 52 90 Z" fill="#3B82F6" />
      <path d="M16 42 C16 28 22 23 30 23 C38 23 44 28 44 42 L46 62 C40 66 20 66 14 62 Z" fill="#1E40AF" />
      <circle cx="30" cy="41" r="11" fill="#F6D0B5" />
      <rect x="21" y="38" width="7" height="5" rx="1.2" fill="none" stroke="#1E293B" strokeWidth="1.4" />
      <rect x="32" y="38" width="7" height="5" rx="1.2" fill="none" stroke="#1E293B" strokeWidth="1.4" />
      <line x1="28" y1="40.5" x2="32" y2="40.5" stroke="#1E293B" strokeWidth="1.4" />
      <circle cx="24.5" cy="40.5" r="1.1" fill="#1E293B" />
      <circle cx="35.5" cy="40.5" r="1.1" fill="#1E293B" />
      <path d="M27.5 46.5 Q30 48.5 32.5 46.5" fill="none" stroke="#9A5B3C" strokeWidth="1.3" strokeLinecap="round" />
    </g>

    {/* Back Right Male Technician */}
    <g transform="translate(166, 72)">
      <path d="M8 94 C10 68 20 62 32 62 C44 62 54 68 56 94 Z" fill="#E2E8F0" />
      <path d="M27 62 L32 82 L37 62 Z" fill="#0F172A" />
      <circle cx="32" cy="42" r="13" fill="#F4CBB0" />
      <path d="M19 40 C19 29 25 26 32 26 C39 26 45 29 45 40 C42 34 37 33 32 33 C27 33 22 34 19 40 Z" fill="#111827" />
      <circle cx="27" cy="42" r="1.4" fill="#1E293B" />
      <circle cx="37" cy="42" r="1.4" fill="#1E293B" />
      <path d="M29 48 Q32 50 35 48" fill="none" stroke="#9A5B3C" strokeWidth="1.5" strokeLinecap="round" />
    </g>

    {/* Front Right Hijab Secretary */}
    <g transform="translate(142, 70)">
      <path d="M6 106 C8 74 20 68 34 68 C48 68 60 74 62 106 Z" fill="#1D4ED8" />
      <path d="M18 46 C18 30 25 25 34 25 C43 25 50 30 50 46 L52 70 C45 75 23 75 16 70 Z" fill="#2563EB" />
      <circle cx="34" cy="44" r="12" fill="#F8D7BF" />
      <circle cx="29.5" cy="43" r="1.4" fill="#1E293B" />
      <circle cx="38.5" cy="43" r="1.4" fill="#1E293B" />
      <path d="M30.5 49.5 Q34 52 37.5 49.5" fill="none" stroke="#9A5B3C" strokeWidth="1.5" strokeLinecap="round" />
    </g>

    {/* Front Center Chairman (Drs. H. Ahmad, M.Pd) */}
    <g transform="translate(86, 48)">
      <path d="M10 132 C12 92 26 84 44 84 C62 84 76 92 78 132 Z" fill="#1E3A8A" />
      <path d="M35 84 L44 106 L53 84 Z" fill="#FFFFFF" />
      <path d="M41.5 88 L44 108 L46.5 88 Z" fill="#DC2626" />
      {/* Crossed arms */}
      <path d="M18 110 C28 102 60 102 70 110 L66 125 L22 125 Z" fill="#1D4ED8" />
      <rect x="37" y="70" width="14" height="15" rx="5" fill="#F3C6A5" />
      <circle cx="44" cy="52" r="17" fill="#F6D0B5" />
      <path d="M27 50 C27 36 35 32 44 32 C53 32 61 36 61 50 C57 42 51 40 44 40 C37 40 31 42 27 50 Z" fill="#1F2937" />
      <rect x="31" y="48" width="11" height="8" rx="2" fill="none" stroke="#1E293B" strokeWidth="1.8" />
      <rect x="46" y="48" width="11" height="8" rx="2" fill="none" stroke="#1E293B" strokeWidth="1.8" />
      <line x1="42" y1="51.5" x2="46" y2="51.5" stroke="#1E293B" strokeWidth="1.8" />
      <circle cx="36.5" cy="52" r="1.5" fill="#1E293B" />
      <circle cx="51.5" cy="52" r="1.5" fill="#1E293B" />
      <path d="M39.5 60.5 Q44 63.5 48.5 60.5" fill="none" stroke="#9A5B3C" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  </svg>
);

export const CommitteeManager: React.FC<CommitteeManagerProps> = ({
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onResetMembers,
  onNavigateTab,
}) => {
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [modal, setModal] = useState<ActiveModal>(null);

  // Add/Edit form states
  const [formNama, setFormNama] = useState('');
  const [formNip, setFormNip] = useState('');
  const [formJabatan, setFormJabatan] = useState<CommitteeRole>('Anggota');
  const [formStatus, setFormStatus] = useState<'Aktif' | 'Nonaktif'>('Aktif');
  const [formTugas, setFormTugas] = useState('');
  const [formJadwal, setFormJadwal] = useState('Senin – Sabtu (07.15 – 11.45 WITA)');
  const [formRuang, setFormRuang] = useState('Sekretariat Panitia');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setFormNama('');
    setFormNip('');
    setFormJabatan('Anggota');
    setFormStatus('Aktif');
    setFormTugas('Mendukung pelaksanaan dan administrasi ujian PAS di ruang tugas.');
    setFormJadwal('Senin – Sabtu (07.15 – 11.45 WITA)');
    setFormRuang('Sekretariat Panitia');
    setFormError(null);
    setModal({ type: 'form' });
  };

  const openEditModal = (member: CommitteeMember) => {
    setFormNama(member.nama);
    setFormNip(member.nip);
    setFormJabatan(member.jabatan);
    setFormStatus(member.status);
    setFormTugas(member.tugas);
    setFormJadwal(member.jadwalTugas);
    setFormRuang(member.ruangTugas);
    setFormError(null);
    setModal({ type: 'form', editing: member });
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = formNama.trim();
    const cleanNip = formNip.trim();
    if (!cleanNama) {
      setFormError('Nama anggota panitia wajib diisi.');
      return;
    }
    if (!cleanNip) {
      setFormError('NIP / NUPTK wajib diisi.');
      return;
    }

    if (modal && modal.type === 'form' && modal.editing) {
      onUpdateMember(modal.editing.id, {
        ...modal.editing,
        nama: cleanNama,
        nip: cleanNip,
        jabatan: formJabatan,
        status: formStatus,
        tugas: formTugas.trim() || modal.editing.tugas,
        jadwalTugas: formJadwal.trim() || modal.editing.jadwalTugas,
        ruangTugas: formRuang.trim() || modal.editing.ruangTugas,
        avatarVariant: ROLE_TO_AVATAR[formJabatan],
      });
    } else {
      onAddMember({
        id: `pan-${Date.now()}`,
        nama: cleanNama,
        nip: cleanNip,
        jabatan: formJabatan,
        status: formStatus,
        tugas: formTugas.trim() || 'Membantu kelancaran pelaksanaan ujian PAS.',
        jadwalTugas: formJadwal.trim() || 'Senin – Sabtu (07.15 – 11.45 WITA)',
        ruangTugas: formRuang.trim() || 'Sekretariat Panitia',
        kehadiran: 'Hadir',
        avatarVariant: ROLE_TO_AVATAR[formJabatan],
      });
    }
    setModal(null);
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter && m.jabatan !== roleFilter) return false;
      if (q) {
        return (
          m.nama.toLowerCase().includes(q) ||
          m.nip.toLowerCase().includes(q) ||
          m.jabatan.toLowerCase().includes(q) ||
          m.ruangTugas.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, roleFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pagedMembers = filteredMembers.slice(startIdx, startIdx + PAGE_SIZE);
  const showingFrom = filteredMembers.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(filteredMembers.length, startIdx + PAGE_SIZE);

  const subMenuCards = [
    {
      title: 'Tambah Anggota',
      subtitle: 'Input data panitia baru',
      cardBg: 'linear-gradient(180deg, #E8F1FF 0%, #DCEAFF 100%)',
      borderClass: 'border-[#C7DCFF]',
      iconColor: 'text-[#1D4ED8]',
      btnClass: 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF]',
      icon: <UserPlus className="w-9 h-9" />,
      onClick: openCreateModal,
    },
    {
      title: 'Struktur Organisasi',
      subtitle: 'Atur struktur kepanitiaan',
      cardBg: 'linear-gradient(180deg, #E8FAF3 0%, #D5F5E8 100%)',
      borderClass: 'border-[#BAEBD6]',
      iconColor: 'text-[#059669]',
      btnClass: 'bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857]',
      icon: <Network className="w-9 h-9" />,
      onClick: () => setModal({ type: 'structure' }),
    },
    {
      title: 'Penugasan Panitia',
      subtitle: 'Bagikan tugas & tanggung jawab',
      cardBg: 'linear-gradient(180deg, #FFF3E5 0%, #FFE7CC 100%)',
      borderClass: 'border-[#FED7AA]',
      iconColor: 'text-[#EA580C]',
      btnClass: 'bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C]',
      icon: <UserCog className="w-9 h-9" />,
      onClick: () => setModal({ type: 'assignments' }),
    },
    {
      title: 'Jadwal Tugas Panitia',
      subtitle: 'Atur jadwal kerja panitia',
      cardBg: 'linear-gradient(180deg, #F3EEFF 0%, #E9E0FF 100%)',
      borderClass: 'border-[#DDD6FE]',
      iconColor: 'text-[#6D28D9]',
      btnClass: 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] hover:from-[#6D28D9] hover:to-[#5B21B6]',
      icon: <ClipboardList className="w-9 h-9" />,
      onClick: () => setModal({ type: 'schedules' }),
    },
    {
      title: 'Data Kehadiran',
      subtitle: 'Monitoring kehadiran',
      cardBg: 'linear-gradient(180deg, #E8F8FF 0%, #D6F2FF 100%)',
      borderClass: 'border-[#BAE6FD]',
      iconColor: 'text-[#0284C7]',
      btnClass: 'bg-gradient-to-r from-[#0EA5E9] to-[#0284C7] hover:from-[#0284C7] hover:to-[#0369A1]',
      icon: <FileText className="w-9 h-9" />,
      onClick: () => setModal({ type: 'attendance' }),
    },
    {
      title: 'Laporan Panitia',
      subtitle: 'Cetak laporan kegiatan',
      cardBg: 'linear-gradient(180deg, #E7FAF6 0%, #D1F5EE 100%)',
      borderClass: 'border-[#A7F3D0]',
      iconColor: 'text-[#0D9488]',
      btnClass: 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] hover:from-[#0D9488] hover:to-[#0F766E]',
      icon: <FileSpreadsheet className="w-9 h-9" />,
      onClick: () => setModal({ type: 'report' }),
    },
  ];

  const attendanceCounts = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let belum = 0;
    for (const m of members) {
      if (m.kehadiran === 'Hadir') hadir += 1;
      else if (m.kehadiran === 'Izin') izin += 1;
      else belum += 1;
    }
    return { hadir, izin, belum };
  }, [members]);

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        {/* Top Royal Blue Banner with Breadcrumb */}
        <section
          className="relative rounded-2xl overflow-hidden px-6 py-4 text-white shadow-[0_4px_16px_rgba(9,44,104,0.16)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            background: 'linear-gradient(95deg, #062458 0%, #0D3C8E 55%, #1553B8 100%)',
          }}
        >
          {/* Subtle decorative wave */}
          <svg
            viewBox="0 0 420 100"
            className="absolute right-0 top-0 h-full w-auto opacity-20 pointer-events-none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M120,0 C190,45 270,15 420,80 L420,0 Z" fill="#60A5FA" />
            <path d="M210,100 C280,55 340,85 420,35 L420,100 Z" fill="#3B82F6" />
          </svg>

          <div className="relative z-10 flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/12 border border-white/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl leading-tight">
                Manajemen Panitia
              </h1>
              <p className="text-xs sm:text-[13px] italic text-white/85 mt-0.5 truncate">
                Kelola data dan tugas seluruh panitia pelaksanaan ulangan
              </p>
            </div>
          </div>

          <nav
            aria-label="Breadcrumb"
            className="relative z-10 flex items-center gap-1.5 text-xs text-white/85 shrink-0"
          >
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-white/60" />
            <span className="font-semibold text-white">Manajemen Panitia</span>
          </nav>
        </section>

        {/* 6 Sub-Menu Action Cards */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {subMenuCards.map((card) => (
            <div
              key={card.title}
              style={{ background: card.cardBg }}
              className={`rounded-2xl border ${card.borderClass} shadow-[0_2px_8px_rgba(15,23,42,0.04)] p-4 flex flex-col items-center text-center justify-between gap-3 hover:-translate-y-0.5 transition-transform duration-150`}
            >
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className={card.iconColor}>{card.icon}</div>
                <div>
                  <h2 className="font-display font-bold text-[13.5px] text-[#0F172A] leading-snug">
                    {card.title}
                  </h2>
                  <p className="text-[11px] text-[#475569] mt-0.5 leading-snug">{card.subtitle}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={card.onClick}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full ${card.btnClass} text-white text-xs font-bold shadow-xs transition-all duration-150 active:scale-[0.98]`}
              >
                Kelola
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </section>

        {/* Bottom Main Split: Daftar Panitia (9 cols) + Informasi Panitia (3 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Daftar Panitia Table Card */}
          <section className="xl:col-span-9 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 lg:p-5 flex flex-col justify-between min-w-0">
            <div>
              {/* Table Header & Filter Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EEF4FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="font-display font-bold text-base text-[#0F172A]">
                    Daftar Panitia
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter jabatan"
                    className="px-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] bg-white text-[#1E293B]"
                  >
                    <option value="">Semua Jabatan</option>
                    {COMMITTEE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Cari nama..."
                      className="px-3 py-1.5 text-xs rounded-l-lg border border-r-0 border-[#CBD5E1] bg-white text-[#1E293B] w-40 sm:w-48 focus:outline-none focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      aria-label="Cari panitia"
                      className="px-2.5 py-1.5 rounded-r-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border border-[#1D4ED8] transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportCommitteeExcelCsv(filteredMembers)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Committee Roster Table */}
              <div className="overflow-x-auto rounded-xl border border-[#DCE5F2]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#DCE8FB] text-[#0F295C] font-display font-bold border-b border-[#C7DAFA]">
                      <th className="py-2.5 px-3 w-12 text-center">No</th>
                      <th className="py-2.5 px-3">Nama</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">NIP/NUPTK</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Jabatan</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 text-center w-32 whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {pagedMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#64748B]">
                          Tidak ada anggota panitia yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      pagedMembers.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-[#F8FAFF] transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-[#334155] tabular-nums">
                            {startIdx + idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#0F172A] whitespace-nowrap">
                            {m.nama}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#334155] tabular-nums whitespace-nowrap">
                            {m.nip}
                          </td>
                          <td className="py-2.5 px-3 text-[#1E293B] whitespace-nowrap">
                            {m.jabatan}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMember(m.id, {
                                  ...m,
                                  status: m.status === 'Aktif' ? 'Nonaktif' : 'Aktif',
                                })
                              }
                              title="Klik untuk ubah status aktif/nonaktif"
                              className={`inline-flex items-center justify-center px-3.5 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                                m.status === 'Aktif'
                                  ? 'bg-[#22C55E] hover:bg-[#16A34A] text-white'
                                  : 'bg-[#CBD5E1] hover:bg-[#94A3B8] text-[#1E293B]'
                              }`}
                            >
                              {m.status}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(m)}
                                title="Edit anggota panitia"
                                className="w-7 h-7 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-2xs transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setModal({ type: 'detail', member: m })}
                                title="Lihat detail anggota"
                                className="w-7 h-7 rounded-md bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center justify-center shadow-2xs transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={members.length <= 1}
                                onClick={() => onDeleteMember(m.id)}
                                title="Hapus anggota panitia"
                                className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white flex items-center justify-center shadow-2xs transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Pagination Footer */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#475569]">
              <div className="tabular-nums">
                Menampilkan {showingFrom} – {showingTo} dari {filteredMembers.length} data
                {members.length !== COMMITTEE_MASTER.length && (
                  <button
                    type="button"
                    onClick={onResetMembers}
                    className="ml-3 text-[#1D4ED8] hover:underline font-medium"
                  >
                    Reset Bawaan
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                  title="Halaman pertama"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNo) => (
                  <button
                    key={pageNo}
                    type="button"
                    onClick={() => setCurrentPage(pageNo)}
                    className={`w-7 h-7 rounded-md text-xs font-semibold tabular-nums transition-colors ${
                      safePage === pageNo
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] text-[#334155]'
                    }`}
                  >
                    {pageNo}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-7 h-7 rounded-md border border-[#DCE5F2] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center"
                  title="Halaman terakhir"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Informasi Panitia Card */}
          <section className="xl:col-span-3 bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_2px_10px_rgba(15,23,42,0.04)] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
                <Info className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-display font-bold text-sm text-[#0F172A]">
                Informasi Panitia
              </h2>
            </div>

            <div className="flex-1 rounded-2xl border border-[#C7DCFF] bg-gradient-to-b from-[#EDF4FF] to-[#DCEBFF] p-4 flex flex-col items-center justify-center text-center">
              <CommitteeTeamIllustration />

              <div className="mt-2">
                <div className="font-display font-bold text-sm text-[#0F172A]">
                  Tim Panitia Ulangan
                </div>
                <div className="font-display font-bold text-sm text-[#0F172A]">
                  SMA Negeri 1 Alalak
                </div>
                <p className="mt-2 text-[11.5px] italic text-[#1D4ED8] leading-snug">
                  &ldquo;Bersama Menyukseskan Pelaksanaan Ulangan dengan Profesional&rdquo;
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-[#BFDBFE] w-full flex items-center justify-center gap-3 text-[11px] font-mono text-[#1E3A8A] tabular-nums">
                <span>
                  <strong>{members.filter((m) => m.status === 'Aktif').length}</strong> Aktif
                </span>
                <span>·</span>
                <span>
                  <strong>{attendanceCounts.hadir}</strong> Hadir
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Interactive Modals for All 6 Sub-Menu Cards & Table Actions */}
      {modal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#091A3B]/45"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFF] flex items-center justify-between gap-3">
              <h3 className="font-display font-bold text-sm text-[#0F172A]">
                {modal.type === 'form'
                  ? modal.editing
                    ? `Edit Data Panitia — ${modal.editing.nama}`
                    : 'Tambah Anggota Panitia Baru'
                  : modal.type === 'detail'
                    ? `Profil Anggota Panitia`
                    : modal.type === 'structure'
                      ? 'Struktur Organisasi Panitia Ulangan'
                      : modal.type === 'assignments'
                        ? 'Penugasan & Ruang Tanggung Jawab Panitia'
                        : modal.type === 'schedules'
                          ? 'Jadwal Tugas Kerja Panitia'
                          : modal.type === 'attendance'
                            ? 'Monitoring Data Kehadiran Panitia'
                            : 'Laporan Kegiatan & Rekap Panitia'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] flex items-center justify-center text-[#475569]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 text-xs">
              {modal.type === 'form' && (
                <form onSubmit={handleSaveForm} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">
                        Nama Lengkap &amp; Gelar
                      </label>
                      <input
                        type="text"
                        value={formNama}
                        onChange={(e) => setFormNama(e.target.value)}
                        placeholder="Contoh: Drs. H. Ahmad, M.Pd"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">
                        NIP / NUPTK
                      </label>
                      <input
                        type="text"
                        value={formNip}
                        onChange={(e) => setFormNip(e.target.value)}
                        placeholder="198203152008012005"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono tabular-nums text-[#0F172A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">Jabatan</label>
                      <select
                        value={formJabatan}
                        onChange={(e) => setFormJabatan(e.target.value as CommitteeRole)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                      >
                        {COMMITTEE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) =>
                          setFormStatus(e.target.value as 'Aktif' | 'Nonaktif')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                      >
                        <option value="Aktif">Aktif</option>
                        <option value="Nonaktif">Nonaktif</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">
                        Ruang / Lokasi Tugas
                      </label>
                      <input
                        type="text"
                        value={formRuang}
                        onChange={(e) => setFormRuang(e.target.value)}
                        placeholder="Sekretariat Panitia / Ruang 01–05"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#334155] mb-1">
                        Jadwal Tugas
                      </label>
                      <input
                        type="text"
                        value={formJadwal}
                        onChange={(e) => setFormJadwal(e.target.value)}
                        placeholder="Senin – Sabtu (07.15 – 11.45 WITA)"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#334155] mb-1">
                      Uraian Tugas Pokok
                    </label>
                    <textarea
                      rows={3}
                      value={formTugas}
                      onChange={(e) => setFormTugas(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#0F172A]"
                    />
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModal(null)}
                      className="px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#334155] font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      {modal.editing ? 'Simpan Perubahan' : 'Simpan Anggota'}
                    </button>
                  </div>
                </form>
              )}

              {modal.type === 'detail' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2]">
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#BFDBFE] shrink-0">
                      <CommitteeAvatar
                        variant={modal.member.avatarVariant}
                        className="w-full h-full"
                      />
                    </div>
                    <div>
                      <div className="font-display font-bold text-base text-[#0F172A]">
                        {modal.member.nama}
                      </div>
                      <div className="text-xs font-semibold text-[#1D4ED8] mt-0.5">
                        {modal.member.jabatan}
                      </div>
                      <div className="font-mono text-[11px] text-[#64748B] mt-1 tabular-nums">
                        NIP/NUPTK: {modal.member.nip}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B]">Status &amp; Kehadiran</div>
                      <div className="font-semibold text-[#0F172A] mt-1">
                        {modal.member.status} · Kehadiran: {modal.member.kehadiran}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B]">Ruang &amp; Jadwal Tugas</div>
                      <div className="font-semibold text-[#0F172A] mt-1">
                        {modal.member.ruangTugas}
                      </div>
                      <div className="text-[11px] text-[#475569] mt-0.5">
                        {modal.member.jadwalTugas}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#E2E8F0]">
                    <div className="text-[11px] text-[#64748B] mb-1">Uraian Tugas Pokok</div>
                    <p className="text-[#1E293B] leading-relaxed">{modal.member.tugas}</p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(modal.member)}
                      className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
                    >
                      Edit Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal(null)}
                      className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#334155] font-semibold"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}

              {modal.type === 'structure' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-center">
                    <div className="text-[11px] font-semibold text-[#1D4ED8] uppercase">
                      Penanggung Jawab
                    </div>
                    <div className="font-display font-bold text-sm text-[#0F172A] mt-0.5">
                      Kepala SMA Negeri 1 Alalak
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['Ketua Panitia', 'Sekretaris', 'Bendahara'] as CommitteeRole[]).map(
                      (role) => {
                        const found = members.filter((m) => m.jabatan === role);
                        return (
                          <div
                            key={role}
                            className="p-3 rounded-xl border border-[#DCE5F2] bg-[#F8FAFC]"
                          >
                            <div className="text-[11px] font-bold text-[#1D4ED8] uppercase">
                              {role}
                            </div>
                            {found.length === 0 ? (
                              <div className="text-[#94A3B8] italic mt-1">Belum ditunjuk</div>
                            ) : (
                              found.map((m) => (
                                <div key={m.id} className="mt-1">
                                  <div className="font-semibold text-[#0F172A]">{m.nama}</div>
                                  <div className="font-mono text-[10px] text-[#64748B]">
                                    {m.nip}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['Proktor', 'Teknisi', 'Koordinator Ruang', 'Anggota'] as CommitteeRole[]).map(
                      (role) => {
                        const found = members.filter((m) => m.jabatan === role);
                        return (
                          <div
                            key={role}
                            className="p-3 rounded-xl border border-[#E2E8F0] bg-white"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#0F172A] uppercase">
                                {role}
                              </span>
                              <span className="font-mono text-[11px] text-[#64748B]">
                                {found.length} org
                              </span>
                            </div>
                            <ul className="mt-1.5 space-y-1">
                              {found.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between text-[#334155]"
                                >
                                  <span>{m.nama}</span>
                                  <span className="text-[10.5px] text-[#64748B]">
                                    {m.ruangTugas}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {modal.type === 'assignments' && (
                <div className="space-y-2.5">
                  <p className="text-[#475569] mb-2">
                    Atur ruang tugas dan tanggung jawab langsung untuk tiap anggota panitia:
                  </p>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-[#0F172A]">{m.nama}</span>
                          <span className="ml-2 text-[11px] font-semibold text-[#1D4ED8]">
                            ({m.jabatan})
                          </span>
                        </div>
                        <input
                          type="text"
                          value={m.ruangTugas}
                          onChange={(e) =>
                            onUpdateMember(m.id, { ...m, ruangTugas: e.target.value })
                          }
                          aria-label={`Ruang tugas ${m.nama}`}
                          className="px-2.5 py-1 rounded-md border border-[#CBD5E1] bg-white text-[11px] w-44"
                        />
                      </div>
                      <input
                        type="text"
                        value={m.tugas}
                        onChange={(e) => onUpdateMember(m.id, { ...m, tugas: e.target.value })}
                        aria-label={`Tugas ${m.nama}`}
                        className="w-full px-2.5 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-[#334155]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {modal.type === 'schedules' && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-[#475569] mb-2">
                    <CalendarClock className="w-4 h-4 text-[#6D28D9]" />
                    <span>Sesuaikan jadwal shift kerja tiap anggota panitia:</span>
                  </div>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#0F172A]">{m.nama}</div>
                        <div className="text-[11px] text-[#64748B]">
                          {m.jabatan} · {m.ruangTugas}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={m.jadwalTugas}
                        onChange={(e) =>
                          onUpdateMember(m.id, { ...m, jadwalTugas: e.target.value })
                        }
                        aria-label={`Jadwal ${m.nama}`}
                        className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white w-full sm:w-64 font-mono text-[11px]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {modal.type === 'attendance' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 text-center font-mono tabular-nums">
                    <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]">
                      <div className="text-lg font-bold">{attendanceCounts.hadir}</div>
                      <div className="text-[11px]">Hadir</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]">
                      <div className="text-lg font-bold">{attendanceCounts.izin}</div>
                      <div className="text-[11px]">Izin</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155]">
                      <div className="text-lg font-bold">{attendanceCounts.belum}</div>
                      <div className="text-[11px]">Belum Absen</div>
                    </div>
                  </div>

                  <div className="divide-y divide-[#EEF2F7] rounded-xl border border-[#E2E8F0]">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0F172A] truncate">{m.nama}</div>
                          <div className="text-[11px] text-[#64748B]">
                            {m.jabatan} · {m.ruangTugas}
                          </div>
                        </div>
                        <div className="inline-flex p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] gap-0.5 shrink-0">
                          {(['Hadir', 'Izin', 'Belum Absen'] as CommitteeAttendanceStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => onUpdateMember(m.id, { ...m, kehadiran: st })}
                                className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors ${
                                  m.kehadiran === st
                                    ? st === 'Hadir'
                                      ? 'bg-[#16A34A] text-white'
                                      : st === 'Izin'
                                        ? 'bg-[#D97706] text-white'
                                        : 'bg-[#475569] text-white'
                                    : 'text-[#475569] hover:text-[#0F172A]'
                                }`}
                              >
                                {st}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setModal(null);
                        onNavigateTab('attendance');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold"
                    >
                      Buka Daftar Hadir Peserta Ujian
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {modal.type === 'report' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#F8FAFF] border border-[#DCE5F2] space-y-1.5">
                    <div className="font-display font-bold text-sm text-[#0F172A]">
                      Ringkasan Laporan Panitia PAS — SMA Negeri 1 Alalak
                    </div>
                    <div className="text-[#475569] font-mono tabular-nums">
                      Total Panitia: {members.length} orang · Aktif:{' '}
                      {members.filter((m) => m.status === 'Aktif').length} · Hadir:{' '}
                      {attendanceCounts.hadir}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] font-semibold text-[#334155]">
                          <th className="py-2 px-2.5">No</th>
                          <th className="py-2 px-2.5">Nama</th>
                          <th className="py-2 px-2.5">Jabatan</th>
                          <th className="py-2 px-2.5">Ruang Tugas</th>
                          <th className="py-2 px-2.5">Kehadiran</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {members.map((m, idx) => (
                          <tr key={m.id}>
                            <td className="py-1.5 px-2.5 font-mono">{idx + 1}</td>
                            <td className="py-1.5 px-2.5 font-semibold">{m.nama}</td>
                            <td className="py-1.5 px-2.5">{m.jabatan}</td>
                            <td className="py-1.5 px-2.5">{m.ruangTugas}</td>
                            <td className="py-1.5 px-2.5 font-semibold">{m.kehadiran}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => exportCommitteeExcelCsv(members)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh Excel (.CSV)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModal(null);
                        onNavigateTab('export');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Ke Pusat Ekspor &amp; Arsip ZIP
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
