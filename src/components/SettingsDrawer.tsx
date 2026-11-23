import React, { useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Subtle backdrop so live preview remains visible when tweaking parameters */}
      <div
        className="fixed inset-0 bg-[#0F172A]/20 transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative z-10 w-full max-w-[360px] sm:max-w-[380px] h-full bg-white border-l border-[#DCE2EE] shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0 bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#1F3864] text-[#C9A227] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm text-[#131C31] truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-[#64748B] truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            title="Tutup pengaturan (Esc)"
            className="w-9 h-9 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#475569] hover:text-[#131C31] flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {children}
        </div>

        {/* Drawer Footer */}
        <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-4 rounded-lg bg-[#1F3864] hover:bg-[#172B4D] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </aside>
    </div>
  );
};
