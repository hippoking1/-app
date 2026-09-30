import { SubscriptionPeriod } from '@/types';
import {
  parseISO,
  format,
  addMonths,
  addYears,
  addWeeks,
  getDaysInMonth,
  setDate,
  differenceInDays,
  startOfDay
} from 'date-fns';

/**
 * 試算下一期扣款日期 (精準維持原始扣款日，並防禦小月/閏月天數溢出)
 */
export function calculateNextBillingDate(
  currentDateStr: string,
  period: SubscriptionPeriod = 'monthly',
  cycleDay?: number
): string {
  try {
    const current = parseISO(currentDateStr);

    if (period === 'weekly') {
      return format(addWeeks(current, 1), 'yyyy-MM-dd');
    }

    if (period === 'yearly') {
      return format(addYears(current, 1), 'yyyy-MM-dd');
    }

    // monthly (預設每月扣款)
    const nextMonth = addMonths(current, 1);
    const targetDay = cycleDay || current.getDate();
    const daysInNextMonth = getDaysInMonth(nextMonth);
    const clampedDay = Math.min(targetDay, daysInNextMonth);
    const result = setDate(nextMonth, clampedDay);

    return format(result, 'yyyy-MM-dd');
  } catch (err) {
    console.error('[subscriptionUtils] calculateNextBillingDate error:', err);
    return currentDateStr;
  }
}

/**
 * 計算距離下次扣款剩餘天數 (今日為 0 天)
 */
export function getDaysUntilNextBilling(nextBillingDateStr: string): number {
  try {
    const today = startOfDay(new Date());
    const next = startOfDay(parseISO(nextBillingDateStr));
    return differenceInDays(next, today);
  } catch {
    return 0;
  }
}

/**
 * 熱門常用訂閱服務預設範本
 */
export interface SubscriptionPreset {
  name: string;
  defaultAmount: number;
  period: SubscriptionPeriod;
  categoryKeyword: string;
  iconName?: string;
  description: string;
}

export const POPULAR_SUBSCRIPTION_PRESETS: SubscriptionPreset[] = [
  {
    name: 'Netflix',
    defaultAmount: 390,
    period: 'monthly',
    categoryKeyword: '娛樂',
    iconName: 'Tv',
    description: '標準高畫質串流方案'
  },
  {
    name: 'Spotify',
    defaultAmount: 149,
    period: 'monthly',
    categoryKeyword: '娛樂',
    iconName: 'Music',
    description: '個人 Premium 音樂方案'
  },
  {
    name: 'YouTube Premium',
    defaultAmount: 199,
    period: 'monthly',
    categoryKeyword: '娛樂',
    iconName: 'Video',
    description: '無廣告觀看與背景播放'
  },
  {
    name: 'ChatGPT Plus',
    defaultAmount: 650,
    period: 'monthly',
    categoryKeyword: '購物',
    iconName: 'Sparkles',
    description: 'OpenAI 智慧模型訂閱'
  },
  {
    name: 'iCloud+ 雲端儲存',
    defaultAmount: 90,
    period: 'monthly',
    categoryKeyword: '居家',
    iconName: 'Cloud',
    description: '200GB 雲端備份空間'
  },
  {
    name: 'Disney+',
    defaultAmount: 270,
    period: 'monthly',
    categoryKeyword: '娛樂',
    iconName: 'Film',
    description: '迪士尼、漫威與星戰串流'
  },
  {
    name: 'Google One',
    defaultAmount: 65,
    period: 'monthly',
    categoryKeyword: '居家',
    iconName: 'Cloud',
    description: '100GB Google 雲端儲存'
  },
  {
    name: 'Adobe Creative Cloud',
    defaultAmount: 1680,
    period: 'monthly',
    categoryKeyword: '購物',
    iconName: 'Palette',
    description: '設計全套創意軟體'
  }
];
