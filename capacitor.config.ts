import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartexpense.app',
  appName: '智慧記帳',
  webDir: 'dist',
  server: {
    url: 'https://hippoking1.github.io/-app/',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'hippoking1.github.io',
      '*.firebaseapp.com',
      '*.google.com',
      'accounts.google.com',
      '*.googleapis.com',
      '*.gstatic.com'
    ]
  }
};

export default config;
