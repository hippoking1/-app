import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Tag, Building2, Wallet, CreditCard, HelpCircle, Utensils, Car, ShoppingBag, Gamepad2, Home, HeartPulse, GraduationCap, TrendingUp, MoreHorizontal, Briefcase, Award, LineChart, Laptop, PiggyBank } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Utensils,
  Car,
  ShoppingBag,
  Gamepad2,
  Home,
  HeartPulse,
  GraduationCap,
  TrendingUp,
  MoreHorizontal,
  Briefcase,
  Award,
  LineChart,
  Laptop,
  PiggyBank,
  Wallet,
  Building2,
  CreditCard,
  Tag,
  HelpCircle
};

/**
 * 安全取得 Lucide 圖示元件，絕不回傳 undefined
 */
export function getSafeIcon(iconName?: string, fallback: React.ComponentType<any> = Tag): React.ComponentType<any> {
  if (!iconName) return fallback;
  
  if (ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }

  const dynamicIcon = (LucideIcons as any)[iconName];
  if (typeof dynamicIcon === 'function' || (typeof dynamicIcon === 'object' && dynamicIcon !== null)) {
    return dynamicIcon;
  }

  return fallback;
}
