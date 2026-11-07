import React from 'react';
import { Transaction, Category, Account } from '@/types';
import { Trash2, ArrowRightLeft, Plane } from 'lucide-react';
import { formatCurrency } from '@/utils/analytics';
import { deleteTransaction, deleteInstallmentGroup, restoreTransaction } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { useTrips } from '@/hooks/useFirestore';
import { getCurrencyInfo, formatForeignCurrency, formatExchangeRate } from '@/services/exchangeRate';

import { getSafeIcon } from '@/utils/iconHelper';
import styles from './TransactionItem.module.css';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  targetAccount?: Account;
  onEdit?: (transaction: Transaction) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  category,
  account,
  targetAccount,
  onEdit
}) => {
  const { addToast } = useAppStore();
  const { trips } = useTrips();
  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  // 外幣與旅行關聯
  const isForeign = Boolean(transaction.originalCurrency && transaction.originalCurrency !== 'TWD');
  const currencyInfo = isForeign ? getCurrencyInfo(transaction.originalCurrency) : null;
  const matchedTrip = transaction.tripId ? trips.find((t) => t.id === transaction.tripId) : null;

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
      const choice = window.prompt(
        `此交易為信用卡分期第 ${currentPeriod}/${totalPeriods} 期記錄。\n\n請輸入 1 或 2：\n1：僅刪除本期記錄\n2：刪除全部 ${totalPeriods} 期分期記錄\n(取消請直接關閉)`,
        '1'
      );
      if (choice === '2') {
        try {
          await deleteInstallmentGroup(transaction.userId, groupId);
          addToast({ type: 'info', message: `已刪除全部分期記錄 (共 ${totalPeriods} 期)` });
        } catch (err: any) {
          addToast({ type: 'error', message: '刪除失敗: ' + err.message });
        }
        return;
      }
      if (choice !== '1') return;
    }

    try {
      await deleteTransaction(transaction);
      const title = transaction.merchant || transaction.note || category?.name || '交易明細';
      addToast({
        type: 'info',
        message: `已刪除「${title}」($${transaction.amount.toLocaleString()})`,
        action: {
          label: '復原',
          onClick: async () => {
            try {
              await restoreTransaction(transaction);
              addToast({ type: 'success', message: '已成功復原該筆交易！' });
            } catch (restoreErr: any) {
              addToast({ type: 'error', message: '復原失敗: ' + restoreErr.message });
            }
          }
        },
        duration: 6000
      });
    } catch (err: any) {
      addToast({ type: 'error', message: '刪除失敗: ' + err.message });
    }
  };

  return (
    <div
      className={`${styles.container} ${onEdit ? styles.containerInteractive : ''}`}
      onClick={() => onEdit?.(transaction)}
    >
      {/* 左側圖示與分類/備註 */}
      <div className={styles.leftGroup}>
        <div
          className={styles.iconBox}
          style={{
            backgroundColor: `${iconColor}20`,
            color: iconColor
          }}
        >
          <IconComponent size={20} />
        </div>

        <div className={styles.infoCol}>
          <div className={styles.titleRow}>
            <span className={styles.title}>
              {isTransfer
                ? `${account?.name || '帳戶'} ➔ ${targetAccount?.name || '目標帳戶'}`
                : transaction.merchant || transaction.note || category?.name || '未分類支出'}
            </span>
            {transaction.aiGenerated && (
              <span className={styles.badgeAi}>
                AI
              </span>
            )}
            {matchedTrip && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--primary-light)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={`歸屬旅程：${matchedTrip.name}`}
              >
                ✈️ {matchedTrip.name}
              </span>
            )}
            {isForeign && currencyInfo && !matchedTrip && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                {currencyInfo.flag} {currencyInfo.code}
              </span>
            )}
            {transaction.installment && (
              <span
                className={styles.badgeInstallment}
                title={`總金額 $${transaction.installment.totalAmount.toLocaleString()}`}
              >
                分期 {transaction.installment.currentPeriod}/{transaction.installment.totalPeriods}
              </span>
            )}
            {(transaction.subscription || transaction.tags?.includes('訂閱付款')) && (
              <span
                className={styles.badgeSubscription}
                title="信用卡定期訂閱扣款"
              >
                🔁 訂閱扣款
              </span>
            )}
          </div>

          <div className={styles.metaRow}>
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
      <div className={styles.rightGroup}>
        <div style={{ textAlign: 'right' }}>
          <div
            className={styles.amount}
            style={{
              color: isExpense ? 'var(--expense)' : isIncome ? 'var(--income)' : 'var(--info)'
            }}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatCurrency(transaction.amount)}
          </div>
          {isForeign && currencyInfo && transaction.originalAmount && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginTop: '1px'
              }}
              title={transaction.exchangeRate ? `匯率 1 ${currencyInfo.code} ≈ ${formatExchangeRate(transaction.exchangeRate)} NT$` : undefined}
            >
              {currencyInfo.symbol}
              {transaction.originalAmount.toLocaleString()} {currencyInfo.code}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className={styles.deleteBtn}
          title="刪除"
          aria-label="刪除此筆交易"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
