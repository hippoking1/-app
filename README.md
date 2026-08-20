# 💰 智慧記帳與資產管理 Web App (Smart Expense Tracker)

基於 **React 19 + TypeScript + Vite** 開發的現代化全功能個人財務與資產管理應用程式。整合 **Google Gemini 3.7 Flash AI** 自然語言記帳、**Yahoo Finance 全球/台股 (上市/上櫃/興櫃) 即時報價**、**Firebase 雲端資料庫** 及 **PWA 離線安裝支援**。

---

## 🌟 核心功能特色

### 1. 🤖 Gemini 3.7 Flash AI 智慧記帳
- **自然語言秒速解析**：支援隨意輸入（或語音轉文字）如 `今天午餐在麥當勞刷卡吃了 180 元`、`昨天搭計程車花了 250`、`領薪水 55000`。
- **全自動結構化**：精確辨識金額、交易類型（支出/收入/轉帳）、最佳預算分類、扣款帳戶、日期推算及繁體中文標籤。
- **AI 財務健康度洞察**：定期分析收支比例、超支類別並給予客製化省錢與理財優化建議。

### 2. 📈 股票資產與即時損益 (Yahoo Finance API)
- **台股全覆蓋**：全面支援 **上市 (`.TW`)**、**上櫃 (`.TWO`)** 與 **興櫃市場 (`.TWO` 如 7829 全景軟體等)**。
- **美股市場**：支援 Apple (`AAPL`)、NVIDIA (`NVDA`)、Tesla (`TSLA`) 等美股行情。
- **即時/盤後市值計算**：一鍵批次更新持倉最新報價，自動折算台幣總市值、報酬率及今日預估損益。
- **靈活建倉**：支援初始建倉、買進加碼、分批賣出與自訂成本模式。

### 3. 💳 多帳戶與信用卡額度管理
- 支援現金、銀行活存、悠遊卡、電子支付與信用卡。
- **信用卡額度監控**：支援設定信用額度、自動計算可用餘額與使用率進度條。
- **帳戶轉帳**：支援帳戶間資金調撥，雙向自動扣補餘額。

### 4. 📊 視覺化預算與財務報表
- **分類預算監控**：設定每月/每類預算上限，提供超支進度條與預警提示。
- **多維度統計圖表**：月度收支趨勢折線圖、分類佔比圓餅圖與資產分佈圖。

### 5. 🔒 雲端同步與帳號安全
- **Firebase Firestore 即時資料庫**：跨裝置毫秒級雙向同步。
- **Google 快速登入**：支援一鍵 Google 授權登入；訪客無痛體驗並隨時升級綁定。
- **PWA 支援**：支援手機（iOS/Android）與電腦（Chrome/Edge）安裝為獨立原生 App。

---

## 🛠️ 技術架構

| 領域 | 技術選型 |
| :--- | :--- |
| **前端核心** | React 19、TypeScript、Vite 6、HashRouter |
| **狀態管理** | Zustand 5、date-fns、uuid |
| **圖表與視覺** | Recharts、Lucide React、Glassmorphism 深色/淺色主題 |
| **後端代理** | Google Apps Script (GAS) Web App |
| **AI 模型** | Google Gemini 3.7 Flash API |
| **金融報價** | Yahoo Finance v8 API + 全球即時 Search API |
| **資料庫 & 認證**| Firebase Authentication + Cloud Firestore |
| **部署發布** | GitHub Pages、Vite PWA (Workbox) |

---

## 🚀 完整部署教學

### 步驟 1：建立並配置 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/) 點擊 **「新增專案」**。
2. **啟用 Authentication (身分驗證)**：
   - 點擊左側「建置」➔「Authentication」➔「開始使用」。
   - 在「登入方法」中啟用 **Google** 與 **匿名 (Anonymous)**。
   - 前往「設定」➔「已授權網域」，新增你的 GitHub Pages 網域（例如：`hippoking1.github.io`）。
3. **啟用 Cloud Firestore (資料庫)**：
   - 點擊左側「Firestore Database」➔「建立資料庫」➔ 選擇伺服器位置（建議 `asia-east1` 台灣）。
   - 在「規則」頁籤貼入以下安全規則並發布：
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
4. **取得 Web 應用程式配置**：
   - 點擊專案首頁齒輪圖示「專案設定」➔「您的應用程式」➔ 點擊 Web 圖示 `</>`。
   - 複製 `firebaseConfig` 內的 6 個欄位值。

---

### 步驟 2：取得 Google Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/) 登入 Google 帳號。
2. 點擊 **「Get API key」** ➔ **「Create API key」**。
3. 複製產生的 API Key（免費方案即可供個人記帳使用）。

---

### 步驟 3：部署 Google Apps Script (GAS) 後端

1. 開啟 [Google Apps Script 雲端編輯器](https://script.google.com/) ➔ 點擊 **「新增專案」**。
2. 將本專案中的 [`gas/Code.gs`](gas/Code.gs) 全部程式碼複製並貼上覆蓋。
3. **設定 Gemini API Key**：
   - 點擊左側齒輪圖示 **「專案設定」** ➔ 滑至最下方 **「指令碼屬性」**。
   - 點擊「新增指令碼屬性」：
     - 屬性名稱：`GEMINI_API_KEY`
     - 屬性值：貼上步驟 2 取得的 Gemini API Key ➔ 點擊「儲存」。
4. **發布為 Web 應用程式**：
   - 點擊右上角 **「部署」 ➔ 「新增部署作業」**。
   - 齒輪圖示選擇 **「網路應用程式」**：
     - 說明：`Smart Expense API v1`
     - 執行身分：**「我」 (Me)**
     - 誰可以存取：**「所有人」 (Anyone)** ⚠️ *務必選擇 Anyone*
   - 點擊「部署」並授權權限，複製取得的 **Web 應用程式網址**（結尾為 `/exec`）。

---

### 步驟 4：本機環境設定與測試

1. Clone 本專案並安裝相依套件：
   ```bash
   git clone https://github.com/hippoking1/-app.git
   cd -app
   npm install
   ```

2. 建立 `.env` 檔案（可複製 `.env.example`）：
   ```bash
   cp .env.example .env
   ```

3. 在 `.env` 中填入你的設定：
   ```env
   # Firebase 配置
   VITE_FIREBASE_API_KEY=你的_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN=你的_PROJECT_ID.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=你的_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET=你的_PROJECT_ID.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=你的_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID=你的_FIREBASE_APP_ID

   # Google Apps Script 部署 URL
   VITE_GAS_DEPLOYMENT_URL=https://script.google.com/macros/s/你的_DEPLOYMENT_ID/exec
   ```

4. 啟動本機開發伺服器：
   ```bash
   npm run dev
   ```

---

### 步驟 5：免費一鍵部署至 GitHub Pages

本專案已配置 `gh-pages` 部署腳本：

1. 確認 `vite.config.ts` 中的 `base` 與你的 GitHub Repository 名稱一致：
   ```ts
   export default defineConfig({
     base: '/-app/', // 若 repo 名稱為 -app 則設定為 '/-app/'，根網域則為 '/'
     // ...
   });
   ```

2. 執行一鍵自動編譯並部署：
   ```bash
   npm run deploy
   ```

3. 前往 GitHub Repo ➔ **Settings** ➔ **Pages**，確認 Source 設定為 `gh-pages` 分支的 `/ (root)`。
4. 稍待 1~2 分鐘即可由專屬網址開啟 App（例如 `https://<username>.github.io/<repo>/`）！

---

## ⚡ 內建連線診斷工具

登入系統後，隨時可進入 **「系統設定」 ➔ 點擊「⚡ 立即進行完整診斷」**：
- 🟢 **GAS 伺服器 (doPost) 狀態**：即時測試網路延遲。
- 🟢 **Gemini 3.7 Flash API 金鑰生效狀態**：發送測試文字給 LLM 並驗證真實結構化回傳。
- 🟢 **Yahoo Finance 台股 2880 (華南金) 與興櫃報價測試**：即時獲取最新市場價格。

---

## 📁 專案目錄結構

```text
├── gas/
│   └── Code.gs               # GAS 一體化後端 (Gemini 3.7 Flash + Yahoo Finance 引擎)
├── public/                   # PWA Manifest、App Icons 等靜態資源
├── src/
│   ├── components/
│   │   ├── accounts/         # 帳戶與信用卡管理元件
│   │   ├── ai/               # AI 記帳解析卡片
│   │   ├── budget/           # 預算卡片與設定表單
│   │   ├── common/           # 全域 ErrorBoundary 等通用防護元件
│   │   ├── layout/           # 側邊欄、頂部列、底部導航與 AppShell
│   │   ├── stocks/           # 股票持倉卡、Yahoo 搜尋彈窗與建倉表單
│   │   ├── transactions/     # 記帳清單、分類選擇器與快速表單
│   │   └── ui/               # 按鈕、卡片、彈窗、輸入框等基礎 UI 元件
│   ├── hooks/                # Firestore 監聽與股票查詢 Custom Hooks
│   ├── lib/                  # Firebase SDK 初始化配置
│   ├── pages/                # 儀表板、明細、帳戶、預算、股票、AI、設定等頁面
│   ├── services/             # Auth、Firestore、GAS 呼叫模組與種子資料
│   ├── stores/               # Zustand 全域狀態管理 (認證、主題、Modal)
│   ├── types/                # TypeScript 財務與股票型別定義
│   └── utils/                # 財務計算、圖示解析、防禦性計算工具
├── .env.example              # 環境變數範本
├── package.json              # 專案相依套件與指令設定
└── vite.config.ts            # Vite 與 PWA 配置
```

---

## 📄 開源授權 (License)

本專案採用 [MIT License](LICENSE) 授權。
