import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTransactions, useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { getMonthlyTrends, getCategoryBreakdown, getDailySpending, formatCurrency } from '@/utils/analytics';
import { fetchSpendingInsights } from '@/services/gas';
import { CategoryTrendsChart } from '@/components/analytics/CategoryTrendsChart';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Bot, BarChart3 } from 'lucide-react';

// 每日花費柱狀圖 Tooltip
const BarCustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0]?.value || 0;
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-focus)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--text-primary)'
      }}
    >
      <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>支出</span>
        <span className="font-mono" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {formatCurrency(Number(value) || 0)}
        </span>
      </div>
    </div>
  );
};

export const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { currentMonth, aiConfig, addToast } = useAppStore();
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  const [insightText, setInsightText] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // 1. 月趨勢
  const monthlyData = getMonthlyTrends(transactions, 6);

  // 2. 分類佔比
  const expenseBreakdown = getCategoryBreakdown(transactions, categories, 'expense', currentMonth);

  // 3. 每日花費與峰值日
  const { dailyData, totalExpense, avgDaily } = getDailySpending(transactions, currentMonth);
  const maxDailyAmount = useMemo(() => {
    return dailyData.reduce((max, item) => Math.max(max, item.amount), 0);
  }, [dailyData]);

  // AI 洞察分析請求
  const handleGenerateInsights = async () => {
    if (!aiConfig.apiKey.trim() || !aiConfig.isKeyValid || !aiConfig.selectedModel) {
      addToast({
        type: 'warning',
        message: '請先至「系統設定」輸入個人 API Key 並選擇 AI 模型'
      });
      navigate('/settings');
      return;
    }

    setLoadingInsights(true);
    try {
      const summaryPayload = {
        month: currentMonth,
        totalExpense,
        avgDaily,
        topCategories: expenseBreakdown.items.slice(0, 3).map((c) => ({ name: c.name, amount: c.amount })),
        monthlyTrend: monthlyData
      };
      const text = await fetchSpendingInsights(summaryPayload);
      setInsightText(text);
    } catch (err: any) {
      setInsightText(`目前無法取得 AI 分析報告：${err.message || '請確認 API Key 與模型設定'}`);
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部標題與 AI 分析觸發按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            花費分析
          </h1>
          <p className="font-mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {currentMonth} 支出趨勢、分類佔比與每日花費分佈
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleGenerateInsights}
          loading={loadingInsights}
          icon={<Bot size={16} strokeWidth={1.5} />}
        >
          產出 AI 財務健檢 {aiConfig.selectedModel ? `(${aiConfig.selectedModel})` : ''}
        </Button>
      </div>

      {/* AI 財務健檢建議卡片 */}
      {insightText && (
        <Card padding="lg" style={{ borderLeft: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-text)', fontWeight: 500, fontSize: '14px' }}>
            <Bot size={16} strokeWidth={1.5} /> {aiConfig.selectedModel || 'AI'} 財務洞察報告
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {insightText}
          </div>
        </Card>
      )}

      {/* 1. 主圖表：各類支出趨勢折線圖 */}
      <CategoryTrendsChart transactions={transactions} categories={categories} />

      {/* 2. 支出排行榜 (左窄) + 本月每日花費柱狀圖 (右寬) */}
      <div className="grid-ledger-split">
        {/* 支出分類排行長條清單 */}
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
              本月支出排行
            </h3>
            <span className="font-mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              總計 {formatCurrency(expenseBreakdown.totalAmount)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expenseBreakdown.items.slice(0, 6).map((item, index) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: index === 0 ? 500 : 400, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="font-mono" style={{ color: index === 0 ? 'var(--accent-text)' : 'var(--text-muted)', fontSize: '12px', width: '16px' }}>
                      {index + 1}.
                    </span>
                    {item.name}
                  </span>
                  <span className="font-mono" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {formatCurrency(item.amount)}{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({item.percentage}%)</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: '100%',
                      backgroundColor: index === 0 ? 'var(--accent)' : 'var(--text-muted)',
                      opacity: index === 0 ? 1 : Math.max(0.35, 0.85 - index * 0.12),
                      borderRadius: 'var(--radius-xs)'
                    }}
                  />
                </div>
              </div>
            ))}

            {expenseBreakdown.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                本月尚無支出記錄
              </div>
            )}
          </div>
        </Card>

        {/* 本月每日花費柱狀圖 */}
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <BarChart3 size={16} strokeWidth={1.5} color="var(--text-secondary)" /> 本月每日花費
            </h3>
            <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              日均 {formatCurrency(avgDaily)}
            </span>
          </div>

          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  interval={2}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickFormatter={(val) => (val >= 10000 ? `${(val / 10000).toFixed(0)}萬` : `$${val}`)}
                />
                <Tooltip content={<BarCustomTooltip />} cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.4 }} />
                <Bar dataKey="amount" name="花費" radius={[3, 3, 0, 0]}>
                  {dailyData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={entry.amount > 0 && entry.amount === maxDailyAmount ? 'var(--accent)' : 'var(--text-disabled)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
