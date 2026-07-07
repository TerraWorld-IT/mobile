import type { CapacitorConfig } from '@capacitor/cli'

const isDev = process.env.NODE_ENV !== 'production'

const config: CapacitorConfig = {
  appId: 'app.terraworld.mobile',
  appName: 'TerraWorld',
  webDir: 'www',

  // Remote URL — WebView loads the deployed web app directly.
  // Web code updates deploy instantly without app store re-submission.
  server: {
    // Dev: 10.0.2.2 is Android emulator's alias for host machine localhost
    // For real device, use your machine's LAN IP (e.g., 192.168.x.x:3000)
    // Dev: 기본은 Android 에뮬레이터의 호스트 alias(10.0.2.2). 실기기 테스트 시
    // MOBILE_SERVER_URL=http://<PC-LAN-IP>:3000 으로 오버라이드 (예: 192.168.0.10:3000).
    // 프로덕션 URL 도 env 로 파라미터화 — 배포 도메인(web-qplay.kr 서브도메인)을
    // 빌드타임에 MOBILE_PROD_URL 로 주입. 미설정 시 terraworld.web-qplay.kr fallback.
    url: isDev
      ? (process.env.MOBILE_SERVER_URL ?? 'http://10.0.2.2:3000')
      : (process.env.MOBILE_PROD_URL ?? 'https://terraworld.web-qplay.kr'),
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
    // 핀치줌/외부 링크 롱프레스 미리보기 차단 (완전한 네이티브 앱처럼 동작) — 기본값에
    // 의존하지 않고 명시. zoomEnabled=false 는 WKWebView scrollView 의 핀치 제스처를
    // 비활성화한다 (CAPBridgeViewController 의 WebViewDelegationHandler 경유).
    zoomEnabled: false,
    allowsLinkPreview: false,
  },

  // Android-specific overrides
  android: {
    allowMixedContent: isDev, // Allow HTTP resources in dev
    backgroundColor: '#FFF8EB',
  },
}

export default config
