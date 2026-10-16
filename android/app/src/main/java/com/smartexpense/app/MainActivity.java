package com.smartexpense.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 啟動時清除 WebView 舊有 HTTP 靜態資源快取（保留 IndexedDB 與 LocalStorage 登入狀態）
        // 確保每次開啟 Android App 都能立即偵測並載入最新線上版本
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            webView.clearCache(false);
        }
    }
}

