import React, { useState, useEffect } from 'react';
import { StockHolding, StockSearchResult, StockMarket, Transaction } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { useAccounts, useCategories } from '@/hooks/useFirestore';
import { saveStockHolding, addTransaction } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { calculateTWStockFee, calculateTWStockTax } from '@/utils/stockCalculations';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Wallet, ArrowDownRight, ArrowUpRight, CheckSquare, Square } from 'lucide-react';

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
  const { accounts } = useAccounts();
  const { categories } = useCategories();

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

  // 帳戶收支連動設定
  const [syncToAccount, setSyncToAccount] = useState<boolean>(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [includeFeeTax, setIncludeFeeTax] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  // 預設選擇第一個帳戶
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [selectedAccountId, accounts]);

  const clearStockDraft = () => {
    sessionStorage.removeItem('draft_stock_symbol');
    sessionStorage.removeItem('draft_stock_name');
    sessionStorage.removeItem('draft_stock_shares');
    sessionStorage.removeItem('draft_stock_cost');
    sessionStorage.removeItem('draft_stock_note');
  };

  // 試算金額
  const numShares = parseFloat(shares) || 0;
  const numPrice = parseFloat(costPrice) || 0;
  const numCurrent = parseFloat(currentPrice) || numPrice;
  const grossAmount = numShares * numPrice;
  const usdRate = 32.5;

  // 手續費與證交稅
  const grossTWD = market === 'US' ? grossAmount * usdRate : grossAmount;
  const autoFee = market === 'TW' ? calculateTWStockFee(grossAmount) : 0;
  const autoTax = market === 'TW' && mode === 'sell' ? calculateTWStockTax(grossAmount) : 0;

  // 連動記帳之實際金額
  let netTxAmountTWD = 0;
  if (mode === 'sell') {
    // 賣出入帳 = 總額 - (手續費 + 稅)
    const net = includeFeeTax ? grossTWD - autoFee - autoTax : grossTWD;
    netTxAmountTWD = Math.max(0, Math.round(net));
  } else {
    // 買進/建倉扣款 = 總額 + 手續費
    const net = includeFeeTax ? grossTWD + autoFee : grossTWD;
    netTxAmountTWD = Math.max(0, Math.round(net));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!symbol.trim() || !name.trim()) {
      addToast({ type: 'error', message: '請輸入股票代碼與名稱' });
      return;
    }

    if (!numShares || numShares <= 0 || !numPrice || numPrice <= 0) {
      addToast({ type: 'error', message: '請輸入正確的交易股數與價格' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const holdingId = (stock as StockHolding)?.id || 'stock_' + uuidv4().slice(0, 8);

      let finalShares = numShares;
      let finalAvgCost = numPrice;
      const finalCurrentPrice = numCurrent > 0 ? numCurrent : numPrice;

      if (isExistingHolding) {
        const oldShares = (stock as StockHolding).shares || 0;
        const oldAvgCost = (stock as StockHolding).avgCost || 0;
        if (mode === 'buy') {
          finalShares = oldShares + numShares;
          finalAvgCost = (oldShares * oldAvgCost + numShares * numPrice) / finalShares;
        } else if (mode === 'sell') {
          if (numShares > oldShares) {
            addToast({ type: 'error', message: `賣出股數 (${numShares}) 不能大於目前持股數 (${oldShares})` });
            setLoading(false);
            return;
          }
          finalShares = Math.max(0, oldShares - numShares);
          finalAvgCost = oldAvgCost;
        }
      }

      // 1. 儲存股票持倉
      const holding: StockHolding = {
        id: holdingId,
        userId: user.uid,
        symbol: symbol.toUpperCase().includes('.TW') || symbol.toUpperCase().includes('.TWO') || market === 'US' ? symbol.toUpperCase() : `${symbol.toUpperCase()}.TW`,
        code: symbol.replace('.TW', '').replace('.TWO', '').toUpperCase(),
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

      // 2. 同步寫入帳戶收支記錄 (若有勾選)
      if (syncToAccount && selectedAccountId && netTxAmountTWD > 0) {
        const isExpense = mode !== 'sell';
        
        // 尋找投資相關分類
        const matchedCategory = categories.find((c) => 
          isExpense 
            ? (c.type === 'expense' && (c.name.includes('投資') || c.id === 'cat_expense_investment'))
            : (c.type === 'income' && (c.name.includes('投資') || c.name.includes('獲利') || c.id === 'cat_income_investment'))
        );

        const txType = isExpense ? 'expense' : 'income';
        const actionLabel = mode === 'init' ? '初始建倉' : mode === 'buy' ? '買進加碼' : '賣出減碼';
        const currPrefix = market === 'US' ? 'US$' : '$';
        
        const autoNote = note.trim()
          ? `${actionLabel} ${holding.name} (${holding.code}) ${numShares}股 @ ${currPrefix}${numPrice} - ${note.trim()}`
          : `${actionLabel} ${holding.name} (${holding.code}) ${numShares}股 @ ${currPrefix}${numPrice}`;

        const transaction: Transaction = {
          id: 'tx_stock_' + uuidv4().slice(0, 10),
          userId: user.uid,
          accountId: selectedAccountId,
          categoryId: matchedCategory?.id || '',
          type: txType,
          amount: netTxAmountTWD,
          note: autoNote,
          tags: ['股票投資', holding.name, actionLabel],
          date: date,
          createdAt: now,
          updatedAt: now
        };

        await addTransaction(transaction);
      }

      clearStockDraft();
      addToast({
        type: 'success',
        message: mode === 'init'
          ? `成功建立初始持倉「${holding.name}」${syncToAccount ? '，並已自帳戶扣款！' : '！'}`
          : mode === 'buy'
          ? `成功加碼買入「${holding.name}」${syncToAccount ? '，已記錄帳戶支出！' : '！'}`
          : `成功賣出「${holding.name}」${syncToAccount ? '，已記錄款項入帳！' : '！'}`
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId);

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
            const label = m === 'buy' ? '📈 買進加碼 (扣款)' : '📉 賣出減碼 (入帳)';
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
                  cursor: 'pointer',
                  transition: 'all 0.15s'
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
          label="股票代碼 (例如 2330、2880、7829)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="例如：2330、7829、AAPL"
          required
        />
      </div>

      {/* 股票名稱 */}
      <Input
        label="公司 / 股票名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例如：台積電、華南金、全景軟體"
        required
      />

      {/* 股數與成交價格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          label={`${mode === 'sell' ? '賣出' : '買進'}股數 (${market === 'TW' ? '1張=1000股' : '股'})`}
          type="number"
          step="any"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="例如：1000、250"
          required
        />
        <Input
          label={`${mode === 'sell' ? '賣出單價' : '買進成本單價'} (${market === 'TW' ? 'NT$' : 'US$'})`}
          type="number"
          step="any"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          placeholder="例如：26.5、980"
          required
        />
      </div>

      {/* 最新參考現價 (自訂/興櫃用) */}
      {!isExistingHolding && (
        <Input
          label={`目前最新參考市價 (${market === 'TW' ? 'NT$' : 'US$'}，留空自動等於成本價)`}
          type="number"
          step="any"
          value={currentPrice}
          onChange={(e) => setCurrentPrice(e.target.value)}
          placeholder="可輸入目前市價"
        />
      )}

      {/* 交易試算卡片 */}
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
          <span>{mode === 'sell' ? '預估賣出總值：' : '買進持股總成本：'}</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {market === 'TW' ? '$' : 'US$'}
            {Math.round(grossAmount).toLocaleString()}
          </strong>
        </div>

        {market === 'TW' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>預估手續費 (0.1425%) / 證交稅 (0.3%)：</span>
            <span>
              ${autoFee} / ${autoTax}
            </span>
          </div>
        )}
      </div>

      {/* 🌟 核心新功能：帳戶收支同步連動設定區塊 */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label
            onClick={() => setSyncToAccount(!syncToAccount)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              color: syncToAccount ? 'var(--primary-light)' : 'var(--text-secondary)'
            }}
          >
            {syncToAccount ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} />}
            <span>同步將金額記錄到指定帳戶 ({mode === 'sell' ? '入帳' : '扣款'})</span>
          </label>

          {market === 'TW' && syncToAccount && (
            <label
              onClick={() => setIncludeFeeTax(!includeFeeTax)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                color: 'var(--text-muted)'
              }}
            >
              {includeFeeTax ? <CheckSquare size={14} color="var(--income)" /> : <Square size={14} />}
              <span>含手續費/稅</span>
            </label>
          )}
        </div>

        {syncToAccount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Select
              label={mode === 'sell' ? '款項存入帳戶' : '扣款帳戶 (例如銀行/交割戶)'}
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (餘額 $${Math.round(a.balance).toLocaleString()})`
              }))}
            />

            {/* 連動收支即時預覽 */}
            {selectedAcc && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: mode === 'sell' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  fontSize: '12px',
                  color: mode === 'sell' ? 'var(--income)' : 'var(--expense)',
                  fontWeight: 600
                }}
              >
                {mode === 'sell' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>
                  將向「{selectedAcc.name}」{mode === 'sell' ? '入帳增加' : '支出扣除'} NT${netTxAmountTWD.toLocaleString()}
                  {mode === 'sell' ? '（實收金額）' : '（總支付額）'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 交易日期與筆記 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label="交易日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="策略 / 備註說明"
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
        <Button
          type="submit"
          variant={mode === 'sell' ? 'danger' : 'primary'}
          loading={loading}
          style={{ flex: 1 }}
        >
          {mode === 'init' ? '確認建立初始持倉' : mode === 'buy' ? '確認買進扣款' : '確認賣出入帳'}
        </Button>
      </div>
    </form>
  );
};
