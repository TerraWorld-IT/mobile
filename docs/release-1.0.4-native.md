# 1.0.4 네이티브 준비

1.0.4에는 iOS 평점 요청 플러그인과 로컬 알림의 네이티브 의존성을 포함한다. 로컬 알림은 `capacitor.config.ts`의 iOS `includePlugins`에만 추가한다. Android는 권한 최소화를 위해 기존 allowlist를 유지한다.

## 웹 호출 계약

| 플러그인 | JS 이름·호출 | 지원 |
|---|---|---|
| 앱-로컬 평점 요청 | `registerPlugin('InAppReview')` → `requestReview()` | iOS만 지원 |
| `@capacitor/local-notifications` (`^8.3.1`) | 패키지의 `LocalNotifications` export, 브리지 이름 `LocalNotifications` | 이번 릴리스는 iOS만 포함 |

웹은 호출 전에 각각 `Capacitor.isPluginAvailable('InAppReview')`, `Capacitor.isPluginAvailable('LocalNotifications')`를 확인한다. 구버전 앱·일반 브라우저·미지원 플랫폼에서는 호출을 건너뛴다. 웹 패키지 의존성은 모바일과 버전을 맞춘다.

`InAppReview.requestReview()`는 MainActor에서 활성 foreground `UIWindowScene`을 찾는다. iOS 16 이상은 `AppStore.requestReview(in:)`, 이전 버전은 `SKStoreReviewController.requestReview(in:)`를 사용한다. 활성 scene이 없으면 Promise를 reject하므로 웹에서 오류를 처리해야 한다. 성공 응답 `{ requested: true }`는 요청 전달만 의미하며, 표시·평점 제출·리뷰 작성 완료를 뜻하지 않는다.

평점 창 표시 여부는 iOS가 결정한다. TestFlight에서는 표시되지 않으므로 실기기 개발 빌드에서 표시 흐름을 확인한다. [Apple 평점 요청 문서](https://developer.apple.com/documentation/storekit/appstore/requestreview(in:)-1q8qs)

로컬 알림은 의존성과 네이티브 등록만 준비한다. 이번 변경에는 알림 예약·권한 요청 호출을 추가하지 않는다. 실제 사용 시점과 권한 처리는 후속 웹 작업에서 구현한다. [Capacitor 로컬 알림 문서](https://capacitorjs.com/docs/apis/local-notifications)

## 릴리스 전 확인

- `npm ci`, `npm run check:parity`, `npx cap sync android`를 실행한다. Android 생성 Gradle 파일 두 개가 기존 출시 기준과 같은지 확인한다.
- macOS의 Mobile CI `ios-check`에서 `cap sync ios`와 시뮬레이터 빌드를 확인한다. Windows에서 iOS 빌드는 검증할 수 없다.
- `CapApp-SPM/Package.swift`의 상대 경로는 `/`를 유지한다. Windows의 iOS sync는 경로를 `\`로 바꿀 수 있다.
- 개발 빌드에서 플러그인 존재 여부, 평점 호출의 resolve/reject 및 기존 인스타 스토리·위젯 동작을 확인한다.

Info.plist·엔타이틀먼트·서명·CI·기존 플러그인 동작은 변경하지 않는다. `MARKETING_VERSION`도 수정하지 않으며 출시 버전은 `v1.0.4` 태그로 CI가 정한다.
