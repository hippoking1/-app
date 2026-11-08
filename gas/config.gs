/**
 * Google Apps Script 屬性清理與檢查工具
 * 資安規範：系統已全面改為 BYOK (使用者於前端自備 API Key)，請勿在 GAS 儲存預設的 GEMINI_API_KEY。
 * 若您過去曾在 GAS 設定過 GEMINI_API_KEY，可執行下方 removeServerGeminiKey() 將其徹底移除。
 */

function removeServerGeminiKey() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('GEMINI_API_KEY');
  Logger.log('🔒 已成功從 GAS 伺服器移除 GEMINI_API_KEY！現在沒有任何訪客能消耗您的預設定額。');
}

/**
 * 測試檢視目前設定的屬性名稱
 */
function checkProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(props);
  Logger.log('已設定的屬性列表: ' + (keys.length ? keys.join(', ') : '(無任何預設金鑰)'));
}
