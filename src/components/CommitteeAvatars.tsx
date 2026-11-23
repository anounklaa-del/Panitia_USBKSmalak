import React from 'react';

export type AvatarVariant = 'ketua' | 'sekretaris' | 'bendahara' | 'proktor' | 'teknisi';

export const CommitteeAvatar: React.FC<{
  variant: AvatarVariant;
  className?: string;
}> = ({ variant, className = 'w-12 h-12' }) => {
  switch (variant) {
    case 'ketua':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#DCEBFF" />
          {/* Suit & Tie */}
          <path d="M12 62 C14 47 22 44 32 44 C42 44 50 47 52 62 Z" fill="#1E3A8A" />
          <path d="M27 44 L32 56 L37 44 Z" fill="#FFFFFF" />
          <path d="M30.5 47 L32 58 L33.5 47 Z" fill="#DC2626" />
          {/* Neck & Head */}
          <rect x="27" y="36" width="10" height="10" rx="4" fill="#F3C6A5" />
          <circle cx="32" cy="26" r="12" fill="#F6D0B5" />
          {/* Hair & Peci/Hairline */}
          <path d="M20 24 C20 15 26 12 32 12 C38 12 44 15 44 24 C42 19 37 18 32 18 C27 18 22 19 20 24 Z" fill="#1F2937" />
          {/* Glasses */}
          <rect x="22.5" y="23" width="8" height="6" rx="1.5" fill="none" stroke="#1E293B" strokeWidth="1.6" />
          <rect x="33.5" y="23" width="8" height="6" rx="1.5" fill="none" stroke="#1E293B" strokeWidth="1.6" />
          <line x1="30.5" y1="25.5" x2="33.5" y2="25.5" stroke="#1E293B" strokeWidth="1.6" />
          {/* Eyes & Smile */}
          <circle cx="26.5" cy="26" r="1.2" fill="#1E293B" />
          <circle cx="37.5" cy="26" r="1.2" fill="#1E293B" />
          <path d="M28.5 32 Q32 34.5 35.5 32" fill="none" stroke="#9A5B3C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sekretaris':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#DBEAFE" />
          {/* Hijab & Outfit */}
          <path d="M12 62 C14 46 21 42 32 42 C43 42 50 46 52 62 Z" fill="#2563EB" />
          <path d="M19 28 C19 15 24 11 32 11 C40 11 45 15 45 28 L47 45 C42 48 22 48 17 45 Z" fill="#1D4ED8" />
          {/* Face */}
          <circle cx="32" cy="27" r="10.5" fill="#F6D0B5" />
          {/* Eyes & Smile */}
          <circle cx="28" cy="26" r="1.3" fill="#1E293B" />
          <circle cx="36" cy="26" r="1.3" fill="#1E293B" />
          <path d="M29 31.5 Q32 34 35 31.5" fill="none" stroke="#9A5B3C" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'bendahara':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#E0E7FF" />
          <path d="M12 62 C14 47 22 44 32 44 C42 44 50 47 52 62 Z" fill="#0F172A" />
          <path d="M27 44 L32 55 L37 44 Z" fill="#FFFFFF" />
          <path d="M31 47 L32 57 L33 47 Z" fill="#2563EB" />
          <rect x="27" y="36" width="10" height="10" rx="4" fill="#EEC09E" />
          <circle cx="32" cy="26" r="12" fill="#F2C9A8" />
          <path d="M20 24 C20 14 26 11 32 11 C38 11 44 14 44 24 C41 18 36 17 32 17 C28 17 23 18 20 24 Z" fill="#1E293B" />
          <rect x="22.5" y="23" width="8" height="5.5" rx="1.5" fill="none" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="33.5" y="23" width="8" height="5.5" rx="1.5" fill="none" stroke="#1E293B" strokeWidth="1.5" />
          <line x1="30.5" y1="25.5" x2="33.5" y2="25.5" stroke="#1E293B" strokeWidth="1.5" />
          <circle cx="26.5" cy="25.8" r="1.2" fill="#1E293B" />
          <circle cx="37.5" cy="25.8" r="1.2" fill="#1E293B" />
          <path d="M29 32 Q32 34 35 32" fill="none" stroke="#9A5B3C" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'proktor':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#E0F2FE" />
          <path d="M12 62 C14 46 21 42 32 42 C43 42 50 46 52 62 Z" fill="#0369A1" />
          <path d="M19 28 C19 15 24 11 32 11 C40 11 45 15 45 28 L47 45 C42 48 22 48 17 45 Z" fill="#1E3A8A" />
          <circle cx="32" cy="27" r="10.5" fill="#F8D7BF" />
          <circle cx="28" cy="26" r="1.3" fill="#1E293B" />
          <circle cx="36" cy="26" r="1.3" fill="#1E293B" />
          <path d="M29 31.5 Q32 34 35 31.5" fill="none" stroke="#9A5B3C" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'teknisi':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#DBEAFE" />
          <path d="M12 62 C14 47 22 44 32 44 C42 44 50 47 52 62 Z" fill="#1E293B" />
          <path d="M27 44 L32 54 L37 44 Z" fill="#FFFFFF" />
          <rect x="27" y="36" width="10" height="10" rx="4" fill="#ECC09E" />
          <circle cx="32" cy="26" r="12" fill="#F4CBB0" />
          <path d="M20 24 C20 14 26 11 32 11 C38 11 44 14 44 24 C42 18 37 16.5 32 16.5 C27 16.5 22 18 20 24 Z" fill="#111827" />
          <circle cx="27.5" cy="25.5" r="1.3" fill="#1E293B" />
          <circle cx="36.5" cy="25.5" r="1.3" fill="#1E293B" />
          <path d="M29 32 Q32 34.2 35 32" fill="none" stroke="#9A5B3C" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
};
