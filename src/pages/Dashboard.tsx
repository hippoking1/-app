import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { useAccounts, useTransactions, useCategories, useBudgets, useStockHoldings, useTotalNetWorth, useSubscriptions } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { formatCurrency } from '@/utils/analytics';
import { calculateBudgetStatuses, getDailyAllowance, isLivingExpense } from '@/utils/budget';
import { calculatePortfolioSummary } from '@/utils/stockCalculations';
import { calculateCashWalletUsage, calculateCreditCardUsage } from '@/utils/accountCalculations';
import {
  Bot,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Target,
  ChevronRight,
  Building2,
  CalendarClock
} from 'lucide-react';
import { getSafeIcon } from '@/utils/iconHelper';
import { parseISO, differenceInDays } from 'date-fns';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentMonth, setTransactionModalOpen } = useAppStore();

  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { transactions } = useTransactions({ month: currentMonth });
  const { transactions: allTransactions } = useTransactions();
  const { budgets } = useBudgets();
  const { holdings } = useStockHoldings();
  const { subscriptions } = useSubscriptions();
  const { totalNetWorth, cashTotal, stockTotalTWD } = useTotalNetWorth();

  // 未來 7 天即將扣款的定期訂閱
  const today = new Date();
  const upcomingSubscriptions = subscriptions.filter((sub) => {
    if (sub.status !== 'active' || !sub.nextBillingDate) return false;
    try {
      const billDate = parseISO(sub.nextBillingDate);
      const diff = differenceInDays(billDate, today);
      return diff >= 0 && diff <= 7;
    } catch {
      return false;
    }
  });

  // 本月生活收支計算 (自動排除投資股票交易)
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const monthIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = transactions
    .filter((t) => isLivingExpense(t, categoryMap))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  // 預算狀態
  const budgetStatuses = calculateBudgetStatuses(budgets, transactions, categories, currentMonth);
  const globalBudget = budgetStatuses.find((b) => !b.budget.categoryId) || budgetStatuses[0];
  const { dailyAllowance, remainingDays } = getDailyAllowance(
    globalBudget ? globalBudget.budget.amount : 0,
    globalBudget ? globalBudget.spent : 0,
    currentMonth
  );

  // 股票投資組合摘要
  const portfolioSummary = calculatePortfolioSummary(holdings);

  // 現金 vs 股票資產配置比例
  const positiveBase = Math.max(0, cashTotal) + Math.max(0, stockTotalTWD);
  const cashRatio = positiveBase > 0 ? Math.round((Math.max(0, cashTotal) / positiveBase) * 100) : 100;

  // 最近 6 筆交易
  const recentTransactions = transactions.slice(0, 6);
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部頁面標題與核心操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            財務總覽
          </h1>
          <p className="font-mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {currentMonth} 月度帳務摘要
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/ai')}
            icon={<Bot size={16} strokeWidth={1.5} />}
          >
            AI 記帳
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTransactionModalOpen(true)}
            icon={<Plus size={16} strokeWidth={1.5} />}
          >
            記一筆
          </Button>
        </div>
      </div>

      {/* KPI 主副視覺層次：主淨資產卡 (跨寬或獨立比例條) + 兩張緊湊數據卡 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-4)'
        }}
      >
        {/* 1. 總資產卡片 (含現金/股票配置比例條) */}
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
              淨資產估計
            </div>
            <div className="font-mono" style={{ fontSize: '30px', fontWeight: 500, marginTop: '8px', color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {formatCurrency(totalNetWorth)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* 資產構成比例條 */}
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${cashRatio}%`, height: '100%', backgroundColor: 'var(--text-secondary)' }} />
              <div style={{ width: `${100 - cashRatio}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
            </div>

            <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }} />
                現金 {formatCurrency(cashTotal)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                股票 {formatCurrency(stockTotalTWD)}
              </span>
            </div>
          </div>
        </Card>

        {/* 2. 本月收支結餘卡片 */}
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
              本月收支結餘
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '30px',
                fontWeight: 500,
                marginTop: '8px',
                lineHeight: 1.1,
                color: monthBalance >= 0 ? 'var(--income)' : 'var(--expense)'
              }}
            >
              {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)}
            </div>
          </div>

          <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--income)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDownLeft size={14} strokeWidth={1.5} /> 收入 {formatCurrency(monthIncome)}
            </span>
            <span style={{ color: 'var(--expense)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={14} strokeWidth={1.5} /> 支出 {formatCurrency(monthExpense)}
            </span>
          </div>
        </Card>

        {/* 3. 股票投資組合損益 (連動台/美股紅漲綠跌偏好) */}
        <Card interactive padding="lg" onClick={() => navigate('/stocks')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                投資組合損益
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '30px',
                  fontWeight: 500,
                  marginTop: '8px',
                  lineHeight: 1.1,
                  color: portfolioSummary.totalProfitLossTWD >= 0 ? 'var(--gain)' : 'var(--loss)'
                }}
              >
                {portfolioSummary.totalProfitLossTWD >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.totalProfitLossTWD)}
              </div>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: portfolioSummary.totalReturnRate >= 0 ? 'var(--gain)' : 'var(--loss)',
                backgroundColor: portfolioSummary.totalReturnRate >= 0 ? 'var(--gain-subtle)' : 'var(--loss-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)'
              }}
            >
              {portfolioSummary.totalReturnRate >= 0 ? '+' : ''}{portfolioSummary.totalReturnRate}%
            </span>
          </div>

          <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>市值 {formatCurrency(portfolioSummary.totalMarketValueTWD)}</span>
            <span style={{ color: 'var(--accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              持倉明細 <ChevronRight size={14} strokeWidth={1.5} />
            </span>
          </div>
        </Card>
      </div>

      {/* 未來 7 天即將扣款訂閱提醒 */}
      {upcomingSubscriptions.length > 0 && (
        <Card padding="md" style={{ borderLeft: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarClock size={16} strokeWidth={1.5} color="var(--accent-text)" />
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                未來 7 天到期訂閱 ({upcomingSubscriptions.length} 筆)
              </span>
            </div>
            <button
              onClick={() => navigate('/transactions')}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-text)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            >
              查看明細
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {upcomingSubscriptions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  minWidth: '164px',
                  flexShrink: 0
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{sub.name}</div>
                <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{sub.nextBillingDate}</span>
                  <span style={{ fontWeight: 500, color: 'var(--expense)' }}>
                    NT$ {sub.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 本月總預算執行進度 */}
      {globalBudget && (
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--accent-text)' }}>
                <Target size={16} strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  本月總預算執行進度
                </div>
                <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  已支出 {formatCurrency(globalBudget.spent)} / 上限 {formatCurrency(globalBudget.budget.amount)}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>每日建議可花費</span>
              <div className="font-mono" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                {formatCurrency(dailyAllowance)} / 天 · 剩 {remainingDays} 天
              </div>
            </div>
          </div>

          <ProgressBar value={globalBudget.usageRatio * 100} max={100} height={8} showLabel />
        </Card>
      )}

      {/* 下半部：不對稱雙欄帳本視圖 (左寬最近交易，右窄帳戶列表) */}
      <div className="grid-ledger-split">
        {/* 左欄：最近交易記錄 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
              最近交易記錄
            </h3>
            <button
              onClick={() => navigate('/transactions')}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-text)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
            >
              全部明細 <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentTransactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                category={categoryMap.get(tx.categoryId)}
                account={accountMap.get(tx.accountId)}
                targetAccount={tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined}
              />
            ))}

            {recentTransactions.length === 0 && (
              <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                本月尚無交易記錄，點擊「記一筆」開始記錄
              </Card>
            )}
          </div>
        </div>

        {/* 右欄：帳戶資產清單 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
              帳戶資產分佈
            </h3>
            <button
              onClick={() => navigate('/accounts')}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-text)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
            >
              管理帳戶 <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          <Card padding="none">
            {accounts.map((acc, index) => {
              const IconComponent = getSafeIcon(acc.icon, Building2);
              let displayLabel = '';
              let displayAmount = formatCurrency(acc.balance);
              let amountColor = acc.balance < 0 ? 'var(--expense)' : 'var(--text-primary)';

              if (acc.type === 'credit_card') {
                const cardUsage = calculateCreditCardUsage(acc, allTransactions);
                displayLabel = `結帳日 ${acc.billingCycleDay || 10} 號`;
                displayAmount = formatCurrency(cardUsage.usedAmount);
                amountColor = 'var(--expense)';
              } else if (acc.type === 'cash' && acc.balance === 0) {
                const cashUsage = calculateCashWalletUsage(acc, allTransactions);
                displayLabel = '本月純額度已用';
                displayAmount = formatCurrency(cashUsage.currentMonthSpent);
                amountColor = 'var(--text-primary)';
              }

              return (
                <div
                  key={acc.id}
                  onClick={() => navigate('/accounts')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: index < accounts.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background-color 0.15s var(--ease-out)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
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
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComponent size={16} strokeWidth={1.5} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acc.name}
                      </div>
                      {displayLabel && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {displayLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="font-mono" style={{ fontSize: '14px', fontWeight: 500, color: amountColor, flexShrink: 0 }}>
                    {displayAmount}
                  </div>
                </div>
              );
            })}
            {accounts.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                尚未建立帳戶
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
