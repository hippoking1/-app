import React from 'react';
import { BudgetStatus } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/analytics';
import { deleteBudget } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as Icons from 'lucide-react';

interface BudgetCardProps {
  status: BudgetStatus;
  onEdit?: () => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({ status, onEdit }) => {
  const { addToast } = useAppStore();
  const { budget, category, spent, remaining, usageRatio, isOverBudget, isWarning } = status;

  const isGlobal = !budget.categoryId;
  const title = isGlobal ? '📊 全月總預算' : category?.name || '特定分類';
  const IconComponent = category ? (Icons as any)[category.icon] || Icons.Tag : Icons.Target;

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
        borderColor: isOverBudget
          ? 'rgba(244, 63, 94, 0.4)'
          : isWarning
          ? 'rgba(245, 158, 11, 0.4)'
          : 'var(--border-glass)'
      }}
    >
      {/* 頂部標題與狀態 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: category ? `${category.color}25` : 'var(--primary-glow)',
              color: category?.color || 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconComponent size={18} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              上限 {formatCurrency(budget.amount)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOverBudget ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--expense)',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <AlertTriangle size={12} /> 超支
            </span>
          ) : isWarning ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--warning)',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <AlertTriangle size={12} /> 警戒
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--income)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              <CheckCircle2 size={12} /> 充裕
            </span>
          )}

          <button
            onClick={handleDelete}
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
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* 進度條 */}
      <ProgressBar value={usageRatio * 100} max={100} height={10} showLabel />

      {/* 底部數據 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '13px',
          paddingTop: '4px',
          borderTop: '1px solid var(--border)'
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>
          已花費：
          <strong style={{ color: isOverBudget ? 'var(--expense)' : 'var(--text-primary)' }}>
            {formatCurrency(spent)}
          </strong>
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          剩餘額度：
          <strong style={{ color: remaining < 0 ? 'var(--expense)' : 'var(--income)' }}>
            {formatCurrency(remaining)}
          </strong>
        </span>
      </div>
    </Card>
  );
};
