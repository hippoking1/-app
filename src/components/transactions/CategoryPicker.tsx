import React from 'react';
import { Category } from '@/types';
import { getSafeIcon } from '@/utils/iconHelper';

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string;
  onSelect: (categoryId: string) => void;
}

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  selectedId,
  onSelect
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
        gap: '8px',
        maxHeight: '180px',
        overflowY: 'auto',
        padding: '4px'
      }}
    >
      {categories.map((cat) => {
        const isSelected = cat.id === selectedId;
        const IconComponent = getSafeIcon(cat.icon);

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 4px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
              border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out)'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent size={16} strokeWidth={1.5} />
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: isSelected ? 500 : 400,
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%'
              }}
            >
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
