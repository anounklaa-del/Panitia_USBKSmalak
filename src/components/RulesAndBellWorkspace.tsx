import React, { useState } from 'react';
import {
  Bell,
  Edit3,
  Eye,
  Plus,
  Printer,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DEFAULT_RULES_BELL_CONFIG,
  type BellCodeRow,
  type RulePointItem,
  type RulesAndBellConfig,
  type RulesBellDocId,
} from '../data/rulesAndBellData';
import { RulesAndBellPagesBlock } from './RulesAndBellRenderer';

interface RulesAndBellWorkspaceProps {
  cfg: RulesAndBellConfig;
  onChange: (patch: Partial<RulesAndBellConfig>) => void;
  onReset: () => void;
  onPrintScope: (scope: 'active' | 'all') => void;
}

const DOC_TABS: Array<{
  id: RulesBellDocId;
  label: string;
  shortLabel: string;
  subtitle: string;
}> = [
  {
    id: 'kode_lonceng',
    label: 'Kode Lonceng',
    shortLabel: 'Kode Lonceng',
    subtitle: 'Isyarat bunyi lonceng masuk, login, mulai, sisa 15 menit, & selesai',
  },
  {
    id: 'tata_tertib_peserta',
    label: 'Tata Tertib Peserta',
    shortLabel: 'Tatib Peserta',
    subtitle: '15 butir tata tertib peserta selama Penilaian Sumatif berlangsung',
  },
  {
    id: 'tata_tertib_pengawas',
    label: 'Tata Tertib & Tugas Pengawas',
    shortLabel: 'Tatib Pengawas',
    subtitle: '10 butir tugas, tanggung jawab, & tata tertib pengawas ruang',
  },
];

export const RulesAndBellWorkspace: React.FC<RulesAndBellWorkspaceProps> = ({
  cfg,
  onChange,
  onReset,
  onPrintScope,
}) => {
  const [showEditor, setShowEditor] = useState(false);

  const activeDoc = cfg.activeDoc;
  const currentTabMeta = DOC_TABS.find((t) => t.id === activeDoc) ?? DOC_TABS[0];

  const handleUpdateBellRow = (id: string, patch: Partial<BellCodeRow>) => {
    onChange({
      bellRows: cfg.bellRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  };

  const handleAddBellRow = () => {
    const newRow: BellCodeRow = {
      id: `bell-${Date.now()}`,
      countLabel: '1 X ( Kali )',
      description: 'Keterangan bunyi lonceng baru.',
    };
    onChange({ bellRows: [...cfg.bellRows, newRow] });
  };

  const handleDeleteBellRow = (id: string) => {
    if (cfg.bellRows.length <= 1) return;
    onChange({ bellRows: cfg.bellRows.filter((row) => row.id !== id) });
  };

  const rulesKey = activeDoc === 'tata_tertib_peserta' ? 'studentRules' : 'proctorRules';
  const activeRules: RulePointItem[] =
    activeDoc === 'tata_tertib_peserta' ? cfg.studentRules : cfg.proctorRules;

  const handleUpdateRuleText = (id: string, text: string) => {
    onChange({
      [rulesKey]: activeRules.map((item) => (item.id === id ? { ...item, text } : item)),
    });
  };

  const handleUpdateRuleSubItems = (id: string, rawLines: string) => {
    const subs = rawLines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({
      [rulesKey]: activeRules.map((item) =>
        item.id === id ? { ...item, subItems: subs.length > 0 ? subs : undefined } : item,
      ),
    });
  };

  const handleAddRule = () => {
    const newRule: RulePointItem = {
      id: `rule-${Date.now()}`,
      text: 'Butir tata tertib / ketentuan baru.',
    };
    onChange({ [rulesKey]: [...activeRules, newRule] });
  };

  const handleDeleteRule = (id: string) => {
    if (activeRules.length <= 1) return;
    onChange({ [rulesKey]: activeRules.filter((r) => r.id !== id) });
  };

  const handleResetConfirm = () => {
    onReset();
  };

  const zoomScale = Math.max(0.4, Math.min(1.05, (cfg.zoomPct || 72) / 100));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F6FA]">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg gap-0.5 flex-wrap">
            {DOC_TABS.map((tab) => {
              const isActive = activeDoc === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChange({ activeDoc: tab.id })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1F3864] text-white shadow-2xs'
                      : 'text-[#475569] hover:text-[#131C31]'
                  }`}
                >
                  {tab.id === 'kode_lonceng' && <Bell className="w-3.5 h-3.5" />}
                  {tab.id === 'tata_tertib_peserta' && <ScrollText className="w-3.5 h-3.5" />}
                  {tab.id === 'tata_tertib_pengawas' && <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <span className="hidden xl:inline-block text-xs text-[#64748B] ml-1">
            {currentTabMeta.subtitle}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
              showEditor
                ? 'bg-[#EEF4FF] border-[#93C5FD] text-[#1D4ED8]'
                : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
            }`}
          >
            {showEditor ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {showEditor ? 'Tutup Editor' : 'Ubah Isi Dokumen'}
          </button>

          <button
            type="button"
            onClick={() => onPrintScope('active')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#1E293B] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-[#1D4ED8]" />
            Cetak Halaman Ini
          </button>

          <button
            type="button"
            onClick={() => onPrintScope('all')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Semua Paket (3 Hal)
          </button>
        </div>
      </div>

      {/* Main Split Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Optional Side Editor Panel */}
        {showEditor && (
          <aside className="w-full max-w-[400px] bg-white border-r border-[#E2E8F0] overflow-y-auto p-4 space-y-4 shrink-0">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-display font-bold text-sm text-[#1F3864]">
                  Editor {currentTabMeta.shortLabel}
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Perubahan langsung terlihat pada pratinjau A4 dan hasil cetak.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetConfirm}
                title="Kembalikan isi dokumen ke standar awal"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[11px] font-medium text-[#475569]"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* Common Header & Signatory Fields */}
            <div className="space-y-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1F3864]">
                Identitas Dokumen &amp; Penandatangan
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    value={cfg.academicYear}
                    onChange={(e) => onChange({ academicYear: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Tanggal Surat
                  </label>
                  <input
                    type="text"
                    value={cfg.letterDateLabel}
                    onChange={(e) => onChange({ letterDateLabel: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Kota
                  </label>
                  <input
                    type="text"
                    value={cfg.cityLabel}
                    onChange={(e) => onChange({ cityLabel: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Nama Ketua Panitia
                  </label>
                  <input
                    type="text"
                    value={cfg.chairName}
                    onChange={(e) => onChange({ chairName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>
              </div>

              {activeDoc === 'kode_lonceng' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                        Nama Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={cfg.principalName}
                        onChange={(e) => onChange({ principalName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                        NIP Kepala Sekolah
                      </label>
                      <input
                        type="text"
                        value={cfg.principalNip}
                        onChange={(e) => onChange({ principalNip: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#334155] pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.showKopOnBellCode}
                      onChange={(e) => onChange({ showKopOnBellCode: e.target.checked })}
                      className="rounded border-[#CBD5E1]"
                    />
                    Tampilkan Kop Surat di halaman Kode Lonceng
                  </label>
                </>
              )}
            </div>

            {/* Specific Document Editor */}
            {activeDoc === 'kode_lonceng' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Judul Kode Lonceng
                  </label>
                  <input
                    type="text"
                    value={cfg.bellTitleLine1}
                    onChange={(e) => onChange({ bellTitleLine1: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31] mb-1.5"
                  />
                  <input
                    type="text"
                    value={cfg.bellTitleLine2}
                    onChange={(e) => onChange({ bellTitleLine2: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F3864]">
                    Daftar Isyarat Lonceng ({cfg.bellRows.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBellRow}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#1D4ED8] text-white text-[11px] font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Baris
                  </button>
                </div>

                <div className="space-y-2.5">
                  {cfg.bellRows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold text-[#64748B]">
                          BARIS #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBellRow(row.id)}
                          disabled={cfg.bellRows.length <= 1}
                          className="text-[#DC2626] hover:text-[#991B1B] disabled:opacity-30 p-0.5"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={row.countLabel}
                        onChange={(e) =>
                          handleUpdateBellRow(row.id, { countLabel: e.target.value })
                        }
                        placeholder="Contoh: 6 X ( Kali )"
                        className="w-full px-2 py-1 text-xs font-semibold rounded border border-[#CBD5E1] bg-white"
                      />
                      <textarea
                        rows={2}
                        value={row.description}
                        onChange={(e) =>
                          handleUpdateBellRow(row.id, { description: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-[#CBD5E1] bg-white"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Catatan Bawah Tabel
                  </label>
                  <textarea
                    rows={2}
                    value={cfg.bellNote}
                    onChange={(e) => onChange({ bellNote: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-0.5">
                    Judul Dokumen
                  </label>
                  <input
                    type="text"
                    value={
                      activeDoc === 'tata_tertib_peserta'
                        ? cfg.studentDocTitle
                        : cfg.proctorDocTitle
                    }
                    onChange={(e) =>
                      onChange(
                        activeDoc === 'tata_tertib_peserta'
                          ? { studentDocTitle: e.target.value }
                          : { proctorDocTitle: e.target.value },
                      )
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#CBD5E1] bg-white text-[#131C31]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F3864]">
                    Daftar Butir ({activeRules.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#1D4ED8] text-white text-[11px] font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Butir
                  </button>
                </div>

                <div className="space-y-2.5">
                  {activeRules.map((item, idx) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-[#1F3864]">
                          BUTIR {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(item.id)}
                          disabled={activeRules.length <= 1}
                          className="text-[#DC2626] hover:text-[#991B1B] disabled:opacity-30 p-0.5"
                          title="Hapus butir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={item.text}
                        onChange={(e) => handleUpdateRuleText(item.id, e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded border border-[#CBD5E1] bg-white"
                      />
                      <div>
                        <label className="block text-[10px] text-[#64748B] mb-0.5">
                          Sub-poin (opsional, 1 baris per poin a, b, c)
                        </label>
                        <textarea
                          rows={item.subItems?.length ? Math.min(6, item.subItems.length + 1) : 2}
                          value={(item.subItems ?? []).join('\n')}
                          onChange={(e) => handleUpdateRuleSubItems(item.id, e.target.value)}
                          placeholder="Kosongkan jika tidak ada sub-poin"
                          className="w-full px-2 py-1 text-[11px] rounded border border-[#CBD5E1] bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Live A4 Paper Preview */}
        <div className="flex-1 min-w-0 overflow-auto p-4 lg:p-6 flex flex-col items-center">
          {/* Zoom & Quick Info Bar */}
          <div className="w-full max-w-[820px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2 text-xs text-[#334155]">
              <span className="font-mono font-bold text-[#1F3864] bg-[#EEF4FF] border border-[#BFDBFE] px-2 py-0.5 rounded">
                A4 PORTRAIT · 210 × 297 mm
              </span>
              <span className="font-semibold text-[#131C31]">{currentTabMeta.label}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ zoomPct: Math.max(45, (cfg.zoomPct || 72) - 8) })}
                className="p-1.5 rounded-md border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569]"
                title="Perkecil pratinjau"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={45}
                max={105}
                step={1}
                value={cfg.zoomPct || DEFAULT_RULES_BELL_CONFIG.zoomPct}
                onChange={(e) => onChange({ zoomPct: Number(e.target.value) })}
                aria-label="Zoom pratinjau dokumen"
                className="w-24 accent-[#1D4ED8]"
              />
              <span className="font-mono text-xs font-semibold text-[#334155] w-10 text-right tabular-nums">
                {cfg.zoomPct || 72}%
              </span>
              <button
                type="button"
                onClick={() => onChange({ zoomPct: Math.min(105, (cfg.zoomPct || 72) + 8) })}
                className="p-1.5 rounded-md border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#475569]"
                title="Perbesar pratinjau"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scaled A4 Sheet Container */}
          <div
            style={{
              width: `calc(210mm * ${zoomScale})`,
              minHeight: `calc(297mm * ${zoomScale})`,
            }}
            className="relative shrink-0 mb-8"
          >
            <div
              style={{
                width: '210mm',
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
              }}
            >
              <RulesAndBellPagesBlock cfg={cfg} docIds={[activeDoc]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
