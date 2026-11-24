import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let displayMsg = error?.message || 'Terjadi kesalahan saat menyambung ke database cloud.';
    try {
      const parsed = JSON.parse(displayMsg) as { error?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        displayMsg = parsed.path
          ? `${parsed.error} (path: ${parsed.path})`
          : parsed.error;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: displayMsg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#EBF1FA] flex items-center justify-center p-6 text-[#131C31]">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#FECACA] shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#B91C1C]">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base">
                  Terjadi Kendala Koneksi Cloud
                </h2>
                <p className="text-xs text-[#64748B]">
                  Aplikasi menghentikan operasi demi keamanan data.
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] break-words font-mono">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
