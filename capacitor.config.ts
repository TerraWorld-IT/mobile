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
      ? (process.env.MOBILE_SERVER_URL?.trim() || 'http://10.0.2.2:3000')
      : (process.env.MOBILE_PROD_URL?.trim() || 'https://terraworld.web-qplay.kr'),
    cleartext: isDev, // Allow HTTP in dev mode
    // 원격 URL 로드 실패(오프라인 콜드스타트, 서버 장애) 시 WebView 가 webDir('www') 의
    // 로컬 폴백 페이지로 대체된다. launchAutoHide: true 와 10초 워치독으로 스플래시를 내리고,
    // www/index.html 에서 폴백 안내와 수동 재시도를 제공한다.
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
      backgroundColor: '#FFFFFF', // 디자인 스펙: 흰 배경 + 앱아이콘 중앙 (assets/splash.png)
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFF8EB', // riso-cream
    },
    Keyboard: {
      // iOS 전용: frontend app/plugins/capacitor.client.ts의 런타임
      // Keyboard.setResizeMode(native)와 같은 값으로 정렬한다.
      resize: 'native',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // iOS-specific overrides
  ios: {
    scheme: 'TerraWorld',
    // iOS 보상형 광고와 ATT 요청을 지원한다. 광고 요청·동의 상태 처리는 frontend가 담당한다.
    // allowlist에 AdMob을 포함하고 Info.plist·개인정보 매니페스트를 함께 유지한다.
    // 카메라·사진 읽기는 미도입이므로 @capacitor/camera는 계속 제외한다.
    // cordova-plugin-purchase는 기존 release.yml의 iOS IAP gate를 위해 유지한다.
    includePlugins: [
      '@capacitor-community/admob',
      '@capacitor/app',
      '@capacitor/filesystem',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/network',
      '@capacitor/push-notifications',
      '@capacitor/share',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
      'cordova-plugin-purchase',
    ],
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
    // Google Play 첫 출시도 iOS 와 같이 광고·결제를 제외한다 — 전역 includePlugins 를 덮어쓰는
    // allowlist 라 package.json 의존성이 늘어도 Android 에 자동 포함되지 않는다(새 플러그인은 여기에도 추가).
    // - '@capacitor-community/admob' 제외: GMA SDK 가 병합 매니페스트에 AD_ID·ACCESS_ADSERVICES_*
    //   권한을 넣어 Play 광고 ID 선언·Data safety 의 광고 항목을 요구한다.
    // - 'cordova-plugin-purchase' 제외: Play Billing 라이브러리가 BILLING 권한을 넣는다. iOS 는
    //   release.yml 'iOS IAP gate' 때문에 유지하지만 Android 쪽 release.yml 에는 해당 검사가 없다.
    // - '@capacitor/camera' 제외: frontend 호출 0건인데 CameraX 네이티브 라이브러리(.so)가 딸려 온다.
    // 도입 시 각 항목을 복원하고 AndroidManifest 의 AdMob APPLICATION_ID meta-data·build.gradle 의
    // admobAppId placeholder(docs/admob-config.md)를 함께 되살린다.
    includePlugins: [
      '@capacitor/app',
      '@capacitor/filesystem',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/network',
      '@capacitor/push-notifications',
      '@capacitor/share',
      '@capacitor/splash-screen',
      '@capacitor/status-bar',
    ],
  },
}

export default config
