import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Subscription, SubscriptionPeriod } from '@/types';
import { useAccounts, useCategories, useTransactions, useTrips } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { addTransaction, addInstallmentTransactions, saveSubscription } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CategoryPicker } from './CategoryPicker';
import { getUniqueMerchants, getMerchantPattern, MerchantPattern } from '@/utils/merchantPatterns';
import { calculateCashWalletUsage, calculateCreditCardUsage } from '@/utils/accountCalculations';
import { calculateNextBillingDate, POPULAR_SUBSCRIPTION_PRESETS, SubscriptionPreset } from '@/utils/subscriptionUtils';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  getExchangeRateForCurrency,
  convertForeignToTWD,
  fetchLiveExchangeRates,
  formatExchangeRate
} from '@/services/exchangeRate';
import { v4 as uuidv4 } from 'uuid';
import { format, addMonths, parseISO } from 'date-fns';
import { MapPin, Sparkles, CreditCard, Layers, Repeat, CalendarClock, Plane, RefreshCw, Globe, ArrowRight } from 'lucide-react';
import { hapticSuccess } from '@/utils/haptics';

interface TransactionFormProps {
  initialData?: Partial<Transaction>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialData,
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { transactions } = useTransactions();
  const { trips, activeTrip } = useTrips();

  // 貨幣與旅程狀態
  const [currency, setCurrency] = useState<string>(() => {
    return initialData?.originalCurrency || activeTrip?.currency || 'TWD';
  });
  const [tripId, setTripId] = useState<string>(() => {
    return initialData?.tripId || activeTrip?.id || '';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    if (initialData?.exchangeRate) return initialData.exchangeRate;
    if (activeTrip?.customExchangeRate && activeTrip.currency === (initialData?.originalCurrency || activeTrip?.currency)) {
      return activeTrip.customExchangeRate;
    }
    return getExchangeRateForCurrency(initialData?.originalCurrency || activeTrip?.currency || 'TWD');
  });
  const [isForeignFee, setIsForeignFee] = useState<boolean>(() => {
    return initialData?.foreignFeeRate !== undefined ? initialData.foreignFeeRate > 0 : true;
  });
  const [customFeeRate, setCustomFeeRate] = useState<number>(() => {
    return initialData?.foreignFeeRate ?? 1.5;
  });
  const [isCustomRate, setIsCustomRate] = useState<boolean>(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState<boolean>(false);

  const [type, setType] = useState<TransactionType>(() => {
    return initialData?.type || (sessionStorage.getItem('draft_tx_type') as TransactionType) || 'expense';
  });
  const [amount, setAmount] = useState<string>(() => {
    if (initialData?.originalAmount) return String(initialData.originalAmount);
    return initialData?.amount ? String(initialData.amount) : sessionStorage.getItem('draft_tx_amount') || '';
  });
  const [merchant, setMerchant] = useState<string>(() => {
    return initialData?.merchant || sessionStorage.getItem('draft_tx_merchant') || '';
  });
  const [appliedPattern, setAppliedPattern] = useState<MerchantPattern | null>(null);
  const [accountId, setAccountId] = useState<string>(initialData?.accountId || accounts[0]?.id || '');
  const [transferToAccountId, setTransferToAccountId] = useState<string>(initialData?.transferToAccountId || '');
  const [categoryId, setCategoryId] = useState<string>(initialData?.categoryId || '');
  const [date, setDate] = useState<string>(initialData?.date || format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState<string>(() => {
    return initialData?.note || sessionStorage.getItem('draft_tx_note') || '';
  });
  const [tagInput, setTagInput] = useState<string>(initialData?.tags ? initialData.tags.join(', ') : '');
  const [loading, setLoading] = useState(false);

  // 信用卡分期付款狀態
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentPeriods, setInstallmentPeriods] = useState(3);
  const [isCustomPeriods, setIsCustomPeriods] = useState(false);

  // 信用卡定期訂閱付款狀態
  const [isSubscription, setIsSubscription] = useState(false);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<SubscriptionPeriod>('monthly');
  const [billingCycleDay, setBillingCycleDay] = useState<number>(() => {
    try {
      return parseISO(date).getDate();
    } catch {
      return 1;
    }
  });
  const [recordFirstImmediately, setRecordFirstImmediately] = useState(true);

  // 判斷選中帳戶是否為信用卡且為支出模式
  const selectedAccount = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);
  const isCreditCard = selectedAccount?.type === 'credit_card';
  const canUseInstallment = type === 'expense' && isCreditCard;
  const canUseSubscription = type === 'expense' && isCreditCard;

  // 預先計算並快取帳戶選單標籤，避免每次輸入觸發 O(帳戶數 × 交易數) 重複迴圈
  const accountOptions = useMemo(() => {
    return accounts.map((a) => {
      let labelSuffix = `$${Math.round(a.balance).toLocaleString()}`;
      if (a.type === 'cash' && a.balance === 0) {
        const cashUsage = calculateCashWalletUsage(a, transactions);
        labelSuffix = `純額度 / 本月已用 $${Math.round(cashUsage.currentMonthSpent).toLocaleString()}`;
      } else if (a.type === 'credit_card') {
        const cardUsage = calculateCreditCardUsage(a, transactions);
        labelSuffix = `本期已用 $${Math.round(cardUsage.usedAmount).toLocaleString()}`;
      }
      return {
        value: a.id,
        label: `${a.name} (${labelSuffix})`
      };
    });
  }, [accounts, transactions]);

  // 訂閱下次扣款預覽日期
  const previewNextBilling = useMemo(() => {
    return calculateNextBillingDate(date, subscriptionPeriod, billingCycleDay);
  }, [date, subscriptionPeriod, billingCycleDay]);

  // 切換幣別處理
  const handleCurrencyChange = (newCode: string) => {
    setCurrency(newCode);
    const upper = newCode.toUpperCase();
    if (upper === 'TWD') {
      setExchangeRate(1.0);
      setIsCustomRate(false);
      return;
    }
    const matchedTrip = trips.find((t) => t.id === tripId);
    if (matchedTrip?.customExchangeRate && matchedTrip.currency === upper) {
      setExchangeRate(matchedTrip.customExchangeRate);
    } else {
      setExchangeRate(getExchangeRateForCurrency(upper));
    }
  };

  // 手動更新最新即時匯率
  const handleRefreshLiveRate = async () => {
    if (currency === 'TWD') return;
    setIsUpdatingRates(true);
    try {
      const liveRates = await fetchLiveExchangeRates(true);
      const rate = liveRates[currency] || getExchangeRateForCurrency(currency);
      setExchangeRate(rate);
      setIsCustomRate(false);
      addToast({
        type: 'success',
        message: `已更新 ${currency} 即時匯率：1 ${currency} = ${formatExchangeRate(rate)} NT$`
      });
    } catch (err: any) {
      addToast({ type: 'warning', message: '匯率更新失敗，已維持目前匯率' });
    } finally {
      setIsUpdatingRates(false);
    }
  };

  // 外幣折合台幣試算
  const parsedAmount = parseFloat(amount) || 0;
  const isForeignCurrency = currency !== 'TWD';
  const activeCurrencyInfo = useMemo(() => getCurrencyInfo(currency), [currency]);

  const foreignConversion = useMemo(() => {
    if (!isForeignCurrency) {
      return { baseTWD: parsedAmount, feeTWD: 0, totalTWD: parsedAmount };
    }
    const feeRate = isCreditCard && isForeignFee ? customFeeRate : 0;
    return convertForeignToTWD(parsedAmount, exchangeRate, feeRate);
  }, [isForeignCurrency, parsedAmount, exchangeRate, isCreditCard, isForeignFee, customFeeRate]);

  // 最終折合台幣金額 (用於帳戶餘額、信用卡帳單與總資產計算)
  const effectiveTWDAmount = foreignConversion.totalTWD;

  // 套用熱門訂閱範本
  const handleApplySubscriptionPreset = (preset: SubscriptionPreset) => {
    setMerchant(preset.name);
    setAmount(String(preset.defaultAmount));
    setSubscriptionPeriod(preset.period);
    setIsSubscription(true);
    setIsInstallment(false);
    if (!tagInput.includes('訂閱付款')) {
      setTagInput(tagInput ? `${tagInput}, 訂閱付款` : '訂閱付款');
    }
    const matchedCategory = categories.find(
      (c) => c.type === 'expense' && c.name.includes(preset.categoryKeyword)
    );
    if (matchedCategory) {
      setCategoryId(matchedCategory.id);
    }
  };

  // 分期試算數據 (以外幣折算後之台幣 effectiveTWDAmount 進行分期拆算)
  const activePeriods = Math.max(2, Math.min(60, installmentPeriods));
  const basePeriodAmount = Math.floor(effectiveTWDAmount / activePeriods);
  const remainder = effectiveTWDAmount - basePeriodAmount * activePeriods;
  const firstPeriodAmount = basePeriodAmount + remainder;
  const endPeriodDate = useMemo(() => {
    try {
      return format(addMonths(parseISO(date), activePeriods - 1), 'yyyy-MM-dd');
    } catch {
      return date;
    }
  }, [date, activePeriods]);

  // 取得歷史常去商家清單
  const uniqueMerchants = useMemo(() => getUniqueMerchants(transactions), [transactions]);

  // 地點或商家輸入連動：自動推算並套用最常使用的消費模式
  const handleMerchantChange = (val: string) => {
    setMerchant(val);
    sessionStorage.setItem('draft_tx_merchant', val);

    if (val.trim().length >= 1) {
      const pattern = getMerchantPattern(val, transactions, categories, accounts);
      if (pattern) {
        if (pattern.type && pattern.type !== type) {
          setType(pattern.type);
        }
        if (pattern.categoryId) {
          setCategoryId(pattern.categoryId);
        }
        if (pattern.accountId) {
          setAccountId(pattern.accountId);
        }
        if (pattern.commonTag && !tagInput) {
          setTagInput(pattern.commonTag);
        }
        setAppliedPattern(pattern);
      } else {
        setAppliedPattern(null);
      }
    } else {
      setAppliedPattern(null);
    }
  };

  // 自動同步草稿至 sessionStorage
  const handleAmountChange = (val: string) => {
    setAmount(val);
    sessionStorage.setItem('draft_tx_amount', val);
  };

  const handleNoteChange = (val: string) => {
    setNote(val);
    sessionStorage.setItem('draft_tx_note', val);
  };

  const clearDraft = () => {
    sessionStorage.removeItem('draft_tx_amount');
    sessionStorage.removeItem('draft_tx_note');
    sessionStorage.removeItem('draft_tx_type');
    sessionStorage.removeItem('draft_tx_merchant');
  };

  // 根據收支類型過濾分類
  const filteredCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

  // 若尚未選取分類，預設選取第一項
  React.useEffect(() => {
    if (!categoryId && filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [categoryId, filteredCategories]);

  // 若尚未選取帳戶，預設選取第一項
  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast({ type: 'error', message: '請輸入有效的金額' });
      return;
    }

    if (!accountId) {
      addToast({ type: 'error', message: '請選擇付款/收款帳戶' });
      return;
    }

    if (type === 'transfer' && (!transferToAccountId || transferToAccountId === accountId)) {
      addToast({ type: 'error', message: '轉帳目標帳戶不能與轉出帳戶相同' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const matchedTrip = trips.find((t) => t.id === tripId);
      if (matchedTrip) {
        if (!tags.includes(matchedTrip.name)) {
          tags.push(matchedTrip.name);
        }
      } else if (isForeignCurrency) {
        if (!tags.includes('外幣記帳')) {
          tags.push('外幣記帳');
        }
      }

      const shouldExcludeFromBudget = Boolean(matchedTrip?.excludeFromMonthlyBudget);

      // 分期付款模式：自動依期數產生對應交易並批次寫入
      if (canUseInstallment && isInstallment) {
        if (!tags.includes('分期付款')) {
          tags.push('分期付款');
        }

        const groupId = 'inst_' + uuidv4().slice(0, 10);
        const installmentTxs: Transaction[] = [];

        for (let i = 0; i < activePeriods; i++) {
          const curPeriod = i + 1;
          const curAmount = i === 0 ? firstPeriodAmount : basePeriodAmount;
          const curDate = format(addMonths(parseISO(date), i), 'yyyy-MM-dd');
          const periodNote = note.trim()
            ? `${note.trim()} (${curPeriod}/${activePeriods}期)`
            : `分期付款 (${curPeriod}/${activePeriods}期)`;

          installmentTxs.push({
            id: 'tx_' + uuidv4().slice(0, 10),
            userId: user.uid,
            accountId,
            categoryId,
            type: 'expense',
            amount: curAmount,
            merchant: merchant.trim() || undefined,
            note: periodNote,
            tags,
            date: curDate,
            installment: {
              groupId,
              currentPeriod: curPeriod,
              totalPeriods: activePeriods,
              totalAmount: effectiveTWDAmount,
              periodAmount: curAmount
            },
            // 外幣資訊
            originalCurrency: isForeignCurrency ? currency : undefined,
            originalAmount: isForeignCurrency && i === 0 ? parsedAmount : undefined,
            exchangeRate: isForeignCurrency ? exchangeRate : undefined,
            foreignFeeRate: isForeignCurrency && isForeignFee ? customFeeRate : undefined,
            foreignFeeTWD: isForeignCurrency && isForeignFee && i === 0 ? foreignConversion.feeTWD : undefined,
            tripId: tripId || undefined,
            excludeFromBudget: shouldExcludeFromBudget,
            createdAt: now,
            updatedAt: now
          });
        }

        await addInstallmentTransactions(installmentTxs);
        hapticSuccess();
        clearDraft();
        addToast({
          type: 'success',
          message: `已建立信用卡分期（共 ${activePeriods} 期，每期約 NT$ ${basePeriodAmount.toLocaleString()}）！`
        });
        if (onSuccess) onSuccess();
        return;
      }

      // 信用卡定期訂閱付款模式：建立訂閱排程並視需要紀錄首期支出
      if (canUseSubscription && isSubscription) {
        const subTags = Array.from(new Set([...tags, '訂閱付款']));
        const subId = 'sub_' + uuidv4().slice(0, 10);
        const subName = merchant.trim() || note.trim() || '信用卡定期訂閱';
        const initialDate = date;
        const nextDate = recordFirstImmediately
          ? calculateNextBillingDate(initialDate, subscriptionPeriod, billingCycleDay)
          : initialDate;

        const newSubscription: Subscription = {
          id: subId,
          userId: user.uid,
          name: subName,
          accountId,
          categoryId,
          amount: effectiveTWDAmount,
          period: subscriptionPeriod,
          billingCycleDay,
          startDate: initialDate,
          nextBillingDate: nextDate,
          status: 'active',
          autoRecord: true,
          note: note.trim(),
          tags: subTags,
          lastRecordedDate: recordFirstImmediately ? initialDate : undefined,
          createdAt: now,
          updatedAt: now
        };

        await saveSubscription(newSubscription);

        if (recordFirstImmediately) {
          const initialTx: Transaction = {
            id: initialData?.id || 'tx_' + uuidv4().slice(0, 10),
            userId: user.uid,
            accountId,
            categoryId,
            type: 'expense',
            amount: effectiveTWDAmount,
            merchant: merchant.trim() || undefined,
            note: note.trim() ? `${note.trim()} (首期訂閱扣款)` : `${subName} (首期訂閱扣款)`,
            tags: subTags,
            date: initialDate,
            subscription: {
              subscriptionId: subId,
              period: subscriptionPeriod
            },
            originalCurrency: isForeignCurrency ? currency : undefined,
            originalAmount: isForeignCurrency ? parsedAmount : undefined,
            exchangeRate: isForeignCurrency ? exchangeRate : undefined,
            foreignFeeRate: isForeignCurrency && isForeignFee ? customFeeRate : undefined,
            foreignFeeTWD: isForeignCurrency && isForeignFee ? foreignConversion.feeTWD : undefined,
            tripId: tripId || undefined,
            excludeFromBudget: shouldExcludeFromBudget,
            createdAt: now,
            updatedAt: now
          };
          await addTransaction(initialTx);
        }

        hapticSuccess();
        clearDraft();
        addToast({
          type: 'success',
          message: `已建立「${subName}」信用卡定期訂閱！系統將在指定時間自行紀錄。`
        });
        if (onSuccess) onSuccess();
        return;
      }

      // 一般交易建立
      const transaction: Transaction = {
        id: initialData?.id || 'tx_' + uuidv4().slice(0, 10),
        userId: user.uid,
        accountId,
        categoryId: type === 'transfer' ? '' : categoryId,
        type,
        amount: effectiveTWDAmount,
        merchant: merchant.trim() || undefined,
        note: note.trim(),
        tags: tags.length > 0 ? tags : [],
        date,
        originalCurrency: isForeignCurrency ? currency : undefined,
        originalAmount: isForeignCurrency ? parsedAmount : undefined,
        exchangeRate: isForeignCurrency ? exchangeRate : undefined,
        foreignFeeRate: isForeignCurrency && isCreditCard && isForeignFee ? customFeeRate : undefined,
        foreignFeeTWD: isForeignCurrency && isCreditCard && isForeignFee ? foreignConversion.feeTWD : undefined,
        tripId: tripId || undefined,
        excludeFromBudget: shouldExcludeFromBudget,
        source: isForeignCurrency || tripId ? 'travel' : 'manual',
        createdAt: initialData?.createdAt || now,
        updatedAt: now
      };

      if (type === 'transfer' && transferToAccountId) {
        transaction.transferToAccountId = transferToAccountId;
      }

      await addTransaction(transaction);
      hapticSuccess();
      clearDraft();
      addToast({
        type: 'success',
        message: isForeignCurrency
          ? `外幣記帳已儲存！${activeCurrencyInfo.symbol}${parsedAmount.toLocaleString()} ➔ NT$ ${effectiveTWDAmount.toLocaleString()}`
          : '記帳已儲存！'
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
      {/* 交易類型切換 Tab */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
        {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => {
          const isActive = type === t;
          const label = t === 'expense' ? '支出' : t === 'income' ? '收入' : '轉帳';
          const activeColor = t === 'expense' ? 'var(--expense)' : t === 'income' ? 'var(--income)' : 'var(--info)';

          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCategoryId('');
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? activeColor : 'transparent',
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
        })}
      </div>

      {/* 貨幣與旅行專案選擇列 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Globe size={14} color="var(--primary)" />
            <span>消費幣別</span>
          </div>

          {/* 歸屬旅程下拉選擇 (若有旅程專案) */}
          {trips.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plane size={13} color="var(--primary-light)" />
              <select
                value={tripId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setTripId(selectedId);
                  const foundTrip = trips.find((t) => t.id === selectedId);
                  if (foundTrip) {
                    handleCurrencyChange(foundTrip.currency);
                  }
                }}
                style={{
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">無歸屬旅行專案</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    ✈️ {t.name} ({t.currency})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 常用貨幣快捷標籤 */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'THB'].map((code) => {
            const isSelected = currency === code;
            const info = getCurrencyInfo(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleCurrencyChange(code)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--primary-light)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <span>{info.flag}</span>
                <span>{info.code}</span>
              </button>
            );
          })}

          {/* 更多幣別下拉 */}
          <select
            value={['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'THB'].includes(currency) ? '' : currency}
            onChange={(e) => {
              if (e.target.value) handleCurrencyChange(e.target.value);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">更多外幣...</option>
            {SUPPORTED_CURRENCIES.filter((c) => !['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'THB'].includes(c.code)).map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.code} ({c.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 金額輸入 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {canUseInstallment && isInstallment
              ? `分期總金額 (${activeCurrencyInfo.symbol} ${activeCurrencyInfo.code})`
              : canUseSubscription && isSubscription
              ? `每期訂閱金額 (${activeCurrencyInfo.symbol} ${activeCurrencyInfo.code} / ${subscriptionPeriod === 'yearly' ? '年' : subscriptionPeriod === 'weekly' ? '週' : '月'})`
              : `金額 (${activeCurrencyInfo.symbol} ${activeCurrencyInfo.code})`}
          </label>
          {canUseInstallment && isInstallment && effectiveTWDAmount > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--expense)', fontWeight: 700 }}>
              分 {activePeriods} 期 • 每期約 NT$ {basePeriodAmount.toLocaleString()}
            </span>
          )}
          {canUseSubscription && isSubscription && effectiveTWDAmount > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--purple)', fontWeight: 700 }}>
              每期 NT$ {effectiveTWDAmount.toLocaleString()} • 每月 {billingCycleDay} 號扣款
            </span>
          )}
        </div>
        <div style={{ position: 'relative', marginTop: '4px' }}>
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: activeCurrencyInfo.symbol.length > 2 ? '15px' : '20px',
              fontWeight: 800,
              color: type === 'expense' ? 'var(--expense)' : type === 'income' ? 'var(--income)' : 'var(--info)'
            }}
          >
            {activeCurrencyInfo.symbol}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            required
            autoFocus
            style={{
              width: '100%',
              padding: activeCurrencyInfo.symbol.length > 2 ? '12px 14px 12px 48px' : '12px 14px 12px 36px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '24px',
              fontWeight: 800,
              outline: 'none',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        {/* 外幣即時匯率換算與手續費計算卡片 */}
        {isForeignCurrency && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px'
            }}
          >
            {/* 匯率資訊列 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <span>即時參考匯率：</span>
                {isCustomRate ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      step="any"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '75px',
                        padding: '2px 4px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TWD</span>
                  </div>
                ) : (
                  <strong style={{ color: 'var(--text-primary)' }}>
                    1 {currency} ≈ {formatExchangeRate(exchangeRate)} NT$
                  </strong>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomRate(!isCustomRate)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary-light)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {isCustomRate ? '完成微調' : '手動微調匯率'}
                </button>

                <button
                  type="button"
                  onClick={handleRefreshLiveRate}
                  disabled={isUpdatingRates}
                  title="更新最新即時匯率"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 6px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px'
                  }}
                >
                  <RefreshCw size={12} className={isUpdatingRates ? 'animate-spin' : ''} />
                  <span>更新</span>
                </button>
              </div>
            </div>

            {/* 信用卡海外交易手續費開關 (當帳戶為信用卡且為支出時) */}
            {canUseInstallment && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} color="var(--purple)" />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>海外刷卡手續費 (1.5%)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isForeignFee && foreignConversion.feeTWD > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--expense)' }}>
                      +NT$ {foreignConversion.feeTWD.toLocaleString()}
                    </span>
                  )}
                  <input
                    type="checkbox"
                    checked={isForeignFee}
                    onChange={(e) => setIsForeignFee(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* 即時折合台幣結果總結 */}
            {parsedAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '4px',
                  borderTop: '1px solid var(--border)'
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  原幣折合台幣：
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {activeCurrencyInfo.symbol}{parsedAmount.toLocaleString()}
                  </span>
                  <ArrowRight size={12} color="var(--text-muted)" />
                  <strong style={{ fontSize: '15px', color: type === 'expense' ? 'var(--expense)' : 'var(--income)', fontWeight: 800 }}>
                    NT$ {effectiveTWDAmount.toLocaleString()}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 地點或商家 (輸入時自動套用最常使用之消費模式) */}
      <div>
        <Input
          label="地點或商家"
          placeholder="例如：麥當勞、7-ELEVEN、全聯、星巴克"
          value={merchant}
          onChange={(e) => handleMerchantChange(e.target.value)}
          list="merchant-suggestions"
          icon={<MapPin size={16} />}
        />
        <datalist id="merchant-suggestions">
          {uniqueMerchants.map((m) => (
            <option key={m.name} value={m.name} />
          ))}
        </datalist>

        {/* 自動套用模式提示 */}
        {appliedPattern && (
          <div
            style={{
              marginTop: '6px',
              padding: '6px 10px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={14} />
            <span>
              已自動套用<strong>「{appliedPattern.merchant}」</strong>常用模式：
              {appliedPattern.categoryName && (
                <span style={{ color: appliedPattern.categoryColor || 'inherit', fontWeight: 700 }}>
                  {appliedPattern.categoryName}
                </span>
              )}
              {appliedPattern.categoryName && appliedPattern.accountName && ' • '}
              {appliedPattern.accountName && <span style={{ fontWeight: 600 }}>{appliedPattern.accountName}</span>}
            </span>
          </div>
        )}

        {/* 歷史常去商家快捷標籤 */}
        {!merchant && uniqueMerchants.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>常去：</span>
            {uniqueMerchants.slice(0, 5).map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => handleMerchantChange(m.name)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 帳戶選擇 */}
      <div style={{ display: 'grid', gridTemplateColumns: type === 'transfer' ? '1fr 1fr' : '1fr', gap: '10px' }}>
        <Select
          label={type === 'transfer' ? '轉出帳戶' : '帳戶'}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accountOptions}
        />

        {type === 'transfer' && (
          <Select
            label="轉入目標帳戶"
            value={transferToAccountId}
            onChange={(e) => setTransferToAccountId(e.target.value)}
            options={[
              { value: '', label: '請選擇目標帳戶' },
              ...accountOptions.filter((opt) => opt.value !== accountId)
            ]}
          />
        )}
      </div>

      {/* 信用卡分期付款選項 (當支出且帳戶為信用卡時顯示) */}
      {canUseInstallment && (
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: isInstallment ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-tertiary)',
            border: isInstallment ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color={isInstallment ? '#3b82f6' : 'var(--text-secondary)'} />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  💳 信用卡分期付款
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  將此筆消費按月拆分為多期每期扣款
                </div>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isInstallment;
                setIsInstallment(next);
                if (next) setIsSubscription(false);
              }}
              style={{
                width: '42px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isInstallment ? 'var(--primary)' : 'var(--border)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: isInstallment ? '21px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}
              />
            </button>
          </div>

          {/* 分期詳細設定與試算 */}
          {isInstallment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  選擇分期期數
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[3, 6, 12, 24].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setInstallmentPeriods(p);
                        setIsCustomPeriods(false);
                      }}
                      style={{
                        flex: '1 1 50px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: !isCustomPeriods && installmentPeriods === p ? '1px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: !isCustomPeriods && installmentPeriods === p ? 'var(--primary)' : 'var(--bg-secondary)',
                        color: !isCustomPeriods && installmentPeriods === p ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {p} 期
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomPeriods(true)}
                    style={{
                      flex: '1 1 50px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: isCustomPeriods ? '1px solid var(--primary)' : '1px solid var(--border)',
                      backgroundColor: isCustomPeriods ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: isCustomPeriods ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    自訂
                  </button>
                </div>

                {isCustomPeriods && (
                  <div style={{ marginTop: '8px' }}>
                    <Input
                      type="number"
                      min={2}
                      max={60}
                      label="自訂期數 (2 ~ 60 期)"
                      value={String(installmentPeriods)}
                      onChange={(e) => setInstallmentPeriods(Math.max(2, Math.min(60, parseInt(e.target.value) || 2)))}
                      placeholder="請輸入期數 (例如：5)"
                    />
                  </div>
                )}
              </div>

              {/* 試算結果卡片 */}
              {parsedAmount > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px dashed rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>消費總金額：</span>
                    <strong style={{ color: 'var(--text-primary)' }}>${parsedAmount.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>每期應繳金額：</span>
                    <strong style={{ color: 'var(--expense)', fontSize: '13px' }}>
                      {remainder === 0
                        ? `$${basePeriodAmount.toLocaleString()} / 期 (共 ${activePeriods} 期)`
                        : `首期 $${firstPeriodAmount.toLocaleString()}，後續 $${basePeriodAmount.toLocaleString()} / 期`}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <span>分期起訖日：</span>
                    <span>{date} 至 {endPeriodDate}</span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--primary-light)', lineHeight: 1.4 }}>
                    ✨ 系統將自動為您依序建立 {activePeriods} 筆按月到期的每期扣款紀錄，隨結帳日自動納入當期帳單。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 信用卡定期訂閱付款選項 (當支出且帳戶為信用卡時顯示) */}
      {canUseSubscription && (
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: isSubscription ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-tertiary)',
            border: isSubscription ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Repeat size={18} color={isSubscription ? 'var(--purple)' : 'var(--text-secondary)'} />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  🔁 信用卡定期訂閱付款
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  設定週期扣款，在指定時間自行紀錄並可隨時取消
                </div>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isSubscription;
                setIsSubscription(next);
                if (next) setIsInstallment(false);
              }}
              style={{
                width: '42px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isSubscription ? 'var(--purple)' : 'var(--border)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  left: isSubscription ? '21px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}
              />
            </button>
          </div>

          {/* 訂閱詳細設定與試算 */}
          {isSubscription && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
              {/* 熱門訂閱範本快捷點選 */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  快速套用常見訂閱服務：
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {POPULAR_SUBSCRIPTION_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleApplySubscriptionPreset(p)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: merchant === p.name ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-secondary)',
                        border: merchant === p.name ? '1px solid var(--purple)' : '1px solid var(--border)',
                        color: merchant === p.name ? 'var(--purple)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p.name} (${p.defaultAmount})
                    </button>
                  ))}
                </div>
              </div>

              {/* 扣款週期與指定扣款日 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    扣款週期
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { key: 'monthly', label: '每月' },
                      { key: 'yearly', label: '每年' },
                      { key: 'weekly', label: '每週' }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSubscriptionPeriod(item.key as SubscriptionPeriod)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 'var(--radius-sm)',
                          border: subscriptionPeriod === item.key ? '1px solid var(--purple)' : '1px solid var(--border)',
                          backgroundColor: subscriptionPeriod === item.key ? 'var(--purple)' : 'var(--bg-secondary)',
                          color: subscriptionPeriod === item.key ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    label="每月指定扣款日 (1 ~ 31 號)"
                    value={String(billingCycleDay)}
                    onChange={(e) => {
                      const d = parseInt(e.target.value) || 1;
                      setBillingCycleDay(Math.max(1, Math.min(31, d)));
                    }}
                    placeholder="例如：15"
                  />
                </div>
              </div>

              {/* 首期扣款設定 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px'
                }}
              >
                <input
                  type="checkbox"
                  id="recordFirstImmediately"
                  checked={recordFirstImmediately}
                  onChange={(e) => setRecordFirstImmediately(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--purple)', cursor: 'pointer' }}
                />
                <label htmlFor="recordFirstImmediately" style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
                  立即記錄首期扣款 (日期為：<strong>{date}</strong>)
                </label>
              </div>

              {/* 試算與說明卡片 */}
              {parsedAmount > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    border: '1px dashed rgba(168, 85, 247, 0.35)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>訂閱服務名稱：</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{merchant || note || '信用卡定期訂閱'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>每期扣款金額：</span>
                    <strong style={{ color: 'var(--expense)', fontSize: '13px' }}>
                      ${parsedAmount.toLocaleString()} / {subscriptionPeriod === 'yearly' ? '年' : subscriptionPeriod === 'weekly' ? '週' : '月'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <span>下次自動扣款日：</span>
                    <span style={{ color: 'var(--purple)', fontWeight: 700 }}>
                      {recordFirstImmediately ? previewNextBilling : date} (每月 {billingCycleDay} 號)
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    ✨ 系統將在指定時間於背景自行紀錄支出並自動計入信用卡帳單；您可以隨時在「訂閱管理」中暫停或取消訂閱以停止自動紀錄。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 分類選擇 (非轉帳時顯示) */}
      {type !== 'transfer' && (
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
            分類選擇
          </label>
          <CategoryPicker
            categories={filteredCategories}
            selectedId={categoryId}
            onSelect={(id) => setCategoryId(id)}
          />
        </div>
      )}

      {/* 日期與備註 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label="日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="備註說明"
          placeholder="例如：午餐拉麵、搭計程車"
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
        />
      </div>

      {/* 標籤 (選填) */}
      <Input
        label="標籤 (以逗號分隔)"
        placeholder="例如：外食, 朋友聚餐, 報帳"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
      />

      {/* 按鈕列 */}
      <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-2)' }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
          確認儲存
        </Button>
      </div>
    </form>
  );
};
