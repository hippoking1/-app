import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useTrips, useTransactions, useCategories, useAccounts } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { TravelTrip, Transaction } from '@/types';
import { saveTrip, deleteTrip, setActiveTrip } from '@/services/firestore';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  getExchangeRateForCurrency,
  convertForeignToTWD,
  fetchLiveExchangeRates,
  formatForeignCurrency,
  formatExchangeRate
} from '@/services/exchangeRate';
import { formatCurrency } from '@/utils/analytics';
import { CurrencySelector } from '@/components/common/CurrencySelector';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Plane,
  Calculator,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CreditCard,
  Banknote,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Globe
} from 'lucide-react';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

export const Travel: React.FC = () => {
  const { user, addToast, setTransactionModalOpen } = useAppStore();
  const { trips, activeTrip, loading: loadingTrips } = useTrips();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  // 選中檢視的旅程 (預設為 activeTrip，若無則為第一個 trip)
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    return activeTrip?.id || (trips.length > 0 ? trips[0].id : '');
  });

  // 當 trips 載入完畢且尚未設定 selectedTripId 時自動選擇
  React.useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(activeTrip?.id || trips[0].id);
    }
  }, [trips, activeTrip, selectedTripId]);

  const currentTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || activeTrip || trips[0] || null;
  }, [trips, selectedTripId, activeTrip]);

  // 1. 隨身即時匯率計算機狀態
  const [calcCurrency, setCalcCurrency] = useState<string>(() => currentTrip?.currency || 'JPY');
  const [calcAmount, setCalcAmount] = useState<string>('1000');
  const [calcRate, setCalcRate] = useState<number>(() => {
    return currentTrip?.customExchangeRate && currentTrip.currency === (currentTrip?.currency || 'JPY')
      ? currentTrip.customExchangeRate
      : getExchangeRateForCurrency(currentTrip?.currency || 'JPY');
  });
  const [isCalcCardFee, setIsCalcCardFee] = useState<boolean>(true);
  const [isUpdatingCalcRate, setIsUpdatingCalcRate] = useState<boolean>(false);
  const [isCustomCalcRate, setIsCustomCalcRate] = useState<boolean>(false);

  // 當 currentTrip 改變時同步更新計算機幣別
  React.useEffect(() => {
    if (currentTrip?.currency && currentTrip.currency !== calcCurrency) {
      setCalcCurrency(currentTrip.currency);
      const rate = currentTrip.customExchangeRate || getExchangeRateForCurrency(currentTrip.currency);
      setCalcRate(rate);
    }
  }, [currentTrip]);

  // 計算機切換幣別
  const handleCalcCurrencyChange = (newCode: string) => {
    setCalcCurrency(newCode);
    const upper = newCode.toUpperCase();
    if (upper === currentTrip?.currency && currentTrip?.customExchangeRate) {
      setCalcRate(currentTrip.customExchangeRate);
    } else {
      setCalcRate(getExchangeRateForCurrency(upper));
    }
    setIsCustomCalcRate(false);
  };

  // 計算機更新即時匯率
  const handleRefreshCalcRate = async () => {
    if (calcCurrency === 'TWD') return;
    setIsUpdatingCalcRate(true);
    try {
      const live = await fetchLiveExchangeRates(true);
      const r = live[calcCurrency] || getExchangeRateForCurrency(calcCurrency);
      setCalcRate(r);
      setIsCustomCalcRate(false);
      addToast({
        type: 'success',
        message: `已更新 ${calcCurrency} 最新即時匯率：1 ${calcCurrency} = ${formatExchangeRate(r)} NT$`
      });
    } catch {
      addToast({ type: 'warning', message: '匯率更新失敗，已維持快取匯率' });
    } finally {
      setIsUpdatingCalcRate(false);
    }
  };

  const parsedCalcAmount = parseFloat(calcAmount) || 0;
  const calcConversion = useMemo(() => {
    if (calcCurrency === 'TWD') {
      return { baseTWD: parsedCalcAmount, feeTWD: 0, totalTWD: parsedCalcAmount };
    }
    const feeRate = isCalcCardFee ? 1.5 : 0;
    return convertForeignToTWD(parsedCalcAmount, calcRate, feeRate);
  }, [calcCurrency, parsedCalcAmount, calcRate, isCalcCardFee]);

  const calcCurrencyInfo = useMemo(() => getCurrencyInfo(calcCurrency), [calcCurrency]);

  // 2. 旅程專案 Modal 狀態 (新增/編輯)
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Partial<TravelTrip> | null>(null);
  const [tripFormName, setTripFormName] = useState('');
  const [tripFormDestination, setTripFormDestination] = useState('');
  const [tripFormCurrency, setTripFormCurrency] = useState('JPY');
  const [tripFormBudget, setTripFormBudget] = useState('');
  const [tripFormCustomRate, setTripFormCustomRate] = useState('');
  const [tripFormStart, setTripFormStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tripFormEnd, setTripFormEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tripFormExcludeBudget, setTripFormExcludeBudget] = useState(true);
  const [tripFormIsActive, setTripFormIsActive] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);

  // 3. 編輯交易明細 Modal
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // 開啟建立旅程 Modal
  const handleOpenNewTripModal = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setEditingTrip(null);
    setTripFormName('');
    setTripFormDestination('');
    setTripFormCurrency('JPY');
    setTripFormBudget('50000');
    setTripFormCustomRate('');
    setTripFormStart(todayStr);
    setTripFormEnd(todayStr);
    setTripFormExcludeBudget(true);
    setTripFormIsActive(trips.length === 0);
    setIsTripModalOpen(true);
  };

  // 開啟編輯旅程 Modal
  const handleOpenEditTripModal = (trip: TravelTrip) => {
    setEditingTrip(trip);
    setTripFormName(trip.name);
    setTripFormDestination(trip.destination);
    setTripFormCurrency(trip.currency);
    setTripFormBudget(trip.budgetTWD ? String(trip.budgetTWD) : '');
    setTripFormCustomRate(trip.customExchangeRate ? String(trip.customExchangeRate) : '');
    setTripFormStart(trip.startDate);
    setTripFormEnd(trip.endDate);
    setTripFormExcludeBudget(trip.excludeFromMonthlyBudget ?? true);
    setTripFormIsActive(trip.isActive);
    setIsTripModalOpen(true);
  };

  // 儲存旅程
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!tripFormName.trim()) {
      addToast({ type: 'error', message: '請輸入旅程名稱' });
      return;
    }

    setSavingTrip(true);
    try {
      const now = new Date().toISOString();
      const tripId = editingTrip?.id || 'trip_' + uuidv4().slice(0, 8);
      const parsedBudget = parseFloat(tripFormBudget) || 0;
      const parsedCustomRate = parseFloat(tripFormCustomRate) || undefined;

      const tripData: TravelTrip = {
        id: tripId,
        userId: user.uid,
        name: tripFormName.trim(),
        destination: tripFormDestination.trim() || '國外自由行',
        currency: tripFormCurrency.toUpperCase(),
        budgetTWD: parsedBudget > 0 ? parsedBudget : undefined,
        customExchangeRate: parsedCustomRate && parsedCustomRate > 0 ? parsedCustomRate : undefined,
        startDate: tripFormStart,
        endDate: tripFormEnd,
        isActive: tripFormIsActive,
        excludeFromMonthlyBudget: tripFormExcludeBudget,
        createdAt: editingTrip?.createdAt || now,
        updatedAt: now
      };

      await saveTrip(tripData);

      // 若設為啟用中旅程，確保其他旅程關閉 active
      if (tripFormIsActive) {
        await setActiveTrip(user.uid, tripId);
      }

      addToast({ type: 'success', message: `旅程「${tripData.name}」已成功儲存！` });
      setSelectedTripId(tripId);
      setIsTripModalOpen(false);
      hapticSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setSavingTrip(false);
    }
  };

  // 刪除旅程
  const handleDeleteTrip = async (trip: TravelTrip) => {
    if (!user) return;
    if (window.confirm(`確定要刪除旅程「${trip.name}」嗎？\n(注意：該旅程下的記帳明細仍會保留，但會解除旅程關聯)`)) {
      try {
        await deleteTrip(user.uid, trip.id);
        addToast({ type: 'info', message: `已刪除旅程「${trip.name}」` });
        if (selectedTripId === trip.id) {
          const remaining = trips.filter((t) => t.id !== trip.id);
          setSelectedTripId(remaining[0]?.id || '');
        }
      } catch (err: any) {
        addToast({ type: 'error', message: '刪除失敗: ' + err.message });
      }
    }
  };

  // 一鍵切換「旅途中模式」
  const handleToggleActiveTrip = async (trip: TravelTrip) => {
    if (!user) return;
    const nextStatus = !trip.isActive;
    try {
      await setActiveTrip(user.uid, nextStatus ? trip.id : null);
      addToast({
        type: 'success',
        message: nextStatus
          ? `🟢 已啟動「${trip.name}」旅途中模式！快速記帳將自動套用 ${trip.currency} 與本旅程。`
          : `已關閉旅途中模式。`
      });
      hapticLight();
    } catch (err: any) {
      addToast({ type: 'error', message: '切換失敗: ' + err.message });
    }
  };

  // 計算機一鍵帶入記帳
  const handleUseCalcForTransaction = () => {
    sessionStorage.setItem('draft_tx_amount', String(parsedCalcAmount));
    sessionStorage.setItem('draft_tx_merchant', currentTrip?.name ? `${currentTrip.name}消費` : '國外旅行消費');
    setTransactionModalOpen(true);
  };

  // 3. 該趟旅程之財務數據統計
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const tripTransactions = useMemo(() => {
    if (!currentTrip) return [];
    return transactions.filter((t) => {
      if (t.tripId === currentTrip.id) return true;
      // 若該筆交易無 tripId 但在旅程起訖日之間且為該幣別外幣
      if (!t.tripId && t.originalCurrency === currentTrip.currency && t.date >= currentTrip.startDate && t.date <= currentTrip.endDate) {
        return true;
      }
      return false;
    });
  }, [transactions, currentTrip]);

  // 總花費 (台幣與外幣)
  const tripTotalTWD = tripTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const tripTotalForeign = tripTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.originalAmount || 0), 0);

  // 現鈔 vs 信用卡拆解
  const cashExpenses = tripTransactions.filter((t) => {
    if (t.type !== 'expense') return false;
    const acc = accountMap.get(t.accountId);
    return acc?.type === 'cash';
  });

  const cardExpenses = tripTransactions.filter((t) => {
    if (t.type !== 'expense') return false;
    const acc = accountMap.get(t.accountId);
    return acc?.type === 'credit_card';
  });

  const cashTotalTWD = cashExpenses.reduce((sum, t) => sum + t.amount, 0);
  const cashTotalForeign = cashExpenses.reduce((sum, t) => sum + (t.originalAmount || 0), 0);

  const cardTotalTWD = cardExpenses.reduce((sum, t) => sum + t.amount, 0);
  const cardTotalForeign = cardExpenses.reduce((sum, t) => sum + (t.originalAmount || 0), 0);
  const cardFeesTWD = cardExpenses.reduce((sum, t) => sum + (t.foreignFeeTWD || 0), 0);

  // 旅遊預算進度
  const budgetTWD = currentTrip?.budgetTWD || 0;
  const budgetRatio = budgetTWD > 0 ? (tripTotalTWD / budgetTWD) * 100 : 0;
  const budgetRemaining = budgetTWD - tripTotalTWD;

  const currentCurrencyInfo = currentTrip ? getCurrencyInfo(currentTrip.currency) : SUPPORTED_CURRENCIES[1];

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '960px' }}>
      {/* 頂部標題與快速操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plane size={18} />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
              旅行記帳 & 即時匯率
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            即時外幣換算、海外刷卡手續費、現金 vs 信用卡拆解與旅程專案
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="primary" size="sm" onClick={handleOpenNewTripModal} icon={<Plus size={16} />}>
            建立新旅程
          </Button>
        </div>
      </div>

      {/* 1. 逛街隨身即時匯率換算機 (Quick FX Calculator - 現代雙幣兌換 UX) */}
      <Card
        glass
        padding="lg"
        style={{
          border: '1px solid var(--border-focus)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* 卡片標題與最新匯率更新按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calculator size={18} />
            </div>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                逛街隨身即時匯率計算機
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                出國掃街換算神器
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshCalcRate}
            disabled={isUpdatingCalcRate}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={12} className={isUpdatingCalcRate ? 'animate-spin' : ''} />
            <span>更新最新匯率</span>
          </button>
        </div>

        {/* 雙幣轉換卡片（上下流向：支付當地貨幣 ➔ 換算折合台幣） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 上卡：當地外幣輸入卡（水平膠囊無重疊結構） */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                當地標價 (外幣支付)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--primary-light)', fontWeight: 600 }}>
                {calcCurrencyInfo.name} ({calcCurrencyInfo.symbol})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* 幣別徽章膠囊 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-focus)',
                  flexShrink: 0
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{calcCurrencyInfo.flag}</span>
                <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {calcCurrencyInfo.code}
                </span>
              </div>

              {/* 大字數字輸入框 (右對齊、無 absolute 遮擋，零重疊) */}
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="輸入當地標價金額..."
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '26px',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  textAlign: 'right',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* 中繼：匯率指示與微調列 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--primary-light)', fontWeight: 800 }}>⇄ 參考匯率：</span>
              <span>1 {calcCurrency} ≈ </span>
              {isCustomCalcRate ? (
                <input
                  type="number"
                  step="any"
                  value={calcRate}
                  onChange={(e) => setCalcRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '75px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                  autoFocus
                />
              ) : (
                <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                  {formatExchangeRate(calcRate)}
                </strong>
              )}
              <span>NT$</span>
            </div>

            <button
              type="button"
              onClick={() => setIsCustomCalcRate(!isCustomCalcRate)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-light)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isCustomCalcRate ? '完成微調' : '微調匯率'}
            </button>
          </div>

          {/* 下卡：折合台幣結果卡 */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                即時折合台幣 (實付成本)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--income)', fontWeight: 700 }}>
                新台幣 (TWD)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* TWD 膠囊 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  flexShrink: 0
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>🇹🇼</span>
                <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--income)' }}>
                  TWD
                </span>
              </div>

              {/* 大字折算結果 */}
              <div
                className="font-mono"
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: 'var(--income)',
                  textAlign: 'right'
                }}
              >
                NT$ {calcConversion.totalTWD.toLocaleString()}
              </div>
            </div>

            {/* 海外刷卡 1.5% 手續費 Toggle */}
            <div
              onClick={() => setIsCalcCardFee(!isCalcCardFee)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                cursor: 'pointer',
                userSelect: 'none',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <CreditCard size={14} color="var(--purple)" />
                <span>加計海外刷卡 1.5% 手續費</span>
                {isCalcCardFee && calcConversion.feeTWD > 0 && (
                  <span style={{ color: 'var(--expense)', fontWeight: 700 }}>
                    (+NT$ {calcConversion.feeTWD.toLocaleString()})
                  </span>
                )}
              </div>
              <input
                type="checkbox"
                checked={isCalcCardFee}
                onChange={(e) => setIsCalcCardFee(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: '15px', height: '15px' }}
              />
            </div>
          </div>
        </div>

        {/* 常用貨幣快捷列 (可快速切換外幣與自由增刪) */}
        <div>
          <CurrencySelector
            selectedCurrency={calcCurrency}
            onSelectCurrency={handleCalcCurrencyChange}
            includeTWD={false}
            label="常用貨幣快速切換"
          />
        </div>

        {/* 快速帶入記帳按鈕 */}
        <Button
          variant="primary"
          size="md"
          onClick={handleUseCalcForTransaction}
          icon={<Sparkles size={16} />}
          style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 800 }}
        >
          ⚡ 直接將此金額帶入快速記帳
        </Button>
      </Card>

      {/* 2. 旅程選擇切換標籤與「旅途中模式」開關 */}
      {trips.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {trips.map((trip) => {
                const isSelected = currentTrip?.id === trip.id;
                return (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                      color: isSelected ? 'var(--primary-light)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>✈️ {trip.name}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>({trip.currency})</span>
                    {trip.isActive && (
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          boxShadow: '0 0 6px #10b981'
                        }}
                        title="目前進行中旅程"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {currentTrip && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Button
                  variant={currentTrip.isActive ? 'success' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleActiveTrip(currentTrip)}
                  icon={<CheckCircle2 size={14} />}
                >
                  {currentTrip.isActive ? '🟢 旅途中模式 (啟動中)' : '開啟旅途中模式'}
                </Button>
                <button
                  onClick={() => handleOpenEditTripModal(currentTrip)}
                  style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                  title="編輯旅程"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDeleteTrip(currentTrip)}
                  style={{
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--expense)',
                    cursor: 'pointer'
                  }}
                  title="刪除旅程"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          {/* 3. 該旅程財務儀表板 (KPI 卡片) */}
          {currentTrip && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid-3">
                {/* 1. 旅程總花費 (雙幣) */}
                <Card glass padding="md">
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {currentTrip.name} • 總花費
                  </div>
                  <div className="font-mono" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--expense)', marginTop: '4px' }}>
                    NT$ {tripTotalTWD.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>
                    {currentCurrencyInfo.symbol} {tripTotalForeign.toLocaleString()} {currentCurrencyInfo.code}
                  </div>
                </Card>

                {/* 2. 現鈔 vs 信用卡拆解 */}
                <Card glass padding="md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    支付方式拆解
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--income)' }}>
                        <Banknote size={14} /> 外幣現鈔：
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        NT$ {cashTotalTWD.toLocaleString()} ({currentCurrencyInfo.symbol}{cashTotalForeign.toLocaleString()})
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--purple)' }}>
                        <CreditCard size={14} /> 信用卡刷卡：
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        NT$ {cardTotalTWD.toLocaleString()} ({currentCurrencyInfo.symbol}{cardTotalForeign.toLocaleString()})
                      </strong>
                    </div>
                  </div>
                  {cardFeesTWD > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                      (含海外交易手續費 NT$ {cardFeesTWD.toLocaleString()})
                    </div>
                  )}
                </Card>

                {/* 3. 旅遊預算與進度 */}
                <Card glass padding="md">
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    旅遊預算 (NT$)
                  </div>
                  {budgetTWD > 0 ? (
                    <>
                      <div className="font-mono" style={{ fontSize: '22px', fontWeight: 900, color: budgetRemaining >= 0 ? 'var(--income)' : 'var(--expense)', marginTop: '4px' }}>
                        {budgetRemaining >= 0 ? '剩餘 NT$ ' + budgetRemaining.toLocaleString() : '超支 NT$ ' + Math.abs(budgetRemaining).toLocaleString()}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <ProgressBar value={Math.min(100, budgetRatio)} max={100} height={8} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>已用 {budgetRatio.toFixed(1)}%</span>
                        <span>總預算 NT$ {budgetTWD.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      尚未設定本趟旅遊預算，可點擊上方編輯按鈕設定。
                    </div>
                  )}
                </Card>
              </div>

              {/* 該旅程明細列表 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    📝 「{currentTrip.name}」消費明細 ({tripTransactions.length} 筆)
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      sessionStorage.setItem('draft_tx_merchant', `${currentTrip.name}消費`);
                      setTransactionModalOpen(true);
                    }}
                    icon={<Plus size={14} />}
                  >
                    記一筆旅行花費
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tripTransactions.map((tx) => (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      category={categoryMap.get(tx.categoryId)}
                      account={accountMap.get(tx.accountId)}
                      targetAccount={tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined}
                      onEdit={(item) => setEditingTx(item)}
                    />
                  ))}

                  {tripTransactions.length === 0 && (
                    <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      本趟旅程尚無記帳記錄，點擊上方按鈕開始記帳！
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 尚未建立任何旅程時之引導卡片 */
        <Card glass padding="lg" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <Plane size={28} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            尚未建立任何旅行專案
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '8px auto 20px', lineHeight: 1.6 }}>
            建立您的第一趟旅程（如「東京 5 日遊」或「首爾自由行」），即可開啟「旅途中模式」，即時以外幣記帳並自動統計折合台幣與預算！
          </p>
          <Button variant="primary" onClick={handleOpenNewTripModal} icon={<Plus size={16} />}>
            立即建立旅程專案
          </Button>
        </Card>
      )}

      {/* 建立 / 編輯旅程 Modal */}
      <Modal
        isOpen={isTripModalOpen}
        onClose={() => setIsTripModalOpen(false)}
        title={editingTrip ? '✏️ 編輯旅程專案' : '✈️ 建立新旅行專案'}
      >
        <form onSubmit={handleSaveTrip} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="旅程名稱"
            placeholder="例如：2026 東京賞櫻行、曼谷放鬆之旅"
            value={tripFormName}
            onChange={(e) => setTripFormName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="目的地"
            placeholder="例如：日本 東京、泰國 曼谷"
            value={tripFormDestination}
            onChange={(e) => setTripFormDestination(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select
              label="當地主要貨幣"
              value={tripFormCurrency}
              onChange={(e) => setTripFormCurrency(e.target.value)}
              options={SUPPORTED_CURRENCIES.filter((c) => c.code !== 'TWD').map((c) => ({
                value: c.code,
                label: `${c.flag} ${c.code} (${c.name})`
              }))}
            />

            <Input
              type="number"
              label="鎖定固定匯率 (選填)"
              placeholder="未填則使用最新即時匯率"
              value={tripFormCustomRate}
              onChange={(e) => setTripFormCustomRate(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input
              type="date"
              label="開始日期"
              value={tripFormStart}
              onChange={(e) => setTripFormStart(e.target.value)}
              required
            />
            <Input
              type="date"
              label="結束日期"
              value={tripFormEnd}
              onChange={(e) => setTripFormEnd(e.target.value)}
              required
            />
          </div>

          <Input
            type="number"
            label="本趟旅遊總預算 (台幣 NT$)"
            placeholder="例如：50000"
            value={tripFormBudget}
            onChange={(e) => setTripFormBudget(e.target.value)}
          />

          {/* 勾選項：排除日常每月預算 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px'
            }}
          >
            <input
              type="checkbox"
              id="tripFormExcludeBudget"
              checked={tripFormExcludeBudget}
              onChange={(e) => setTripFormExcludeBudget(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="tripFormExcludeBudget" style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
              <strong>排除於日常每月生活預算</strong> (強烈推薦：防止旅遊機票與大額花費把平常的餐飲預算表衝爆)
            </label>
          </div>

          {/* 勾選項：設為當前進行中旅程 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px'
            }}
          >
            <input
              type="checkbox"
              id="tripFormIsActive"
              checked={tripFormIsActive}
              onChange={(e) => setTripFormIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="tripFormIsActive" style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
              <strong>設為當前進行中旅程 (旅途中模式)</strong> (快速記帳將自動預設此旅程與當地幣別)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsTripModalOpen(false)} style={{ flex: 1 }}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={savingTrip} style={{ flex: 1 }}>
              確認儲存
            </Button>
          </div>
        </form>
      </Modal>

      {/* 編輯交易明細 Modal */}
      <Modal
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        title="✏️ 編輯交易明細"
      >
        {editingTx && (
          <TransactionForm
            initialData={editingTx}
            onSuccess={() => setEditingTx(null)}
            onCancel={() => setEditingTx(null)}
          />
        )}
      </Modal>
    </div>
  );
};
