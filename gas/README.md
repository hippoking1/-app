# Google Apps Script 後端部署指南

本專案將 Google Apps Script (GAS) 作為 Serverless API Proxy 後端，用來保護 **Gemini 3.7 Flash** 與 **Finnhub** 的 API Key，並解決瀏覽器存取 TWSE OpenAPI 的跨域 (CORS) 限制。

---

## 5 分鐘快速部署步驟

### 步驟 1：建立 Apps Script 專案
1. 開啟瀏覽器造訪 [script.google.com](https://script.google.com/)。
2. 點選左上角 **「新增專案」 (New project)**。
3. 將專案名稱重新命名為「**智慧記帳後端**」。

### 步驟 2：複製程式碼至編輯器
將本資料夾內的所有 `.gs` 檔案內容分別貼入：
1. `Code.gs`（或重新命名為 `main.gs`）：複製貼上 `gas/main.gs`。
2. 點擊編輯器左側的 `+` 號 -> 建立指令碼 `gemini.gs`：複製貼上 `gas/gemini.gs`。
3. 點擊 `+` 號 -> 建立指令碼 `stock.gs`：複製貼上 `gas/stock.gs`。
4. 點擊 `+` 號 -> 建立指令碼 `config.gs`：複製貼上 `gas/config.gs`。

### 步驟 3：設定 API 金鑰 (Script Properties)
有兩種方式設定金鑰：

**方法 A：透過介面設定（推薦）**
1. 點擊左側齒輪圖示 **「專案設定」 (Project Settings)**。
2. 滾動至 **「指令碼屬性」 (Script Properties)** 區塊。
3. 點選 **「新增指令碼屬性」** 並加入以下兩個屬性：
   - 屬性名稱：`GEMINI_API_KEY`，值：你的 Google Gemini API Key
   - 屬性名稱：`FINNHUB_API_KEY`，值：你的 Finnhub API Key

**方法 B：透過程式碼設定**
1. 在 `config.gs` 填入金鑰。
2. 在上方函式下拉選單選擇 `setupProperties` 並點擊 **「執行」**。

### 步驟 4：發布為 Web 應用程式 (Web App)
1. 點選右上角的 **「部署」 (Deploy)** -> **「新增部署」 (New deployment)**。
2. 點選左側齒輪圖示，選擇 **「網頁應用程式」 (Web app)**。
3. 設定如下：
   - **說明 (Description)**：v1
   - **執行身分 (Execute as)**：`我 (Me / 您的 Google 帳號)`
   - **誰可以存取 (Who has access)**：`任何人 (Anyone)` *(重要！前端才能公開呼叫)*
4. 點選 **「部署」 (Deploy)**。
5. Google 會彈出授權視窗，點擊「核對權限」並允許存取。
6. 複製彈出的 **「網頁應用程式網址」 (Web App URL)**（格式為 `https://script.google.com/macros/s/AKfycb.../exec`）。

### 步驟 5：貼入前端環境變數
將複製的 Web App URL 填入前端專案根目錄的 `.env` 檔案中：
```env
VITE_GAS_DEPLOYMENT_URL=https://script.google.com/macros/s/你的部署ID/exec
```

---

## 測試 API 是否正常運作
直接在瀏覽器網址列貼上你的 Web App URL，若看到以下回應即代表部署成功：
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ok",
    "message": "Smart Expense Tracker GAS API is running healthy",
    "timestamp": "..."
  }
}
```
