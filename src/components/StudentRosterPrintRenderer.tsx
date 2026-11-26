import React from 'react';
import { LOGO_RIGHT_DATA_URI, type StudentRecord } from '../data/pasData';
import type { StickerGroupingMode } from '../types/prepress';
import {
  buildDeskAssignmentLookup,
  compareNumericStrings,
  normalizeRoomLabel,
} from '../utils/deskStickerBuilder';
import {
  deriveStudentGender,
  deriveStudentJurusan,
  deriveStudentNisn,
  deriveStudentStatus,
} from '../utils/studentMetadata';

interface StudentRosterPrintBlockProps {
  students: StudentRecord[];
  groupingMode: StickerGroupingMode;
  academicYear?: string;
  semester?: 'Ganjil' | 'Genap';
}

export const StudentRosterPrintBlock: React.FC<StudentRosterPrintBlockProps> = ({
  students,
  groupingMode,
  academicYear = '2026/2027',
  semester = 'Ganjil',
}) => {
  const sorted = [...students].sort((a, b) => compareNumericStrings(a.no, b.no));
  const deskLookup = buildDeskAssignmentLookup(students, groupingMode);
  const rowsPerPage = 32;
  const pages: StudentRecord[][] = [];
  for (let i = 0; i < sorted.length; i += rowsPerPage) {
    pages.push(sorted.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <>
      {pages.map((pageRows, pageIdx) => (
        <div
          key={pageIdx}
          className="print-sheet-page bg-white text-[#0F172A] px-[12mm] py-[10mm]"
          style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
          <div className="border-b-2 border-[#0F295C] pb-2 mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_RIGHT_DATA_URI}
                alt="Logo Sekolah SMA Negeri 1 Alalak"
                className="w-10 h-10 object-contain shrink-0"
              />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                  SMA NEGERI 1 ALALAK — SISTEM MANAJEMEN PANITIA ULANGAN
                </div>
                <h1 className="text-[15px] font-extrabold text-[#0F172A]">
                  DAFTAR PESERTA UJIAN SEMESTER {semester.toUpperCase()} ({academicYear})
                </h1>
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#475569] text-right shrink-0">
              <div>Total Peserta: {sorted.length} siswa</div>
              <div>
                Halaman {pageIdx + 1} / {pages.length}
              </div>
            </div>
          </div>

          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="bg-[#E8F1FF] text-[#0F295C] font-bold">
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-8">No</th>
                <th className="border border-[#CBD5E1] py-1.5 px-2 text-left w-24">NISN</th>
                <th className="border border-[#CBD5E1] py-1.5 px-2 text-left">Nama Peserta</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-14">Kelas</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Jurusan</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-10">L/P</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Ruang</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Meja</th>
                <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((st, idx) => {
                const desk = deskLookup.get(st.no);
                return (
                  <tr key={st.no} className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center font-mono">
                      {pageIdx * rowsPerPage + idx + 1}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-2 font-mono">
                      {deriveStudentNisn(st)}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-2 font-semibold">{st.nama}</td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center font-mono">
                      {st.kelas}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center">
                      {deriveStudentJurusan(st)}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center font-semibold">
                      {deriveStudentGender(st)}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center font-mono">
                      R.{normalizeRoomLabel(st.ruang)}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center font-mono">
                      {desk ? desk.mejaLabel : '-'}
                    </td>
                    <td className="border border-[#CBD5E1] py-1 px-1.5 text-center">
                      {deriveStudentStatus(st)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
};
