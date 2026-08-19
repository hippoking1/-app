/**
 * Google Apps Script 屬性設定工具
 * 第一次建立時，可在 Apps Script 編輯器中執行 setupProperties 函式進行初始化設定，
 * 或直接至【專案設定】->【指令碼屬性】手動新增 GEMINI_API_KEY 與 FINNHUB_API_KEY。
 */

function setupProperties() {
  const props = PropertiesService.getScriptProperties();
  
  // 請在此處填入你的金鑰（執行後可刪除或直接在專案設定中管理）
  props.setProperties({
    'GEMINI_API_KEY': 'YOUR_GEMINI_API_KEY_HERE',
    'FINNHUB_API_KEY': 'YOUR_FINNHUB_API_KEY_HERE'
  });
  
  Logger.log('✅ 指令碼屬性設定完成！');
}

/**
 * 測試檢視目前設定的屬性名稱 (安全隱藏金鑰內容)
 */
function checkProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(props);
  Logger.log('已設定的屬性列表: ' + keys.join(', '));
  keys.forEach(function(k) {
    Logger.log(k + ': ' + (props[k] ? '已設定 (長度 ' + props[k].length + ')' : '未設定'));
  });
}
