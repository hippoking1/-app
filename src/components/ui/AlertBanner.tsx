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
          bg: 'rgba(244, 63, 94, 0.12)',
          border: 'rgba(244, 63, 94, 0.35)',
          text: 'var(--expense)',
          icon: <AlertCircle size={18} color="var(--expense)" />
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.35)',
          text: 'var(--warning)',
          icon: <AlertTriangle size={18} color="var(--warning)" />
        };
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.35)',
          text: 'var(--income)',
          icon: <CheckCircle2 size={18} color="var(--income)" />
        };
      case 'info':
      default:
        return {
          bg: 'rgba(14, 165, 233, 0.12)',
          border: 'rgba(14, 165, 233, 0.35)',
          text: 'var(--info)',
          icon: <Info size={18} color="var(--info)" />
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
            <div style={{ fontSize: '13px', fontWeight: 700, color: style.text }}>
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
