import React from 'react';
import { LOGO_LEFT_DATA_URI, LOGO_RIGHT_DATA_URI } from '../data/pasData';
import type { ProctorMatrixSession, ProctorRecord } from '../data/proctorData';
import { describeMatrixSession, type ProctorDutyItem } from '../utils/proctorStore';
import type { ExamScheduleEntry } from '../utils/scheduleStore';

export type ProctorPrintMode = 'matrix' | 'roster' | 'both';

export interface ProctorRosterPrintBlockProps {
  mode: ProctorPrintMode;
  proctors: ProctorRecord[];
  matrix: ProctorMatrixSession[];
  dutiesByCode: Map<number, ProctorDutyItem[]>;
  scheduleEntries?: ExamScheduleEntry[];
  academicYear?: string;
  filterSummary?: string;
  chairName?: string;
  chairNip?: string;
}

export const ProctorRosterPrintBlock: React.FC<ProctorRosterPrintBlockProps> = ({
  mode,
  proctors,
  matrix,
  dutiesByCode,
  scheduleEntries,
  academicYear = '2026/2027',
  filterSummary,
  chairName = 'Drs. H. Ahmad, M.Pd',
  chairNip = '196805121993031005',
}) => {
  // Group matrix sessions by dayNo for clean rowspan rendering matching official spreadsheet
  const dayGroups: Array<{
    dayNo: number;
    dayLabel: string;
    shortDate: string;
    sessions: ProctorMatrixSession[];
  }> = [];

  for (const s of matrix) {
    let grp = dayGroups.find((g) => g.dayNo === s.dayNo);
    if (!grp) {
      grp = { dayNo: s.dayNo, dayLabel: s.dayLabel, shortDate: s.shortDate, sessions: [] };
      dayGroups.push(grp);
    }
    grp.sessions.push(s);
  }

  const periodRangeText =
    dayGroups.length === 0
      ? ''
      : dayGroups.length === 1
        ? dayGroups[0].shortDate
        : `${dayGroups[0].shortDate} s.d. ${dayGroups[dayGroups.length - 1].shortDate}`;

  // Build 3-column Keterangan columns (matching Image 3: 1-12 | 13-24 | 25-37)
  const sortedProctors = [...proctors].sort((a, b) => a.code - b.code);
  const colSize = Math.ceil(sortedProctors.length / 3);
  const ketCols = [
    sortedProctors.slice(0, colSize),
    sortedProctors.slice(colSize, colSize * 2),
    sortedProctors.slice(colSize * 2),
  ];

  const rowsPerPage = 22;
  const rosterPages: ProctorRecord[][] = [];
  for (let i = 0; i < sortedProctors.length; i += rowsPerPage) {
    rosterPages.push(sortedProctors.slice(i, i + rowsPerPage));
  }
  if (rosterPages.length === 0) rosterPages.push([]);

  return (
    <>
      {(mode === 'matrix' || mode === 'both') && (
        <div
          className="print-sheet-page bg-white text-[#0F172A] px-[10mm] py-[8mm] flex flex-col justify-between"
          style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
          <div>
            {/* Compact Header matching Image 2 */}
            <div className="flex items-center justify-between gap-2 border-b-2 border-[#0F295C] pb-1.5 mb-2">
              <img
                src={LOGO_LEFT_DATA_URI}
                alt="Logo Pendidikan"
                className="w-9 h-9 object-contain shrink-0"
              />
              <div className="text-center flex-1">
                <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-[#0F172A]">
                  DAFTAR PENGAWAS PENILAIAN SUMATIF AKHIR SEMESTER 1
                </div>
                <div className="text-[10px] font-bold uppercase text-[#1E3A8A]">
                  SMA NEGERI 1 ALALAK · TAHUN PELAJARAN {academicYear}
                  {periodRangeText ? ` · ${periodRangeText}` : ''}
                  {filterSummary ? ` · ${filterSummary}` : ''}
                </div>
              </div>
              <img
                src={LOGO_RIGHT_DATA_URI}
                alt="Logo Sekolah"
                className="w-9 h-9 object-contain shrink-0"
              />
            </div>

            {/* Matrix Table matching Image 2 */}
            <table className="w-full border-collapse text-[8px] leading-tight">
              <thead>
                <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                  <th rowSpan={2} className="border border-[#334155] py-1 px-1 text-center w-6">
                    NO
                  </th>
                  <th rowSpan={2} className="border border-[#334155] py-1 px-1.5 text-center w-16">
                    HARI/TGL
                  </th>
                  <th rowSpan={2} className="border border-[#334155] py-1 px-1 text-center w-8">
                    JAM KE
                  </th>
                  <th rowSpan={2} className="border border-[#334155] py-1 px-1 text-center w-16">
                    PUKUL (WITA)
                  </th>
                  {scheduleEntries && scheduleEntries.length > 0 && (
                    <th rowSpan={2} className="border border-[#334155] py-1 px-1 text-left w-28">
                      JADWAL / MAPEL
                    </th>
                  )}
                  <th
                    colSpan={10}
                    className="border border-[#334155] py-1 px-1 text-center bg-[#9BC2E6]"
                  >
                    RUANG DAN KODE PENGAWAS
                  </th>
                </tr>
                <tr className="bg-[#FFC000] text-[#0F172A] font-bold">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <th key={r} className="border border-[#334155] py-0.5 text-center w-6">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayGroups.map((grp) =>
                  grp.sessions.map((sess, sIdx) => {
                    const isEvenPair = sIdx % 2 === 1;
                    const meta =
                      scheduleEntries && scheduleEntries.length > 0
                        ? describeMatrixSession(sess, scheduleEntries)
                        : null;
                    return (
                      <tr
                        key={sess.id}
                        className={isEvenPair ? 'bg-[#D9D9D9]/55' : 'bg-white'}
                      >
                        {sIdx === 0 && (
                          <>
                            <td
                              rowSpan={grp.sessions.length}
                              className="border border-[#334155] text-center font-bold bg-white align-middle"
                            >
                              {grp.dayNo}
                            </td>
                            <td
                              rowSpan={grp.sessions.length}
                              className="border border-[#334155] px-1 text-center font-semibold bg-white align-middle"
                            >
                              <div className="font-bold">{grp.dayLabel}</div>
                              <div>{grp.shortDate}</div>
                            </td>
                          </>
                        )}
                        <td className="border border-[#334155] py-[1.5px] text-center font-semibold">
                          {sess.jamKe}
                        </td>
                        <td className="border border-[#334155] py-[1.5px] px-1 text-center font-mono whitespace-nowrap">
                          {sess.time}
                        </td>
                        {meta && (
                          <td className="border border-[#334155] py-[1.5px] px-1 text-left truncate max-w-[105px]">
                            {meta.summaryLabel}
                          </td>
                        )}
                        {sess.rooms.map((code, rIdx) =>
                          code === null ? (
                            <td
                              key={rIdx}
                              className="border border-[#334155] bg-[#0F172A]"
                            />
                          ) : (
                            <td
                              key={rIdx}
                              className="border border-[#334155] py-[1.5px] text-center font-mono font-bold"
                            >
                              {code}
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>

            {/* Keterangan 1-37 matching Image 3 */}
            <div className="mt-2.5 border border-[#CBD5E1] rounded p-2 bg-[#F8FAFC]">
              <div className="text-[9px] font-extrabold text-[#0F295C] mb-1 uppercase">
                Keterangan Kode Pengawas ({sortedProctors.length} Orang · {matrix.length} Sesi Tersinkron Jadwal):
              </div>
              <div className="grid grid-cols-3 gap-x-3 text-[8px] leading-snug">
                {ketCols.map((col, cIdx) => (
                  <div key={cIdx} className="space-y-0.5">
                    {col.map((p) => (
                      <div key={p.id} className="flex gap-1">
                        <span className="font-mono font-bold w-5 text-right shrink-0">
                          {p.code}.
                        </span>
                        <span className="truncate">{p.nama}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between text-[8.5px] text-[#334155]">
            <div>
              Dicetak dari Sistem Manajemen Panitia Ulangan · SMA Negeri 1 Alalak
              {periodRangeText ? ` (${periodRangeText})` : ''}
            </div>
            <div className="text-center pr-6">
              <div>Alalak, November 2026 · Ketua Panitia PAS</div>
              <div className="h-7" />
              <div className="font-bold underline text-[#0F172A]">{chairName}</div>
              <div className="text-[7.5px] text-[#64748B]">NIP. {chairNip}</div>
            </div>
          </div>
        </div>
      )}

      {(mode === 'roster' || mode === 'both') &&
        rosterPages.map((pageRows, pageIdx) => (
          <div
            key={pageIdx}
            className="print-sheet-page bg-white text-[#0F172A] px-[12mm] py-[10mm]"
            style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
          >
            <div className="border-b-2 border-[#0F295C] pb-2 mb-3 flex items-end justify-between">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                  SMA NEGERI 1 ALALAK — DAFTAR PENGAWAS UJIAN
                </div>
                <h1 className="text-[14px] font-extrabold text-[#0F172A]">
                  DAFTAR PENGAWAS PENILAIAN AKHIR SEMESTER ({academicYear})
                </h1>
              </div>
              <div className="text-[9.5px] font-mono text-[#475569] text-right">
                <div>Total: {sortedProctors.length} Pengawas</div>
                <div>
                  Hal {pageIdx + 1}/{rosterPages.length}
                </div>
              </div>
            </div>

            <table className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-[#E8F1FF] text-[#0F295C] font-bold">
                  <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-10">Kode</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-left">Nama Pengawas</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-32">NIP / Kode</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-2 text-center w-24">Ruang Tugas</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-16">Total Sesi</th>
                  <th className="border border-[#CBD5E1] py-1.5 px-1.5 text-center w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p, idx) => {
                  const duties = dutiesByCode.get(p.code) ?? [];
                  const rooms = [...new Set(duties.map((d) => d.roomLabel))].slice(0, 5);
                  return (
                    <tr key={p.id} className={idx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                      <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-mono font-bold">
                        {String(p.code).padStart(2, '0')}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 font-semibold">
                        {p.nama}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-center font-mono">
                        {p.nip || `KODE-${String(p.code).padStart(2, '0')}`}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-2 text-center font-mono text-[8.5px]">
                        {rooms.length > 0 ? rooms.join(', ') + (duties.length > 5 ? '...' : '') : '-'}
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-mono font-semibold">
                        {duties.length} sesi
                      </td>
                      <td className="border border-[#CBD5E1] py-1.5 px-1.5 text-center font-semibold">
                        {p.status}
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
