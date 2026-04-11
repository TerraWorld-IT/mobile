import type { CapacitorConfig } from '@capacitor/cli'

const isDev = process.env.NODE_ENV !== 'production'

const config: CapacitorConfig = {
  appId: 'app.terraworld.mobile',
  appName: 'TerraWorld',
  webDir: 'www',

  // Remote URL — WebView loads the deployed web app directly.
  // Web code updates deploy instantly without app store re-submission.
  server: {
    url: isDev
      ? 'http://localhost:3000'
      : 'https://terraworld.app',
    cleartext: isDev, // Allow HTTP in dev mode
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: false, // App controls hide timing (after page load)
      backgroundColor: '#FFF8EB', // riso-cream
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFF8EB', // riso-cream
    },
    Keyboard: {
      resize: 'body',
      scrollAssist: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // iOS-specific overrides
  ios: {
    scheme: 'TerraWorld',
    contentInset: 'always',
  },

  // Android-specific overrides
  android: {
    allowMixedContent: isDev, // Allow HTTP resources in dev
    backgroundColor: '#FFF8EB',
  },
}

export default config
