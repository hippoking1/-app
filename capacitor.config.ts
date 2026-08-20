import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartexpense.app',
  appName: '智慧記帳',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
