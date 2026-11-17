import React from 'react';
import { useAppStore } from '@/stores/appStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top, 52px) + 12px)',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '380px',
        width: 'calc(100% - 40px)',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success': return <CheckCircle2 size={16} strokeWidth={1.5} color="var(--income)" />;
            case 'error': return <AlertCircle size={16} strokeWidth={1.5} color="var(--expense)" />;
            case 'warning': return <AlertTriangle size={16} strokeWidth={1.5} color="var(--warning)" />;
            case 'info':
            default:
              return <Info size={16} strokeWidth={1.5} color="var(--text-secondary)" />;
          }
        };

        return (
          <div
            key={toast.id}
            className="animate-slide-up"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {getIcon()}
              <div>
                {toast.title && (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {toast.title}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {toast.message}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  style={{
                    backgroundColor: 'var(--accent-subtle)',
                    border: '1px solid var(--border-focus)',
                    color: 'var(--accent-text)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
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
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
