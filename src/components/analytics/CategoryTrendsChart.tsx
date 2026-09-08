import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Transaction, Category } from '@/types';
import {
  getMonthsInRange,
  getCategoryMonthlyTrends,
  TimeRangePreset,
  formatCurrency
} from '@/utils/analytics';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { TrendingUp, Calendar, CheckSquare, RotateCcw, Activity } from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface CategoryTrendsChartProps {
  transactions: Transaction[];
  categories: Category[];
}

const PRESETS: { id: TimeRangePreset; label: string }[] = [
  { id: '3m', label: '近 3 個月' },
  { id: '6m', label: '近 6 個月' },
  { id: '12m', label: '近 1 年' },
  { id: 'ytd', label: '今年以來' },
  { id: 'custom', label: '自訂區間' }
];

export const CategoryTrendsChart: React.FC<CategoryTrendsChartProps> = ({
  transactions,
  categories
}) => {
  const now = useMemo(() => new Date(), []);
  const defaultEnd = useMemo(() => format(now, 'yyyy-MM'), [now]);
  const defaultStart = useMemo(() => format(subMonths(now, 5), 'yyyy-MM'), [now]);

  // 區間選擇狀態
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>('6m');
  const [customStart, setCustomStart] = useState<string>(defaultStart);
  const [customEnd, setCustomEnd] = useState<string>(defaultEnd);

  // 選取的月份清單
  const selectedMonths = useMemo(() => {
    return getMonthsInRange(rangePreset, customStart, customEnd);
  }, [rangePreset, customStart, customEnd]);

  // 各分類趨勢數據
  const { chartData, activeCategories } = useMemo(() => {
    return getCategoryMonthlyTrends(transactions, categories, selectedMonths);
  }, [transactions, categories, selectedMonths]);

  // 分類顯示篩選：null 代表尚未手動設定（預設全選或前 5 大）
  const [selectedCatIds, setSelectedCatIds] = useState<string[] | null>(null);

  // 總支出輔助參考線開關
  const [showTotalLine, setShowTotalLine] = useState<boolean>(false);

  // 當前應顯示的分類 ID 列表
  const displayedCatIds = useMemo(() => {
    if (selectedCatIds !== null) {
      return selectedCatIds;
    }
    // 預設若分類 <= 5 全部顯示，否則預設勾選花費最高的前 5 大
    return activeCategories.slice(0, 5).map((c) => c.id);
  }, [selectedCatIds, activeCategories]);

  // 切換單個分類顯示
  const handleToggleCategory = (id: string) => {
    if (displayedCatIds.includes(id)) {
      setSelectedCatIds(displayedCatIds.filter((cId) => cId !== id));
    } else {
      setSelectedCatIds([...displayedCatIds, id]);
    }
  };

  // 全選
  const handleSelectAll = () => {
    setSelectedCatIds(activeCategories.map((c) => c.id));
  };

  // 重置回預設（前 5 大）
  const handleResetTop5 = () => {
    setSelectedCatIds(null);
  };

  // 區間字串摘要
  const rangeSummary = useMemo(() => {
    if (selectedMonths.length === 0) return '';
    const first = selectedMonths[0].replace('-', '/');
    const last = selectedMonths[selectedMonths.length - 1].replace('-', '/');
    return `${first} ~ ${last}（共 ${selectedMonths.length} 個月）`;
  }, [selectedMonths]);

  // 自訂 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const fullMonth = payload[0]?.payload?.fullMonth || label;
    const monthTotal = payload[0]?.payload?.totalExpense || 0;

    // 依金額降序排列，僅顯示有支出的分類
    const sortedItems = [...payload]
      .filter((p: any) => p.dataKey !== 'totalExpense' && Number(p.value) > 0)
      .sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));

    const totalItem = payload.find((p: any) => p.dataKey === 'totalExpense');

    return (
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-lg)',
          minWidth: '220px',
          backdropFilter: 'blur(16px)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '8px',
            marginBottom: '8px'
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
            {fullMonth}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--expense)', fontWeight: 700 }}>
            當月總支出: {formatCurrency(monthTotal)}
          </span>
        </div>

        {sortedItems.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
            本月無選取分類之支出
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sortedItems.map((item: any) => {
              const amt = Number(item.value) || 0;
              const pct = monthTotal > 0 ? ((amt / monthTotal) * 100).toFixed(1) : '0.0';
              return (
                <div
                  key={item.dataKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        display: 'inline-block',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(amt)}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '38px', textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showTotalLine && totalItem && (
          <div
            style={{
              marginTop: '8px',
              paddingTop: '6px',
              borderTop: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <span>總支出參考線</span>
            <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(Number(totalItem.value) || 0)}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 標題與區間切換控制列 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-primary)'
            }}
          >
            <TrendingUp size={18} color="var(--primary-light)" /> 各類支出趨勢折線圖
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {rangeSummary}
          </span>
        </div>

        {/* 區間快選標籤 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '3px',
              borderRadius: 'var(--radius-md)',
              gap: '2px'
            }}
          >
            {PRESETS.map((preset) => {
              const isActive = rangePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setRangePreset(preset.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 自訂區間選擇器 */}
      {rangePreset === 'custom' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Calendar size={15} color="var(--primary-light)" /> 自訂顯示區間：
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="month"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                colorScheme: 'dark',
                cursor: 'pointer'
              }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>至</span>
            <input
              type="month"
              value={customEnd}
              min={customStart}
              max={defaultEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 10px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                colorScheme: 'dark',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      )}

      {/* 分類篩選與控制晶片列 */}
      {activeCategories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* 工具列 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              點選分類可單獨開啟/關閉折線：
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleSelectAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <CheckSquare size={12} /> 全選
              </button>

              <button
                onClick={handleResetTop5}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={12} /> 前 5 大
              </button>

              <button
                onClick={() => setShowTotalLine(!showTotalLine)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: showTotalLine ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: `1px solid ${showTotalLine ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '11px',
                  color: showTotalLine ? 'var(--primary-light)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <Activity size={12} /> 總支出參考線
              </button>
            </div>
          </div>

          {/* 分類 Chips 清單 */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          >
            {activeCategories.map((cat) => {
              const isSelected = displayedCatIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleToggleCategory(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                    border: `1.5px solid ${isSelected ? cat.color : 'var(--border)'}`,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    opacity: isSelected ? 1 : 0.4
                  }}
                  title={`區間累計：${formatCurrency(cat.total)}`}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: cat.color,
                      boxShadow: isSelected ? `0 0 6px ${cat.color}` : 'none'
                    }}
                  />
                  <span>{cat.name}</span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '11px',
                      opacity: isSelected ? 0.85 : 0.6
                    }}
                  >
                    {formatCurrency(cat.total)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 折線圖區域 */}
      {activeCategories.length === 0 ? (
        <div
          style={{
            height: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            gap: '8px'
          }}
        >
          <Calendar size={32} style={{ opacity: 0.4 }} />
          <span>所選區間內尚無任何支出記錄</span>
        </div>
      ) : (
        <div style={{ width: '100%', height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(val) =>
                  val >= 10000 ? `${(val / 10000).toFixed(0)}萬` : `$${val}`
                }
              />
              <Tooltip content={<CustomTooltip />} />

              {/* 總支出對照參考線 */}
              {showTotalLine && (
                <Line
                  type="monotone"
                  dataKey="totalExpense"
                  name="總支出"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#94a3b8' }}
                  activeDot={{ r: 5 }}
                />
              )}

              {/* 各分類支出折線 */}
              {activeCategories.map((cat) => {
                if (!displayedCatIds.includes(cat.id)) return null;
                return (
                  <Line
                    key={cat.id}
                    type="monotone"
                    dataKey={cat.id}
                    name={cat.name}
                    stroke={cat.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: cat.color }}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 1.5 }}
                    isAnimationActive={true}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
