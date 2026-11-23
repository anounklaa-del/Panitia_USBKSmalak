import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import type { CommitteeMember } from '../data/committeeData';
import type { MainWorkspaceTab } from '../types/prepress';
import {
  createPanitiaAccount,
  deleteManagedAccount,
  fetchManagedAccounts,
  updateManagedAccount,
  type AuthUser,
  type ManagedAccount,
} from '../utils/authClient';

interface AccountAccessManagerProps {
  authToken: string;
  currentUser: AuthUser;
  committeeMembers: CommitteeMember[];
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

export const AccountAccessManager: React.FC<AccountAccessManagerProps> = ({
  authToken,
  currentUser,
  committeeMembers,
  onNavigateTab,
}) => {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [hasEnvAdmin, setHasEnvAdmin] = useState(false);
  const [hasEnvPanitia, setHasEnvPanitia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newJabatan, setNewJabatan] = useState('Anggota Panitia PAS');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<ManagedAccount | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [savingReset, setSavingReset] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchManagedAccounts(authToken);
      setAccounts(data.accounts);
      setHasEnvAdmin(data.hasEnvAdmin);
      setHasEnvPanitia(data.hasEnvPanitia);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat daftar akun login.',
      );
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const activeCount = accounts.filter((a) => a.active).length;
  const panitiaCount = accounts.filter((a) => a.role === 'panitia').length;
  const adminCount = accounts.filter((a) => a.role === 'admin').length;

  const handlePickCommitteeMember = (memberId: string) => {
    const member = committeeMembers.find((m) => m.id === memberId);
    if (!member) return;
    const suggestedUser = member.nama
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24);
    setNewUsername(suggestedUser);
    setNewDisplayName(member.nama);
    setNewJabatan(member.jabatan);
  };

  const handleCreateSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (savingCreate) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingCreate(true);
    try {
      const res = await createPanitiaAccount(authToken, {
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        jabatan: newJabatan.trim() || 'Anggota Panitia PAS',
        password: newPassword,
      });
      setAccounts((prev) => [...prev, res.account]);
      setFeedbackMsg(`Akun panitia "${res.account.username}" berhasil ditambahkan.`);
      setCreateOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewJabatan('Anggota Panitia PAS');
      setNewPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat akun baru.');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleToggleActive = async (acc: ManagedAccount) => {
    if (acc.username.toLowerCase() === 'admin') return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await updateManagedAccount(authToken, acc.username, {
        active: !acc.active,
      });
      setAccounts((prev) =>
        prev.map((a) => (a.username === acc.username ? res.account : a)),
      );
      setFeedbackMsg(
        `Akun "${acc.username}" sekarang ${res.account.active ? 'Aktif' : 'Dinonaktifkan'}.`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui status akun.');
    }
  };

  const handleResetPasswordSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!resetTarget || savingReset) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSavingReset(true);
    try {
      const res = await updateManagedAccount(authToken, resetTarget.username, {
        password: resetPasswordVal,
      });
      setAccounts((prev) =>
        prev.map((a) => (a.username === resetTarget.username ? res.account : a)),
      );
      setFeedbackMsg(`Kata sandi untuk "${resetTarget.username}" berhasil diperbarui.`);
      setResetTarget(null);
      setResetPasswordVal('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.');
    } finally {
      setSavingReset(false);
    }
  };

  const handleDeleteAccount = async (acc: ManagedAccount) => {
    if (acc.isBuiltIn) return;
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await deleteManagedAccount(authToken, acc.username);
      setAccounts((prev) => prev.filter((a) => a.username !== acc.username));
      setFeedbackMsg(`Akun "${acc.username}" dihapus.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghapus akun.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#EBF1FA] p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Hero Banner */}
        <section
          className="rounded-2xl px-6 py-5 text-white shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
          style={{
            background: 'linear-gradient(125deg, #0D3C8E 0%, #1555BF 60%, #1D64D8 100%)',
          }}
        >
          <div>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-[#DBEAFE] mb-1.5"
            >
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="inline-flex items-center gap-1 hover:text-white transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-white">Manajemen Akun &amp; Akses</span>
            </nav>
            <h1 className="font-display font-extrabold text-xl lg:text-2xl tracking-tight">
              Manajemen Akun Login Panitia &amp; Administrator
            </h1>
            <p className="text-xs text-[#E0EAFF] mt-1">
              Masuk sebagai <strong className="text-white">{currentUser.username}</strong> · Hanya
              Administrator yang dapat mengelola kredensial akses portal panitia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadAccounts()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/12 hover:bg-white/20 border border-white/25 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Segarkan
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-[#092252] text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Akun Panitia
            </button>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl border border-[#DCE5F2] p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] font-medium">Akun Aktif</div>
              <div className="font-display font-extrabold text-2xl text-[#131C31] tabular-nums">
                {activeCount}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE5F2] p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] font-medium">Akun Panitia</div>
              <div className="font-display font-extrabold text-2xl text-[#131C31] tabular-nums">
                {panitiaCount}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE5F2] p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#1F3864] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] font-medium">Administrator</div>
              <div className="font-display font-extrabold text-2xl text-[#131C31] tabular-nums">
                {adminCount}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE5F2] p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] text-[#B45309] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] font-medium">Env Secrets Override</div>
              <div className="font-display font-bold text-sm text-[#131C31] mt-0.5">
                {hasEnvAdmin || hasEnvPanitia ? 'Aktif via Server' : 'Mode Lokal Terenkripsi'}
              </div>
            </div>
          </div>
        </section>

        {/* Feedback / Error Notices */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {feedbackMsg && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Accounts Table */}
        <section className="bg-white rounded-2xl border border-[#DCE5F2] shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-base text-[#131C31]">
                Daftar Akun Akses Portal Ujian
              </h2>
              <p className="text-xs text-[#64748B]">
                Semua kata sandi tersimpan sebagai hash scrypt di server dan diverifikasi menggunakan
                token sesi Bearer.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#475569]">
                  <th className="py-3 px-4 whitespace-nowrap">Username</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Jabatan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Peran</th>
                  <th className="py-3 px-4 whitespace-nowrap">Sumber Sandi</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={7} className="py-3.5 px-4">
                        <div className="h-4 bg-[#F1F5F9] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-[#64748B]">
                      Belum ada akun terdaftar.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const isPrimaryAdmin = acc.username.toLowerCase() === 'admin';
                    return (
                      <tr key={acc.username} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-[#131C31] whitespace-nowrap">
                          {acc.username}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#1E293B]">{acc.displayName}</td>
                        <td className="py-3 px-4 text-[#475569]">{acc.jabatan}</td>
                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-[#1F3864]">
                          {acc.role === 'admin' ? 'Administrator' : 'Panitia'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[#475569]">
                          {acc.source === 'env' ? 'Environment Secret' : 'Hash Server Lokal'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {acc.active ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                              <UserX className="w-3.5 h-3.5" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {acc.source !== 'env' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTarget(acc);
                                  setResetPasswordVal('');
                                  setErrorMsg(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#1F3864] font-semibold transition-colors"
                              >
                                <KeyRound className="w-3 h-3" />
                                Ganti Sandi
                              </button>
                            )}
                            {!isPrimaryAdmin && acc.source !== 'env' && (
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(acc)}
                                className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#334155] font-medium transition-colors"
                              >
                                {acc.active ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                            {!acc.isBuiltIn && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteAccount(acc)}
                                title="Hapus akun panitia"
                                className="p-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Create Panitia Account Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-create-account-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3
                id="modal-create-account-title"
                className="font-display font-bold text-base text-[#131C31]"
              >
                Tambah Akun Login Panitia
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Ambil Cepat dari Data Panitia (Opsional)
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => handlePickCommitteeMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#131C31]"
                >
                  <option value="">— Pilih anggota panitia untuk isi otomatis —</option>
                  {committeeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama} ({m.jabatan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Username Login Panitia
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="mis. siti.aminah"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] font-mono text-[#131C31]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Dra. Siti Aminah"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">Jabatan Panitia</label>
                <input
                  type="text"
                  value={newJabatan}
                  onChange={(e) => setNewJabatan(e.target.value)}
                  placeholder="Sekretaris / Proktor / Anggota"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Kata Sandi Awal (min. 3 karakter)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white font-bold"
                >
                  {savingCreate ? 'Menyimpan...' : 'Simpan Akun Panitia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#041434]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reset-pw-title"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#DCE5F2] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3
                id="modal-reset-pw-title"
                className="font-display font-bold text-base text-[#131C31]"
              >
                Perbarui Kata Sandi
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-[#475569]">
                Tetapkan kata sandi baru untuk akun{' '}
                <strong className="font-mono text-[#131C31]">{resetTarget.username}</strong> (
                {resetTarget.displayName}).
              </p>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showResetPw ? 'text' : 'password'}
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Kata sandi baru"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                >
                  {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] text-[#475569] font-semibold hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingReset}
                  className="px-4 py-2 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] disabled:opacity-60 text-white font-bold"
                >
                  {savingReset ? 'Menyimpan...' : 'Perbarui Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
