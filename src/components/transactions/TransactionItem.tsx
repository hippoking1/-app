import React from 'react';
import { Transaction, Category, Account } from '@/types';
import * as Icons from 'lucide-react';
import { Trash2, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '@/utils/analytics';
import { deleteTransaction, deleteInstallmentGroup } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';

import { getSafeIcon } from '@/utils/iconHelper';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  targetAccount?: Account;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  category,
  account,
  targetAccount
}) => {
  const { addToast } = useAppStore();
  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  const IconComponent = isTransfer
    ? ArrowRightLeft
    : getSafeIcon(category?.icon);

  const iconColor = isTransfer
    ? 'var(--info)'
    : category?.color || (isExpense ? 'var(--expense)' : 'var(--income)');

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (transaction.installment) {
      const { currentPeriod, totalPeriods, groupId } = transaction.installment;
      const confirmAll = window.confirm(
        `此交易為信用卡分期第 ${currentPeriod}/${totalPeriods} 期記錄。\n\n【確定】：刪除全部 ${totalPeriods} 期分期記錄\n【取消】：僅刪除此單期記錄`
      );
      if (confirmAll) {
        try {
          await deleteInstallmentGroup(transaction.userId, groupId);
          addToast({ type: 'info', message: `已刪除全部分期記錄 (共 ${totalPeriods} 期)` });
        } catch (err: any) {
          addToast({ type: 'error', message: '刪除失敗: ' + err.message });
        }
        return;
      }
      if (!window.confirm(`確定要「僅刪除」第 ${currentPeriod}/${totalPeriods} 期記錄嗎？`)) {
        return;
      }
    } else {
      if (!window.confirm('確定要刪除這筆交易記錄嗎？帳戶餘額將自動回補。')) {
        return;
      }
    }

    try {
      await deleteTransaction(transaction);
      addToast({ type: 'info', message: '已刪除交易' });
    } catch (err: any) {
      addToast({ type: 'error', message: '刪除失敗: ' + err.message });
    }
  };

  return (
    <div
      className="interactive-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        backgroundColor: 'var(--bg-card)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-lg)',
        gap: '12px',
        transition: 'all 0.15s ease'
      }}
    >
      {/* 左側圖示與分類/備註 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: `${iconColor}20`,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <IconComponent size={20} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {isTransfer
                ? `${account?.name || '帳戶'} ➔ ${targetAccount?.name || '目標帳戶'}`
                : transaction.merchant || transaction.note || category?.name || '未分類支出'}
            </span>
            {transaction.aiGenerated && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  color: 'var(--purple)',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600
                }}
              >
                AI
              </span>
            )}
            {transaction.installment && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
                title={`總金額 $${transaction.installment.totalAmount.toLocaleString()}`}
              >
                分期 {transaction.installment.currentPeriod}/{transaction.installment.totalPeriods}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '2px',
              flexWrap: 'wrap'
            }}
          >
            <span>{transaction.date}</span>
            <span>•</span>
            <span>{isTransfer ? '帳戶轉帳' : account?.name || '現金'}</span>
            {!isTransfer && category && (
              <>
                <span>•</span>
                <span style={{ color: category.color }}>{category.name}</span>
              </>
            )}
            {transaction.merchant && transaction.note && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--text-secondary)' }}>{transaction.note}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右側金額與操作按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ textAlign: 'right' }}>
          <div
            className="font-mono"
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: isExpense ? 'var(--expense)' : isIncome ? 'var(--income)' : 'var(--info)'
            }}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatCurrency(transaction.amount)}
          </div>
        </div>

        <button
          onClick={handleDelete}
          title="刪除"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-disabled)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--expense)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-disabled)')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
