import React from 'react';
import { LOGO_RIGHT_DATA_URI, type StudentRecord } from '../data/pasData';
import type { PrepressConfig, SeatingConfig } from '../types/prepress';
import {
  formatParticipantNo,
  normalizeRoomLabel,
  type DeskStickerRecord,
} from '../utils/deskStickerBuilder';
import {
  describeNumberingOrder,
  getSeatingPaperDimensions,
  placeItemsInGrid,
  type RoomSeatingPlan,
  type SeatingPageEntry,
} from '../utils/seatingPlanBuilder';

function FrontClassroomZone({
  orientation,
  doorSide,
}: {
  orientation: SeatingConfig['orientation'];
  doorSide: SeatingConfig['doorSide'];
}) {
  const isDoorLeft = doorSide === 'left';
  const isFrontTop = orientation === 'front_top';

  const doorNode = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5mm',
        padding: '0.8mm 2mm',
        border: '0.3mm dashed #64748B',
        backgroundColor: '#F8FAFC',
        flexShrink: 0,
      }}
    >
      <svg width="5mm" height="5mm" viewBox="0 0 20 20">
        {isDoorLeft ? (
          <>
            <line x1="2" y1="2" x2="2" y2="18" stroke="#1F3864" strokeWidth="2" />
            <path
              d={isFrontTop ? 'M2 18 A16 16 0 0 0 18 2' : 'M2 2 A16 16 0 0 1 18 18'}
              fill="none"
              stroke="#64748B"
              strokeWidth="1.3"
              strokeDasharray="2 2"
            />
          </>
        ) : (
          <>
            <line x1="18" y1="2" x2="18" y2="18" stroke="#1F3864" strokeWidth="2" />
            <path
              d={isFrontTop ? 'M18 18 A16 16 0 0 1 2 2' : 'M18 2 A16 16 0 0 0 2 18'}
              fill="none"
              stroke="#64748B"
              strokeWidth="1.3"
              strokeDasharray="2 2"
            />
          </>
        )}
      </svg>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: '6pt', fontWeight: 700, color: '#1F3864' }}>PINTU</div>
        <div style={{ fontSize: '5pt', color: '#64748B' }}>MASUK</div>
      </div>
    </div>
  );

  const teacherDeskNode = (
    <div
      style={{
        border: '0.4mm solid #1F3864',
        backgroundColor: '#FEF9E7',
        padding: '1mm 3mm',
        textAlign: 'center',
        flexShrink: 0,
        minWidth: '28mm',
      }}
    >
      <div style={{ fontSize: '6.5pt', fontWeight: 800, color: '#1F3864', lineHeight: 1.15 }}>
        MEJA PENGAWAS
      </div>
      <div style={{ fontSize: '5.2pt', color: '#7C5808', lineHeight: 1.1 }}>
        Pengawas Ruang Ujian
      </div>
    </div>
  );

  const boardNode = (
    <div
      style={{
        flex: 1,
        maxWidth: '82mm',
        border: '0.45mm solid #1F3864',
        backgroundColor: '#EEF2FA',
        padding: '1.1mm 3mm',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '7pt',
          fontWeight: 800,
          color: '#1F3864',
          letterSpacing: '0.5mm',
          lineHeight: 1.2,
        }}
      >
        PAPAN TULIS / DEPAN KELAS
      </div>
      <div style={{ fontSize: '5pt', color: '#44546A', lineHeight: 1.1 }}>
        Arah hadap peserta ujian
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '3mm',
        padding: '1.8mm 3mm',
        backgroundColor: '#F8FAFC',
        borderBottom: isFrontTop ? '0.4mm solid #CBD5E1' : 'none',
        borderTop: isFrontTop ? 'none' : '0.4mm solid #CBD5E1',
        flexShrink: 0,
      }}
    >
      {isDoorLeft ? doorNode : teacherDeskNode}
      {boardNode}
      {isDoorLeft ? teacherDeskNode : doorNode}
    </div>
  );
}

function StudentCardSeatBox({
  student,
  seatNo,
  mejaLabel,
  cols,
  rows,
  isPanitia,
  isFrontTop,
  isSpaciousPerKelas,
  seatingConfig,
  onSelectStudent,
}: {
  student: StudentRecord;
  seatNo: number;
  mejaLabel?: string;
  cols: number;
  rows: number;
  isPanitia: boolean;
  isFrontTop: boolean;
  isSpaciousPerKelas?: boolean;
  seatingConfig: SeatingConfig;
  onSelectStudent?: (st: StudentRecord) => void;
}) {
  const isCompact = !isSpaciousPerKelas && (cols >= 7 || rows >= 10);
  const isVeryCompact = !isSpaciousPerKelas && (cols >= 8 || rows >= 11);

  return (
    <div
      onClick={onSelectStudent ? () => onSelectStudent(student) : undefined}
      title={
        onSelectStudent
          ? `Klik untuk buka Kartu Peserta: ${mejaLabel || ''} · ${student.nama} (${student.kelas})`
          : undefined
      }
      style={{
        border: '0.35mm solid #1F3864',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: onSelectStudent ? 'pointer' : 'default',
      }}
    >
      {/* Mini PAS Card Header with Desk Number + Seat + Class */}
      <div
        style={{
          backgroundColor: '#1F3864',
          color: '#FFFFFF',
          borderBottom: isSpaciousPerKelas ? '0.6mm solid #C9A227' : '0.45mm solid #C9A227',
          padding: isSpaciousPerKelas ? '0.9mm 1.8mm' : isVeryCompact ? '0.35mm 0.9mm' : '0.45mm 1.2mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6mm',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8mm', minWidth: 0 }}>
          {mejaLabel && (
            <span
              style={{
                backgroundColor: '#C9A227',
                color: '#0F172A',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: isSpaciousPerKelas ? '6.2pt' : isVeryCompact ? '4.4pt' : '4.9pt',
                fontWeight: 800,
                padding: isSpaciousPerKelas ? '0.25mm 1.1mm' : '0.1mm 0.7mm',
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
              }}
            >
              {mejaLabel}
            </span>
          )}
          <span
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: isSpaciousPerKelas ? '6.5pt' : isVeryCompact ? '4.7pt' : isCompact ? '5.1pt' : '5.6pt',
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
            }}
          >
            #{String(seatNo).padStart(2, '0')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8mm', minWidth: 0 }}>
          <span
            style={{
              fontSize: isSpaciousPerKelas ? '6.5pt' : isVeryCompact ? '4.7pt' : '5.1pt',
              fontWeight: 700,
              color: '#F3D06B',
              whiteSpace: 'nowrap',
            }}
          >
            {student.kelas}
          </span>
          {isPanitia && (
            <span
              style={{
                width: isSpaciousPerKelas ? '2.4mm' : '1.8mm',
                height: isSpaciousPerKelas ? '2.4mm' : '1.8mm',
                border: '0.22mm solid #FFFFFF',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )}
        </div>
      </div>

      {/* Mini PAS Card Body synced 1:1 with Kartu Peserta */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isSpaciousPerKelas ? '1.1mm 1.8mm' : isVeryCompact ? '0.35mm 0.9mm' : '0.5mm 1.2mm',
          lineHeight: isSpaciousPerKelas ? 1.24 : 1.12,
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: isSpaciousPerKelas
              ? seatingConfig.showUserAndFullNo
                ? '6.8pt'
                : '8.4pt'
              : seatingConfig.showUserAndFullNo
                ? isVeryCompact
                  ? '4.3pt'
                  : '4.8pt'
                : isVeryCompact
                  ? '6pt'
                  : '6.8pt',
            fontWeight: 800,
            color: '#1F3864',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {seatingConfig.showUserAndFullNo || isSpaciousPerKelas
            ? formatParticipantNo(student.no)
            : `NO. ${student.no}`}
        </div>

        {seatingConfig.showStudentNames && (
          <div
            style={{
              fontSize: isSpaciousPerKelas ? '7.2pt' : isVeryCompact ? '4.9pt' : isCompact ? '5.3pt' : '5.9pt',
              fontWeight: 800,
              color: '#000000',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: isSpaciousPerKelas ? '0.6mm' : '0.2mm',
            }}
          >
            {student.nama}
          </div>
        )}

        {seatingConfig.showUserAndFullNo && (
          <div
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: isSpaciousPerKelas ? '5.6pt' : isVeryCompact ? '4.1pt' : '4.5pt',
              color: '#475569',
              whiteSpace: 'nowrap',
              marginTop: isSpaciousPerKelas ? '0.45mm' : '0.18mm',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '0.6mm',
            }}
          >
            <span>USR:{student.user}</span>
            <span style={{ color: '#1F3864', fontWeight: 700 }}>
              R.{normalizeRoomLabel(student.ruang)}
            </span>
          </div>
        )}
      </div>

      {/* Chair Orientation Bar */}
      <div
        style={{
          height: isSpaciousPerKelas ? '1.1mm' : '0.75mm',
          backgroundColor: '#E2E8F0',
          borderTop: isFrontTop ? '0.2mm solid #94A3B8' : 'none',
          borderBottom: isFrontTop ? 'none' : '0.2mm solid #94A3B8',
          order: isFrontTop ? 10 : -1,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function CombinedDeskSeatBox({
  desk,
  ruang,
  isPanitia,
  isFrontTop,
  isDenseGrid,
  seatingConfig,
}: {
  desk: DeskStickerRecord;
  ruang: string;
  isPanitia: boolean;
  isFrontTop: boolean;
  isDenseGrid: boolean;
  seatingConfig: SeatingConfig;
}) {
  const occupiedSlots = desk.slots.filter((s) => s.student !== null);

  return (
    <div
      style={{
        border: '0.4mm solid #1F3864',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: '#EEF2FA',
          borderBottom: '0.3mm solid #1F3864',
          padding: isDenseGrid ? '0.6mm 1.4mm' : '0.8mm 1.8mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: isDenseGrid ? '6.6pt' : '7.4pt',
            fontWeight: 800,
            color: '#1F3864',
            lineHeight: 1.1,
          }}
        >
          {desk.mejaLabel}
        </span>
        {isPanitia ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.8mm',
              fontSize: '5.5pt',
              color: '#44546A',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            <span
              style={{
                width: '2.2mm',
                height: '2.2mm',
                border: '0.25mm solid #1F3864',
                backgroundColor: '#FFFFFF',
                display: 'inline-block',
              }}
            />
            Cek
          </span>
        ) : (
          <span
            style={{
              fontSize: '5.2pt',
              fontWeight: 700,
              color: '#44546A',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}
          >
            R.{ruang}
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: isDenseGrid ? '0.5mm 1.3mm' : '0.7mm 1.6mm',
        }}
      >
        {occupiedSlots.map((slot, sIdx) => {
          const st = slot.student!;
          return (
            <div
              key={`${desk.id}-${st.no}`}
              style={{
                borderBottom: sIdx < occupiedSlots.length - 1 ? '0.2mm solid #E2E8F0' : 'none',
                paddingBottom: sIdx < occupiedSlots.length - 1 ? '0.35mm' : 0,
                paddingTop: sIdx > 0 ? '0.35mm' : 0,
                lineHeight: 1.12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '1mm',
                }}
              >
                <span
                  style={{
                    fontSize: seatingConfig.showStudentNames
                      ? isDenseGrid
                        ? '5.6pt'
                        : '6.2pt'
                      : '7.5pt',
                    fontWeight: 800,
                    color: '#1F3864',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st.kelas}
                </span>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: seatingConfig.showStudentNames
                      ? isDenseGrid
                        ? '5.1pt'
                        : '5.5pt'
                      : '7.5pt',
                    fontWeight: 700,
                    color: '#334155',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {seatingConfig.showUserAndFullNo ? formatParticipantNo(st.no) : st.no}
                </span>
              </div>
              {seatingConfig.showStudentNames && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '1mm',
                  }}
                >
                  <span
                    style={{
                      fontSize: isDenseGrid ? '5.2pt' : '5.8pt',
                      fontWeight: 700,
                      color: '#000000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {st.nama}
                  </span>
                  {seatingConfig.showUserAndFullNo && (
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        fontSize: isDenseGrid ? '4.3pt' : '4.7pt',
                        color: '#64748B',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {st.user}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          height: '1mm',
          backgroundColor: '#E2E8F0',
          borderTop: isFrontTop ? '0.2mm solid #94A3B8' : 'none',
          borderBottom: isFrontTop ? 'none' : '0.2mm solid #94A3B8',
          order: isFrontTop ? 10 : -1,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function SeatingPageMarkup({
  roomPlan,
  mode,
  paperW,
  paperH,
  seatingConfig,
  forPrint,
  onSelectStudent,
}: {
  roomPlan: RoomSeatingPlan;
  mode: 'kelas' | 'panitia';
  paperW: number;
  paperH: number;
  seatingConfig: SeatingConfig;
  forPrint?: boolean;
  onSelectStudent?: (st: StudentRecord) => void;
}) {
  const isPerKelas = seatingConfig.seatingMode === 'per_kelas';
  const isStudentCardMode = seatingConfig.seatingMode === 'student_card' || isPerKelas;
  const grid = isStudentCardMode
    ? placeItemsInGrid(
        roomPlan.orderedStudents,
        seatingConfig.cols,
        seatingConfig.numberingOrder,
        seatingConfig.orientation,
      )
    : placeItemsInGrid(
        roomPlan.desks,
        seatingConfig.cols,
        seatingConfig.numberingOrder,
        seatingConfig.orientation,
      );

  const isFrontTop = seatingConfig.orientation === 'front_top';
  const isPanitia = mode === 'panitia';
  const showSchoolHeader = seatingConfig.showSchoolHeader !== false;
  const isSpaciousPerKelas = isPerKelas && grid.cols <= 5 && grid.rows <= 7;
  const isDenseDeskGrid = grid.cols >= 5 || grid.rows >= 7 || (isPanitia && grid.rows >= 6);

  const frontZone = (
    <FrontClassroomZone
      orientation={seatingConfig.orientation}
      doorSide={seatingConfig.doorSide}
    />
  );

  return (
    <div
      className={`relative bg-white overflow-hidden ${
        forPrint ? 'print-sheet-page' : 'shadow-lg border border-[#CBD5E1]'
      }`}
      style={{
        width: `${paperW}mm`,
        height: `${paperH}mm`,
        padding: `${seatingConfig.marginMm}mm`,
        display: 'flex',
        flexDirection: 'column',
        gap: '2.2mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#0F172A',
      }}
    >
      {/* Header Kop Sekolah & Identitas Ruang */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '3mm',
          paddingBottom: showSchoolHeader ? '1.8mm' : '1.2mm',
          borderBottom: showSchoolHeader ? '0.8mm solid #C9A227' : '0.4mm solid #CBD5E1',
          flexShrink: 0,
        }}
      >
        {showSchoolHeader ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3.2mm', minWidth: 0 }}>
            <img
              src={LOGO_RIGHT_DATA_URI}
              alt="Lambang Sekolah SMAN 1 Alalak"
              style={{ height: '15mm', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, lineHeight: 1.2 }}>
              <div
                style={{
                  fontSize: '6.8pt',
                  fontWeight: 700,
                  color: '#44546A',
                  letterSpacing: '0.25mm',
                }}
              >
                {isPerKelas
                  ? 'TEMPAT DUDUK PESERTA PENILAIAN SUMATIF · SEMESTER GANJIL'
                  : seatingConfig.examTitle}
              </div>
              <div style={{ fontSize: '11pt', fontWeight: 800, color: '#1F3864' }}>
                {isPerKelas
                  ? 'SMAN 1 ALALAK TAHUN AJARAN 2026-2027'
                  : 'SMA NEGERI 1 ALALAK · DENAH TEMPAT DUDUK SISWA'}
              </div>
              <div
                style={{
                  fontSize: '6.8pt',
                  fontWeight: 700,
                  color: isPanitia ? '#92400E' : '#1F3864',
                  marginTop: '0.25mm',
                }}
              >
                {isPanitia ? 'DOKUMEN KONTROL & ARSIP PANITIA UJIAN · ' : null}
                <span style={{ fontWeight: 400, color: '#475569' }}>
                  {isPerKelas
                    ? `Denah Per Kelas (${roomPlan.classLabel ?? ''})`
                    : isStudentCardMode
                      ? 'Format Kartu Siswa (1 Kursi = 1 Kartu)'
                      : 'Format Meja Gabungan'}{' '}
                  · {describeNumberingOrder(seatingConfig.numberingOrder)} ({grid.cols}×{grid.rows})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div style={{ fontSize: '9.5pt', fontWeight: 800, color: '#1F3864' }}>
              DENAH TEMPAT DUDUK {isPerKelas && roomPlan.classLabel ? `· ${roomPlan.classLabel}` : 'PESERTA'}
            </div>
            <div
              style={{
                fontSize: '6.6pt',
                fontWeight: 700,
                color: isPanitia ? '#92400E' : '#475569',
                marginTop: '0.2mm',
              }}
            >
              {isPanitia ? 'DOKUMEN KONTROL & ARSIP PANITIA UJIAN · ' : null}
              <span style={{ fontWeight: 400, color: '#475569' }}>
                {isPerKelas
                  ? `Denah Per Kelas (${roomPlan.classLabel ?? ''})`
                  : isStudentCardMode
                    ? 'Format Kartu Siswa (1 Kursi = 1 Kartu)'
                    : 'Format Meja Gabungan'}{' '}
                · {describeNumberingOrder(seatingConfig.numberingOrder)} ({grid.cols}×{grid.rows})
              </span>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            border: '0.5mm solid #1F3864',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div
            style={{
              backgroundColor: '#1F3864',
              color: '#FFFFFF',
              padding: '1mm 2.8mm',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: '5.5pt', color: '#F3D06B', fontWeight: 700, lineHeight: 1.05 }}>
              {roomPlan.badgeLabel.startsWith('RUANG') ? `RUANG : ${roomPlan.ruang}` : 'KELOMPOK'}
            </div>
            <div style={{ fontSize: isPerKelas ? '10.5pt' : '12pt', fontWeight: 800, lineHeight: 1.15 }}>
              {isPerKelas
                ? roomPlan.classLabel
                : roomPlan.badgeLabel.startsWith('RUANG')
                  ? roomPlan.ruang
                  : roomPlan.badgeLabel}
            </div>
          </div>
          <div
            style={{
              backgroundColor: '#F8FAFC',
              padding: '1mm 2.4mm',
              textAlign: 'right',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              lineHeight: 1.25,
            }}
          >
            <div style={{ fontSize: '6.8pt', fontWeight: 800, color: '#1F3864' }}>
              {isPerKelas && roomPlan.subClassListLabel
                ? roomPlan.subClassListLabel
                : isStudentCardMode
                  ? `${roomPlan.totalStudents} Kursi`
                  : `${roomPlan.totalDesks} Meja`}
            </div>
            <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#44546A' }}>
              {roomPlan.totalStudents} Siswa
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Proportional Architectural Frame */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '0.5mm solid #1F3864',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
        }}
      >
        {isFrontTop && frontZone}

        {/* Proportional Grid with Clear Walking Aisles */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: isStudentCardMode ? '2mm 2.4mm' : isDenseDeskGrid ? '2mm 2.5mm' : '2.8mm 3.5mm',
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
            columnGap: grid.cols >= 7 ? '2.2mm' : grid.cols >= 5 ? '2.8mm' : '4mm',
            rowGap: grid.rows >= 9 ? '1.6mm' : grid.rows >= 6 ? '2mm' : '2.6mm',
          }}
        >
          {grid.cells.flatMap((rowArr, rIdx) =>
            rowArr.map((cell, cIdx) => {
              if (!cell.item) {
                if (!seatingConfig.showEmptyDesks) {
                  return <div key={`empty-${rIdx}-${cIdx}`} />;
                }
                return (
                  <div
                    key={`empty-${rIdx}-${cIdx}`}
                    style={{
                      border: '0.3mm dashed #CBD5E1',
                      backgroundColor: '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      fontSize: isStudentCardMode ? '5.2pt' : '6.5pt',
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>
                      {isStudentCardMode
                        ? `#${String(cell.placeholderNo).padStart(2, '0')}`
                        : `MEJA ${String(cell.placeholderNo).padStart(2, '0')}`}
                    </span>
                    <span style={{ fontSize: isStudentCardMode ? '4.5pt' : '5.5pt' }}>
                      Kosong
                    </span>
                  </div>
                );
              }

              if (isStudentCardMode) {
                const st = cell.item as StudentRecord;
                return (
                  <StudentCardSeatBox
                    key={`seat-${st.no}-${cell.placeholderNo}`}
                    student={st}
                    seatNo={cell.placeholderNo}
                    mejaLabel={roomPlan.seatDesksByStudentNo[st.no]?.mejaLabel}
                    cols={grid.cols}
                    rows={grid.rows}
                    isPanitia={isPanitia}
                    isFrontTop={isFrontTop}
                    isSpaciousPerKelas={isSpaciousPerKelas}
                    seatingConfig={seatingConfig}
                    onSelectStudent={forPrint ? undefined : onSelectStudent}
                  />
                );
              }

              const desk = cell.item as DeskStickerRecord;
              return (
                <CombinedDeskSeatBox
                  key={desk.id}
                  desk={desk}
                  ruang={roomPlan.ruang}
                  isPanitia={isPanitia}
                  isFrontTop={isFrontTop}
                  isDenseGrid={isDenseDeskGrid}
                  seatingConfig={seatingConfig}
                />
              );
            }),
          )}
        </div>

        {!isFrontTop && frontZone}
      </div>

      {/* Footer Zone */}
      {isPanitia ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr',
            gap: '3mm',
            flexShrink: 0,
          }}
        >
          <div style={{ border: '0.4mm solid #1F3864', overflow: 'hidden' }}>
            <div
              style={{
                backgroundColor: '#1F3864',
                color: '#FFFFFF',
                padding: '0.7mm 2mm',
                fontSize: '6pt',
                fontWeight: 700,
                letterSpacing: '0.2mm',
              }}
            >
              REKAP PESERTA {roomPlan.badgeLabel} ({roomPlan.totalStudents} SISWA)
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '6pt',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '0.25mm solid #CBD5E1' }}>
                  <th style={{ textAlign: 'left', padding: '0.6mm 1.5mm', color: '#44546A' }}>
                    Kelas
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.6mm 1.5mm', color: '#44546A' }}>
                    No. Peserta Kartu
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.6mm 1.5mm', color: '#44546A' }}>
                    Urutan Meja
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.6mm 1.5mm', color: '#44546A' }}>
                    Jml
                  </th>
                </tr>
              </thead>
              <tbody>
                {roomPlan.classSummaries.map((cs) => (
                  <tr key={cs.kelas} style={{ borderBottom: '0.2mm solid #E2E8F0' }}>
                    <td style={{ padding: '0.5mm 1.5mm', fontWeight: 700, color: '#1F3864' }}>
                      {cs.kelas}
                    </td>
                    <td
                      style={{
                        padding: '0.5mm 1.5mm',
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      }}
                    >
                      2026/SMAN 1 ALALAK/{cs.firstNo}–{cs.lastNo}
                    </td>
                    <td
                      style={{
                        padding: '0.5mm 1.5mm',
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                        color: '#44546A',
                      }}
                    >
                      {cs.firstMeja}–{cs.lastMeja}
                    </td>
                    <td
                      style={{
                        padding: '0.5mm 1.5mm',
                        textAlign: 'right',
                        fontWeight: 700,
                      }}
                    >
                      {cs.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              border: '0.4mm solid #1F3864',
              padding: '1.2mm 2mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontSize: '5.8pt',
              backgroundColor: '#F8FAFC',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: '#1F3864', marginBottom: '0.6mm' }}>
                VERIFIKASI PANITIA &amp; PENGAWAS
              </div>
              <div style={{ color: '#475569', lineHeight: 1.35 }}>
                Hari / Tanggal : _________________________
                <br />
                Hadir / Absen : _______ / _______ siswa
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2mm',
                marginTop: '2mm',
                paddingTop: '0.8mm',
                borderTop: '0.2mm dashed #CBD5E1',
              }}
            >
              <div>
                <div style={{ color: '#64748B' }}>Pengawas {roomPlan.badgeLabel}</div>
                <div style={{ marginTop: '5mm', borderTop: '0.25mm solid #334155' }} />
              </div>
              <div>
                <div style={{ color: '#64748B' }}>Ketua / Koordinator</div>
                <div
                  style={{
                    marginTop: '5mm',
                    borderTop: '0.25mm solid #334155',
                    fontSize: '5.2pt',
                    color: '#1F3864',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {seatingConfig.committeeChairName}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            border: '0.35mm solid #CBD5E1',
            backgroundColor: '#F8FAFC',
            padding: '1.3mm 2.3mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3mm',
            fontSize: '6.2pt',
            flexShrink: 0,
          }}
        >
          <div style={{ fontVariantNumeric: 'tabular-nums', color: '#1F3864' }}>
            <strong>Komposisi Kelas:</strong>{' '}
            {roomPlan.classSummaries
              .map((c) => `${c.kelas} (No. ${c.firstNo}–${c.lastNo}: ${c.count})`)
              .join('  ·  ')}
          </div>
          <div style={{ color: '#44546A', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
            Peserta wajib menempati kursi sesuai Nomor Peserta pada kartu ujian.
          </div>
        </div>
      )}
    </div>
  );
}

export function SeatingSheetPagesBlock({
  pages,
  paperConfig,
  seatingConfig,
  forPrint,
  onSelectStudent,
}: {
  pages: SeatingPageEntry[];
  paperConfig: Pick<PrepressConfig, 'paper' | 'customW' | 'customH'>;
  seatingConfig: SeatingConfig;
  forPrint?: boolean;
  onSelectStudent?: (st: StudentRecord) => void;
}) {
  const { paperW, paperH } = getSeatingPaperDimensions(
    paperConfig,
    seatingConfig.paperOrientation,
  );

  return (
    <div className={forPrint ? '' : 'space-y-8 flex flex-col items-center'}>
      {pages.map((entry, idx) => (
        <div key={entry.key} className={forPrint ? '' : 'flex flex-col items-center'}>
          {!forPrint && (
            <div className="mb-2 flex items-center gap-3 text-xs font-mono text-[#44546A]">
              <span className="font-semibold text-[#1F3864]">
                HALAMAN {idx + 1} · {entry.roomPlan.badgeLabel}
              </span>
              <span>·</span>
              <span>
                {entry.mode === 'kelas' ? 'Denah Tempel Kelas' : 'Denah Kontrol Panitia'}
              </span>
              <span>·</span>
              <span>
                {seatingConfig.seatingMode === 'per_kelas' || seatingConfig.seatingMode === 'student_card'
                  ? `${entry.roomPlan.totalStudents} kartu kursi (${entry.roomPlan.totalDesks} meja)`
                  : `${entry.roomPlan.totalDesks} meja (${entry.roomPlan.totalStudents} siswa)`}
              </span>
            </div>
          )}
          <SeatingPageMarkup
            roomPlan={entry.roomPlan}
            mode={entry.mode}
            paperW={paperW}
            paperH={paperH}
            seatingConfig={seatingConfig}
            forPrint={forPrint}
            onSelectStudent={onSelectStudent}
          />
        </div>
      ))}
    </div>
  );
}
