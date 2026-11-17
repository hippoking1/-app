import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/animations.css';

// 根據儲存的設定初始化主題與市場色彩慣例
const savedTheme = localStorage.getItem('smart_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const savedMarketColor = localStorage.getItem('smart_market_color') || 'intl';
document.documentElement.setAttribute('data-market-color', savedMarketColor);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
