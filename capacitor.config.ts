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
      resize: 'body',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  // iOS-specific overrides
  ios: {
    scheme: 'TerraWorld',
    // iOS 첫 출시는 광고 제외 확정 — AdMob 네이티브 플러그인을 iOS 빌드에서 뺀다.
    // 광고 SDK 가 없으면 ATT(추적 권한) 요청도 없으므로 NSUserTrackingUsageDescription 을
    // 둘 필요가 없다(설명 문구만 있고 요청이 없으면 가이드라인 5.1.2 반려 소지).
    // 전역 includePlugins 를 덮어쓰는 allowlist 라 package.json 의존성이 늘어도 iOS 에는 자동
    // 포함되지 않는다 — 새 플러그인은 여기에도 추가해야 한다 (Android 는 allowlist 없이 전체 포함).
    // cordova-plugin-purchase 는 release.yml 의 'iOS IAP gate' 가 cap sync 결과를 검사하므로 유지.
    // iOS 에 광고를 도입하는 시점에 '@capacitor-community/admob' 복원 + Info.plist 의
    // GADApplicationIdentifier·ATT 문구·SKAdNetworkItems 를 함께 되살린다.
    // '@capacitor/camera' 도 뺐다 — frontend 가 카메라·사진 선택을 호출하지 않아 쓰지 않는 권한
    // 문구(NSCameraUsageDescription 등)가 심사 사유가 될 수 있다. 사진 첨부 도입 시 복원 +
    // Info.plist 권한 문구·PrivacyInfo.xcprivacy 의 PhotosorVideos 를 함께 되살린다 (Android 는 그대로).
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
  },
}

export default config
