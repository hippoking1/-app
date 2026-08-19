import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AccountForm } from '@/components/accounts/AccountForm';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useAccounts, useTotalNetWorth } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { Account } from '@/types';
import { formatCurrency } from '@/utils/analytics';
import { deleteAccount } from '@/services/firestore';
import { Plus, Edit3, Trash2, ArrowRightLeft } from 'lucide-react';
import { getSafeIcon } from '@/utils/iconHelper';

export const Accounts: React.FC = () => {
  const { user, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { cashTotal } = useTotalNetWorth();

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
                        ? '現金'
                        : acc.type === 'credit_card'
                        ? '信用卡'
                        : acc.type === 'e_wallet'
                        ? '電子支付'
                        : '銀行帳戶'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleEdit(acc)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(acc)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* 餘額與額度顯示 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {acc.type === 'credit_card' ? '已刷卡未出帳 / 應繳' : '目前結餘'}
                  </span>
                  {acc.type === 'credit_card' && acc.creditLimit && (
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
                    color: acc.type === 'credit_card' ? 'var(--expense)' : acc.balance < 0 ? 'var(--expense)' : 'var(--text-primary)'
                  }}
                >
                  {formatCurrency(acc.balance)}
                </div>

                {acc.type === 'credit_card' && acc.creditLimit && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>可用額度：{formatCurrency(Math.max(0, acc.creditLimit - Math.abs(acc.balance)))}</span>
                      <span>已用 {((Math.abs(acc.balance) / acc.creditLimit) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (Math.abs(acc.balance) / acc.creditLimit) * 100)}%`,
                          height: '100%',
                          backgroundColor: (Math.abs(acc.balance) / acc.creditLimit) > 0.8 ? 'var(--expense)' : 'var(--warning)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      />
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
