# 나의 테라 홈스크린 위젯 MVP

상태: Android 소스·등록·debug APK 빌드 완료, iOS Swift scaffold 완료 / Xcode target 연결은 보류. 두 플랫폼 실기기 표시는 미검증이다. 앱에서 마지막으로 렌더링한 테라리움 PNG를 보여주며 앱을 열지 않은 동안 서버의 성장 상태를 가져오지 않는다.

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

## iOS: Mac/Xcode에서 필수로 수행할 연결

이 변경은 `project.pbxproj`, 기존 App.entitlements, ViewController, AppDelegate를 변경하지 않았다. 따라서 현재 iOS 빌드에 Widget Extension이나 TerraWidget 브리지는 아직 포함되지 않는다. 아래 절차를 수행하고 Xcode 빌드 검증을 마친 뒤 배포해야 한다.

1. `ios/App/App.xcodeproj`를 Xcode로 열고 File → New → Target → Widget Extension을 만든다. 이름 `TerraWidgetExtension`, bundle ID `app.terraworld.mobile.TerraWidgetExtension`, App에 embed한다. Configuration Intent와 Live Activity는 추가하지 않는다. 배포 대상은 App과 맞춘다(최소 iOS 15 이상; iOS 17 전용 배경 API에는 availability 분기가 있다).
2. 자동 생성한 Swift 위젯 소스를 저장소의 `TerraWidgetExtension/TerraWidget.swift`로 대체한다. `@main` 위젯은 하나만 남기고 **Extension target에만** 포함한다. 이 타깃에 Capacitor를 링크하지 않는다.
3. `WidgetShared/TerraWidgetSnapshot.swift`는 **App과 Extension 양쪽 target membership**에 추가한다. `App/TerraWidgetPlugin.swift`는 **App에만** 추가한다. WidgetKit/ImageIO framework import가 App에서 resolve되는지 확인한다.
4. `ViewController.capacitorDidLoad()`의 기존 Instagram 등록 다음 줄에 `bridge?.registerPluginInstance(TerraWidgetPlugin())`를 추가한다. AppDelegate의 push forwarding, URL allowlist와 ViewController의 swipe 설정을 유지한다.
5. Apple Developer 계정에 `group.app.terraworld.mobile` App Group을 생성하고 App과 Extension 양쪽 Signing & Capabilities에 동일한 그룹을 활성화한다. 다른 ID를 사용하면 shared Swift 상수와 양쪽 entitlement를 함께 바꾼다.
6. App의 기존 `App/App.entitlements`에 아래 키를 **병합**한다. 기존 `aps-environment`와 associated-domains를 덮어쓰지 않는다. App의 Debug/Release `CODE_SIGN_ENTITLEMENTS`가 해당 파일을 참조하고 프로비저닝에 그룹이 포함되는지 확인한다.

   ```xml
   <key>com.apple.security.application-groups</key>
   <array><string>group.app.terraworld.mobile</string></array>
   ```

7. Extension의 `CODE_SIGN_ENTITLEMENTS`를 `TerraWidgetExtension/TerraWidgetExtension.entitlements`로, `INFOPLIST_FILE`을 `TerraWidgetExtension/Info.plist`로 설정한다. 이 plist를 사용하면 `GENERATE_INFOPLIST_FILE=NO`로 두고 Info.plist가 Copy Bundle Resources에 중복 포함되지 않게 한다. Extension/App의 버전과 build 번호를 맞춘다.
8. App Build Phases의 Embed App Extensions에 `.appex`가 포함되고 target dependency가 존재하는지 확인한다. 실제 Signing Team으로 App·Extension을 모두 빌드한다. 예: `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' build` (SPM resolve 및 로컬 scheme 이름 확인 필요).
9. 테스트 기기에 설치하고 위젯 갤러리의 나의 테라 small/medium/large를 각각 추가한다. 홈 진입·변경·로그아웃·계정 전환·잠금/해제·앱 종료 후 표시를 확인한다. PNG는 첫 기기 잠금 해제 이후 접근 가능하며 백업에서 제외된다. App Group entitlement가 없으면 브리지는 오류를 반환하고 홈 흐름은 계속 동작해야 한다.

## 검증 기록

2026-09-13 Windows: `assembleDebug` **exit 0**, `BUILD SUCCESSFUL in 1m 31s`, `431 actionable tasks: 246 executed, 185 from cache`; Java 컴파일·리소스/manifest 처리·APK 패키징 수행. 기존 flatDir 경고와 일부 native library strip 불가 안내가 있었다. `node scripts/check-capacitor-sync.mjs` **exit 0**, 공유 의존 12개 일치; mobile-only assets 1개 안내. 상세 frontend 결과 및 최초 실패/재실행은 workspace `scratchpad/audit-2026-09-12/report-P7-widget.md`에 기록한다.

iOS 컴파일·서명·App Group 접근·위젯 배포, Android/iOS 실기기 위젯 표시, 운영 원격 frontend 배포 및 홈/공유/푸시/딥링크 실기기 회귀는 **미검증**이다. 정적 source/로컬 APK 빌드를 전체 기능 PASS로 확대하지 않는다.

공식 계약 참고: [Android 기본 위젯](https://developer.android.com/develop/ui/views/appwidgets), [Android 갱신](https://developer.android.com/develop/ui/views/appwidgets/advanced), [Apple TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider), [WidgetKit 갱신 예산](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date/).
