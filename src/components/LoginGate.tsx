import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  RefreshCw,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { LOGO_RIGHT_DATA_URI } from '../data/pasData';
import {
  bootstrapInitialAccounts,
  fetchAuthStatus,
  loginWithCredentials,
  type AuthStatus,
  type AuthUser,
  type UserRole,
} from '../utils/authClient';

interface LoginGateProps {
  onAuthenticated: (token: string, user: AuthUser) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ onAuthenticated }) => {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [buildingImgError, setBuildingImgError] = useState(false);

  // Standard login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // First-run activation state (when ADMIN_PASSCODE env and local claimed hash are unset)
  const [setupAdminPassword, setSetupAdminPassword] = useState('');
  const [setupPanitiaPassword, setSetupPanitiaPassword] = useState('');
  const [setupLoginAs, setSetupLoginAs] = useState<UserRole>('admin');
  const [showSetupPasswords, setShowSetupPasswords] = useState(false);

  const formatUiError = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message && err.message !== '[object Object]') {
      return err.message;
    }
    if (typeof err === 'string' && err.trim() && err.trim() !== '[object Object]') {
      return err.trim();
    }
    return fallback;
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await fetchAuthStatus();
      setStatus(next);
    } catch (err) {
      setStatusError(
        formatUiError(err, 'Tidak dapat terhubung ke server autentikasi.'),
      );
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleLoginSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Masukkan nama pengguna dan kata sandi untuk melanjutkan.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginWithCredentials(username.trim(), password);
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setErrorMessage(formatUiError(err, 'Gagal masuk ke sistem.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (setupAdminPassword.length < 4) {
      setErrorMessage('Kata sandi Admin minimal 4 karakter.');
      return;
    }
    if (setupPanitiaPassword.length < 3) {
      setErrorMessage('Kata sandi Panitia minimal 3 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bootstrapInitialAccounts({
        adminPassword: setupAdminPassword,
        panitiaPassword: setupPanitiaPassword,
        loginAs: setupLoginAs,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setErrorMessage(
        formatUiError(err, 'Gagal mengaktifkan kredensial awal.'),
      );
      void loadStatus();
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
          {statusLoading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Memeriksa status autentikasi">
              <div className="h-6 w-48 bg-[#E2E8F0] rounded animate-pulse" />
              <div className="h-4 w-72 bg-[#F1F5F9] rounded animate-pulse" />
              <div className="h-11 w-full bg-[#F1F5F9] rounded-xl animate-pulse mt-4" />
              <div className="h-11 w-full bg-[#F1F5F9] rounded-xl animate-pulse" />
              <div className="h-11 w-full bg-[#DCE5F2] rounded-xl animate-pulse mt-2" />
            </div>
          ) : statusError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <div className="font-bold text-sm mb-1">Koneksi Autentikasi Gagal</div>
                  <p>{statusError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Ulang Status Server
              </button>
            </div>
          ) : status && !status.initialized ? (
            /* First-run Credential Activation Flow */
            <form onSubmit={handleBootstrapSubmit} className="space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1D4ED8] mb-1">
                  <KeyRound className="w-4 h-4" />
                  <span>Aktivasi Kredensial Pertama Kali</span>
                </div>
                <h2 className="font-display font-extrabold text-xl text-[#131C31]">
                  Tetapkan Kata Sandi Admin &amp; Panitia
                </h2>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  {status.mode === 'static' ? (
                    <>
                      Pratinjau statis aktif. Tetapkan sandi akses untuk{' '}
                      <strong className="text-[#131C31]">admin</strong> dan{' '}
                      <strong className="text-[#131C31]">Panitia</strong> yang disimpan terenkripsi
                      (PBKDF2) di peramban ini.
                    </>
                  ) : (
                    <>
                      Server belum memiliki kata sandi tersimpan. Tetapkan sandi akses untuk{' '}
                      <strong className="text-[#131C31]">admin</strong> dan{' '}
                      <strong className="text-[#131C31]">Panitia</strong> untuk mengunci sistem
                      (dapat di-override lewat Secrets{' '}
                      <code className="font-mono">ADMIN_PASSCODE</code> /{' '}
                      <code className="font-mono">PANITIA_PASSCODE</code>).
                    </>
                  )}
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

              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="setup-admin-pw"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    Kata Sandi Administrator (<span className="font-mono">admin</span>)
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="setup-admin-pw"
                      type={showSetupPasswords ? 'text' : 'password'}
                      value={setupAdminPassword}
                      onChange={(e) => setSetupAdminPassword(e.target.value)}
                      placeholder="Masukkan kata sandi admin (min. 4 karakter)"
                      autoComplete="new-password"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#131C31] focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPasswords((v) => !v)}
                      aria-label={showSetupPasswords ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#131C31] p-1"
                    >
                      {showSetupPasswords ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="setup-panitia-pw"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    Kata Sandi Panitia Ujian (<span className="font-mono">Panitia</span>)
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="setup-panitia-pw"
                      type={showSetupPasswords ? 'text' : 'password'}
                      value={setupPanitiaPassword}
                      onChange={(e) => setSetupPanitiaPassword(e.target.value)}
                      placeholder="Masukkan kata sandi Panitia (min. 3 karakter)"
                      autoComplete="new-password"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#131C31] focus:border-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div>
                  <div className="block text-xs font-semibold text-[#334155] mb-1.5">
                    Langsung Masuk Sebagai
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSetupLoginAs('admin')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        setupLoginAs === 'admin'
                          ? 'bg-[#1F3864] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      Administrator (admin)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupLoginAs('panitia')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        setupLoginAs === 'panitia'
                          ? 'bg-[#1D4ED8] text-white shadow-2xs'
                          : 'text-[#475569] hover:text-[#131C31]'
                      }`}
                    >
                      Panitia Ujian
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-all duration-150 active:scale-[0.99] whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? 'Mengaktifkan Akses...' : 'Aktifkan & Masuk Aplikasi'}
              </button>
            </form>
          ) : (
            /* Standard Server-Verified Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-[#131C31]">
                  Masuk Portal Panitia
                </h2>
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

              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    Nama Pengguna (User)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Masukkan nama pengguna"
                      autoComplete="username"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#131C31] focus:border-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Masukkan kata sandi"
                      autoComplete="current-password"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#131C31] focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#131C31] p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white text-sm font-bold shadow-xs transition-all duration-150 active:scale-[0.99] whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                {submitting ? 'Memverifikasi Sesi...' : 'Masuk ke Portal Panitia'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
