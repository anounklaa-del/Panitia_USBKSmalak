import React from 'react';
import {
  Bell,
  Box,
  Calendar,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FolderArchive,
  Home,
  KeyRound,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { LOGO_RIGHT_DATA_URI } from '../data/pasData';
import type { MainWorkspaceTab, PaperPreset } from '../types/prepress';
import type { UserRole } from '../utils/authClient';

export interface WorkspaceRouteMeta {
  id: MainWorkspaceTab;
  groupId: 'ringkasan' | 'perangkat' | 'master' | 'produksi';
  groupLabel: string;
  label: string;
  shortLabel: string;
}

export const WORKSPACE_META: Record<MainWorkspaceTab, WorkspaceRouteMeta> = {
  dashboard: {
    id: 'dashboard',
    groupId: 'ringkasan',
    groupLabel: 'Ringkasan',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
  },
  committee: {
    id: 'committee',
    groupId: 'master',
    groupLabel: 'Kepanitiaan',
    label: 'Manajemen Panitia',
    shortLabel: 'Panitia',
  },
  studio: {
    id: 'studio',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Kartu Peserta 2D',
    shortLabel: 'Kartu 2D',
  },
  mockup3d: {
    id: 'mockup3d',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Mockup Kartu 3D',
    shortLabel: 'Mockup 3D',
  },
  students: {
    id: 'students',
    groupId: 'master',
    groupLabel: 'Master Data',
    label: 'Data Peserta Ujian',
    shortLabel: 'Data Peserta',
  },
  schedule: {
    id: 'schedule',
    groupId: 'master',
    groupLabel: 'Master Data',
    label: 'Jadwal Ulangan',
    shortLabel: 'Jadwal',
  },
  sticker: {
    id: 'sticker',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Stiker Meja',
    shortLabel: 'Stiker Meja',
  },
  seating: {
    id: 'seating',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Pembagian Ruang',
    shortLabel: 'Pembagian Ruang',
  },
  proctor: {
    id: 'proctor',
    groupId: 'master',
    groupLabel: 'Master Data',
    label: 'Pengawas Ujian',
    shortLabel: 'Pengawas',
  },
  attendance: {
    id: 'attendance',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Daftar Hadir',
    shortLabel: 'Daftar Hadir',
  },
  berita_acara: {
    id: 'berita_acara',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Berita Acara',
    shortLabel: 'Berita Acara',
  },
  rules_bell: {
    id: 'rules_bell',
    groupId: 'perangkat',
    groupLabel: 'Perangkat Ujian',
    label: 'Kode Lonceng & Tata Tertib',
    shortLabel: 'Lonceng & Tatib',
  },
  export: {
    id: 'export',
    groupId: 'produksi',
    groupLabel: 'Produksi & Ekspor',
    label: 'Ekspor & Laporan',
    shortLabel: 'Ekspor ZIP',
  },
  docs: {
    id: 'docs',
    groupId: 'produksi',
    groupLabel: 'Produksi & Ekspor',
    label: 'Panduan & SOP',
    shortLabel: 'Panduan SOP',
  },
  settings: {
    id: 'settings',
    groupId: 'produksi',
    groupLabel: 'Administrasi Sistem',
    label: 'Pengaturan',
    shortLabel: 'Pengaturan',
  },
  accounts: {
    id: 'accounts',
    groupId: 'produksi',
    groupLabel: 'Administrasi Sistem',
    label: 'Akun & Hak Akses',
    shortLabel: 'Akun Login',
  },
};

interface SidebarNavItem {
  id: MainWorkspaceTab;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface AppSidebarProps {
  activeTab: MainWorkspaceTab;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectTab: (tab: MainWorkspaceTab) => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  counts: {
    committeeMembers: number;
    totalStudents: number;
    scheduleSessions: number;
    proctors: number;
    filteredStudents: number;
    stickers: number;
    seatingPages: number;
    attendancePages: number;
    beritaAcara: number;
  };
  academicYear: string;
  onAcademicYearChange: (year: string) => void;
  paper: PaperPreset;
  dpi: number;
  hasActiveCardFilter: boolean;
  cardFilterDesc: string;
  onResetCardFilter: () => void;
  userRole?: UserRole;
  schoolLogoUri?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  collapsed,
  mobileOpen,
  onSelectTab,
  onCloseMobile,
  counts,
  academicYear,
  onAcademicYearChange,
  hasActiveCardFilter,
  onResetCardFilter,
  userRole,
  schoolLogoUri,
}) => {
  const navItems: SidebarNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'committee',
      label: 'Manajemen Panitia',
      icon: <Users className="w-4 h-4 shrink-0" />,
      count: counts.committeeMembers,
    },
    {
      id: 'students',
      label: 'Data Peserta Ujian',
      icon: <UserCheck className="w-4 h-4 shrink-0" />,
      count: counts.totalStudents,
    },
    {
      id: 'schedule',
      label: 'Jadwal Ulangan',
      icon: <CalendarDays className="w-4 h-4 shrink-0" />,
      count: counts.scheduleSessions,
    },
    {
      id: 'seating',
      label: 'Pembagian Ruang',
      icon: <LayoutGrid className="w-4 h-4 shrink-0" />,
      count: counts.seatingPages,
    },
    {
      id: 'proctor',
      label: 'Pengawas Ujian',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
      count: counts.proctors,
    },
    {
      id: 'studio',
      label: 'Kartu Peserta 2D',
      icon: <CreditCard className="w-4 h-4 shrink-0" />,
      count: counts.filteredStudents,
    },
    {
      id: 'mockup3d',
      label: 'Mockup Kartu 3D',
      icon: <Box className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'sticker',
      label: 'Stiker Meja',
      icon: <Tag className="w-4 h-4 shrink-0" />,
      count: counts.stickers,
    },
    {
      id: 'attendance',
      label: 'Daftar Hadir',
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
      count: counts.attendancePages,
    },
    {
      id: 'berita_acara',
      label: 'Berita Acara',
      icon: <FileCheck2 className="w-4 h-4 shrink-0" />,
      count: counts.beritaAcara,
    },
    {
      id: 'rules_bell',
      label: 'Kode Lonceng & Tatib',
      icon: <Bell className="w-4 h-4 shrink-0" />,
      count: 3,
    },
    {
      id: 'export',
      label: 'Ekspor & Laporan',
      icon: <FolderArchive className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'docs',
      label: 'Panduan & SOP',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
    ...(userRole === 'admin'
      ? [
          {
            id: 'accounts' as MainWorkspaceTab,
            label: 'Akun & Hak Akses',
            icon: <KeyRound className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  const renderSidebarBody = (isCollapsedRail: boolean) => (
    <div
      className="relative flex flex-col h-full text-white select-none overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0B3A86 0%, #06255C 48%, #031538 100%)',
      }}
    >
      {/* Mobile Close Button */}
      {!isCollapsedRail && (
        <button
          type="button"
          onClick={onCloseMobile}
          title="Tutup menu"
          className="lg:hidden absolute top-3 right-3 z-20 flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Centered School Crest & Identity */}
      <div
        className={`relative z-10 shrink-0 ${
          isCollapsedRail ? 'py-4 px-2 flex justify-center' : 'pt-5 pb-4 px-4 text-center'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onSelectTab('dashboard');
            onCloseMobile();
          }}
          title="Kembali ke Dashboard SMA Negeri 1 Alalak"
          className={`group transition-opacity hover:opacity-95 ${
            isCollapsedRail ? 'flex items-center justify-center' : 'flex flex-col items-center w-full'
          }`}
        >
          <div
            className={`${
              isCollapsedRail ? 'w-10 h-10' : 'w-[68px] h-[62px] mb-2'
            } flex items-center justify-center shrink-0`}
          >
            <img
              src={schoolLogoUri || LOGO_RIGHT_DATA_URI}
              alt="Logo Sekolah SMA Negeri 1 Alalak"
              className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            />
          </div>
          {!isCollapsedRail && (
            <>
              <div className="font-display font-bold text-[13px] tracking-wider text-white leading-tight uppercase">
                SMA NEGERI 1
              </div>
              <div className="font-display font-extrabold text-[18px] tracking-wider text-[#FFD43B] leading-tight uppercase">
                ALALAK
              </div>
              <p className="mt-1 text-[10.5px] italic text-[#CBD5E1]/90 leading-snug max-w-[190px]">
                &ldquo;Berprestasi, Berkarakter, Berdaya Saing&rdquo;
              </p>
            </>
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="Navigasi Utama Studio PAS"
        className={`relative z-10 flex-1 overflow-y-auto py-1 ${
          isCollapsedRail ? 'px-2 space-y-1.5' : 'px-3 space-y-1'
        }`}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              title={
                isCollapsedRail
                  ? `${item.label}${item.count !== undefined ? ` (${item.count})` : ''}`
                  : undefined
              }
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center rounded-lg transition-all duration-150 ${
                isCollapsedRail
                  ? 'justify-center h-9 px-0'
                  : 'justify-between gap-2 px-3 py-2'
              } text-[12.5px] whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-[#2D7CF6] to-[#1D5AE0] text-white font-semibold shadow-[0_4px_14px_rgba(37,99,235,0.45)] ring-1 ring-white/25'
                  : 'text-[#DCE6F7] hover:bg-white/10 hover:text-white font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-white' : 'text-[#93C5FD]'}>{item.icon}</span>
                {!isCollapsedRail && <span className="truncate">{item.label}</span>}
              </span>

              {!isCollapsedRail && item.count !== undefined && (
                <span
                  className={`font-mono text-[10.5px] tabular-nums shrink-0 ${
                    isActive ? 'text-white/95 font-semibold' : 'text-[#93C5FD]/80'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tahun Pelajaran Card + School Building Blended Backdrop */}
      {!isCollapsedRail && (
        <div className="relative z-10 px-3 pt-2 pb-3 shrink-0 space-y-2">
          {hasActiveCardFilter && (
            <button
              type="button"
              onClick={onResetCardFilter}
              className="w-full py-1.5 px-2.5 rounded-lg bg-[#FFD43B]/15 hover:bg-[#FFD43B]/25 border border-[#FFD43B]/40 text-[#FFD43B] text-[11px] font-semibold transition-colors text-center"
            >
              Reset Filter Kartu Aktif
            </button>
          )}

          <div className="relative rounded-xl bg-[#0A2C68]/85 border border-white/15 px-3 py-2 backdrop-blur-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[#93C5FD] shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-[#CBD5E1]/85 leading-tight">
                  Tahun Pelajaran
                </div>
                <div className="relative flex items-center">
                  <select
                    value={academicYear}
                    onChange={(e) => onAcademicYearChange(e.target.value)}
                    aria-label="Pilih Tahun Pelajaran"
                    className="w-full appearance-none bg-transparent text-white font-display font-bold text-xs pr-5 py-0.5 focus:outline-none cursor-pointer"
                  >
                    <option value="2026/2027" className="text-[#131C31] bg-white">
                      2026/2027
                    </option>
                    <option value="2025/2026" className="text-[#131C31] bg-white">
                      2025/2026
                    </option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#93C5FD] pointer-events-none absolute right-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blended Bottom School Building Illustration */}
      {!isCollapsedRail && (
        <div className="relative h-28 shrink-0 overflow-hidden pointer-events-none">
          <img
            src="/assets/aistudio/Ilustrasi_Cerah_SMA_Negeri_1_Alalak_v2.png"
            alt="Ilustrasi SMA Negeri 1 Alalak"
            className="w-full h-full object-cover object-[50%_85%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, #031538 0%, rgba(3,21,56,0.42) 32%, rgba(3,21,56,0.02) 70%, transparent 100%)',
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={`no-print hidden lg:flex flex-col shrink-0 transition-[width] duration-150 ease-out shadow-[2px_0_12px_rgba(3,21,56,0.18)] ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {renderSidebarBody(collapsed)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#041434]/55"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[256px] max-w-[85vw] h-full shadow-2xl">
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}
    </>
  );
};
