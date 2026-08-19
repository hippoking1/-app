import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Transactions } from '@/pages/Transactions';
import { Accounts } from '@/pages/Accounts';
import { BudgetPage } from '@/pages/Budget';
import { Analytics } from '@/pages/Analytics';
import { Stocks } from '@/pages/Stocks';
import { AIBookkeeper } from '@/pages/AIBookkeeper';
import { Settings } from '@/pages/Settings';
import { useAppStore } from '@/stores/appStore';
import { subscribeAuthState } from '@/services/auth';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

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
      <HashRouter>
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
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
