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
    // 원격 URL 로드 실패(오프라인 콜드스타트, 서버 장애) 시 WebView 가 webDir('www') 의
    // 로컬 폴백 페이지로 대체된다. 미배선 시 launchAutoHide: false 스플래시의 hide() 를
    // 호출할 주체가 없어 무한 스플래시로 고착된다 (www/index.html 은 폴백 안내 + 재시도 제공).
    errorPath: 'index.html',
  },

  plugins: {
    SplashScreen: {
      // 정상 경로: 원격 앱이 마운트 직후 hideSplash() 로 먼저 내린다 (보통 1~3초).
      // launchAutoHide + 10초 는 워치독 — Android 의 errorPath 폴백 페이지는 플러그인
      // 접근이 불가해 hide() 를 호출할 수 없으므로(Capacitor 문서), autoHide 없이는
      // 오프라인 콜드스타트 시 폴백이 스플래시 뒤에 영구히 가려진다 (Codex 리뷰).
      // 트레이드오프: 10초 넘게 걸리는 초저속 로드에서 스플래시가 로딩 중 화면으로
      // 일찍 걷힐 수 있음 — 무한 스플래시보다 낫다고 판단.
      launchAutoHide: true,
      launchShowDuration: 10000,
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
    // 'never' = UIScrollView.contentInsetAdjustmentBehavior.never (Capacitor 기본값).
    // 웹 레이어가 viewport-fit=cover + env(safe-area-inset-*) 로 세이프에어리어를 직접 처리하므로
    // (layouts/default.vue), WKWebView 가 인셋을 한 번 더 얹으면 스크롤 콘텐츠가 뷰포트보다 커져
    // 문서 전체가 스크롤/러버밴딩하고, 노출된 인셋 영역은 아무도 칠하지 않아 검게 보인다.
    contentInset: 'never',
    // WKWebView 배경. 지정하지 않으면 시스템 기본색이 드러나 상하단에 검은 띠가 생긴다.
    // android 와 동일한 크림색으로 맞춘다.
    backgroundColor: '#FFF8EB',
    // 핀치줌/외부 링크 롱프레스 미리보기 차단 (완전한 네이티브 앱처럼 동작) — 기본값에
    // 의존하지 않고 명시. zoomEnabled=false 는 WKWebView scrollView 의 핀치 제스처를
    // 비활성화한다 (CAPBridgeViewController 의 WebViewDelegationHandler 경유).
    zoomEnabled: false,
    allowsLinkPreview: false,
    // WebView UA 에 앱 식별자 append — 서버 로그/분석에서 앱 셸 트래픽을 모바일 브라우저와
    // 구분한다. 버전 동적 주입은 하지 않는다 (고정 문자열 — 단순성 우선).
    appendUserAgent: 'TerraWorldApp',
  },

  // Android-specific overrides
  android: {
    allowMixedContent: isDev, // Allow HTTP resources in dev
    backgroundColor: '#FFF8EB',
    // iOS 블록과 동일 — WebView UA 에 앱 식별자 append (서버/분석 트래픽 구분).
    appendUserAgent: 'TerraWorldApp',
  },
}

export default config
