import type { AvatarVariant } from '../components/CommitteeAvatars';

export type CommitteeRole =
  | 'Ketua Panitia'
  | 'Sekretaris'
  | 'Bendahara'
  | 'Proktor'
  | 'Teknisi'
  | 'Koordinator Ruang'
  | 'Anggota';

export type CommitteeAttendanceStatus = 'Hadir' | 'Izin' | 'Belum Absen';

export interface CommitteeMember {
  id: string;
  nama: string;
  nip: string;
  jabatan: CommitteeRole;
  status: 'Aktif' | 'Nonaktif';
  tugas: string;
  jadwalTugas: string;
  ruangTugas: string;
  kehadiran: CommitteeAttendanceStatus;
  avatarVariant: AvatarVariant;
}

export const COMMITTEE_ROLES: CommitteeRole[] = [
  'Ketua Panitia',
  'Sekretaris',
  'Bendahara',
  'Proktor',
  'Teknisi',
  'Koordinator Ruang',
  'Anggota',
];

export const ROLE_TO_AVATAR: Record<CommitteeRole, AvatarVariant> = {
  'Ketua Panitia': 'ketua',
  Sekretaris: 'sekretaris',
  Bendahara: 'bendahara',
  Proktor: 'proktor',
  Teknisi: 'teknisi',
  'Koordinator Ruang': 'teknisi',
  Anggota: 'sekretaris',
};

export const COMMITTEE_MASTER: CommitteeMember[] = [
  {
    id: 'pan-01',
    nama: 'Drs. H. Ahmad, M.Pd',
    nip: '196805121993031005',
    jabatan: 'Ketua Panitia',
    status: 'Aktif',
    tugas: 'Koordinasi umum, pengesahan kartu peserta, denah ruang, dan berita acara PAS.',
    jadwalTugas: 'Senin – Sabtu (07.00 – 12.00 WITA)',
    ruangTugas: 'Sekretariat Panitia',
    kehadiran: 'Hadir',
    avatarVariant: 'ketua',
  },
  {
    id: 'pan-02',
    nama: 'Dra. Siti Aminah',
    nip: '196912311995032002',
    jabatan: 'Sekretaris',
    status: 'Aktif',
    tugas: 'Pengelolaan daftar hadir, berita acara ruangan, dan rekap administrasi peserta.',
    jadwalTugas: 'Senin – Sabtu (07.00 – 12.00 WITA)',
    ruangTugas: 'Sekretariat Panitia',
    kehadiran: 'Hadir',
    avatarVariant: 'sekretaris',
  },
  {
    id: 'pan-03',
    nama: 'Muhammad, S.Pd',
    nip: '197705082006041001',
    jabatan: 'Bendahara',
    status: 'Aktif',
    tugas: 'Pengelolaan anggaran percetakan kartu, konsumsi pengawas, dan pelaporan keuangan.',
    jadwalTugas: 'Senin – Sabtu (07.30 – 12.00 WITA)',
    ruangTugas: 'Ruang Tata Usaha',
    kehadiran: 'Hadir',
    avatarVariant: 'bendahara',
  },
  {
    id: 'pan-04',
    nama: 'Dewi Lestari, S.Pd',
    nip: '198203152008012005',
    jabatan: 'Proktor',
    status: 'Aktif',
    tugas: 'Sinkronisasi akun ujian, QR absensi ruang, serta verifikasi data peserta.',
    jadwalTugas: 'Senin – Sabtu (06.45 – 12.00 WITA)',
    ruangTugas: 'Ruang Server & Ruang 01–10',
    kehadiran: 'Hadir',
    avatarVariant: 'proktor',
  },
  {
    id: 'pan-05',
    nama: 'Rudi Hartono, S.Kom',
    nip: '198601272010121001',
    jabatan: 'Teknisi',
    status: 'Aktif',
    tugas: 'Pracetak kartu PAS, stiker nomor meja, denah tempat duduk, dan dukungan perangkat.',
    jadwalTugas: 'Senin – Sabtu (06.45 – 12.00 WITA)',
    ruangTugas: 'Ruang Server & Ruang 11–20',
    kehadiran: 'Hadir',
    avatarVariant: 'teknisi',
  },
  {
    id: 'pan-06',
    nama: 'Hj. Rahmawati, S.Pd',
    nip: '197409142000122003',
    jabatan: 'Koordinator Ruang',
    status: 'Aktif',
    tugas: 'Distribusi naskah, daftar hadir, dan pengecekan kelengkapan ruang 01–05.',
    jadwalTugas: 'Senin – Sabtu (07.15 – 11.45 WITA)',
    ruangTugas: 'Ruang 01 – 05',
    kehadiran: 'Hadir',
    avatarVariant: 'sekretaris',
  },
  {
    id: 'pan-07',
    nama: 'Agus Salim, S.Pd',
    nip: '198004192005011007',
    jabatan: 'Koordinator Ruang',
    status: 'Aktif',
    tugas: 'Penataan nomor meja dan pengecekan denah tempat duduk ruang 06–10.',
    jadwalTugas: 'Senin – Sabtu (07.15 – 11.45 WITA)',
    ruangTugas: 'Ruang 06 – 10',
    kehadiran: 'Hadir',
    avatarVariant: 'bendahara',
  },
  {
    id: 'pan-08',
    nama: 'Nurul Hidayah, S.Pd',
    nip: '198907222014022004',
    jabatan: 'Koordinator Ruang',
    status: 'Aktif',
    tugas: 'Pengumpulan daftar hadir dan pengawasan ketertiban ruang 11–15.',
    jadwalTugas: 'Senin – Sabtu (07.15 – 11.45 WITA)',
    ruangTugas: 'Ruang 11 – 15',
    kehadiran: 'Hadir',
    avatarVariant: 'proktor',
  },
  {
    id: 'pan-09',
    nama: 'Bambang Sutrisno, S.Pd',
    nip: '198311052009031002',
    jabatan: 'Koordinator Ruang',
    status: 'Aktif',
    tugas: 'Koordinasi pengawas dan verifikasi berita acara ruang 16–20.',
    jadwalTugas: 'Senin – Sabtu (07.15 – 11.45 WITA)',
    ruangTugas: 'Ruang 16 – 20',
    kehadiran: 'Hadir',
    avatarVariant: 'ketua',
  },
  {
    id: 'pan-10',
    nama: 'Fitriani, S.Kom',
    nip: '199204112019032008',
    jabatan: 'Anggota',
    status: 'Aktif',
    tugas: 'Pengarsipan laporan harian, dokumentasi foto, dan rekap peserta susulan.',
    jadwalTugas: 'Senin – Sabtu (07.30 – 12.00 WITA)',
    ruangTugas: 'Sekretariat Panitia',
    kehadiran: 'Hadir',
    avatarVariant: 'sekretaris',
  },
];
