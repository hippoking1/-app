import React from 'react';

interface ProgressBarProps {
  value: number; // 0 ~ 100+
  max?: number;
  height?: number;
  showLabel?: boolean;
  colorVariant?: 'auto' | 'primary' | 'accent' | 'income' | 'expense' | 'warning';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 8,
  showLabel = false,
  colorVariant = 'auto'
}) => {
  const percentage = Math.max(0, (value / max) * 100);
  const ratio = Math.min(1, percentage / 100);
  const isOver = percentage > 100;

  const getColor = () => {
    if (colorVariant !== 'auto') {
      switch (colorVariant) {
        case 'income': return 'var(--income)';
        case 'expense': return 'var(--expense)';
        case 'warning': return 'var(--warning)';
        case 'accent': return 'var(--accent)';
        case 'primary': return 'var(--primary)';
      }
    }

    if (percentage > 100) return 'var(--expense)';
    if (percentage >= 80) return 'var(--warning)';
    return 'var(--accent)';
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: getColor(),
            borderRadius: 'var(--radius-xs)',
            transform: `scaleX(${ratio})`,
            transformOrigin: 'left center',
            transition: 'transform 0.35s var(--ease-out), background-color 0.15s var(--ease-out)'
          }}
        />
      </div>
      {showLabel && (
        <div
          className="font-mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            marginTop: '6px',
            color: isOver ? 'var(--expense)' : percentage >= 80 ? 'var(--warning)' : 'var(--text-secondary)',
            fontWeight: 500
          }}
        >
          <span>已使用 {percentage.toFixed(1)}%</span>
          {isOver && <span>超出預算 {(percentage - 100).toFixed(1)}%</span>}
        </div>
      )}
    </div>
  );
};
