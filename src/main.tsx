import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/animations.css';
import { registerSW } from 'virtual:pwa-register';

// 自動更新 Service Worker 快取，確保發布新版時使用者立即獲取最新程式碼
registerSW({ immediate: true });

// 根據儲存的設定初始化主題
const savedTheme = localStorage.getItem('smart_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
