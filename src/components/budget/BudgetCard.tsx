import React from 'react';
import { BudgetStatus } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/analytics';
import { deleteBudget } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { Trash2, Target } from 'lucide-react';
import { getSafeIcon } from '@/utils/iconHelper';

interface BudgetCardProps {
  status: BudgetStatus;
  onEdit?: () => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ status, onEdit }) => {
  const { addToast } = useAppStore();
  const { budget, category, spent, remaining, usageRatio, isOverBudget, isWarning } = status;

  const isGlobal = !budget.categoryId;
  const title = isGlobal ? '全月總預算' : category?.name || '特定分類';
  const IconComponent = isGlobal ? Target : getSafeIcon(category?.icon);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`確定要刪除「${title}」預算嗎？`)) {
      try {
        await deleteBudget(budget.userId, budget.id);
        addToast({ type: 'info', message: '已移除預算' });
      } catch (err: any) {
        addToast({ type: 'error', message: '刪除失敗: ' + err.message });
      }
    }
  };

  return (
    <Card
      interactive
      onClick={onEdit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: onEdit ? 'pointer' : 'default',
        borderColor: isOverBudget
          ? 'rgba(229, 72, 77, 0.35)'
          : isWarning
          ? 'rgba(245, 158, 11, 0.35)'
          : 'var(--border)'
      }}
    >
      {/* 頂部標題與狀態 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconComponent size={16} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {category && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: category.color }} />
              )}
              {title}
            </div>
            <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              上限 {formatCurrency(budget.amount)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="font-mono"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: isOverBudget ? 'var(--expense)' : isWarning ? 'var(--warning)' : 'var(--income)',
              backgroundColor: isOverBudget
                ? 'var(--expense-subtle)'
                : isWarning
                ? 'var(--warning-subtle)'
                : 'var(--income-subtle)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)'
            }}
          >
            {isOverBudget ? '超支' : isWarning ? '警戒' : '充裕'}
          </span>

          <button
            onClick={handleDelete}
            aria-label="刪除預算"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-disabled)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 進度條 */}
      <ProgressBar value={usageRatio * 100} max={100} height={8} showLabel />

      {/* 底部數據 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '13px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border)'
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          已花費{' '}
          <span className="font-mono" style={{ fontWeight: 500, color: isOverBudget ? 'var(--expense)' : 'var(--text-primary)' }}>
            {formatCurrency(spent)}
          </span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          剩餘{' '}
          <span className="font-mono" style={{ fontWeight: 500, color: remaining < 0 ? 'var(--expense)' : 'var(--income)' }}>
            {formatCurrency(remaining)}
          </span>
        </span>
      </div>
    </Card>
  );
};
