import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const APP_VERSION: string = pkg.version || '1.1.0';
const BUILD_TIME: string = new Date().toISOString();
const BUILD_ID: string = `${APP_VERSION}-${BUILD_TIME.replace(/[-:T.Z]/g, '').slice(0, 12)}`;

/**
 * 自動產生遠端版本檢查清單 (version.json)
 * 供電腦版 (.exe)、手機版 (.apk) 與 PWA 啟動時比對是否為最新版本
 */
function versionManifestPlugin(): Plugin {
  const versionPayload = JSON.stringify(
    {
      version: APP_VERSION,
      buildId: BUILD_ID,
      buildTime: BUILD_TIME,
      minNativeVersion: '1.0.0',
      downloadUrls: {
        windows: 'https://github.com/hippoking1/-app/releases/latest',
        android: 'https://github.com/hippoking1/-app/releases/latest',
        web: 'https://hippoking1.github.io/-app/'
      }
    },
    null,
    2
  );

  return {
    name: 'vite-plugin-version-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].endsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.end(versionPayload);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: versionPayload
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 相對路徑確保在 GitHub Pages、Electron 本地與 Capacitor 均能直接運作
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME)
  },
  plugins: [
    react(),
    versionManifestPlugin(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/version.json'],
        navigateFallbackDenylist: [/^\/version\.json$/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 放寬快取上限至 5MB
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/version\.json(\?.*)?$/,
            handler: 'NetworkOnly'
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        id: './',
        name: '智慧記帳 - AI & 投資理財助手',
        short_name: '智慧記帳',
        description: '個人記帳、多帳戶管理、預算提醒、股票資產追蹤與 Gemini AI 智慧記帳',
        theme_color: '#0f172a',
        background_color: '#0b0f19',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: './',
        scope: './',
        // 強制單一視窗模式：重複點擊桌面圖示或連結時，直接喚醒並聚焦既有視窗，絕不新開分頁
        launch_handler: {
          client_mode: ['focus-existing', 'auto']
        },
        handle_links: 'preferred',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: false // 關閉自動開瀏覽器分頁，避免重複啟動時產生多個分頁
  }
});
