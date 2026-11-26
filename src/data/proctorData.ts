import type { AvatarVariant } from '../components/CommitteeAvatars';

export type ProctorStatus = 'Aktif' | 'Tidak Aktif';

export interface ProctorRecord {
  id: string;
  code: number; // Kode Pengawas 1..37+
  nama: string;
  nip?: string;
  status: ProctorStatus;
  avatarVariant: AvatarVariant;
  notes?: string;
}

export interface ProctorMatrixSession {
  id: string;
  dayNo: number; // 1..9
  dayLabel: string; // e.g. "SENIN"
  date: string; // e.g. "Senin, 30 Nov 2026"
  shortDate: string; // e.g. "30-Nov-26"
  jamKe: 1 | 2 | 3;
  time: string; // e.g. "08.00 - 09.00"
  /** Length 10 array corresponding to Ruang 1..10. `null` = sesi kosong / blok hitam */
  rooms: Array<number | null>;
}

const PROCTOR_AVATAR_CYCLE: AvatarVariant[] = [
  'sekretaris',
  'ketua',
  'proktor',
  'bendahara',
  'teknisi',
];

function guessAvatarVariant(nama: string, code: number): AvatarVariant {
  const lower = nama.toLowerCase();
  if (lower.startsWith('hj.') || lower.includes('fitriah') || lower.includes('sri ') || lower.includes('ida ') || lower.includes('masitah') || lower.includes('juwita') || lower.includes('isna') || lower.includes('arina') || lower.includes('ayu') || lower.includes('zaitun') || lower.includes('rusi') || lower.includes('siti') || lower.includes('raudhatul') || lower.includes('dewi') || lower.includes('rahimah') || lower.includes('ani ') || lower.includes('erie')) {
    return code % 2 === 0 ? 'sekretaris' : 'proktor';
  }
  return code % 3 === 0 ? 'teknisi' : code % 2 === 0 ? 'ketua' : 'bendahara';
}

const RAW_PROCTOR_NAMES: Array<[number, string]> = [
  [1, 'Fitriah, S.Pd'],
  [2, 'Sarjanawan, S.Pd'],
  [3, 'Surya Israwan Noor, S.Pd'],
  [4, 'Suhartoyo, S.Pd'],
  [5, 'Bunardi, S. Pd'],
  [6, 'Ani Nilawardani, M.Pd'],
  [7, 'Suryadi, S.Pd'],
  [8, 'Sri Rahayu, S. Pd'],
  [9, 'Erie Murwilamsari, S.Pd'],
  [10, 'Hj. Nurhidayani, S.Pd'],
  [11, 'Ida Fitriah, ST'],
  [12, 'Hj. Titien Andayani, SE'],
  [13, 'Agus Suwarni Isyra, M.Pd'],
  [14, 'Hj. Nurida Hayati, S. Pd'],
  [15, 'Murjani, S.Pd, MM'],
  [16, 'Masitah, S.Pd'],
  [17, 'Hj. Juhairiah, S.Pd'],
  [18, 'Hj. Titik Sukarni, SE'],
  [19, 'H. Fuady, S. Sos, M.Pd'],
  [20, 'Rahyono, S.Ag'],
  [21, 'Sri Murtiningsih, S.Pd'],
  [22, 'Ridha Anshari, S.Pd'],
  [23, 'Juwita, ST'],
  [24, 'Juhri, S.Ag'],
  [25, 'Satria Dharmawan, S. Pd'],
  [26, 'Gt. Riza Rizky, S.Pd'],
  [27, 'Isna Faulina, S.Pd'],
  [28, 'Arina Dyah Nastiti, S.Pd'],
  [29, 'Hj. Mursinah, S.Pd'],
  [30, 'Sri Ayu Lestari, S.Pd'],
  [31, 'Ayu Saradita Gasati, S.Pd'],
  [32, 'Zaitun Nita, S.Pd'],
  [33, 'Rusi Aprina, S.Pd'],
  [34, 'Siti Elmiah, S. Pd'],
  [35, 'Raudhatul Jannah, S.Pd'],
  [36, 'Dewi Suci Hartanti, S.Pd'],
  [37, 'Rahimah'],
];

export const PROCTORS_MASTER: ProctorRecord[] = RAW_PROCTOR_NAMES.map(([code, nama]) => ({
  id: `prg-${String(code).padStart(2, '0')}`,
  code,
  nama,
  status: 'Aktif',
  avatarVariant: guessAvatarVariant(nama, code) || PROCTOR_AVATAR_CYCLE[code % PROCTOR_AVATAR_CYCLE.length],
}));

export const PROCTOR_MATRIX_MASTER: ProctorMatrixSession[] = [
  // HARI 1 — SENIN, 30-Nov-26 (6 sesi: X1-6 & XI 1-7 & XII 1-7)
  { id: 'd1-s1', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 1, time: '08.00 - 09.00', rooms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 'd1-s2', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 2, time: '09.15 - 10.15', rooms: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  { id: 'd1-s3', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 1, time: '10.30 - 11.30', rooms: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  { id: 'd1-s4', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 2, time: '11.45 - 12.45', rooms: [31, 32, 33, 34, 35, 36, 37, 1, 2, 3] },
  { id: 'd1-s5', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 1, time: '13.15 - 14.15', rooms: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  { id: 'd1-s6', dayNo: 1, dayLabel: 'SENIN', date: 'Senin, 30 Nov 2026', shortDate: '30-Nov-26', jamKe: 2, time: '14.30 - 15.30', rooms: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },

  // HARI 2 — SELASA, 01-Dec-26 (6 sesi)
  { id: 'd2-s1', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33] },
  { id: 'd2-s2', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [34, 35, 36, 37, 1, 2, 3, 4, 5, 6] },
  { id: 'd2-s3', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  { id: 'd2-s4', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
  { id: 'd2-s5', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [27, 28, 29, 30, 31, 32, 33, 34, 35, 36] },
  { id: 'd2-s6', dayNo: 2, dayLabel: 'SELASA', date: 'Selasa, 1 Des 2026', shortDate: '01-Dec-26', jamKe: 2, time: '14.30 - 15.30', rooms: [37, 1, 2, 3, 4, 5, 6, 7, 8, 9] },

  // HARI 3 — RABU, 02-Dec-26 (5 sesi; jam 09.15 R.04 & R.07 kosong karena XI 3 & XI 5 tidak ada ujian; 14.30-15.30 kosong/tidak ada ujian)
  { id: 'd3-s1', dayNo: 3, dayLabel: 'RABU', date: 'Rabu, 2 Des 2026', shortDate: '02-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
  { id: 'd3-s2', dayNo: 3, dayLabel: 'RABU', date: 'Rabu, 2 Des 2026', shortDate: '02-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [20, 21, 22, null, 23, 24, null, 25, 26, 27] },
  { id: 'd3-s3', dayNo: 3, dayLabel: 'RABU', date: 'Rabu, 2 Des 2026', shortDate: '02-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37] },
  { id: 'd3-s4', dayNo: 3, dayLabel: 'RABU', date: 'Rabu, 2 Des 2026', shortDate: '02-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 'd3-s5', dayNo: 3, dayLabel: 'RABU', date: 'Rabu, 2 Des 2026', shortDate: '02-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },

  // HARI 4 — KAMIS, 03-Dec-26 (6 sesi; jam 11.45 R.10 kosong karena hanya berisi XI 7)
  { id: 'd4-s1', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  { id: 'd4-s2', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [31, 32, 33, 34, 35, 36, 37, 1, 2, 3] },
  { id: 'd4-s3', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  { id: 'd4-s4', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [14, 15, 16, 17, 18, 19, 20, 21, 22, null] },
  { id: 'd4-s5', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
  { id: 'd4-s6', dayNo: 4, dayLabel: 'KAMIS', date: 'Kamis, 3 Des 2026', shortDate: '03-Dec-26', jamKe: 2, time: '14.30 - 15.30', rooms: [33, 34, 35, 36, 37, 1, 2, 3, 4, 5] },

  // HARI 5 — JUM'AT, 04-Dec-26 (3 sesi: Matematika Umum XII, X, XI)
  { id: 'd5-s1', dayNo: 5, dayLabel: "JUM'AT", date: 'Jumat, 4 Des 2026', shortDate: '04-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  { id: 'd5-s2', dayNo: 5, dayLabel: "JUM'AT", date: 'Jumat, 4 Des 2026', shortDate: '04-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
  { id: 'd5-s3', dayNo: 5, dayLabel: "JUM'AT", date: 'Jumat, 4 Des 2026', shortDate: '04-Dec-26', jamKe: 3, time: '10.30 - 11.30', rooms: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35] },

  // HARI 6 — SENIN, 07-Dec-26 (6 sesi; semua 10 ruang aktif)
  { id: 'd6-s1', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [36, 37, 1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'd6-s2', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { id: 'd6-s3', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28] },
  { id: 'd6-s4', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [29, 30, 31, 32, 33, 34, 35, 36, 37, 1] },
  { id: 'd6-s5', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'd6-s6', dayNo: 6, dayLabel: 'SENIN', date: 'Senin, 7 Des 2026', shortDate: '07-Dec-26', jamKe: 2, time: '14.30 - 15.30', rooms: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21] },

  // HARI 7 — SELASA, 08-Dec-26 (6 sesi; jam 11.45 R.09 kosong karena XI 6 tidak ada ujian)
  { id: 'd7-s1', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31] },
  { id: 'd7-s2', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [32, 33, 34, 35, 36, 37, 1, 2, 3, 4] },
  { id: 'd7-s3', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  { id: 'd7-s4', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [15, 16, 17, 18, 19, 20, 21, 22, null, 23] },
  { id: 'd7-s5', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33] },
  { id: 'd7-s6', dayNo: 7, dayLabel: 'SELASA', date: 'Selasa, 8 Des 2026', shortDate: '08-Dec-26', jamKe: 2, time: '14.30 - 15.30', rooms: [34, 35, 36, 37, 1, 2, 3, 4, 5, 6] },

  // HARI 8 — RABU, 09-Dec-26 (5 sesi: tidak ada ujian 09.15-10.15; jam 14.30 R.01 kosong karena hanya XI 1)
  { id: 'd8-s1', dayNo: 8, dayLabel: 'RABU', date: 'Rabu, 9 Des 2026', shortDate: '09-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  { id: 'd8-s2', dayNo: 8, dayLabel: 'RABU', date: 'Rabu, 9 Des 2026', shortDate: '09-Dec-26', jamKe: 1, time: '10.30 - 11.30', rooms: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
  { id: 'd8-s3', dayNo: 8, dayLabel: 'RABU', date: 'Rabu, 9 Des 2026', shortDate: '09-Dec-26', jamKe: 2, time: '11.45 - 12.45', rooms: [27, 28, 29, 30, 31, 32, 33, 34, 35, 36] },
  { id: 'd8-s4', dayNo: 8, dayLabel: 'RABU', date: 'Rabu, 9 Des 2026', shortDate: '09-Dec-26', jamKe: 1, time: '13.15 - 14.15', rooms: [37, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'd8-s5', dayNo: 8, dayLabel: 'RABU', date: 'Rabu, 9 Des 2026', shortDate: '09-Dec-26', jamKe: 2, time: '14.30 - 15.30', rooms: [null, 10, 11, 12, 13, 14, 15, 16, 17, 18] },

  // HARI 9 — KAMIS, 10-Dec-26 (2 sesi: Sosiologi X & Koding dan Kecerdasan Artifisial X)
  { id: 'd9-s1', dayNo: 9, dayLabel: 'KAMIS', date: 'Kamis, 10 Des 2026', shortDate: '10-Dec-26', jamKe: 1, time: '08.00 - 09.00', rooms: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28] },
  { id: 'd9-s2', dayNo: 9, dayLabel: 'KAMIS', date: 'Kamis, 10 Des 2026', shortDate: '10-Dec-26', jamKe: 2, time: '09.15 - 10.15', rooms: [29, 30, 31, 32, 33, 34, 35, 36, 37, 1] },
];
