import React from 'react';
import { LOGO_LEFT_DATA_URI } from '../data/pasData';
import type {
  RulePointItem,
  RulesAndBellConfig,
  RulesBellDocId,
} from '../data/rulesAndBellData';

interface RulesAndBellRendererProps {
  cfg: RulesAndBellConfig;
  docIds: RulesBellDocId[];
  forPrint?: boolean;
}

function KopSuratBlock({
  kopTitle,
  academicYear,
  schoolName,
  schoolAddress,
}: {
  kopTitle: string;
  academicYear: string;
  schoolName: string;
  schoolAddress: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4mm',
        paddingBottom: '2.5mm',
        borderBottom: '1mm solid #000000',
        marginBottom: '6mm',
      }}
    >
      <div
        style={{
          width: '20mm',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={LOGO_LEFT_DATA_URI}
          alt="Logo Pemerintah Provinsi Kalimantan Selatan"
          style={{
            height: '18.5mm',
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
      <div style={{ flex: 1, textAlign: 'center', color: '#000000' }}>
        <div
          style={{
            fontSize: '10.5pt',
            fontWeight: 700,
            letterSpacing: '0.2px',
            lineHeight: 1.28,
            textTransform: 'uppercase',
          }}
        >
          {kopTitle}
        </div>
        <div
          style={{
            fontSize: '10.5pt',
            fontWeight: 700,
            lineHeight: 1.28,
            textTransform: 'uppercase',
          }}
        >
          TAHUN PELAJARAN {academicYear}
        </div>
        <div
          style={{
            fontSize: '14pt',
            fontWeight: 800,
            letterSpacing: '0.4px',
            lineHeight: 1.22,
            textTransform: 'uppercase',
          }}
        >
          {schoolName}
        </div>
        <div
          style={{
            fontSize: '9pt',
            fontWeight: 400,
            lineHeight: 1.3,
            marginTop: '0.5mm',
          }}
        >
          {schoolAddress}
        </div>
      </div>
    </div>
  );
}

function RulesListBlock({
  items,
  compactFont,
}: {
  items: RulePointItem[];
  compactFont?: boolean;
}) {
  const fontSize = compactFont ? '10.6pt' : '11.3pt';
  const lineHeight = compactFont ? 1.38 : 1.48;
  const itemGap = compactFont ? '1.35mm' : '2.2mm';

  return (
    <ol
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize,
        lineHeight,
        color: '#000000',
      }}
    >
      {items.map((item, idx) => (
        <li
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2.5mm',
            marginBottom: itemGap,
            textAlign: 'justify',
          }}
        >
          <span
            style={{
              width: '6.5mm',
              flexShrink: 0,
              fontWeight: 700,
              textAlign: 'left',
            }}
          >
            {idx + 1}.
          </span>
          <div style={{ flex: 1 }}>
            <div>{item.text}</div>
            {item.subItems && item.subItems.length > 0 && (
              <ol
                style={{
                  margin: '1mm 0 0.5mm 0',
                  padding: 0,
                  listStyle: 'none',
                }}
              >
                {item.subItems.map((sub, sIdx) => (
                  <li
                    key={`${item.id}-sub-${sIdx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '2.2mm',
                      marginBottom: '0.7mm',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ width: '5mm', flexShrink: 0 }}>
                      {String.fromCharCode(97 + sIdx)}.
                    </span>
                    <span style={{ flex: 1 }}>{sub}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function KodeLoncengPage({ cfg }: { cfg: RulesAndBellConfig }) {
  return (
    <div
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {cfg.showKopOnBellCode && (
        <div style={{ fontFamily: '"Times New Roman", Georgia, serif' }}>
          <KopSuratBlock
            kopTitle={cfg.proctorKopTitle}
            academicYear={cfg.academicYear}
            schoolName={cfg.schoolName}
            schoolAddress={cfg.schoolAddress}
          />
        </div>
      )}

      {/* Centered Italic Bold Header */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: '12.5pt',
          lineHeight: 1.4,
          textTransform: 'uppercase',
          marginTop: cfg.showKopOnBellCode ? '1mm' : '4mm',
          marginBottom: '6mm',
        }}
      >
        <div>{cfg.bellTitleLine1}</div>
        <div>{cfg.bellTitleLine2}</div>
      </div>

      {/* Main Kode Lonceng Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '0.45mm solid #000000',
          fontSize: '12pt',
          lineHeight: 1.38,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: '38%',
                border: '0.4mm solid #000000',
                padding: '4mm 3mm',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '12pt',
              }}
            >
              TANDA LONCENG
            </th>
            <th
              style={{
                width: '62%',
                border: '0.4mm solid #000000',
                padding: '4mm 3mm',
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '12pt',
              }}
            >
              KETERANGAN
            </th>
          </tr>
        </thead>
        <tbody>
          {cfg.bellRows.map((row) => (
            <tr key={row.id}>
              <td
                style={{
                  border: '0.4mm solid #000000',
                  padding: '3.4mm 3mm',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: 700,
                  fontSize: '12.5pt',
                  lineHeight: 1.32,
                }}
              >
                <div>Bunyi Lonceng</div>
                <div>{row.countLabel}</div>
              </td>
              <td
                style={{
                  border: '0.4mm solid #000000',
                  padding: '3.4mm 4mm',
                  textAlign: 'left',
                  verticalAlign: 'middle',
                  fontWeight: 700,
                  fontSize: '11.8pt',
                  lineHeight: 1.38,
                }}
              >
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Note */}
      <div
        style={{
          marginTop: '6mm',
          fontSize: '11.5pt',
          fontWeight: 700,
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}
      >
        {cfg.bellNote}
      </div>

      {/* Dual Signature Footer */}
      <div
        style={{
          marginTop: '12mm',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          fontFamily: '"Times New Roman", Georgia, serif',
          fontSize: '11pt',
          lineHeight: 1.4,
        }}
      >
        <div style={{ width: '48%' }}>
          <div>Mengetahui,</div>
          <div>{cfg.principalTitle}</div>
          <div style={{ height: '18mm' }} />
          <div style={{ fontWeight: 700 }}>{cfg.principalName}</div>
          {cfg.principalNip.trim() && <div>NIP. {cfg.principalNip}</div>}
        </div>

        <div style={{ width: '42%', paddingLeft: '6mm' }}>
          <div>
            {cfg.cityLabel}, {cfg.letterDateLabel}
          </div>
          <div>{cfg.chairTitle}</div>
          <div style={{ height: '18mm' }} />
          <div style={{ fontWeight: 700 }}>{cfg.chairName}</div>
        </div>
      </div>
    </div>
  );
}

function TataTertibPesertaPage({ cfg }: { cfg: RulesAndBellConfig }) {
  const yearCompact = cfg.academicYear.replace(/\s+/g, '');
  return (
    <div
      style={{
        fontFamily: '"Times New Roman", Georgia, serif',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <KopSuratBlock
        kopTitle={cfg.studentKopTitle}
        academicYear={cfg.academicYear}
        schoolName={cfg.schoolName}
        schoolAddress={cfg.schoolAddress}
      />

      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '12pt',
          lineHeight: 1.32,
          textTransform: 'uppercase',
          marginBottom: '5mm',
        }}
      >
        <div>{cfg.studentDocTitle}</div>
        <div>{cfg.studentDocSubtitle}</div>
        <div>TAHUN PELAJARAN {yearCompact}</div>
      </div>

      <RulesListBlock items={cfg.studentRules} compactFont />

      <div
        style={{
          marginTop: '6mm',
          display: 'flex',
          justifyContent: 'flex-end',
          fontSize: '11pt',
          lineHeight: 1.4,
        }}
      >
        <div style={{ width: '38%' }}>
          <div style={{ fontWeight: 700 }}>
            {cfg.cityLabel}, {cfg.letterDateLabel}
          </div>
          <div style={{ fontWeight: 700 }}>{cfg.chairTitle}</div>
          <div style={{ height: '16mm' }} />
          <div style={{ fontWeight: 700 }}>{cfg.chairName}</div>
        </div>
      </div>
    </div>
  );
}

function TataTertibPengawasPage({ cfg }: { cfg: RulesAndBellConfig }) {
  const yearCompact = cfg.academicYear.replace(/\s+/g, '');
  return (
    <div
      style={{
        fontFamily: '"Times New Roman", Georgia, serif',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <KopSuratBlock
        kopTitle={cfg.proctorKopTitle}
        academicYear={cfg.academicYear}
        schoolName={cfg.schoolName}
        schoolAddress={cfg.schoolAddress}
      />

      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '12.5pt',
          lineHeight: 1.35,
          textTransform: 'uppercase',
          marginBottom: '6mm',
        }}
      >
        <div>{cfg.proctorDocTitle}</div>
        <div>{cfg.proctorDocSubtitle}</div>
        <div>TAHUN PELAJARAN {yearCompact}</div>
      </div>

      <RulesListBlock items={cfg.proctorRules} />

      <div
        style={{
          marginTop: '10mm',
          display: 'flex',
          justifyContent: 'flex-end',
          fontSize: '11.2pt',
          lineHeight: 1.42,
        }}
      >
        <div style={{ width: '38%' }}>
          <div style={{ fontWeight: 700 }}>
            {cfg.cityLabel}, {cfg.letterDateLabel}
          </div>
          <div style={{ fontWeight: 700 }}>{cfg.chairTitle}</div>
          <div style={{ height: '18mm' }} />
          <div style={{ fontWeight: 700 }}>{cfg.chairName}</div>
        </div>
      </div>
    </div>
  );
}

export const RulesAndBellPagesBlock: React.FC<RulesAndBellRendererProps> = ({
  cfg,
  docIds,
  forPrint = false,
}) => {
  return (
    <>
      {docIds.map((docId, idx) => (
        <div
          key={docId}
          className={forPrint ? 'print-sheet-page' : undefined}
          style={{
            width: '210mm',
            minHeight: '297mm',
            height: forPrint ? '297mm' : undefined,
            backgroundColor: '#FFFFFF',
            padding: '15mm 18mm',
            boxSizing: 'border-box',
            position: 'relative',
            boxShadow: forPrint ? undefined : '0 8px 28px rgba(15, 23, 42, 0.14)',
            border: forPrint ? undefined : '1px solid #CBD5E1',
            pageBreakAfter: forPrint && idx < docIds.length - 1 ? 'always' : undefined,
          }}
        >
          {docId === 'kode_lonceng' && <KodeLoncengPage cfg={cfg} />}
          {docId === 'tata_tertib_peserta' && <TataTertibPesertaPage cfg={cfg} />}
          {docId === 'tata_tertib_pengawas' && <TataTertibPengawasPage cfg={cfg} />}
        </div>
      ))}
    </>
  );
};
