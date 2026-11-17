import React from 'react';

interface BrandMarkProps {
  size?: number;
}

/**
 * 專屬帳冊幾何標誌：深底框線搭配暖琥珀銅騎縫書籤
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect
        x="2"
        y="3"
        width="24"
        height="22"
        rx="5"
        fill="var(--bg-tertiary)"
        stroke="var(--border-focus)"
        strokeWidth="1.25"
      />
      <line x1="9" y1="3.5" x2="9" y2="24.5" stroke="var(--border)" strokeWidth="1.25" />
      <path d="M16 3H20V11L18 9.2L16 11V3Z" fill="var(--accent)" />
      <line x1="13" y1="15.5" x2="21" y2="15.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="19.5" x2="18.5" y2="19.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
