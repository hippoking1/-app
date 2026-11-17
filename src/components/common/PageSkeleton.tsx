import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '24px'
      }}
    >
      <div
        className="skeleton"
        style={{
          height: '32px',
          width: '200px',
          borderRadius: 'var(--radius-sm)'
        }}
      />
      <div
        className="skeleton"
        style={{
          height: '128px',
          width: '100%',
          borderRadius: 'var(--radius-lg)'
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}
      >
        <div
          className="skeleton"
          style={{
            height: '200px',
            borderRadius: 'var(--radius-lg)'
          }}
        />
        <div
          className="skeleton"
          style={{
            height: '200px',
            borderRadius: 'var(--radius-lg)'
          }}
        />
      </div>
    </div>
  );
};
