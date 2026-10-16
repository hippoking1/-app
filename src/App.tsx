import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useAppStore } from '@/stores/appStore';
import { subscribeAuthState } from '@/services/auth';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRuntimeGuard } from '@/components/common/AppRuntimeGuard';

const Login = React.lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = React.lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Transactions = React.lazy(() => import('@/pages/Transactions').then((m) => ({ default: m.Transactions })));
const Accounts = React.lazy(() => import('@/pages/Accounts').then((m) => ({ default: m.Accounts })));
const BudgetPage = React.lazy(() => import('@/pages/Budget').then((m) => ({ default: m.BudgetPage })));
const Analytics = React.lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.Analytics })));
const Stocks = React.lazy(() => import('@/pages/Stocks').then((m) => ({ default: m.Stocks })));
const AIBookkeeper = React.lazy(() => import('@/pages/AIBookkeeper').then((m) => ({ default: m.AIBookkeeper })));
const Settings = React.lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })));

export const App: React.FC = () => {
  const { setUser, setIsLoadingAuth } = useAppStore();

  useEffect(() => {
    // 訂閱使用者登入狀態
    const unsubscribe = subscribeAuthState((user) => {
      setUser(user);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [setUser, setIsLoadingAuth]);

  return (
    <ErrorBoundary>
      <AppRuntimeGuard />
      <HashRouter>
        <React.Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* 需認證之主框架路由 */}
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/budget" element={<BudgetPage />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/stocks" element={<Stocks />} />
              <Route path="/ai" element={<AIBookkeeper />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* 404 Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
