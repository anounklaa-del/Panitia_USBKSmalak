import React from 'react';
import { LOGO_LEFT_DATA_URI, LOGO_RIGHT_DATA_URI } from '../data/pasData';
import type { CombinedScheduleRow, ExamScheduleEntry } from '../utils/scheduleStore';
import { formatIndonesianDateLong, splitDayAndDate } from '../utils/scheduleStore';

export type SchedulePrintMode = 'combined' | 'sessions' | 'class';

export interface ScheduleRosterPrintBlockProps {
  mode: SchedulePrintMode;
  combinedRows: CombinedScheduleRow[];
  sessionRows: ExamScheduleEntry[];
  selectedClass?: string;
  academicYear?: string;
  filterSummary?: string;
  totalStudents: number;
  totalRooms: number;
  chairName?: string;
  chairNip?: string;
}

interface PrintableScheduleLine {
  key: string;
  date: string;
  subject: string;
  kelas: string;
  time: string;
  room: string;
  pengawas: string;
  status: string;
}

export const ScheduleRosterPrintBlock: React.FC<ScheduleRosterPrintBlockProps> = ({
  mode,
  combinedRows,
  sessionRows,
  selectedClass,
  academicYear = '2026/2027',
  filterSummary,
  totalStudents,
  totalRooms,
  chairName = 'Drs. H. Ahmad, M.Pd',
  chairNip = '196805121993031005',
}) => {
  const lines: PrintableScheduleLine[] =
    mode === 'combined'
      ? combinedRows.map((r) => ({
          key: r.id,
          date: r.date,
          subject: r.subject,
          kelas: r.isAllClasses ? 'X, XI, XII (Semua Kelas)' : r.kelasLabel,
          time: r.timeLabel,
          room: r.ruangLabel,
          pengawas: r.pengawas,
          status: r.hasMixedStatus ? 'Sebagian' : r.status,
        }))
      : sessionRows.map((e) => ({
          key: e.id,
          date: e.date,
          subject: e.subject,
          kelas: e.kelasLabel,
          time: e.time,
          room: e.ruangLabel,
          pengawas: e.pengawas,
          status: e.status,
        }));

  const uniqueSubjects = new Set(lines.map((l) => l.subject.trim().toLowerCase())).size;
  const uniqueDates = lines.map((l) => l.date);
  const firstDate = uniqueDates[0] ? formatIndonesianDateLong(uniqueDates[0]) : '-';
  const lastDate =
    uniqueDates.length > 0 ? formatIndonesianDateLong(uniqueDates[uniqueDates.length - 1]) : '-';

  const rowsPerPage = 24;
  const pages: PrintableScheduleLine[][] = [];
  for (let i = 0; i < lines.length; i += rowsPerPage) {
    pages.push(lines.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  const subtitleText =
    mode === 'combined'
      ? 'JADWAL ULANGAN GABUNGAN SEMUA KELAS (TINGKAT X, XI, XII)'
      : mode === 'class' && selectedClass
        ? `JADWAL ULANGAN KHUSUS KELAS ${selectedClass}`
        : 'RINCIAN JADWAL & SESI PELAKSANAAN PENILAIAN AKHIR SEMESTER';

  return (
    <>
      {pages.map((pageRows, pageIdx) => {
        const isLastPage = pageIdx === pages.length - 1;
        return (
          <div
            key={pageIdx}
            className="print-sheet-page bg-white text-[#0F172A] px-[12mm] py-[10mm] flex flex-col justify-between"
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
          >
            <div>
              {/* Official Kop Surat */}
              <div className="flex items-center justify-between gap-3 border-b-[2.5px] border-[#0F295C] pb-2.5 mb-3">
                <img
                  src={LOGO_LEFT_DATA_URI}
                  alt="Logo Pendidikan"
                  className="w-12 h-12 object-contain shrink-0"
                />
                <div className="text-center flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                    PEMERINTAH PROVINSI KALIMANTAN SELATAN · DINAS PENDIDIKAN DAN KEBUDAYAAN
                  </div>
                  <div className="text-[15px] font-extrabold uppercase tracking-wide text-[#0F172A]">
                    SMA NEGERI 1 ALALAK
                  </div>
                  <div className="text-[9px] text-[#475569]">
                    Kabupaten Barito Kuala · Sistem Manajemen Panitia Ulangan · Tahun Pelajaran {academicYear}
                  </div>
                </div>
                <img
                  src={LOGO_RIGHT_DATA_URI}
                  alt="Logo Sekolah"
                  className="w-12 h-12 object-contain shrink-0"
                />
              </div>

              {/* Document Title & Metadata Summary */}
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <h1 className="text-[13.5px] font-extrabold text-[#0F295C] uppercase">
                    JADWAL PELAKSANAAN PENILAIAN AKHIR SEMESTER (PAS) GANJIL
                  </h1>
                  <div className="text-[10.5px] font-bold text-[#1D4ED8] mt-0.5">
                    {subtitleText}
                    {filterSummary ? ` · Filter: ${filterSummary}` : ''}
                  </div>
                </div>
                <div className="text-[9.5px] font-mono text-[#334155] text-right shrink-0">
                  <div>
                    Pelaksanaan: {firstDate} – {lastDate}
                  </div>
                  <div>
                    {uniqueSubjects} Mapel · {totalRooms} Ruang · {totalStudents} Peserta · Hal {pageIdx + 1}/{pages.length}
                  </div>
                </div>
              </div>

              {/* Schedule Table */}
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="bg-[#E8F1FF] text-[#0F295C] font-bold">
                    <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-8">No</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-2 text-left w-32">Hari / Tanggal</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-2 text-left">Mata Pelajaran</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-28">Kelas</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-28">Waktu</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-20">Ruang</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-20">Pengawas</th>
                    <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="border border-[#CBD5E1] py-6 text-center text-[#64748B]"
                      >
                        Tidak ada jadwal ulangan yang cocok dengan filter aktif.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row, idx) => {
                      const { dayLabel, dateLabel } = splitDayAndDate(row.date);
                      return (
                        <tr
                          key={row.key}
                          className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}
                        >
                          <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-mono">
                            {pageIdx * rowsPerPage + idx + 1}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-2">
                            {dayLabel && (
                              <span className="text-[#475569] mr-1">{dayLabel}</span>
                            )}
                            <span className="font-semibold text-[#0F172A]">{dateLabel}</span>
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-2 font-bold text-[#0F295C]">
                            {row.subject}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-2 text-center font-semibold">
                            {row.kelas}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-2 text-center font-mono">
                            {row.time}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-mono">
                            {row.room}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-2 text-center">
                            {row.pengawas}
                          </td>
                          <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-semibold">
                            {row.status}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {isLastPage && (
              <div className="mt-5 pt-3 border-t border-[#E2E8F0] flex items-start justify-between text-[9.5px] text-[#334155]">
                <div className="max-w-[92mm] space-y-1">
                  <div className="font-bold text-[#0F295C]">Catatan Pelaksanaan:</div>
                  <div>1. Jadwal ini tersinkron otomatis dengan Kartu Peserta PAS, Daftar Hadir, dan Pembagian Ruang.</div>
                  <div>2. Pengawas hadir 15 menit sebelum sesi dimulai di ruang masing-masing.</div>
                </div>
                <div className="grid grid-cols-2 gap-10 text-center">
                  <div>
                    <div>Mengetahui,</div>
                    <div className="font-bold text-[#0F172A]">Kepala SMA Negeri 1 Alalak</div>
                    <div className="h-12" />
                    <div className="font-bold underline text-[#0F172A]">Hj. Rusidah, S.Pd, M.Pd</div>
                    <div className="text-[8.5px] text-[#64748B]">NIP. 196908141994122003</div>
                  </div>
                  <div>
                    <div>Alalak, November 2026</div>
                    <div className="font-bold text-[#0F172A]">Ketua Panitia PAS</div>
                    <div className="h-12" />
                    <div className="font-bold underline text-[#0F172A]">{chairName}</div>
                    <div className="text-[8.5px] text-[#64748B]">NIP. {chairNip}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
