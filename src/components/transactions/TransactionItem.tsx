import React from 'react';
import { Transaction, Category, Account } from '@/types';
import { Trash2, ArrowRightLeft, Plane } from 'lucide-react';
import { formatCurrency } from '@/utils/analytics';
import { deleteTransaction, deleteInstallmentGroup, restoreTransaction } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { useTrips } from '@/hooks/useFirestore';
import { getCurrencyInfo, formatExchangeRate } from '@/services/exchangeRate';

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

  const isForeign = Boolean(transaction.originalCurrency && transaction.originalCurrency !== 'TWD');
  const currencyInfo = isForeign ? getCurrencyInfo(transaction.originalCurrency) : null;
  const matchedTrip = transaction.tripId ? trips.find((t) => t.id === transaction.tripId) : null;

  const IconComponent = isTransfer
    ? ArrowRightLeft
    : getSafeIcon(category?.icon);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (transaction.installment) {
      const { currentPeriod, totalPeriods, groupId } = transaction.installment;
      const choice = window.prompt(
        `此交易為信用卡分期第 ${currentPeriod}/${totalPeriods} 期。\n\n請輸入 1 或 2：\n1：僅刪除本期\n2：刪除全部 ${totalPeriods} 期\n(取消請直接關閉)`,
        '1'
      );
      if (choice === '2') {
        try {
          await deleteInstallmentGroup(transaction.userId, groupId);
          addToast({ type: 'info', message: `已刪除全部分期 (共 ${totalPeriods} 期)` });
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
              addToast({ type: 'success', message: '已復原該筆交易' });
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
        <div className={styles.iconBox}>
          <IconComponent size={16} strokeWidth={1.5} />
        </div>

        <div className={styles.infoCol}>
          <div className={styles.titleRow}>
            <span className={styles.title}>
              {isTransfer
                ? `${account?.name || '帳戶'} → ${targetAccount?.name || '目標帳戶'}`
                : transaction.merchant || transaction.note || category?.name || '未分類支出'}
            </span>
            {transaction.aiGenerated && (
              <span className={styles.badgeNeutral}>AI</span>
            )}
            {matchedTrip && (
              <span className={styles.badgeAccent} title={`歸屬旅程：${matchedTrip.name}`}>
                <Plane size={11} strokeWidth={1.5} />
                {matchedTrip.name}
              </span>
            )}
            {isForeign && currencyInfo && !matchedTrip && (
              <span className={styles.badgeNeutral}>
                {currencyInfo.code}
              </span>
            )}
            {transaction.installment && (
              <span
                className={styles.badgeNeutral}
                title={`總金額 $${transaction.installment.totalAmount.toLocaleString()}`}
              >
                分期 {transaction.installment.currentPeriod}/{transaction.installment.totalPeriods}
              </span>
            )}
            {(transaction.subscription || transaction.tags?.includes('訂閱付款')) && (
              <span className={styles.badgeNeutral} title="信用卡定期訂閱扣款">
                訂閱
              </span>
            )}
          </div>

          <div className={styles.metaRow}>
            <span className="font-mono">{transaction.date}</span>
            <span>·</span>
            <span>{isTransfer ? '帳戶轉帳' : account?.name || '現金'}</span>
            {!isTransfer && category && (
              <>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                  <span className={styles.categoryDot} style={{ backgroundColor: category.color || 'var(--text-muted)' }} />
                  {category.name}
                </span>
              </>
            )}
            {transaction.merchant && transaction.note && (
              <>
                <span>·</span>
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
              color: isExpense ? 'var(--expense)' : isIncome ? 'var(--income)' : 'var(--text-primary)'
            }}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatCurrency(transaction.amount)}
          </div>
          {isForeign && currencyInfo && transaction.originalAmount && (
            <div
              className="font-mono"
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '2px'
              }}
              title={transaction.exchangeRate ? `匯率 1 ${currencyInfo.code} ≈ ${formatExchangeRate(transaction.exchangeRate)} NT$` : undefined}
            >
              {currencyInfo.symbol}{transaction.originalAmount.toLocaleString()} {currencyInfo.code}
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className={styles.deleteBtn}
          title="刪除"
          aria-label="刪除此筆交易"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
