import React from 'react';
import { AlertTriangle, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertBannerProps {
  type?: 'warning' | 'error' | 'info' | 'success';
  title?: string;
  message: string;
  onClose?: () => void;
  actionButton?: React.ReactNode;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'warning',
  title,
  message,
  onClose,
  actionButton
}) => {
  const getColors = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'var(--expense-subtle)',
          border: 'rgba(229, 72, 77, 0.3)',
          text: 'var(--expense)',
          icon: <AlertCircle size={16} strokeWidth={1.5} color="var(--expense)" />
        };
      case 'warning':
        return {
          bg: 'var(--warning-subtle)',
          border: 'rgba(245, 158, 11, 0.3)',
          text: 'var(--warning)',
          icon: <AlertTriangle size={16} strokeWidth={1.5} color="var(--warning)" />
        };
      case 'success':
        return {
          bg: 'var(--income-subtle)',
          border: 'rgba(76, 195, 138, 0.3)',
          text: 'var(--income)',
          icon: <CheckCircle2 size={16} strokeWidth={1.5} color="var(--income)" />
        };
      case 'info':
      default:
        return {
          bg: 'var(--bg-tertiary)',
          border: 'var(--border-focus)',
          text: 'var(--text-primary)',
          icon: <Info size={16} strokeWidth={1.5} color="var(--text-secondary)" />
        };
    }
  };

  const style = getColors();

  return (
    <div
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>{style.icon}</div>
        <div>
          {title && (
            <div style={{ fontSize: '13px', fontWeight: 500, color: style.text }}>
              {title}
            </div>
          )}
          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            {message}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {actionButton}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
