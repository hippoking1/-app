import React, { useState } from 'react';
import { StockHolding, StockSearchResult, StockTradeType } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { saveStockHolding } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { calculateTWStockFee, calculateTWStockTax } from '@/utils/stockCalculations';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

interface StockTradeFormProps {
  stock?: StockSearchResult | StockHolding;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const StockTradeForm: React.FC<StockTradeFormProps> = ({
  stock,
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();

  const [tradeType, setTradeType] = useState<StockTradeType>('buy');
  const [symbol, setSymbol] = useState(stock?.symbol || '2330.TW');
  const [name, setName] = useState(stock?.name || '台積電');
  const [market, setMarket] = useState<'TW' | 'US'>(stock?.market || 'TW');
  const [shares, setShares] = useState<string>('1000');
  const [price, setPrice] = useState<string>(
    stock ? String((stock as any).currentPrice || (stock as any).price || (stock as any).avgCost || '') : ''
  );
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customFee, setCustomFee] = useState<string>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  // 自動估算手續費與稅費 (台股)
  const numShares = parseFloat(shares) || 0;
  const numPrice = parseFloat(price) || 0;
  const totalAmount = numShares * numPrice;
  const autoFee = market === 'TW' ? calculateTWStockFee(totalAmount) : 0;
  const autoTax = market === 'TW' && tradeType === 'sell' ? calculateTWStockTax(totalAmount) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!numShares || numShares <= 0 || !numPrice || numPrice <= 0) {
      addToast({ type: 'error', message: '請輸入正確的股數與價格' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const holdingId = (stock as StockHolding)?.id || 'stock_' + uuidv4().slice(0, 8);

      // 若為舊持倉進行加碼或減碼，重新計算平均成本與總股數
      let newShares = numShares;
      let newAvgCost = numPrice;

      if ((stock as StockHolding)?.shares) {
        const oldShares = (stock as StockHolding).shares;
        const oldAvgCost = (stock as StockHolding).avgCost;
        if (tradeType === 'buy') {
          newShares = oldShares + numShares;
          newAvgCost = (oldShares * oldAvgCost + numShares * numPrice) / newShares;
        } else if (tradeType === 'sell') {
          newShares = Math.max(0, oldShares - numShares);
          newAvgCost = oldAvgCost; // 賣出時平均成本不變
        }
      }

      const holding: StockHolding = {
        id: holdingId,
        userId: user.uid,
        symbol: symbol.toUpperCase(),
        code: symbol.replace('.TW', '').toUpperCase(),
        name: name || symbol,
        market,
        shares: newShares,
        avgCost: parseFloat(newAvgCost.toFixed(2)),
        currentPrice: numPrice,
        currency: market === 'TW' ? 'TWD' : 'USD',
        createdAt: (stock as StockHolding)?.createdAt || now,
        updatedAt: now
      };

      await saveStockHolding(holding);
      addToast({
        type: 'success',
        message: tradeType === 'buy' ? `成功買入 ${holding.name}！` : `成功賣出 ${holding.name}！`
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
      {/* 交易類型 (買進 / 賣出 / 配息) */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
        {(['buy', 'sell'] as StockTradeType[]).map((t) => {
          const isActive = tradeType === t;
          const label = t === 'buy' ? '📈 買進 / 建倉' : '📉 賣出 / 減碼';
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTradeType(t)}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? (t === 'buy' ? 'var(--income)' : 'var(--expense)') : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 股票基本資訊 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          label="股票代碼"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="例如：2330.TW 或 AAPL"
          required
        />
        <Input
          label="股票名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：台積電"
          required
        />
      </div>

      {/* 股數與價格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          label={`股數 (${market === 'TW' ? '1張=1000股' : '股'})`}
          type="number"
          step="any"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="例如：1000"
          required
        />
        <Input
          label={`成交單價 (${market === 'TW' ? 'NT$' : 'US$'})`}
          type="number"
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="例如：980"
          required
        />
      </div>

      {/* 自動試算摘要 */}
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
          <span>交易總額估計：</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {market === 'TW' ? '$' : 'US$'}
            {Math.round(totalAmount).toLocaleString()}
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

      {/* 日期與備註 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label="交易日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="投資策略 / 備註"
          placeholder="例如：定期定額、波段停利"
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
          確認寫入持倉
        </Button>
      </div>
    </form>
  );
};
