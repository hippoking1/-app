import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--primary)',
          color: 'var(--on-primary)',
          border: '1px solid transparent',
          boxShadow: 'var(--highlight-top)'
        };
      case 'accent':
        return {
          backgroundColor: 'var(--accent)',
          color: 'var(--on-accent)',
          border: '1px solid transparent',
          boxShadow: 'var(--highlight-top)'
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)'
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)'
        };
      case 'danger':
        return {
          backgroundColor: 'var(--expense)',
          color: '#ffffff',
          border: '1px solid transparent'
        };
      case 'success':
        return {
          backgroundColor: 'var(--income)',
          color: '#151413',
          border: '1px solid transparent'
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent'
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { height: '32px', padding: '0 12px', fontSize: '13px', borderRadius: 'var(--radius-md)' };
      case 'lg':
        return { height: '44px', padding: '0 20px', fontSize: '15px', borderRadius: 'var(--radius-md)' };
      case 'md':
      default:
        return { height: '36px', padding: '0 16px', fontSize: '14px', borderRadius: 'var(--radius-md)' };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out), opacity 0.15s var(--ease-out), transform 0.12s var(--ease-out)',
    width: fullWidth ? '100%' : 'auto',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style
  };

  return (
    <button disabled={disabled || loading} style={baseStyle} className={className} {...props}>
      {loading ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : icon}
      {children}
    </button>
  );
};
