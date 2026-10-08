# 나의 테라 홈스크린 위젯 MVP

상태(2026-10-08): iOS App Extension 타깃·App Group·플러그인 등록 및 서명 워크플로 연결을 구현했다. macOS 컴파일·서명·실기기 표시는 미검증이다. Android는 기존 소스·등록·debug APK 빌드 상태를 유지하며 이번 변경 범위 밖이다. 앱에서 마지막으로 렌더링한 테라리움 PNG를 보여주며 앱을 열지 않은 동안 서버의 성장 상태를 가져오지 않는다.

## 데이터 경로와 경계

- frontend `app/pages/index.vue`에서 홈 snapshot/아이템/티어/편집 종료를 관찰하고 1초 debounce 후 캡처한다. 편집 모드에서는 저장하지 않는다. `captureTerraStage`는 기존 html2canvas 옵션(2배 해상도, CORS, 8초 이미지 대기, 10초 deadline, stage transform 복원)을 공통으로 사용한다. 같은 장면의 진행 중 캡처는 이미지 공유와 재사용하며, 장면 변경은 캐시를 무효화한다. 인스타 스토리는 투명 배경을 유지한다.
- 새 `TerraWidget` 플러그인 하나: `saveSnapshot({ pngBase64 })`, `clearSnapshot()`. 이미지 외 사용자 ID·인증 토큰·API 주소는 전달하지 않는다. 웹/구버전 셸은 자동 캡처와 브리지 호출을 건너뛴다.
- 브리지 전달 전 PNG를 320×442로 줄인다. Android는 크기와 PNG 형식·입력 길이를 검증하고 app-private `files/terra-widget.png`에 AtomicFile로 쓴다. FileProvider/외부 저장소/추가 권한은 사용하지 않는다. RemoteViews bitmap은 약 566 KB이다.
- 앱 전체 client plugin이 사용자 ID 변경·로그아웃을 관찰하여 기존 이미지를 삭제한다. 캡처 epoch와 직렬 저장 큐는 이전 계정의 늦은 캡처/저장을 차단한다. 앱 cold start에는 초기 사용자 확인 전 이미지를 지우고 홈에서 재생성한다. 네이티브 저장 실패는 홈·공유 동작을 중단하지 않으며 다음 홈 갱신에서 다시 시도한다.
- Android는 저장/삭제 즉시 모든 widget instance를 갱신하고, 시스템 주기 요청(30분)에도 로컬 파일을 읽는다. 누락 파일은 placeholder, 탭은 기존 MainActivity를 연다. 앱 재실행 시 현재 라우트를 유지할 수 있다.
- iOS는 App Group `group.app.terraworld.mobile`의 `terra-widget.png`를 읽고 WidgetCenter reload를 요청한다. 실제 반영 시점은 OS 예산에 따라 지연될 수 있으며, 로그아웃 직후 런처가 캐시한 이미지까지 즉시 사라진다는 보장은 실기기에서 별도 확인해야 한다.

## Android 설치와 수동 확인

1. 새 frontend를 앱이 사용하는 원격 URL에 반영한 환경과 새 네이티브 APK를 함께 사용한다. 기존 `capacitor.config.ts` 원격 URL 셸은 그대로다.
2. Windows PowerShell에서 mobile/android를 cwd로 다음을 실행한다.

   ```powershell
   $env:ANDROID_HOME='C:\Users\tgkim\AppData\Local\Android\Sdk'
   .\gradlew.bat assembleDebug --console=plain
   ```

   결과 APK: `android/app/build/outputs/apk/debug/app-debug.apk`. 연결된 테스트 기기에 `adb install -r <apk 경로>`로 설치한다.
3. 런처 홈 길게 누르기 → 위젯 → TerraWorld → 나의 테라를 추가한다. 이미지가 없으면 “앱에서 나의 테라를 열어 주세요”가 보여야 한다.
4. 앱 로그인 후 홈에 들어가 이미지 로딩과 캡처 완료를 기다리고 런처로 돌아온다. 위젯 이미지가 앱 테라리움과 일치하는지 확인한다.
5. 배경·배치·활성 병을 변경하고 관리 모드를 저장/종료한다. 새 PNG 및 여러 위젯의 갱신을 확인한다. 미저장 드래그 중에는 위젯이 바뀌지 않아야 한다.
6. 위젯 크기 변경, 앱 프로세스 종료, 재부팅 후 기존 PNG 표시 및 위젯 탭으로 앱 열기를 확인한다. 앱 강제 중지 동안에는 Android가 위젯 갱신을 제한할 수 있다.
7. 설정에서 로그아웃, 계정 A→B 전환, 캡처 중 로그아웃을 시험한다. A 이미지가 B에게 남지 않는지 확인한다. 앱의 기존 공유 시트/인스타 fallback/푸시 등록/공유 딥링크도 회귀 확인한다.

## iOS 타깃 연결 상태

`project.pbxproj`에 `TerraWidgetExtension`을 연결했다. bundle ID는 `app.terraworld.mobile.TerraWidgetExtension`, iOS 배포 대상은 App과 같은 16.4, Swift 5.0, iPhone 전용이다. 지원 크기는 small·medium이며 large는 제외한다.

- Extension 소스: `TerraWidgetExtension/TerraWidget.swift`, `WidgetShared/TerraWidgetSnapshot.swift`. Capacitor는 Extension에 링크하지 않는다.
- App 소스: `App/TerraWidgetPlugin.swift`, `WidgetShared/TerraWidgetSnapshot.swift`. `ViewController.capacitorDidLoad()`가 기존 Instagram 등록 다음에 TerraWidget을 등록한다. 기존 스와이프 설정은 유지한다.
- 두 타깃의 entitlement는 `group.app.terraworld.mobile`을 공유한다. App의 푸시·associated-domains entitlement를 보존했다.
- App은 Extension에 의존하며 `Embed Foundation Extensions` 단계로 `.appex`를 포함한다. Extension plist는 Resources에 복사하지 않고 `INFOPLIST_FILE`로만 사용한다.
- Release는 두 타깃 모두 Manual / Apple Distribution / 팀 `SMF6T723XR`. App 프로파일 이름은 `TerraWorld App Store`, Extension은 `TerraWorld Widget App Store`다. 서명 설정을 xcodebuild 전체 타깃 CLI 옵션으로 전달하지 않는다.
- App/Extension 버전 기본값은 기존 App과 동일하며 release의 `agvtool`이 두 타깃 버전·빌드번호를 함께 설정한다.
- bridge 계약은 frontend `app/lib/terraWidget.ts`와 동일한 `TerraWidget.saveSnapshot({pngBase64})`, `clearSnapshot()`이다. 320×442 PNG를 App Group에 저장하며 서버 데이터나 주기 갱신 로직은 추가하지 않는다. 기존 로컬 파일 재조회 타임라인은 유지한다.

## iOS 광고·위젯 사람 작업 순서

1. Apple Developer 팀 `SMF6T723XR`에서 App Group **`group.app.terraworld.mobile`**을 생성한다.
2. 기존 App ID **`app.terraworld.mobile`**에 해당 App Group을 추가한다. 기존 Push Notifications·Associated Domains 설정을 유지한다.
3. Extension App ID **`app.terraworld.mobile.TerraWidgetExtension`**을 생성하고 같은 App Group을 부여한다.
4. 동일한 기존 Distribution 인증서로 App Store 프로파일을 발급한다. App은 App Group 추가 후 **`TerraWorld App Store`** 이름으로 재발급하고, Extension은 **`TerraWorld Widget App Store`** 이름으로 신규 발급한다. 두 프로파일의 이름·팀·앱 ID·App Group·유효기간이 CI 검사와 일치해야 한다.
5. GitHub Actions secrets를 설정한다. **`APPLE_PROVISIONING_PROFILE_BASE64`**는 재발급 App 프로파일로 교체하고 **`APPLE_WIDGET_PROVISIONING_PROFILE_BASE64`**는 Extension 프로파일로 추가한다. 기존 `APPLE_DISTRIBUTION_CERT_P12_BASE64`, `APPLE_DISTRIBUTION_CERT_PASSWORD`, `APPLE_TEAM_ID=SMF6T723XR` 및 업로드용 `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8_BASE64`를 확인한다.
6. AdMob에서 iOS 앱을 등록하고 App ID를 GitHub secret **`ADMOB_IOS_APP_ID`**에 설정한다. `ca-app-pub-<16자리>~<10자리>` 형식이며 Google 테스트 퍼블리셔는 서명 릴리스에서 거부된다. iOS 보상형 광고 단위를 발급하고 별도 frontend 작업 `ios-widget-ads-frontend`의 iOS 광고 단위 설정에 전달한다. Android 광고 단위나 App ID를 대신 쓰지 않는다.
7. AdMob 보상형 광고 단위의 SSV 콜백 URL을 운영 백엔드의 기존 보상형 콜백 주소로 설정하고 검증한다. **실제 운영 URL은 백엔드 담당자가 확인한 값**을 사용한다. 백엔드 **`REWARD_AD_SSV_AD_UNIT_ALLOWLIST`**에 새 iOS 광고 단위 ID를 추가한다. 현재 `reward.ad.mode` 기본값은 `legacy`이며 이번 작업은 이를 변경하지 않는다. SSV-authoritative 운영 전환 시 nonce 검증·중복 지급 방지·콜백 도달을 별도로 확인한다.
8. App Store에 등록한 개발자 웹사이트 도메인의 `/app-ads.txt`에 AdMob 콘솔이 제공하는 판매자 항목을 게시하고 크롤링/앱 인증 상태를 확인한다. 제공 지역에 필요한 광고 동의 설정도 점검한다.
9. App Store Connect 개인정보 라벨에 추적·광고 식별자·광고 상호작용·대략적 위치·진단 데이터의 수집 목적/연결/추적 여부를 **SDK 수집분 포함**하여 반영한다. Xcode에서 SDK를 포함한 Privacy Report와 대조하고 개인정보처리방침도 실제 동작과 맞춘다.
10. frontend와 mobile 두 작업 단위의 독립 수용 검토 후 PR을 main에 머지하고, main push로 실행되는 **mobile-ci → iOS Build Check** 결과를 확인한다. 이 job은 PR이나 develop push에서는 실행되지 않는다. iOS 시뮬레이터 빌드가 실패하면 수정 PR로 보완한다. 사람 자원과 아래 실기기 검증이 준비된 다음 별도 승인된 단계에서만 태그·TestFlight·App Review 재제출을 진행한다.

## macOS CI 및 실기기 확인

`mobile-ci.yml`의 iOS Build Check는 main push에서만 실행된다. `ios/**` 필터는 Extension과 shared 소스를 포함하며 iOS 워크플로 자체 변경도 빌드 대상이다. 문서만 변경한 push는 워크플로 실행 대상에서 제외되며, iOS 관련 경로가 변경되지 않으면 빌드 단계는 건너뛴다. PR 머지 후 해당 main push에서 빌드 단계가 실제로 실행되어 성공했는지 확인하고, 실패하면 수정 PR로 보완한다. production cap sync 후 App scheme을 무서명 시뮬레이터로 빌드하고 `App.app/PlugIns/TerraWidgetExtension.appex/TerraWidgetExtension` 존재를 검사한다.

```sh
NODE_ENV=production npx cap sync ios
xcodebuild build -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
```

`release.yml`과 `ios-lan-test.yml`은 같은 App·Extension 프로파일 설치·운영 App ID 주입·archive 검사를 수행한다. LAN은 기존 개발 서버 URL·버전·TestFlight 업로드 흐름을 유지하지만 이제 위 사람 작업의 서명 시크릿과 운영 App ID가 모두 필요하다. App Group이 없는 옛 프로파일로는 archive 전에 실패한다. CI의 입력 검사는 실제 Apple 서명 유효성 검증을 대체하지 않는다.

다음 항목은 모두 TestFlight·실기기 전 **NOT_RUN**이다. 시뮬레이터 빌드 성공만으로 PASS 처리하지 않는다.

| 경로 | 확인할 동작 | 상태 |
|---|---|---|
| 보상형 정상 완료 | 광고 종료 후 토큰 보상이 한 번 지급됨 | NOT_RUN |
| 보상형 중간 닫기 | 지급 없음 안내, 토큰 미지급 | NOT_RUN |
| 광고 로드/표시 실패 | 실패 안내, 토큰 미지급, 재시도 가능 | NOT_RUN |
| ATT 미결정 | 보상형 광고 경로에서 최초 1회 프롬프트 | NOT_RUN |
| ATT 허용 | 동의 결과에 맞는 개인화 광고 요청 및 정상 보상 | NOT_RUN |
| ATT 거부·제한 | 재요청 없이 비개인화 광고 지속, 정상 시청 보상 | NOT_RUN |
| 위젯 첫 추가 | 갤러리에서 small·medium 표시, 이미지 없으면 안내 문구 | NOT_RUN |
| 앱 홈 방문 후 | 마지막으로 렌더한 테라리움 PNG로 갱신 | NOT_RUN |
| 홈 꾸미기 변경 | 저장/편집 종료 뒤 새 PNG 반영, 편집 중 미반영 | NOT_RUN |
| 로그아웃·계정 전환 | 이전 계정 이미지 삭제, 지연 캡처가 다시 쓰지 않음 | NOT_RUN |
| 잠금·재부팅·앱 종료 | 최초 잠금 해제 이후 PNG 접근, OS 캐시/갱신 지연 확인 | NOT_RUN |
| 기존 기능 회귀 | 공유·Instagram·푸시·딥링크·스와이프 동작 | NOT_RUN |

이미지는 백업 제외·최초 잠금 해제 이후 접근 정책을 유지한다. OS가 캐시한 위젯 이미지는 로그아웃 직후 즉시 사라진다고 보장할 수 없다. 키보드 수정의 기존 iPhone 실기기 확인 **PARTIAL** 상태는 별도로 유지한다.

## 검증 기록

2026-10-08 Windows: `npm ci`, production `npx cap sync ios`, `npx cap ls` 성공. `Package.swift`는 실제 sync 결과의 경로 구분자만 macOS용으로 정규화했다. `node --test tests/check-capacitor-sync.test.mjs` 10/10 통과. Node 24에서 `node --test tests/`는 디렉터리를 모듈로 해석해 실패하므로 `rg --files tests -g '*.test.mjs'`로 수집한 전체 Node 테스트 파일을 실행하여 10/10 통과했다. Android Java 테스트는 이번 범위 밖이다.

pbxproj 파서로 66개 객체의 24자리 ID·중복·미정의 참조 및 타깃별 소스·의존성·embed·서명 설정 검사 통과. plist/entitlements/xcprivacy 5개를 Python plistlib로 파싱했다. 세 워크플로의 YAML 및 56개 run 블록 bash 문법 검사 통과. 임시 fixture로 App ID 27건, 서명 시크릿 8건, 프로파일 18건, archive 6건의 허용/차단 경계를 확인했다. 실제 Apple 서명·SDK 실행 검증은 아니다.


2026-09-13 Windows: `assembleDebug` **exit 0**, `BUILD SUCCESSFUL in 1m 31s`, `431 actionable tasks: 246 executed, 185 from cache`; Java 컴파일·리소스/manifest 처리·APK 패키징 수행. 기존 flatDir 경고와 일부 native library strip 불가 안내가 있었다. `node scripts/check-capacitor-sync.mjs` **exit 0**, 공유 의존 12개 일치; mobile-only assets 1개 안내. 상세 frontend 결과 및 최초 실패/재실행은 workspace `scratchpad/audit-2026-09-12/report-P7-widget.md`에 기록한다.

iOS 컴파일·서명·App Group 접근·위젯 배포, Android/iOS 실기기 위젯 표시, 운영 원격 frontend 배포 및 홈/공유/푸시/딥링크 실기기 회귀는 **미검증**이다. 정적 source/로컬 APK 빌드를 전체 기능 PASS로 확대하지 않는다.

공식 계약 참고: [Android 기본 위젯](https://developer.android.com/develop/ui/views/appwidgets), [Android 갱신](https://developer.android.com/develop/ui/views/appwidgets/advanced), [Apple TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider), [WidgetKit 갱신 예산](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date/).
