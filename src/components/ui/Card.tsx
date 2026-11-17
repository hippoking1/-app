import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  glass: _glass = false,
  interactive = false,
  padding = 'md',
  className = '',
  style,
  ...props
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return 'var(--space-3)';
      case 'lg': return 'var(--space-6)';
      case 'md':
      default:
        return 'var(--space-4)';
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: getPadding(),
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    overflow: 'hidden',
    ...style
  };

  return (
    <div
      style={cardStyle}
      className={`${interactive ? 'interactive-card' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
