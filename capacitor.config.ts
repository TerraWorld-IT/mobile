import type { CapacitorConfig } from '@capacitor/cli'

const isDev = process.env.NODE_ENV !== 'production'

// Dev URL 우선순위:
//   1) CAP_DEV_URL 환경변수 (iOS sim → localhost / 실기기 → LAN IP / Android 에뮬 → 10.0.2.2)
//   2) 기본값 10.0.2.2:3000 (Android 에뮬레이터 호스트 alias)
// iOS 시뮬레이터는 host machine 과 동일 네트워크이므로 localhost 가 동작한다.
// 실기기는 PC LAN IP (예: CAP_DEV_URL=http://192.168.1.42:3000) 를 지정.
const devUrl = process.env.CAP_DEV_URL ?? 'http://10.0.2.2:3000'

const config: CapacitorConfig = {
  appId: 'app.terraworld.mobile',
  appName: 'TerraWorld',
  webDir: 'www',

  // Remote URL — WebView loads the deployed web app directly.
  // Web code updates deploy instantly without app store re-submission.
  server: {
    url: isDev ? devUrl : 'https://terraworld.app',
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
    AdMob: {
      // 실제 앱 ID 는 .env 또는 출시 빌드 시 환경변수로 주입.
      // dev 빌드는 Google 제공 테스트 ID 사용 (어뷰징 방지 정책 준수).
      // https://developers.google.com/admob/android/test-ads
      initializeForTesting: isDev,
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
