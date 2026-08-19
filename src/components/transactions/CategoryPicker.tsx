import React from 'react';
import { Category } from '@/types';
import * as Icons from 'lucide-react';

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
        const IconComponent = (Icons as any)[cat.icon] || Icons.Tag;

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
              padding: '10px 4px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isSelected ? 'var(--primary-glow)' : 'var(--bg-tertiary)',
              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: `${cat.color}25`,
                color: cat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent size={16} />
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isSelected ? 700 : 500,
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
