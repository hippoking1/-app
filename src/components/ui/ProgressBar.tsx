import React from 'react';

interface ProgressBarProps {
  value: number; // 0 ~ 100+
  max?: number;
  height?: number;
  showLabel?: boolean;
  colorVariant?: 'auto' | 'primary' | 'income' | 'expense' | 'warning';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 8,
  showLabel = false,
  colorVariant = 'auto'
}) => {
  const percentage = Math.max(0, (value / max) * 100);
  const displayPercent = Math.min(100, percentage);
  const isOver = percentage > 100;

  const getColor = () => {
    if (colorVariant !== 'auto') {
      switch (colorVariant) {
        case 'income': return 'linear-gradient(90deg, #10b981, #059669)';
        case 'expense': return 'linear-gradient(90deg, #f43f5e, #e11d48)';
        case 'warning': return 'linear-gradient(90deg, #f59e0b, #d97706)';
        case 'primary': return 'linear-gradient(90deg, #6366f1, #4f46e5)';
      }
    }

    if (percentage > 100) return 'linear-gradient(90deg, #f43f5e, #be123c)';
    if (percentage >= 80) return 'linear-gradient(90deg, #f59e0b, #ea580c)';
    return 'linear-gradient(90deg, #10b981, #059669)';
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          className={isOver ? 'animate-pulse-alert' : ''}
          style={{
            width: `${displayPercent}%`,
            height: '100%',
            background: getColor(),
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      </div>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            marginTop: '4px',
            color: isOver ? 'var(--expense)' : percentage >= 80 ? 'var(--warning)' : 'var(--text-secondary)',
            fontWeight: 600
          }}
        >
          <span>已使用 {percentage.toFixed(1)}%</span>
          {isOver && <span>⚠️ 已超出預算 {(percentage - 100).toFixed(1)}%</span>}
        </div>
      )}
    </div>
  );
};
