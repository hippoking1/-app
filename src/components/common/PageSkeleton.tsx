import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px',
        animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }}
    >
      {/* 標題骨架 */}
      <div
        style={{
          height: '32px',
          width: '200px',
          borderRadius: '8px',
          background: 'var(--surface, rgba(255, 255, 255, 0.06))'
        }}
      />
      {/* 卡片骨架 1 */}
      <div
        style={{
          height: '140px',
          width: '100%',
          borderRadius: '16px',
          background: 'var(--surface, rgba(255, 255, 255, 0.04))'
        }}
      />
      {/* 卡片骨架 2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}
      >
        <div
          style={{
            height: '200px',
            borderRadius: '16px',
            background: 'var(--surface, rgba(255, 255, 255, 0.04))'
          }}
        />
        <div
          style={{
            height: '200px',
            borderRadius: '16px',
            background: 'var(--surface, rgba(255, 255, 255, 0.04))'
          }}
        />
      </div>
    </div>
  );
};
