import React from 'react';

interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  fullWidth = false
}) => {
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: 'var(--bg-tertiary)',
        padding: '4px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        gap: '4px',
        width: fullWidth ? '100%' : 'fit-content'
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: fullWidth ? 1 : 'initial',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: isActive ? 'var(--on-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--primary)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.15s var(--ease-out), color 0.15s var(--ease-out)'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
