import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { LOGO_RIGHT_DATA_URI } from '../data/pasData';
import type { AuthUser, UserRole } from '../utils/authClient';
import {
  bootstrapCloudAccounts,
  fetchCloudAuthStatus,
  loginCloudWithCredentials,
  type CloudAuthStatus,
} from '../utils/cloudSync';

interface LoginGateProps {
  onAuthenticated: (user: AuthUser) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ onAuthenticated }) => {
  const [status, setStatus] = useState<CloudAuthStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // One-time Cloud bootstrap setup state (shown only if Cloud has no admin yet)
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [panitiaPassword, setPanitiaPassword] = useState('');
  const [confirmPanitiaPassword, setConfirmPanitiaPassword] = useState('');
  const [loginAsAfterSetup, setLoginAsAfterSetup] = useState<UserRole>('admin');
  const [showSetupPasswords, setShowSetupPasswords] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buildingImgError, setBuildingImgError] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const s = await fetchCloudAuthStatus();
      setStatus(s);
    } catch (err) {
      let friendly = err instanceof Error ? err.message : 'Gagal memeriksa status Cloud.';
      try {
        const parsed = JSON.parse(friendly) as { error?: string };
        if (parsed && typeof parsed.error === 'string') {
          friendly = parsed.error;
        }
      } catch {
        // ignore JSON parse failure
      }
      setStatusError(friendly);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const formatFriendlyError = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message && err.message !== '[object Object]') {
      try {
        const parsed = JSON.parse(err.message) as { error?: string };
        if (parsed && typeof parsed.error === 'string') {
          return parsed.error;
        }
      } catch {
        // plain error message
      }
      return err.message;
    }
    return fallback;
  };

  const handleLoginSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Nama pengguna dan kata sandi wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginCloudWithCredentials(username.trim(), password);
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMessage(formatFriendlyError(err, 'Gagal masuk ke sistem.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (adminPassword.length < 4) {
      setErrorMessage('Kata sandi Admin minimal 4 karakter.');
      return;
    }
    if (adminPassword !== confirmAdminPassword) {
      setErrorMessage('Konfirmasi kata sandi Admin tidak cocok.');
      return;
    }
    if (panitiaPassword.length < 3) {
      setErrorMessage('Kata sandi Panitia minimal 3 karakter.');
      return;
    }
    if (panitiaPassword !== confirmPanitiaPassword) {
      setErrorMessage('Konfirmasi kata sandi Panitia tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bootstrapCloudAccounts({
        adminPassword,
        panitiaPassword,
        loginAs: loginAsAfterSetup,
      });
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMessage(formatFriendlyError(err, 'Gagal menyimpan kredensial awal ke Cloud.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#EBF1FA] text-[#131C31] grid grid-cols-1 lg:grid-cols-12 items-stretch overflow-x-hidden">
      {/* Left Institutional Brand & Security Overview */}
      <section
        className="lg:col-span-6 xl:col-span-7 relative flex flex-col justify-between p-8 lg:p-12 text-white overflow-hidden"
        style={{
          background:
            'linear-gradient(155deg, #072863 0%, #0B3A86 45%, #04183D 100%)',
        }}
      >
        {!buildingImgError && (
          <img
            src="/assets/aistudio/Ilustrasi_Cerah_SMA_Negeri_1_Alalak_v2.png"
            alt="Ilustrasi SMA Negeri 1 Alalak"
            referrerPolicy="no-referrer"
            onError={() => setBuildingImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-35 pointer-events-none"
          />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,40,99,0.78) 0%, rgba(4,24,61,0.84) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Header Crest Lockup */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center shrink-0">
            <img
              src={LOGO_RIGHT_DATA_URI}
              alt="Logo SMA Negeri 1 Alalak"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
            />
          </div>
          <div>
            <div className="font-display font-bold text-sm tracking-wider text-[#FFD43B] uppercase">
              SMA Negeri 1 Alalak
            </div>
            <div className="text-xs text-[#CBD5E1]">
              Kabupaten Barito Kuala · Kalimantan Selatan
            </div>
          </div>
        </div>

        {/* Central Focal Headline */}
        <div className="relative z-10 my-10 lg:my-auto max-w-xl space-y-5">
          <div className="text-xs font-medium text-[#93C5FD]">
            Portal Internal Pelaksanaan Ujian · Penilaian Akhir Semester
          </div>
          <h1
            className="font-display font-extrabold text-3xl lg:text-4xl text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Sistem Manajemen Panitia &amp; Pracetak Perangkat Ujian
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-[#E2E8F0]">
            <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="flex items-center gap-2 font-bold text-[#FFD43B] mb-1">
                <Cloud className="w-4 h-4" />
                <span>Sinkronisasi Cloud Lintas Perangkat</span>
              </div>
              <p className="text-[#CBD5E1] leading-relaxed">
                Data siswa, jadwal, pengawas, berita acara, dan akun login otomatis tersinkron di semua laptop &amp; versi publik.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
              <div className="flex items-center gap-2 font-bold text-[#FFD43B] mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Login Username &amp; Sandi</span>
              </div>
              <p className="text-[#CBD5E1] leading-relaxed">
                Masuk langsung memakai username Panitia atau Admin tanpa email. Kredensial cukup dibuat satu kali saja.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Motto */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#CBD5E1] pt-4 border-t border-white/10">
          <span>&copy; 2026 Panitia PAS SMA Negeri 1 Alalak</span>
          <span className="italic text-[#FFD43B]">
            &ldquo;Pendidikan Bermutu, Masa Depan Maju&rdquo;
          </span>
        </div>
      </section>

      {/* Right Authentication Panel */}
      <section className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#DCE5F2] shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-6 sm:p-8">
          {loadingStatus ? (
            <div className="space-y-4" aria-busy="true" aria-label="Memeriksa status akun Cloud">
              <div className="h-6 w-52 bg-[#E2E8F0] rounded animate-pulse" />
              <div className="h-4 w-72 bg-[#F1F5F9] rounded animate-pulse" />
              <div className="h-11 w-full bg-[#F1F5F9] rounded-xl animate-pulse mt-4" />
              <div className="h-11 w-full bg-[#F1F5F9] rounded-xl animate-pulse" />
              <div className="h-11 w-full bg-[#E2E8F0] rounded-xl animate-pulse" />
            </div>
          ) : statusError || !status ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{statusError || 'Tidak dapat menghubungi database Cloud.'}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Hubungkan Ulang
              </button>
            </div>
          ) : !status.initialized ? (
            /* One-time Cloud Initialization Setup */
            <form onSubmit={handleBootstrapSubmit} className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-[#1D4ED8] mb-1">
                  Pengaturan Awal Cloud · Cukup 1 Kali Saja
                </div>
                <h2 className="font-display font-extrabold text-xl text-[#131C31]">
                  Buat Kata Sandi Admin &amp; Panitia
                </h2>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Setelah disimpan ke Cloud, perangkat atau laptop lain tidak akan diminta membuat sandi lagi dan langsung masuk menggunakan username &amp; sandi ini.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#131C31]">
                    Akun Administrator (<span className="font-mono text-[#1D4ED8]">admin</span>)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSetupPasswords((p) => !p)}
                    className="text-[11px] font-semibold text-[#1D4ED8] hover:underline inline-flex items-center gap-1"
                  >
                    {showSetupPasswords ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Sembunyikan
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Tampilkan
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Kata Sandi Admin (min. 4 karakter)
                  </label>
                  <input
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Admin"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#131C31]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Konfirmasi Kata Sandi Admin
                  </label>
                  <input
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Ulangi kata sandi Admin"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#131C31]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                <div className="text-xs font-bold text-[#131C31]">
                  Akun Panitia (<span className="font-mono text-[#1D4ED8]">Panitia</span>)
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Kata Sandi Panitia (min. 3 karakter)
                  </label>
                  <input
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={panitiaPassword}
                    onChange={(e) => setPanitiaPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Panitia"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#131C31]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#475569] mb-1">
                    Konfirmasi Kata Sandi Panitia
                  </label>
                  <input
                    type={showSetupPasswords ? 'text' : 'password'}
                    required
                    value={confirmPanitiaPassword}
                    onChange={(e) => setConfirmPanitiaPassword(e.target.value)}
                    placeholder="Ulangi kata sandi Panitia"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#131C31]"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-[#334155] mb-1">
                  Masuk langsung sebagai:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginAsAfterSetup('admin')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition-colors ${
                      loginAsAfterSetup === 'admin'
                        ? 'bg-[#1F3864] border-[#1F3864] text-white'
                        : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    Admin (admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginAsAfterSetup('panitia')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs transition-colors ${
                      loginAsAfterSetup === 'panitia'
                        ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                        : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    Panitia (Panitia)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-all duration-150"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Menyimpan ke Cloud...' : 'Aktifkan Cloud & Masuk'}
              </button>
            </form>
          ) : (
            /* Standard Username & Password Login */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-[#1D4ED8] mb-1">
                  Autentikasi Akun Terdaftar · Sinkron Cloud
                </div>
                <h2 className="font-display font-extrabold text-2xl text-[#131C31]">
                  Masuk Portal Panitia
                </h2>
                <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                  Masukkan nama pengguna (user) dan kata sandi resmi Panitia atau Admin SMA Negeri 1 Alalak.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-3.5 text-xs">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block font-semibold text-[#334155] mb-1.5"
                  >
                    Nama Pengguna (User)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin / Panitia / username panitia"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-mono text-[#131C31] focus:border-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block font-semibold text-[#334155] mb-1.5"
                  >
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#131C31] focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#131C31]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-all duration-150 active:scale-[0.99]"
              >
                <KeyRound className="w-4 h-4" />
                {submitting ? 'Memverifikasi di Cloud...' : 'Masuk ke Sistem'}
              </button>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-[11px] text-[#475569] leading-relaxed">
                Akun bawaan: <span className="font-mono font-semibold text-[#131C31]">admin</span>{' '}
                (Administrator) dan{' '}
                <span className="font-mono font-semibold text-[#131C31]">Panitia</span>, atau username panitia tambahan yang didaftarkan Admin.
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
