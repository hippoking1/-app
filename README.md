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
- **衍生即時餘額引擎**：帳戶餘額以基準餘額 + 交易流水分層動態精準計算，修正信用卡本期已刷未出帳 vs. 繳款沖銷歷史欠款邏輯，生活支出排除投資買賣。
- **信用卡分期付款功能**：支出紀錄選擇信用卡時，支援一鍵開啟「分期付款」，可選擇 3、6、12、24 期或自訂期數（2~60 期）。系統自動依總金額試算每期應繳款（除不盡金額自動補入首期），並依月依序產生各期扣款明細，完美連動當期帳單週期結帳、額度佔用與跨月預算。
- **信用卡定期訂閱扣款功能（冪等化防重複扣款）**：支援在支出記帳時開啟「信用卡定期訂閱付款」，可設定扣款頻率（每月/每年/每週）、指定扣款日（每月 1~31 號）與首期扣款，內建常見熱門範本（Netflix、Spotify、ChatGPT Plus 等）。具備確定性交易 ID，杜絕多視窗或多裝置重複扣款。
- **信用卡結帳日與額度週期自動重算**：支援設定每張信用卡之「帳單結帳日（每月 1~31 號）」，結帳日後系統自動將已刷未出帳額度歸零重新計算下一期，並即時展示當期帳單週期、剩餘結帳天數、已用額度、可用餘額與百分比進度條。
- **現金錢包純已用額度模式**：支援「本月已使用額度」即時統計，每月 1 號自動歸零重計；當現金帳戶餘額設為 0 時，預設啟用「純已用額度模式」，記帳時不扣減餘額，避免未記錄提領收入時現金餘額持續累積為負數。
- **帳戶轉帳**：支援帳戶間資金調撥，雙向自動扣補餘額。

### 4. 📝 交易明細、跨月全域搜尋與一鍵撤銷 (Undo)
- **跨月份全域即時搜尋**：輸入關鍵字時自動啟動跨月份穿透搜尋，毫秒級列出歷史所有相符交易並標記筆數。
- **交易快速編輯**：明細列表點擊即可直接修改金額、收支分類、帳戶與備忘，修改即時連動全域資產計算。
- **刪除防呆與一鍵復原**：刪除紀錄後自動彈出 Toast 提供 5 秒「復原」按鈕，防止誤觸丟失資料。

### 5. 💻📱 電腦與手機雙平台獨立安裝 & 啟動自動更新 (Electron / Capacitor / PWA)
- **雙平台實體安裝檔支援**：支援打包為 Windows 電腦版安裝檔 (`.exe`) 與 Android 手機版安裝檔 (`.apk`)，並內建一鍵獨立視窗安裝。
- **單一視窗鎖定（杜絕開啟多個瀏覽器分頁）**：整合 OS 級 `requestSingleInstanceLock`、Android `singleTask`、PWA `launch_handler: focus-existing` 與 `BroadcastChannel` 單一執行個體守衛，重複點擊捷徑永遠直接聚焦既有視窗。
- **開啟 App 自動偵測並無感更新**：啟動或切回前景時自動比對遠端 `version.json` 與 Service Worker，閒置時自動套用最新版重載，記帳輸入中則彈出不打斷輸入的懸浮更新通知。
- **FAB 多功能記帳按鈕 & 觸覺震動反饋 (Haptics)**：底部中央按鈕短按快速記帳、長按（500ms）直通 Gemini AI 語音/自然語言記帳；搭配 Android 實體返回鍵智能攔截。

### 6. 📊 視覺化預算與財務報表
- **各類支出趨勢折線圖**：專注支出流向分析，以各消費類別（餐飲、交通、娛樂等）繪製獨立趨勢折線，深度洞察每類花費長週期變化。
- **自由自訂顯示區間**：內建「近 3 個月」、「近 6 個月」、「近 1 年」、「今年以來 (YTD)」快捷切換，並支援自訂任意起始與結束月份跨度。
- **即將扣款訂閱雷達**：主頁自動掃描未來 7 天內即將扣款之訂閱項目，防範帳戶扣款不及。
- **智能懸浮 Tooltip**：懸浮圖表時自動依當月各類支出金額由大到小排序，精確標示金額與當月支出佔比（%）。
- **分類預算與佔比**：設定每月/每類預算上限與超支進度提示，搭配當月分類佔比圓餅圖與每日花費柱狀圖。

### 7. ⚡ 極致效能架構與安全
- **首包激瘦 750KB+**：Lucide Tree-shaking 精選圖庫（圖標包由 795KB 驟降至 36KB，減少 95%）、React 19 路由 `React.lazy` 動態分割。
- **單一全域集中資料層 (Single DataStore)**：集中管理 6 大集合監聽，相比傳統各元件獨立監聽大幅節省 60%+ Firestore 讀取量。
- **CSS Modules 樣式架構**：高頻元件遷移至 CSS Modules，徹底消除 JS 模擬 hover 的 CPU 負載。
- **後端安全 Token 驗證**：GAS 請求整合 Firebase Auth ID Token；Firestore Rules 強化金額正數與交易型態校驗。

---

## 🛠️ 技術架構

| 領域 | 技術選型 |
| :--- | :--- |
| **前端核心** | React 19、TypeScript、Vite 6、HashRouter、React.lazy |
| **狀態與快取** | Zustand 5、Single DataStore、IndexedDB (Firestore Cache) |
| **樣式架構** | CSS Modules、Glassmorphism 深色/淺色主題、語意 Tokens |
| **跨平台封裝** | Electron (Windows `.exe`)、Capacitor 8 (Android `.apk`)、PWA (`launch_handler`) |
| **版本熱更新** | 自動 `version.json` 建置插件、智慧無感自動更新引擎 (`useVersionUpdater`) |
| **單元測試** | Vitest（餘額運算、信用卡週期、生活支出過濾測試） |
| **圖表與視覺** | Recharts、Lucide React (Curated Tree-shaking) |
| **後端代理** | Google Apps Script (GAS) Web App + Firebase Auth ID Token |
| **AI 模型** | Google Gemini 3.7 Flash API |
| **金融報價** | Yahoo Finance v8 API + 全球即時 Search API |
| **資料庫 & 認證**| Firebase Authentication + Cloud Firestore |
| **部署發布** | GitHub Pages、GitHub Actions (自動發布 `.exe` & `.apk`)、Firebase CLI |

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
   - 可在「規則」頁籤貼入以下安全規則，或在本專案直接使用 Firebase CLI 部署（見下方說明）：
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
   - **一鍵部署規則（推薦）**：
     ```bash
     npm run deploy:rules
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

4. 執行單元測試（餘額運算、信用卡週期、扣款邏輯）：
   ```bash
   npm test
   ```

5. 啟動本機開發伺服器：
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

## 💻 電腦版 (.exe) & 📱 手機版 (.apk) 獨立安裝指南（免開瀏覽器分頁 & 自動更新）

本專案全面支援**單一視窗執行個體鎖定（Single Instance Lock）**與**開啟時智慧無感自動更新（Auto Version Updater）**，徹底解決傳統網頁模式容易重複開啟多個瀏覽器分頁的問題：

### 1. 💻 Windows 電腦版安裝（兩種方式）

#### 方法 A：下載實體 Windows 安裝檔 (`.exe`)
1. 前往專案的 **GitHub Releases**（或直接在 App 內的 **「系統設定」 ➔ 「下載電腦版安裝檔 (.exe)」**）：
   - 安裝版：`SmartExpenseTracker-Windows-Setup.exe`（自動建立桌面與開始選單捷徑）
   - 免安裝版：`SmartExpenseTracker-Windows-Portable.exe`（單檔直接執行）
2. 具備 **OS 級單一執行個體鎖定 (`requestSingleInstanceLock`)**：重複雙擊桌面捷徑時，系統會直接喚醒並聚焦已開啟的主視窗，**絕不會開啟第二個視窗或瀏覽器分頁**。
3. 本機自行打包 `.exe` 指令：
   ```bash
   npm install --save-dev electron electron-builder --legacy-peer-deps
   npm run build:win
   ```
   編譯完成後即可於 `release/` 資料夾取得 `.exe` 安裝包。

#### 方法 B：透過 Chrome / Edge 一鍵安裝為獨立桌面 App (PWA)
1. 開啟系統後，進入 **「系統設定」** 點擊 **「⚡ 一鍵直接安裝為獨立視窗 App」**（或點擊網址列右側的「安裝圖示」）。
2. 已配置 **`launch_handler: { client_mode: ['focus-existing', 'auto'] }`** 與 **`BroadcastChannel` 單一實例守衛**：點擊桌面捷徑永遠聚焦既有視窗，若誤開新分頁也會自動攔截保護。

---

### 2. 📱 Android 手機安裝（兩種方式）

#### 方法 A：下載實體 Android 安裝檔 (`.apk`)
1. 將程式碼 Push 至 GitHub 後，GitHub Actions (`build-apk.yml`) 會自動編譯並發布至 **GitHub Releases**，可直接於 **「系統設定」 ➔ 「下載手機版安裝檔 (.apk)」** 下載 `SmartExpenseTracker-Android.apk`。
2. 已配置 `android:launchMode="singleTask"` 與啟動快取自動刷新，確保手機永遠單一實例運行且每次開啟自動同步最新線上版本。
3. 本機使用 Android Studio 建置：
   ```bash
   npm run cap:sync
   npm run cap:open
   ```

#### 方法 B：透過手機 Chrome 秒速安裝至主畫面 (PWA)
1. 用手機 Chrome 開啟網址，於 **「系統設定」** 點擊 **「⚡ 一鍵直接安裝為獨立視窗 App」** 或由瀏覽器選單點選「安裝應用程式」。

---

### 3. 🔄 開啟 App 自動偵測最新版本與智慧更新機制
- **編譯期自動生成 `version.json`**：每次執行 `npm run build` 時，Vite 插件會自動產生帶精確時間戳與版本號的 `dist/version.json`。
- **啟動與切回前景即時偵測**：開啟 App 或由背景切回前景時，系統會以 `no-store` 穿透快取比對遠端 `version.json` 及 Service Worker：
  - **剛開啟 App 瞬間（尚未輸入資料）**：若偵測到新版本，自動清理舊快取並無縫重載為最新版本。
  - **記帳輸入操作中**：絕不強制打斷輸入，改於頂部彈出「✨ 發現新版本」通知橫幅，供使用者一鍵更新。

---

## ⚡ 內建連線診斷工具

登入系統後，隨時可進入 **「系統設定」 ➔ 點擊「⚡ 立即進行完整診斷」**：
- 🟢 **GAS 伺服器 (doPost) 狀態**：即時測試網路延遲。
- 🟢 **Gemini 3.7 Flash API 金鑰生效狀態**：發送測試文字給 LLM 並驗證真實結構化回傳。
- 🟢 **Yahoo Finance 台股 2880 (華南金) 與興櫃報價測試**：即時獲取最新市場價格。

---

## 📁 專案目錄結構

```text
├── android/                  # Capacitor Android 原生專案 (.apk 封裝與單一實例設定)
├── electron/                 # Electron Windows 桌面應用主程序與 Preload (單一視窗鎖定與快取清理)
├── gas/
│   └── Code.gs               # GAS 一體化後端 (Gemini 3.7 Flash + Yahoo Finance 引擎)
├── public/                   # PWA Manifest (launch_handler 單一視窗)、App Icons 等靜態資源
├── src/
│   ├── components/
│   │   ├── accounts/         # 帳戶與信用卡管理元件
│   │   ├── ai/               # AI 記帳解析卡片
│   │   ├── analytics/        # 各類支出趨勢圖表與篩選元件
│   │   ├── budget/           # 預算卡片與設定表單
│   │   ├── common/           # AppRuntimeGuard (自動更新與防多分頁)、ErrorBoundary 等防護元件
│   │   ├── layout/           # 側邊欄、頂部列、底部導航與 AppShell
│   │   ├── stocks/           # 股票持倉卡、Yahoo 搜尋彈窗與建倉表單
│   │   ├── transactions/     # 記帳清單、分類選擇器、快速表單與編輯 Modal
│   │   └── ui/               # 按鈕、卡片、彈窗、輸入框、Toast (支援 Undo) 等
│   ├── hooks/                # Firestore 監聽、版本自動更新 (useVersionUpdater)、單一視窗守衛與安裝 Hooks
│   ├── lib/                  # Firebase SDK 初始化與持久離線快取配置
│   ├── pages/                # 儀表板、明細、帳戶、預算、股票、AI、設定等頁面
│   ├── services/             # Auth、Firestore、GAS 呼叫模組與種子資料
│   ├── stores/               # Zustand 狀態管理 (認證、主題、全域集中 DataStore)
│   ├── types/                # TypeScript 財務與股票型別定義
│   └── utils/                # 餘額即時引擎 (balances)、財務計算、防禦性工具
├── tests/                    # Vitest 單元測試 (餘額演算、信用卡週期沖銷)
├── electron-builder.json     # Windows 電腦版 (.exe) 安裝包與免安裝版編譯設定
├── .firebaserc               # Firebase 專案綁定配置
├── firebase.json             # Firebase Firestore 規則與配置
├── firestore.rules           # Cloud Firestore 安全存取規則
├── .env.example              # 環境變數範本
├── package.json              # 專案相依套件與指令設定
└── vite.config.ts            # Vite、version.json 自動生成插件與 PWA 配置
```

---

## 📄 開源授權 (License)

本專案採用 [MIT License](LICENSE) 授權。
