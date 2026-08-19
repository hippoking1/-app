import React, { useState } from 'react';
import { StockHolding, StockSearchResult, StockMarket } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { saveStockHolding } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { calculateTWStockFee, calculateTWStockTax } from '@/utils/stockCalculations';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

type FormMode = 'init' | 'buy' | 'sell';

interface StockTradeFormProps {
  stock?: StockSearchResult | StockHolding;
  initialMode?: FormMode;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const StockTradeForm: React.FC<StockTradeFormProps> = ({
  stock,
  initialMode = 'init',
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();

  const isExistingHolding = Boolean((stock as StockHolding)?.shares);
  const [mode, setMode] = useState<FormMode>(isExistingHolding ? 'buy' : initialMode);
  
  const [symbol, setSymbol] = useState(() => {
    return stock?.symbol || sessionStorage.getItem('draft_stock_symbol') || '2330.TW';
  });
  const [name, setName] = useState(() => {
    return stock?.name || sessionStorage.getItem('draft_stock_name') || '台積電';
  });
  const [market, setMarket] = useState<StockMarket>(stock?.market || 'TW');
  const [shares, setShares] = useState<string>(() => {
    return isExistingHolding ? '1000' : sessionStorage.getItem('draft_stock_shares') || '1000';
  });
  
  // 成本單價與現價
  const [costPrice, setCostPrice] = useState<string>(() => {
    return stock
      ? String((stock as any).avgCost || (stock as any).price || (stock as any).currentPrice || '')
      : sessionStorage.getItem('draft_stock_cost') || '';
  });
  const [currentPrice, setCurrentPrice] = useState<string>(
    stock ? String((stock as any).currentPrice || (stock as any).price || (stock as any).avgCost || '') : ''
  );
  
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState(() => sessionStorage.getItem('draft_stock_note') || '');
  const [loading, setLoading] = useState(false);

  const clearStockDraft = () => {
    sessionStorage.removeItem('draft_stock_symbol');
    sessionStorage.removeItem('draft_stock_name');
    sessionStorage.removeItem('draft_stock_shares');
    sessionStorage.removeItem('draft_stock_cost');
    sessionStorage.removeItem('draft_stock_note');
  };

  // 試算金額
  const numShares = parseFloat(shares) || 0;
  const numCost = parseFloat(costPrice) || 0;
  const numCurrent = parseFloat(currentPrice) || numCost;
  const totalCostAmount = numShares * numCost;
  const autoFee = market === 'TW' ? calculateTWStockFee(totalCostAmount) : 0;
  const autoTax = market === 'TW' && mode === 'sell' ? calculateTWStockTax(totalCostAmount) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!symbol.trim() || !name.trim()) {
      addToast({ type: 'error', message: '請輸入股票代碼與名稱' });
      return;
    }

    if (!numShares || numShares <= 0 || !numCost || numCost <= 0) {
      addToast({ type: 'error', message: '請輸入正確的持有股數與買進成本價' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const holdingId = (stock as StockHolding)?.id || 'stock_' + uuidv4().slice(0, 8);

      let finalShares = numShares;
      let finalAvgCost = numCost;
      const finalCurrentPrice = numCurrent > 0 ? numCurrent : numCost;

      if (isExistingHolding) {
        const oldShares = (stock as StockHolding).shares || 0;
        const oldAvgCost = (stock as StockHolding).avgCost || 0;
        if (mode === 'buy') {
          finalShares = oldShares + numShares;
          finalAvgCost = (oldShares * oldAvgCost + numShares * numCost) / finalShares;
        } else if (mode === 'sell') {
          finalShares = Math.max(0, oldShares - numShares);
          finalAvgCost = oldAvgCost;
        }
      }

      const holding: StockHolding = {
        id: holdingId,
        userId: user.uid,
        symbol: symbol.toUpperCase().includes('.TW') || market === 'US' ? symbol.toUpperCase() : `${symbol.toUpperCase()}.TW`,
        code: symbol.replace('.TW', '').toUpperCase(),
        name: name.trim(),
        market,
        shares: finalShares,
        avgCost: parseFloat(finalAvgCost.toFixed(2)),
        currentPrice: finalCurrentPrice,
        currency: market === 'TW' ? 'TWD' : 'USD',
        createdAt: (stock as StockHolding)?.createdAt || now,
        updatedAt: now
      };

      await saveStockHolding(holding);
      clearStockDraft();
      addToast({
        type: 'success',
        message: mode === 'init'
          ? `成功建立初始持倉「${holding.name}」！`
          : mode === 'buy'
          ? `成功加碼買入「${holding.name}」！`
          : `成功賣出「${holding.name}」！`
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 模式切換 Tab */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
        {!isExistingHolding ? (
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'default'
            }}
          >
            🎯 建立初始持倉 / 興櫃持股建檔
          </button>
        ) : (
          (['buy', 'sell'] as FormMode[]).map((m) => {
            const isActive = mode === m;
            const label = m === 'buy' ? '📈 買進加碼' : '📉 賣出減碼';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? (m === 'buy' ? 'var(--income)' : 'var(--expense)') : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            );
          })
        )}
      </div>

      {/* 股票市場與代碼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
        <Select
          label="市場類別"
          value={market}
          onChange={(e) => setMarket(e.target.value as StockMarket)}
          options={[
            { value: 'TW', label: '🇹🇼 台股/興櫃' },
            { value: 'US', label: '🇺🇸 美股市場' }
          ]}
        />
        <Input
          label="股票代碼 (支援興櫃代碼例如 6789、2330)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="例如：2330、6789、AAPL"
          required
        />
      </div>

      {/* 股票名稱 */}
      <Input
        label="公司 / 股票名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例如：台積電、聯發科、興櫃精選"
        required
      />

      {/* 股數與買進成本價 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          label={`持有股數 (${market === 'TW' ? '1張=1000股' : '股'})`}
          type="number"
          step="any"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="例如：1000、250"
          required
        />
        <Input
          label={`平均買進成本價 (${market === 'TW' ? 'NT$' : 'US$'})`}
          type="number"
          step="any"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          placeholder="例如：85.5、980"
          required
        />
      </div>

      {/* 最新參考現價 (自訂/興櫃用) */}
      {!isExistingHolding && (
        <Input
          label={`目前參考市價 (${market === 'TW' ? 'NT$' : 'US$'}，若留空自動同步成本價)`}
          type="number"
          step="any"
          value={currentPrice}
          onChange={(e) => setCurrentPrice(e.target.value)}
          placeholder="可輸入目前最新市價"
        />
      )}

      {/* 自動試算卡片 */}
      <div
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
          <span>持倉總成本估計：</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {market === 'TW' ? '$' : 'US$'}
            {Math.round(totalCostAmount).toLocaleString()}
          </strong>
        </div>
        {market === 'TW' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>預估手續費 / 證交稅：</span>
            <span>
              ${autoFee} / ${autoTax}
            </span>
          </div>
        )}
      </div>

      {/* 建倉日期與投資筆記 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label="建倉 / 交易日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="投資策略 / 備註"
          placeholder="例如：興櫃潛力股、定期定額"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-2)' }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
          確認建立持倉
        </Button>
      </div>
    </form>
  );
};
