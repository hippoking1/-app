import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, rightElement, className = '', style, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {label && (
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          {icon && (
            <div
              style={{
                position: 'absolute',
                left: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-tertiary)',
              border: `1px solid ${error ? 'var(--expense)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: `10px 14px 10px ${icon ? '38px' : '14px'}`,
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
              ...style
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.target.style.borderColor = error ? 'var(--expense)' : 'var(--border)')}
            className={className}
            {...props}
          />
          {rightElement && (
            <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center' }}>
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span style={{ fontSize: '12px', color: 'var(--expense)', fontWeight: 500 }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
