import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AccountForm } from '@/components/accounts/AccountForm';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useAccounts, useTotalNetWorth, useTransactions } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { Account } from '@/types';
import { formatCurrency } from '@/utils/analytics';
import { deleteAccount, saveAccount } from '@/services/firestore';
import { calculateCashWalletUsage, calculateCreditCardUsage } from '@/utils/accountCalculations';
import { Plus, Edit3, Trash2, ArrowRightLeft, Calendar, Sparkles } from 'lucide-react';
import { getSafeIcon } from '@/utils/iconHelper';

export const Accounts: React.FC = () => {
  const { user, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { cashTotal } = useTotalNetWorth();
  const { transactions } = useTransactions();

  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
  const [isTransferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceAccId, setTransferSourceAccId] = useState<string>('');

  const handleEdit = (acc: Account) => {
    setEditingAccount(acc);
    setAccountModalOpen(true);
  };

  const handleCreate = () => {
    setEditingAccount(undefined);
    setAccountModalOpen(true);
  };

  const handleTransfer = (accId: string) => {
    setTransferSourceAccId(accId);
    setTransferModalOpen(true);
  };

  const handleDelete = async (acc: Account) => {
    if (!user) return;
    if (window.confirm(`確定要刪除「${acc.name}」帳戶嗎？`)) {
      try {
        await deleteAccount(user.uid, acc.id);
        addToast({ type: 'info', message: '已刪除帳戶' });
      } catch (err: any) {
        addToast({ type: 'error', message: '刪除失敗: ' + err.message });
      }
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部資產總結與操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
            帳戶與資產管理
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            管理您的現金錢包、銀行戶頭、信用卡與電子支付
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleCreate} icon={<Plus size={16} />}>
          新增帳戶
        </Button>
      </div>

      {/* 現金總資產看板 */}
      <Card glass padding="lg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
            流動現金帳戶總額
          </span>
          <div className="font-mono" style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatCurrency(cashTotal)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleTransfer(accounts[0]?.id || '')}
            icon={<ArrowRightLeft size={16} />}
          >
            帳戶互轉
          </Button>
        </div>
      </Card>

      {/* 帳戶列表 Grid */}
      <div className="grid-3">
        {accounts.map((acc) => {
          const IconComponent = getSafeIcon(acc.icon);
          return (
            <Card key={acc.id} glass interactive style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 頂部名稱與操作 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: `${acc.color}25`,
                      color: acc.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <IconComponent size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {acc.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {acc.type === 'cash'
                        ? acc.balance === 0
                          ? '現金 • 純額度模式'
                          : '現金'
                        : acc.type === 'credit_card'
                        ? `信用卡 • 每月 ${acc.billingCycleDay || 10} 號結帳`
                        : acc.type === 'e_wallet'
                        ? '電子支付'
                        : acc.type === 'investment'
                        ? '證券投資戶'
                        : '銀行帳戶'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleEdit(acc)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="編輯帳戶"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(acc)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: '4px' }}
                    title="刪除帳戶"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* 餘額與額度顯示 */}
              <div>
                {/* 1. 信用卡視圖 */}
                {acc.type === 'credit_card' && (() => {
                  const cardUsage = calculateCreditCardUsage(acc, transactions);
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          本期已刷未出帳（結帳日後歸零）
                        </span>
                        {acc.creditLimit && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            額度 {formatCurrency(acc.creditLimit)}
                          </span>
                        )}
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          marginTop: '2px',
                          color: 'var(--expense)'
                        }}
                      >
                        {formatCurrency(cardUsage.usedAmount)}
                      </div>

                      {/* 結帳週期與天數提醒 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> 本期 {cardUsage.cycleStartDate.slice(5)} ~ {cardUsage.cycleEndDate.slice(5)}
                        </span>
                        <span style={{ color: cardUsage.daysRemaining === 0 ? 'var(--expense)' : 'var(--primary-light)', fontWeight: 600 }}>
                          {cardUsage.daysRemaining === 0 ? '今日結帳歸零' : `剩 ${cardUsage.daysRemaining} 天結帳`}
                        </span>
                      </div>

                      {/* 額度進度條 */}
                      {acc.creditLimit && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>
                              可用額度：{formatCurrency(cardUsage.availableLimit)}
                              {cardUsage.futureInstallments > 0 && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                                  (含未到期分期 {formatCurrency(cardUsage.futureInstallments)})
                                </span>
                              )}
                            </span>
                            <span>已佔用 {cardUsage.usagePercent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, cardUsage.usagePercent)}%`,
                                height: '100%',
                                backgroundColor: cardUsage.usagePercent > 80 ? 'var(--expense)' : 'var(--warning)',
                                borderRadius: 'var(--radius-full)',
                                transition: 'width 0.3s'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. 現金錢包視圖 */}
                {acc.type === 'cash' && (() => {
                  const cashUsage = calculateCashWalletUsage(acc, transactions);
                  const isZeroMode = acc.balance === 0;

                  if (isZeroMode) {
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '12px', color: 'var(--income)', fontWeight: 600 }}>
                            💵 本月已使用額度
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            每月 1 號自動歸零
                          </span>
                        </div>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '24px',
                            fontWeight: 800,
                            marginTop: '2px',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {formatCurrency(cashUsage.currentMonthSpent)}
                        </div>
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            fontSize: '11px',
                            color: 'var(--income)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Sparkles size={12} /> 純額度模式：不扣減餘額，次月 1 號重新計算
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>目前結餘</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          本月已用 {formatCurrency(cashUsage.currentMonthSpent)}
                        </span>
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          marginTop: '2px',
                          color: acc.balance < 0 ? 'var(--expense)' : 'var(--text-primary)'
                        }}
                      >
                        {formatCurrency(acc.balance)}
                      </div>

                      {/* 餘額為負數時的智慧修正提示 */}
                      {acc.balance < 0 && (
                        <div
                          style={{
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '11px'
                          }}
                        >
                          <span style={{ color: 'var(--expense)' }}>餘額為負數</span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await saveAccount({ ...acc, balance: 0, updatedAt: new Date().toISOString() });
                                addToast({ type: 'success', message: '已切換為純額度模式（餘額設為 0）' });
                              } catch (err: any) {
                                addToast({ type: 'error', message: '切換失敗: ' + err.message });
                              }
                            }}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#ffffff',
                              backgroundColor: 'var(--expense)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              padding: '2px 8px',
                              cursor: 'pointer'
                            }}
                          >
                            設為 0 (啟用純額度模式)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3. 一般銀行/電子支付視圖 */}
                {acc.type !== 'credit_card' && acc.type !== 'cash' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>目前結餘</span>
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        marginTop: '2px',
                        color: acc.balance < 0 ? 'var(--expense)' : 'var(--text-primary)'
                      }}
                    >
                      {formatCurrency(acc.balance)}
                    </div>
                  </div>
                )}
              </div>

              {/* 底部轉帳快速鍵 */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTransfer(acc.id)}
                  icon={<ArrowRightLeft size={14} />}
                >
                  從此帳戶轉帳
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 帳戶新增/編輯 Modal */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? '✏️ 編輯帳戶' : '🏦 新增帳戶'}
      >
        <AccountForm
          initialData={editingAccount}
          onSuccess={() => setAccountModalOpen(false)}
          onCancel={() => setAccountModalOpen(false)}
        />
      </Modal>

      {/* 轉帳 Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="💸 帳戶資金互轉"
      >
        <TransactionForm
          initialData={{ type: 'transfer', accountId: transferSourceAccId }}
          onSuccess={() => setTransferModalOpen(false)}
          onCancel={() => setTransferModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
