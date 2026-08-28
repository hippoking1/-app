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
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  Square,
  RotateCcw,
  Coins,
  FileSpreadsheet
} from 'lucide-react';

type FormMode = 'init' | 'buy' | 'sell' | 'dividend_cash' | 'dividend_stock';

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

  // 自訂手續費與證交稅
  const [feeInput, setFeeInput] = useState<string>('');
  const [taxInput, setTaxInput] = useState<string>('');
  const [isFeeUserEdited, setIsFeeUserEdited] = useState<boolean>(false);
  const [isTaxUserEdited, setIsTaxUserEdited] = useState<boolean>(false);

  // 🌟 股息專用欄位
  // 現金股利
  const [cashPerShare, setCashPerShare] = useState<string>('3.5');
  const [totalCashDividend, setTotalCashDividend] = useState<string>('');
  const [isCashTotalEdited, setIsCashTotalEdited] = useState<boolean>(false);
  const [dividendDeduction, setDividendDeduction] = useState<string>('0'); // 匯費或二代健保保費

  // 股票股利 (配股)
  const [stockDividendRate, setStockDividendRate] = useState<string>('1.0'); // 每股配股元數 (例如 1.0 元 = 10%)
  const [bonusShares, setBonusShares] = useState<string>(''); // 獲配總股數
  const [isBonusSharesEdited, setIsBonusSharesEdited] = useState<boolean>(false);

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
  const existingShares = (stock as StockHolding)?.shares || 0;
  const existingAvgCost = (stock as StockHolding)?.avgCost || 0;
  const numShares = parseFloat(shares) || 0;
  const numPrice = parseFloat(costPrice) || 0;
  const numCurrent = parseFloat(currentPrice) || numPrice;
  const grossAmount = numShares * numPrice;
  const usdRate = 32.5;

  // 預估手續費與證交稅基準
  const grossTWD = market === 'US' ? grossAmount * usdRate : grossAmount;
  const defaultAutoFee = market === 'TW' ? calculateTWStockFee(grossAmount) : 0;
  const defaultAutoTax = market === 'TW' && mode === 'sell' ? calculateTWStockTax(grossAmount) : 0;

  // 當股數、價格或模式變更時，自動帶入預估值
  useEffect(() => {
    if (!isFeeUserEdited) {
      setFeeInput(defaultAutoFee > 0 ? String(defaultAutoFee) : '0');
    }
  }, [defaultAutoFee, isFeeUserEdited]);

  useEffect(() => {
    if (!isTaxUserEdited) {
      setTaxInput(defaultAutoTax > 0 ? String(defaultAutoTax) : '0');
    }
  }, [defaultAutoTax, isTaxUserEdited]);

  // 現金股利試算
  const numCashPerShare = parseFloat(cashPerShare) || 0;
  const targetHoldingShares = isExistingHolding ? existingShares : numShares;

  useEffect(() => {
    if (!isCashTotalEdited) {
      const calculatedTotal = Math.round(targetHoldingShares * numCashPerShare);
      setTotalCashDividend(calculatedTotal > 0 ? String(calculatedTotal) : '');
    }
  }, [targetHoldingShares, numCashPerShare, isCashTotalEdited]);

  const numTotalCashDividend = parseFloat(totalCashDividend) || 0;
  const numDeduction = parseFloat(dividendDeduction) || 0;
  const netCashDividendReceived = Math.max(0, Math.round(numTotalCashDividend - numDeduction));

  // 股票股利試算
  const numStockDividendRate = parseFloat(stockDividendRate) || 0;
  useEffect(() => {
    if (!isBonusSharesEdited) {
      // 台灣股票面額通常 10 元，配股 1 元代表 10% 配股 = 每 1000 股獲配 100 股
      const calculatedShares = Math.round(targetHoldingShares * (numStockDividendRate / 10));
      setBonusShares(calculatedShares > 0 ? String(calculatedShares) : '');
    }
  }, [targetHoldingShares, numStockDividendRate, isBonusSharesEdited]);

  const numBonusShares = parseFloat(bonusShares) || 0;
  const newSharesAfterStockDividend = targetHoldingShares + numBonusShares;
  const oldTotalCost = targetHoldingShares * existingAvgCost;
  const newAvgCostAfterStockDividend = newSharesAfterStockDividend > 0
    ? parseFloat((oldTotalCost / newSharesAfterStockDividend).toFixed(2))
    : existingAvgCost;

  // 使用者實際填寫的自訂手續費/稅額
  const finalFee = parseFloat(feeInput) || 0;
  const finalTax = parseFloat(taxInput) || 0;

  // 連動記帳之實際金額
  let netTxAmountTWD = 0;
  if (mode === 'sell') {
    const net = includeFeeTax ? grossTWD - finalFee - finalTax : grossTWD;
    netTxAmountTWD = Math.max(0, Math.round(net));
  } else if (mode === 'dividend_cash') {
    netTxAmountTWD = netCashDividendReceived;
  } else if (mode === 'buy' || mode === 'init') {
    const net = includeFeeTax ? grossTWD + finalFee : grossTWD;
    netTxAmountTWD = Math.max(0, Math.round(net));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!symbol.trim() || !name.trim()) {
      addToast({ type: 'error', message: '請輸入股票代碼與名稱' });
      return;
    }

    // 依模式檢驗輸入
    if (mode === 'dividend_cash') {
      if (netCashDividendReceived <= 0) {
        addToast({ type: 'error', message: '請輸入正確的每股現金股利或總配發金額' });
        return;
      }
    } else if (mode === 'dividend_stock') {
      if (numBonusShares <= 0) {
        addToast({ type: 'error', message: '請輸入正確的獲配股票股利股數' });
        return;
      }
    } else {
      if (!numShares || numShares <= 0 || !numPrice || numPrice <= 0) {
        addToast({ type: 'error', message: '請輸入正確的交易股數與價格' });
        return;
      }
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
        } else if (mode === 'dividend_cash') {
          // 現金股利持股數不變
          finalShares = oldShares;
          finalAvgCost = oldAvgCost;
        } else if (mode === 'dividend_stock') {
          // 股票股利：增加股數，平均成本自動除權稀釋
          finalShares = oldShares + numBonusShares;
          finalAvgCost = newAvgCostAfterStockDividend;
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

      // 2. 同步寫入帳戶收支記錄 (若有勾選且非純股票股利)
      if (syncToAccount && selectedAccountId && netTxAmountTWD > 0 && mode !== 'dividend_stock') {
        const isExpense = mode === 'buy' || mode === 'init';
        
        // 尋找投資相關分類
        const matchedCategory = categories.find((c) => 
          isExpense 
            ? (c.type === 'expense' && (c.name.includes('投資') || c.id === 'cat_expense_investment'))
            : (c.type === 'income' && (c.name.includes('投資') || c.name.includes('獲利') || c.id === 'cat_income_investment'))
        );

        const txType = isExpense ? 'expense' : 'income';
        const currPrefix = market === 'US' ? 'US$' : '$';
        
        let actionLabel = '股票交易';
        let autoNote = '';

        if (mode === 'dividend_cash') {
          actionLabel = '現金股利';
          autoNote = `發放現金股利 ${holding.name} (${holding.code}) @ $${cashPerShare}/股，實收 NT$${netCashDividendReceived.toLocaleString()}${numDeduction > 0 ? ` (扣除費用$${numDeduction})` : ''}`;
        } else {
          actionLabel = mode === 'init' ? '初始建倉' : mode === 'buy' ? '買進加碼' : '賣出減碼';
          const feeTaxDetail = includeFeeTax
            ? `(手續費$${finalFee}${mode === 'sell' ? `, 證交稅$${finalTax}` : ''})`
            : '';
          autoNote = `${actionLabel} ${holding.name} (${holding.code}) ${numShares}股 @ ${currPrefix}${numPrice} ${feeTaxDetail}`;
        }

        if (note.trim()) {
          autoNote += ` - ${note.trim()}`;
        }

        const transaction: Transaction = {
          id: 'tx_stock_' + uuidv4().slice(0, 10),
          userId: user.uid,
          accountId: selectedAccountId,
          categoryId: matchedCategory?.id || '',
          type: txType,
          amount: netTxAmountTWD,
          note: autoNote.trim(),
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
        message: mode === 'dividend_cash'
          ? `成功記錄「${holding.name}」現金股利 NT$${netCashDividendReceived.toLocaleString()}！`
          : mode === 'dividend_stock'
          ? `成功記錄「${holding.name}」股票股利 ${numBonusShares} 股！除權後均價稀釋為 $${finalAvgCost}`
          : mode === 'init'
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

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 模式切換 Tab */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px', gap: '2px', flexWrap: 'wrap' }}>
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
          [
            { key: 'buy', label: '📈 買進加碼', color: 'var(--income)' },
            { key: 'sell', label: '📉 賣出減碼', color: 'var(--expense)' },
            { key: 'dividend_cash', label: '💵 現金股利', color: '#10b981' },
            { key: 'dividend_stock', label: '📜 股票股利', color: 'var(--purple)' }
          ].map((item) => {
            const isActive = mode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMode(item.key as FormMode);
                  setIsTaxUserEdited(false);
                }}
                style={{
                  flex: 1,
                  minWidth: '70px',
                  padding: '7px 0',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? item.color : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {item.label}
              </button>
            );
          })
        )}
      </div>

      {/* 股票基本資訊展示 (現有持股時標明持股) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {name} ({symbol})
          </span>
          {isExistingHolding && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              目前庫存：<strong>{existingShares.toLocaleString()} 股</strong> • 平均成本：<strong>${existingAvgCost}</strong>
            </div>
          )}
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)' }}>
          {market === 'TW' ? '🇹🇼 台股/興櫃' : '🇺🇸 美股'}
        </span>
      </div>

      {/* =========================================================================
          情境 A：現金股利 (Dividend Cash) 專屬欄位
          ========================================================================= */}
      {mode === 'dividend_cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                每股配發現金 (元)
              </label>
              <Input
                type="number"
                step="any"
                value={cashPerShare}
                onChange={(e) => {
                  setIsCashTotalEdited(false);
                  setCashPerShare(e.target.value);
                }}
                placeholder="例如：3.5"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                現金股利總額 (NT$)
              </label>
              <Input
                type="number"
                step="any"
                value={totalCashDividend}
                onChange={(e) => {
                  setIsCashTotalEdited(true);
                  setTotalCashDividend(e.target.value);
                }}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                扣除匯費 / 二代健保費 (NT$)
              </label>
              <Input
                type="number"
                step="any"
                value={dividendDeduction}
                onChange={(e) => setDividendDeduction(e.target.value)}
                placeholder="例如：10"
              />
            </div>

            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>實收現金股利</span>
              <strong style={{ fontSize: '17px', color: 'var(--income)', fontFamily: 'var(--font-mono)' }}>
                NT$ {netCashDividendReceived.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          情境 B：股票股利 (Dividend Stock / 配股) 專屬欄位
          ========================================================================= */}
      {mode === 'dividend_stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                每股配股 (元)
              </label>
              <Input
                type="number"
                step="any"
                value={stockDividendRate}
                onChange={(e) => {
                  setIsBonusSharesEdited(false);
                  setStockDividendRate(e.target.value);
                }}
                placeholder="例如：1.0 (即10%配股)"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                獲配股票股數 (股)
              </label>
              <Input
                type="number"
                step="any"
                value={bonusShares}
                onChange={(e) => {
                  setIsBonusSharesEdited(true);
                  setBonusShares(e.target.value);
                }}
                placeholder="例如：100"
                required
              />
            </div>
          </div>

          {/* 除權稀釋預覽卡片 */}
          <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
              <span>除權後總持股數：</span>
              <strong className="font-mono" style={{ fontSize: '14px', color: 'var(--purple)' }}>
                {newSharesAfterStockDividend.toLocaleString()} 股 (+{numBonusShares}股)
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>除權後平均每股成本：</span>
              <span className="font-mono" style={{ fontWeight: 700 }}>
                ${existingAvgCost} ➔ <strong style={{ color: 'var(--income)' }}>${newAvgCostAfterStockDividend}</strong>
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              💡 股票股利（配股）使持股增加，總投入本金不變，平均每股成本將自動除權稀釋。
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          情境 C：買進加碼 (buy) / 賣出減碼 (sell) / 初始建倉 (init) 專屬欄位
          ========================================================================= */}
      {(mode === 'buy' || mode === 'sell' || mode === 'init') && (
        <>
          {/* 首次建倉才需輸入名稱與代碼 */}
          {!isExistingHolding && (
            <>
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

              <Input
                label="公司 / 股票名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：台積電、華南金、全景軟體"
                required
              />
            </>
          )}

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

          {/* 交易試算與手續費/證交稅 */}
          <div
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <span>{mode === 'sell' ? '交易總面額：' : '持股總成本：'}</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
                {market === 'TW' ? '$' : 'US$'}
                {Math.round(grossAmount).toLocaleString()}
              </strong>
            </div>

            {/* 手續費與證交稅自訂輸入框 */}
            <div style={{ display: 'grid', gridTemplateColumns: mode === 'sell' && market === 'TW' ? '1fr 1fr' : '1fr', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    證券手續費 (NT$)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFeeUserEdited(false);
                      setFeeInput(String(defaultAutoFee));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary-light)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: 0
                    }}
                  >
                    <RotateCcw size={11} /> 帶入預估 (${defaultAutoFee})
                  </button>
                </div>
                <Input
                  type="number"
                  step="any"
                  value={feeInput}
                  onChange={(e) => {
                    setIsFeeUserEdited(true);
                    setFeeInput(e.target.value);
                  }}
                  placeholder="0"
                />
              </div>

              {mode === 'sell' && market === 'TW' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      證券交易稅 (NT$)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTaxUserEdited(false);
                        setTaxInput(String(defaultAutoTax));
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary-light)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: 0
                      }}
                    >
                      <RotateCcw size={11} /> 帶入預估 (${defaultAutoTax})
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="any"
                    value={taxInput}
                    onChange={(e) => {
                      setIsTaxUserEdited(true);
                      setTaxInput(e.target.value);
                    }}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 帳戶收支同步連動設定區塊 (現金股利、買進、賣出、建倉皆可連動) */}
      {mode !== 'dividend_stock' && (
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
              <span>
                {mode === 'dividend_cash'
                  ? '同步將現金股利記錄為帳戶收入 (入帳)'
                  : `同步將金額記錄到指定帳戶 (${mode === 'sell' ? '入帳' : '扣款'})`}
              </span>
            </label>

            {syncToAccount && mode !== 'dividend_cash' && (
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
                <span>併計手續費/稅</span>
              </label>
            )}
          </div>

          {syncToAccount && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Select
                label={mode === 'sell' || mode === 'dividend_cash' ? '款項存入帳戶' : '扣款帳戶 (例如銀行/交割戶)'}
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
                    backgroundColor: mode === 'sell' || mode === 'dividend_cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                    fontSize: '12px',
                    color: mode === 'sell' || mode === 'dividend_cash' ? 'var(--income)' : 'var(--expense)',
                    fontWeight: 600
                  }}
                >
                  {mode === 'sell' || mode === 'dividend_cash' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  <span>
                    將向「{selectedAcc.name}」{mode === 'sell' || mode === 'dividend_cash' ? '入帳增加' : '支出扣除'} NT${netTxAmountTWD.toLocaleString()}
                    {mode === 'dividend_cash'
                      ? ' (實發現金股利)'
                      : includeFeeTax
                      ? ` (已含手續費$${finalFee}${mode === 'sell' ? `與稅$${finalTax}` : ''})`
                      : ' (未併計手續費/稅)'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 交易/除權息日期與筆記 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label={mode === 'dividend_cash' || mode === 'dividend_stock' ? '除權息 / 發放日期' : '交易日期'}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="策略 / 備註說明"
          placeholder={mode === 'dividend_cash' ? '例如：2025 年上半年股息' : '例如：定期定額、波段停利'}
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
          {mode === 'init'
            ? '確認建立初始持倉'
            : mode === 'buy'
            ? '確認買進扣款'
            : mode === 'sell'
            ? '確認賣出入帳'
            : mode === 'dividend_cash'
            ? '確認記錄現金股利'
            : '確認記錄股票股利 (配股)'}
        </Button>
      </div>
    </form>
  );
};
