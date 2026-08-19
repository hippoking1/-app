import React from 'react';

interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  className = '',
  style,
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-tertiary)',
            border: `1px solid ${error ? 'var(--expense)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
            ...style
          }}
          className={className}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {/* 自訂下拉箭頭 */}
        <div
          style={{
            position: 'absolute',
            right: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--text-muted)',
            fontSize: '10px'
          }}
        >
          ▼
        </div>
      </div>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--expense)', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
};
