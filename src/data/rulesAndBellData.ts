export type RulesBellDocId = 'kode_lonceng' | 'tata_tertib_peserta' | 'tata_tertib_pengawas';

export interface BellCodeRow {
  id: string;
  countLabel: string;
  description: string;
}

export interface RulePointItem {
  id: string;
  text: string;
  subItems?: string[];
}

export interface RulesAndBellConfig {
  activeDoc: RulesBellDocId;
  printScope: 'active' | 'all';
  zoomPct: number;
  showKopOnBellCode: boolean;
  schoolName: string;
  schoolAddress: string;
  academicYear: string;
  cityLabel: string;
  letterDateLabel: string;
  principalTitle: string;
  principalName: string;
  principalNip: string;
  chairTitle: string;
  chairName: string;
  // Kode Lonceng
  bellTitleLine1: string;
  bellTitleLine2: string;
  bellNote: string;
  bellRows: BellCodeRow[];
  // Tata Tertib Peserta
  studentKopTitle: string;
  studentDocTitle: string;
  studentDocSubtitle: string;
  studentRules: RulePointItem[];
  // Tugas & Tata Tertib Pengawas
  proctorKopTitle: string;
  proctorDocTitle: string;
  proctorDocSubtitle: string;
  proctorRules: RulePointItem[];
}

export const RULES_BELL_STORAGE_KEY = 'pas_rules_bell_cfg_v1';

export const DEFAULT_BELL_ROWS: BellCodeRow[] = [
  {
    id: 'bell-1',
    countLabel: '6 X ( Kali )',
    description: 'Peserta Ulangan dipersilahkan memasuki ruangan masing-masing.',
  },
  {
    id: 'bell-2',
    countLabel: '5 X ( Kali )',
    description:
      'Pengawas diperkenankan menuju ruangan yang telah ditentukan dan mempersilahkan peserta masuk ruangan.',
  },
  {
    id: 'bell-3',
    countLabel: '4 X ( Kali )',
    description:
      'Pengawas mempersilahkan peserta untuk login dan membuka akun masing-masing.',
  },
  {
    id: 'bell-4',
    countLabel: '3 X ( Kali )',
    description:
      'Pengawas mempersilahkan peserta Ulangan untuk memastikan data sudah benar.',
  },
  {
    id: 'bell-5',
    countLabel: '2 X ( Kali )',
    description: 'Peserta Ulangan dipersilahkan untuk mengerjakan soal.',
  },
  {
    id: 'bell-6',
    countLabel: '1 X ( Kali )',
    description: 'Waktu mengerjakan soal tinggal 15 menit.',
  },
  {
    id: 'bell-7',
    countLabel: '4 X ( Kali )',
    description: 'Waktu mengerjakan soal telah habis.',
  },
];

export const DEFAULT_STUDENT_RULES: RulePointItem[] = [
  {
    id: 'sr-1',
    text: 'Peserta memasuki ruangan setelah tanda masuk dibunyikan, yakni 10 menit sebelum Penilaian Sumatif Semester I dimulai.',
  },
  {
    id: 'sr-2',
    text: 'Peserta dilarang membawa catatan dalam bentuk apapun ke dalam ruangan.',
  },
  {
    id: 'sr-3',
    text: 'Peserta dilarang membawa lebih dari satu Handphone.',
  },
  {
    id: 'sr-4',
    text: 'Peserta harus menyediakan alat tulis menulis yang diperlukan.',
  },
  {
    id: 'sr-5',
    text: 'Peserta wajib mengisi daftar hadir.',
  },
  {
    id: 'sr-6',
    text: 'Peserta boleh mengerjakan soal setelah tanda waktu mulai dibunyikan.',
  },
  {
    id: 'sr-7',
    text: 'Peserta yang memerlukan penjelasan dapat bertanya kepada pengawas dengan cara mengacungkan tangan terlebih dahulu.',
  },
  {
    id: 'sr-8',
    text: 'Peserta yang datang terlambat hanya boleh mengikuti Penilaian Sumatif Semester I setelah mendapatkan ijin dari Ketua Pelaksanaan Penilaian Sumatif Semester I dan kepadanya tidak diberikan perpanjangan waktu.',
  },
  {
    id: 'sr-9',
    text: 'Selama Penilaian Sumatif Semester I berlangsung peserta hanya dapat meninggalkan ruangan dengan ijin dan pengawasan pengawas, dan tidak melakukannya berulang kali.',
  },
  {
    id: 'sr-10',
    text: 'Peserta yang meninggalkan ruangan setelah membaca soal dan tidak kembali lagi sampai tanda selesai dibunyikan dinyatakan telah selesai menempuh atau mengikuti Penilaian Sumatif Semester I pada mata pelajaran yang terkait.',
  },
  {
    id: 'sr-11',
    text: 'Peserta yang telah selesai mengerjakan/mengirim soal sebelum waktu habis diperbolehkan meninggalkan ruangan dengan memperlihatkan tanda terkirim dari Handphone kepada pengawas.',
  },
  {
    id: 'sr-12',
    text: 'Peserta berhenti mengerjakan soal setelah pengawas memberitahukan tanda batas waktu selesai.',
  },
  {
    id: 'sr-13',
    text: 'Selama Penilaian Sumatif Semester I berlangsung peserta dilarang :',
    subItems: [
      'Menanyakan jawaban soal kepada siapapun.',
      'Bekerja sama dengan peserta lain.',
      'Memberi atau menerima bantuan dalam menjawab soal.',
      'Memperlihatkan pekerjaan sendiri kepada peserta lain atau melihat pekerjaan peserta lain.',
      'Mempergunakan kalkulator dan kamus.',
    ],
  },
  {
    id: 'sr-14',
    text: 'Semua peserta meninggalkan ruangan dengan tertib dan tenang setelah tanda batas waktu dibunyikan.',
  },
  {
    id: 'sr-15',
    text: 'Peserta yang melanggar tata tertib diberi peringatan, bila peringatan dilanggar lagi, peserta dikeluarkan dari ruangan dan diberi nilai 0 (nol), serta dicantumkan identitasnya dalam berita acara pelaksanaan.',
  },
];

export const DEFAULT_PROCTOR_RULES: RulePointItem[] = [
  {
    id: 'pr-1',
    text: 'Mengecek ruangan sesuai dengan tata cara pengaturan ruang Penilaian Sumatif Semester I.',
  },
  {
    id: 'pr-2',
    text: 'Mengecek tempat duduk peserta Penilaian Sumatif Semester I sesuai dengan nomornya masing-masing.',
  },
  {
    id: 'pr-3',
    text: 'Mengecek dan mengontrol peserta Penilaian Sumatif Semester I sesuai dengan tata tertib Penilaian Sumatif Semester I yang telah ditetapkan.',
  },
  {
    id: 'pr-4',
    text: 'Menerima dan memeriksa bahan Penilaian Sumatif Semester I yang terdiri dari :',
    subItems: [
      'Handphone Peserta Penilaian Sumatif Semester I',
      'Lembar Daftar Hadir Peserta Penilaian Sumatif Semester I',
      'Lembar Berita Acara Pelaksanaan Penilaian Sumatif Semester I',
    ],
  },
  {
    id: 'pr-5',
    text: 'Membacakan Tata Tertib Ulangan Penilaian Sumatif Semester I dan petunjuk mengerjakan soal.',
  },
  {
    id: 'pr-6',
    text: 'Memastikan peserta Penilaian Sumatif sudah login ke Akun masing-masing dari Handphonenya.',
  },
  {
    id: 'pr-7',
    text: 'Mengisi berita acara pelaksanaan Penilaian Sumatif Semester I.',
  },
  {
    id: 'pr-8',
    text: 'Menjaga ketertiban dan ketenangan selama pelaksanaan Semester I.',
  },
  {
    id: 'pr-9',
    text: 'Mengecek Handphone peserta Penilaian Sumatif Semester I untuk memastikan bahwa peserta telah menyelesaikan ulangannya dan jawaban telah terkirim.',
  },
  {
    id: 'pr-10',
    text: 'Menyerahkan map yang berisi berita acara dan daftar hadir peserta kepada panitia Penilaian Sumatif Semester I.',
  },
];

export const DEFAULT_RULES_BELL_CONFIG: RulesAndBellConfig = {
  activeDoc: 'kode_lonceng',
  printScope: 'all',
  zoomPct: 72,
  showKopOnBellCode: false,
  schoolName: 'SMA NEGERI 1 ALALAK',
  schoolAddress:
    'Jalan. Brigjend. H. Hasan Basri KM. 11 Kel. Handil Bakti Kec. Alalak Kab. Batola, 70582',
  academicYear: '2026 / 2027',
  cityLabel: 'Alalak',
  letterDateLabel: '12 November 2026',
  principalTitle: 'Kepala SMAN Alalak',
  principalName: 'Dr. H. RASYIDI, S.Pd, M.M.',
  principalNip: '19690106 199601 1 001',
  chairTitle: 'Ketua,',
  chairName: 'Huzaili Yamani, S.Pd',
  bellTitleLine1: 'KODE LONCENG PENILAIAN SUMATIF SEMESTER GANJIL',
  bellTitleLine2: 'TAHUN PELAJARAN 2026/2027',
  bellNote: 'Catatan : Kode lain yang diperlukan melalui pemberitahuan berikutnya.',
  bellRows: DEFAULT_BELL_ROWS,
  studentKopTitle: 'PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER I',
  studentDocTitle: 'TATA TERTIB PESERTA',
  studentDocSubtitle: 'PENILAIAN SUMATIF SEMESTER I',
  studentRules: DEFAULT_STUDENT_RULES,
  proctorKopTitle: 'PANITIA PELAKSANA PENILAIAN SUMATIF SEMESTER GANJIL',
  proctorDocTitle: 'TUGAS DAN TANGGUNG JAWAB PENGAWAS',
  proctorDocSubtitle: 'PENILAIAN SUMATIF SEMESTER I',
  proctorRules: DEFAULT_PROCTOR_RULES,
};

export function loadRulesBellConfig(): RulesAndBellConfig {
  try {
    const raw = localStorage.getItem(RULES_BELL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RulesAndBellConfig>;
      return {
        ...DEFAULT_RULES_BELL_CONFIG,
        ...parsed,
        bellRows:
          Array.isArray(parsed.bellRows) && parsed.bellRows.length > 0
            ? parsed.bellRows
            : DEFAULT_BELL_ROWS,
        studentRules:
          Array.isArray(parsed.studentRules) && parsed.studentRules.length > 0
            ? parsed.studentRules
            : DEFAULT_STUDENT_RULES,
        proctorRules:
          Array.isArray(parsed.proctorRules) && parsed.proctorRules.length > 0
            ? parsed.proctorRules
            : DEFAULT_PROCTOR_RULES,
      };
    }
  } catch {
    // ignore storage failure
  }
  return DEFAULT_RULES_BELL_CONFIG;
}

export function saveRulesBellConfig(cfg: RulesAndBellConfig): void {
  try {
    localStorage.setItem(RULES_BELL_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage failure
  }
}
