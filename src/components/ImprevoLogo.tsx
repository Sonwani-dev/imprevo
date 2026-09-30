import React from 'react';

interface ImprevoLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ImprevoLogo: React.FC<ImprevoLogoProps> = ({
  className = '',
  showText = true,
  size = 'md',
}) => {
  const heights = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-16',
  };

  if (!showText) {
    return (
      <svg
        viewBox="0 0 68 76"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${heights[size]} w-auto object-contain ${className}`}
      >
        <defs>
          <linearGradient id="impGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="46" height="60" rx="8" fill="#DBEAFE" />
        <rect x="14" y="10" width="46" height="60" rx="8" fill="url(#impGradIcon)" />
        <path
          d="M22 32H48M22 40H44M22 48H36"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="50" cy="18" r="4.5" fill="#60A5FA" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 420 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${heights[size]} w-auto object-contain ${className}`}
    >
      <defs>
        <linearGradient id="impGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <g transform="translate(10, 10)">
        <rect x="10" y="8" width="46" height="60" rx="8" fill="#DBEAFE" />
        <rect x="22" y="16" width="46" height="60" rx="8" fill="url(#impGradFull)" />
        <path
          d="M30 38H56M30 46H52M30 54H44"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="58" cy="24" r="4.5" fill="#60A5FA" />
      </g>
      <text
        x="100"
        y="58"
        fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
        fontWeight="800"
        fontSize="38"
        letterSpacing="1.5"
        fill="#0F172A"
      >
        IMPREVO
      </text>
      <text
        x="102"
        y="78"
        fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
        fontWeight="600"
        fontSize="12.5"
        letterSpacing="2"
        fill="#2563EB"
      >
        SMART PRINTING. SIMPLIFIED.
      </text>
    </svg>
  );
};
