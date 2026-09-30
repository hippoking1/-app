import React, { useState, useMemo } from 'react';
import { Subscription, Account, Category } from '@/types';
import { useSubscriptions, useAccounts, useCategories } from '@/hooks/useFirestore';
import { cancelSubscription, reactivateSubscription, deleteSubscription, addTransaction, saveSubscription } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/analytics';
import { getDaysUntilNextBilling, calculateNextBillingDate } from '@/utils/subscriptionUtils';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { getSafeIcon } from '@/utils/iconHelper';

interface SubscriptionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewSubscription?: () => void;
}

export const SubscriptionManagerModal: React.FC<SubscriptionManagerModalProps> = ({
  isOpen,
  onClose,
  onOpenNewSubscription
}) => {
  const { user, addToast } = useAppStore();
  const { subscriptions, loading } = useSubscriptions();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'cancelled'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // 篩選
  const filteredSubs = useMemo(() => {
    if (filterTab === 'active') return subscriptions.filter((s) => s.status === 'active');
    if (filterTab === 'cancelled') return subscriptions.filter((s) => s.status === 'cancelled');
    return subscriptions;
  }, [subscriptions, filterTab]);

  // 統計進行中訂閱與月預估總支出
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === 'active'), [subscriptions]);
  const monthlyTotal = useMemo(() => {
    return activeSubs.reduce((sum, s) => {
      if (s.period === 'yearly') return sum + Math.round(s.amount / 12);
      if (s.period === 'weekly') return sum + Math.round(s.amount * 4.33);
      return sum + s.amount;
    }, 0);
  }, [activeSubs]);

  // 取消訂閱 (隨時停止自動紀錄)
  const handleCancel = async (sub: Subscription) => {
    if (!user) return;
    const ok = window.confirm(
      `確定要取消「${sub.name}」的訂閱服務嗎？\n\n取消後系統將立即【停止自動紀錄扣款】，隨後您也可以隨時恢復。`
    );
    if (!ok) return;

    setProcessingId(sub.id);
    try {
      await cancelSubscription(user.uid, sub.id);
      addToast({
        type: 'info',
        message: `已取消「${sub.name}」訂閱，已全面停止未來的自動紀錄！`
      });
    } catch (err: any) {
      addToast({ type: 'error', message: '操作失敗: ' + err.message });
    } finally {
      setProcessingId(null);
    }
  };

  // 恢復訂閱 (重啟自動扣款排程)
  const handleReactivate = async (sub: Subscription) => {
    if (!user) return;
    setProcessingId(sub.id);
    try {
      await reactivateSubscription(user.uid, sub.id);
      addToast({
        type: 'success',
        message: `已恢復「${sub.name}」訂閱！系統已重新排定自動紀錄。`
      });
    } catch (err: any) {
      addToast({ type: 'error', message: '操作失敗: ' + err.message });
    } finally {
      setProcessingId(null);
    }
  };

  // 徹底刪除訂閱
  const handleDelete = async (sub: Subscription) => {
    if (!user) return;
    const ok = window.confirm(
      `確定要刪除「${sub.name}」訂閱項目設定嗎？\n（歷史已產生的扣款記帳將予以保留）`
    );
    if (!ok) return;

    setProcessingId(sub.id);
    try {
      await deleteSubscription(user.uid, sub.id);
      addToast({ type: 'info', message: `已移除「${sub.name}」訂閱項目` });
    } catch (err: any) {
      addToast({ type: 'error', message: '刪除失敗: ' + err.message });
    } finally {
      setProcessingId(null);
    }
  };

  // 手動立即補記一筆當期扣款
  const handleRecordNow = async (sub: Subscription) => {
    if (!user) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const ok = window.confirm(
      `確定要立即為「${sub.name}」補記一筆今日 (${todayStr}) 的支出扣款嗎？`
    );
    if (!ok) return;

    setProcessingId(sub.id);
    try {
      const now = new Date().toISOString();
      const txId = 'tx_sub_' + uuidv4().slice(0, 10);
      await addTransaction({
        id: txId,
        userId: user.uid,
        accountId: sub.accountId,
        categoryId: sub.categoryId,
        type: 'expense',
        amount: sub.amount,
        merchant: sub.name,
        note: `${sub.name} (手動補記訂閱扣款)`,
        tags: Array.from(new Set([...(sub.tags || []), '訂閱付款'])),
        date: todayStr,
        subscription: {
          subscriptionId: sub.id,
          period: sub.period
        },
        createdAt: now,
        updatedAt: now
      });

      // 更新訂閱的下次扣款日
      const nextDate = calculateNextBillingDate(todayStr, sub.period, sub.billingCycleDay);
      await saveSubscription({
        ...sub,
        lastRecordedDate: todayStr,
        nextBillingDate: nextDate,
        updatedAt: now
      });

      addToast({
        type: 'success',
        message: `已為「${sub.name}」成功記錄今日 NT$ ${sub.amount.toLocaleString()} 支出！`
      });
    } catch (err: any) {
      addToast({ type: 'error', message: '記錄失敗: ' + err.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💳 信用卡訂閱服務管理">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 頂部總結看板 */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              進行中信用卡訂閱
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span className="font-mono" style={{ fontSize: '26px', fontWeight: 900, color: 'var(--primary-light)' }}>
                {activeSubs.length}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>項服務</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              每月平均固定訂閱支出
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '22px',
                fontWeight: 900,
                color: 'var(--expense)',
                marginTop: '2px'
              }}
            >
              {formatCurrency(monthlyTotal)}
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>
                / 月
              </span>
            </div>
          </div>
        </div>

        {/* 說明橫幅 */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={16} color="var(--primary-light)" style={{ flexShrink: 0 }} />
          <span>
            信用卡訂閱付款將於指定扣款日由系統<strong>自行紀錄支出</strong>並計入信用卡本期帳單；您可<strong>隨時取消訂閱</strong>以停止自動紀錄。
          </span>
        </div>

        {/* 篩選 Tab 與 新增按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: '3px'
            }}
          >
            {[
              { key: 'all', label: `全部 (${subscriptions.length})` },
              { key: 'active', label: `訂閱中 (${activeSubs.length})` },
              { key: 'cancelled', label: `已取消 (${subscriptions.length - activeSubs.length})` }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key as any)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: filterTab === tab.key ? 'var(--primary)' : 'transparent',
                  color: filterTab === tab.key ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onOpenNewSubscription && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onClose();
                onOpenNewSubscription();
              }}
              icon={<Plus size={14} />}
            >
              新增訂閱
            </Button>
          )}
        </div>

        {/* 訂閱卡片列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' }}>
          {filteredSubs.map((sub) => {
            const acc = accountMap.get(sub.accountId);
            const cat = categoryMap.get(sub.categoryId);
            const CatIcon = getSafeIcon(cat?.icon);
            const daysLeft = getDaysUntilNextBilling(sub.nextBillingDate);
            const isActive = sub.status === 'active';
            const isBusy = processingId === sub.id;

            return (
              <div
                key={sub.id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: isActive ? '1px solid var(--border)' : '1px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  opacity: isActive ? 1 : 0.65,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* 第一列：標題、狀態、金額 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: cat ? `${cat.color}20` : 'rgba(99,102,241,0.15)',
                        color: cat?.color || 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <CatIcon size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {sub.name}
                        </span>
                        {isActive ? (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              borderRadius: 'var(--radius-full)',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                            自動紀錄中
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: 'var(--expense)',
                              borderRadius: 'var(--radius-full)',
                              fontWeight: 700
                            }}
                          >
                            已取消訂閱 (已停止紀錄)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <CreditCard size={12} />
                          {acc?.name || '指定信用卡'}
                        </span>
                        {cat && (
                          <>
                            <span>•</span>
                            <span style={{ color: cat.color }}>{cat.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 金額與頻率 */}
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      NT$ {sub.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {sub.period === 'yearly' ? '年繳' : sub.period === 'weekly' ? '週繳' : '月繳'}
                    </div>
                  </div>
                </div>

                {/* 第二列：扣款時程與天數提醒 */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <span>指定扣款日：每月 <strong>{sub.billingCycleDay}</strong> 號</span>
                    <span>•</span>
                    <span>
                      下次扣款日：<strong>{sub.nextBillingDate}</strong>
                    </span>
                  </div>

                  {isActive && (
                    <div>
                      {daysLeft === 0 ? (
                        <span style={{ color: 'var(--expense)', fontWeight: 700 }}>今日扣款</span>
                      ) : daysLeft > 0 ? (
                        <span style={{ color: daysLeft <= 3 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                          剩餘 {daysLeft} 天
                        </span>
                      ) : (
                        <span style={{ color: 'var(--expense)', fontWeight: 700 }}>排程處理中</span>
                      )}
                    </div>
                  )}
                </div>

                {/* 第三列：操作按鈕群 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  {isActive ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRecordNow(sub)}
                        disabled={isBusy}
                        icon={<RotateCcw size={13} />}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        立即補記本期
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCancel(sub)}
                        disabled={isBusy}
                        icon={<XCircle size={13} />}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          color: 'var(--expense)',
                          borderColor: 'rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        取消訂閱 (停止自動紀錄)
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleReactivate(sub)}
                      disabled={isBusy}
                      icon={<Play size={13} />}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      恢復訂閱 (重啟自動扣款)
                    </Button>
                  )}

                  <button
                    onClick={() => handleDelete(sub)}
                    disabled={isBusy}
                    title="刪除訂閱設定"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-disabled)',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--expense)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-disabled)')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredSubs.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <CreditCard size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>尚無相關訂閱項目</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                在記帳支出時開啟「信用卡訂閱付款」，即可在此集中管理並在指定時間自行紀錄！
              </div>
            </div>
          )}
        </div>

        {/* 底部關閉 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </Modal>
  );
};
