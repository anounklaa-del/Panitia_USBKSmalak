import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Home,
  KeyRound,
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
import type { AuthUser } from '../utils/authClient';
import {
  createCloudPanitiaAccount,
  deleteCloudPanitiaAccount,
  fetchCloudAccountsDirectory,
  updateCloudAccount,
  type CloudManagedAccount,
} from '../utils/cloudSync';

interface AccountAccessManagerProps {
  currentUser: AuthUser;
  committeeMembers: CommitteeMember[];
  onNavigateTab: (tab: MainWorkspaceTab) => void;
}

function suggestUsernameFromName(nama: string): string {
  const cleaned = nama
    .toLowerCase()
    .replace(/\b(h\.|hj\.|dr\.|dra\.|drs\.|s\.pd|m\.pd|m\.m|s\.kom|s\.ag|s\.si)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  return cleaned.slice(0, 2).join('.').slice(0, 24);
}

export const AccountAccessManager: React.FC<AccountAccessManagerProps> = ({
  currentUser,
  committeeMembers,
  onNavigateTab,
}) => {
  const [accounts, setAccounts] = useState<CloudManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Create panitia account modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newJabatan, setNewJabatan] = useState('Anggota Panitia PAS');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<CloudManagedAccount | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [savingReset, setSavingReset] = useState(false);

  const formatError = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message && err.message !== '[object Object]') {
      try {
        const parsed = JSON.parse(err.message) as { error?: string };
        if (parsed && typeof parsed.error === 'string') return parsed.error;
      } catch {
        // ignore
      }
      return err.message;
    }
    return fallback;
  };

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchCloudAccountsDirectory();
      setAccounts(list);
    } catch (err) {
      setErrorMsg(formatError(err, 'Gagal memuat daftar akun dari Cloud.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const activeCount = useMemo(
    () => accounts.filter((a) => a.active).length,
    [accounts],
  );
  const panitiaCount = useMemo(
    () => accounts.filter((a) => a.role === 'panitia').length,
    [accounts],
  );
  const adminCount = useMemo(
    () => accounts.filter((a) => a.role === 'admin').length,
    [accounts],
  );

  const handlePickCommitteeMember = (memberId: string) => {
    const member = committeeMembers.find((m) => m.id === memberId);
    if (!member) return;
    setNewDisplayName(member.nama);
    setNewJabatan(member.jabatan);
    const suggested = suggestUsernameFromName(member.nama);
    if (suggested) setNewUsername(suggested);
  };

  const handleCreateSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (savingCreate) return;
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setSavingCreate(true);
    try {
      const created = await createCloudPanitiaAccount({
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        jabatan: newJabatan.trim() || 'Anggota Panitia PAS',
        password: newPassword,
      });
      setAccounts((prev) => [...prev, created]);
      setFeedbackMsg(
        `Akun panitia "${created.username}" (${created.displayName}) berhasil disimpan ke Cloud dan siap digunakan di semua perangkat.`,
      );
      setCreateOpen(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewJabatan('Anggota Panitia PAS');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setErrorMsg(formatError(err, 'Gagal menambahkan akun panitia.'));
    } finally {
      setSavingCreate(false);
    }
  };

  const handleToggleActive = async (acc: CloudManagedAccount) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const updated = await updateCloudAccount(acc.username, { active: !acc.active });
      setAccounts((prev) =>
        prev.map((item) => (item.usernameKey === updated.usernameKey ? updated : item)),
      );
      setFeedbackMsg(
        `Status akun "${updated.username}" diubah menjadi ${updated.active ? 'Aktif' : 'Dinonaktifkan'}.`,
      );
    } catch (err) {
      setErrorMsg(formatError(err, 'Gagal mengubah status akun.'));
    }
  };

  const handleResetPasswordSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!resetTarget || savingReset) return;
    setErrorMsg(null);
    setFeedbackMsg(null);

    const minLen = resetTarget.usernameKey === 'admin' ? 4 : 3;
    if (resetPassword.length < minLen) {
      setErrorMsg(`Kata sandi minimal ${minLen} karakter.`);
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setErrorMsg('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setSavingReset(true);
    try {
      const updated = await updateCloudAccount(resetTarget.username, { password: resetPassword });
      setAccounts((prev) =>
        prev.map((item) => (item.usernameKey === updated.usernameKey ? updated : item)),
      );
      setFeedbackMsg(
        `Kata sandi akun "${updated.username}" berhasil diperbarui di Cloud dan langsung berlaku di semua perangkat.`,
      );
      setResetTarget(null);
      setResetPassword('');
      setConfirmResetPassword('');
    } catch (err) {
      setErrorMsg(formatError(err, 'Gagal memperbarui kata sandi.'));
    } finally {
      setSavingReset(false);
    }
  };

  const handleDeleteAccount = async (acc: CloudManagedAccount) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await deleteCloudPanitiaAccount(acc.username);
      setAccounts((prev) => prev.filter((item) => item.usernameKey !== acc.usernameKey));
      setFeedbackMsg(`Akun "${acc.username}" berhasil dihapus dari Cloud.`);
    } catch (err) {
      setErrorMsg(formatError(err, 'Gagal menghapus akun panitia.'));
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
              <span className="font-semibold text-white">Manajemen Akun &amp; Hak Akses</span>
            </nav>
            <h1 className="font-display font-extrabold text-xl lg:text-2xl tracking-tight">
              Daftar Akun Login Panitia &amp; Administrator (Cloud)
            </h1>
            <p className="text-xs text-[#E0EAFF] mt-1">
              Masuk sebagai <strong className="text-white">{currentUser.username}</strong> · Semua
              akun username &amp; kata sandi tersimpan di Cloud Firestore sehingga laptop lain langsung bisa login tanpa membuat sandi ulang.
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
              <div className="text-xs text-[#64748B] font-medium">Total Akun Aktif</div>
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
              <div className="text-xs text-[#64748B] font-medium">Akun Administrator</div>
              <div className="font-display font-extrabold text-2xl text-[#131C31] tabular-nums">
                {adminCount}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DCE5F2] p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#0369A1] flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] font-medium">Mode Autentikasi</div>
              <div className="font-display font-bold text-sm text-[#131C31] mt-0.5">
                Username &amp; Sandi · Cloud Sync
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
                Daftar Akun Terdaftar ({accounts.length})
              </h2>
              <p className="text-xs text-[#64748B]">
                Kelola username dan kata sandi akun bawaan (<code className="font-mono">admin</code>,{' '}
                <code className="font-mono">Panitia</code>) maupun akun panitia tambahan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#475569]">
                  <th className="py-3 px-4 whitespace-nowrap">Username</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4 whitespace-nowrap">Peran</th>
                  <th className="py-3 px-4">Jabatan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status Akses</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={6} className="py-3.5 px-4">
                        <div className="h-4 bg-[#F1F5F9] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-[#64748B]">
                      Belum ada daftar akun di direktori Cloud.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.usernameKey} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#131C31] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{acc.username}</span>
                          {acc.isBuiltIn && (
                            <span className="px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#1F3864] font-sans text-[10px] font-semibold">
                              Bawaan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#1E293B]">{acc.displayName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            acc.role === 'admin' ? 'text-[#1F3864]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {acc.role === 'admin' ? 'Administrator' : 'Panitia'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#475569]">{acc.jabatan}</td>
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
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMsg(null);
                              setResetTarget(acc);
                              setResetPassword('');
                              setConfirmResetPassword('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-[#1D4ED8] font-semibold transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Ubah Sandi
                          </button>

                          {acc.usernameKey !== 'admin' && (
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
                              title={`Hapus akun ${acc.username}`}
                              className="p-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
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
                  Ambil dari Data Panitia Ujian (Opsional)
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
                  Nama Pengguna (Username)
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Kata Sandi Awal
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 3 karakter"
                      className="w-full px-3 py-2 pr-8 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#334155] mb-1">
                    Konfirmasi Sandi
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi sandi"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
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
                  {savingCreate ? 'Menyimpan...' : 'Simpan Akun ke Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset / Change Account Password Modal */}
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
                Ubah Sandi: <span className="font-mono text-[#1D4ED8]">{resetTarget.username}</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="p-1 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Kata Sandi Baru ({resetTarget.usernameKey === 'admin' ? 'min. 4' : 'min. 3'} karakter)
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru"
                    className="w-full px-3 py-2 pr-9 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#334155] mb-1">
                  Konfirmasi Kata Sandi Baru
                </label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-[#131C31]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
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
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white font-bold"
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
