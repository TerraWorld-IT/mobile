# iOS 보상형 광고 설정 (`@capacitor-community/admob`)

갱신: 2026-10-08. iOS에 기존 토큰 보상형 광고 SDK와 ATT 설정을 복원했다. 배너·전면 광고, 카메라·사진 읽기, 별도 분석 SDK는 도입하지 않는다. Android 광고·결제 제외 정책은 그대로다. iOS IAP 플러그인과 릴리스 IAP gate도 유지한다.

저장소 설정과 서명 전 검사를 구현했다. main `1815b7a`의 [Mobile CI run 37749716607](https://github.com/TerraWorld-IT/mobile/actions/runs/37749716607)에서 iOS Build Check의 macOS 무서명 시뮬레이터 빌드가 성공했다. `TerraWidgetExtension.appex`가 `App.app/PlugIns`에 포함됐고, `GoogleMobileAds`·`UserMessagingPlatform` framework가 링크됐다. 서명 archive·TestFlight·실기기 광고 시청은 미검증이다. 기능 노출과 보상 지급은 별도 frontend 작업 `ios-widget-ads-frontend`(iOS 진입점, 광고 단위 ID, ATT 결과에 따른 광고 요청)와 함께 검증해야 한다. 네이티브 SDK 포함만으로 사용자 기능 완료를 뜻하지 않는다.

## 두 종류의 ID와 주입 위치

| 구분 | 설정 위치 | 기본값/검사 |
|---|---|---|
| iOS App ID (`~` 구분) | `ios/App/App/Info.plist`의 `GADApplicationIdentifier` | 개발·mobile-ci는 공식 테스트 ID `ca-app-pub-3940256099942544~1458002511` |
| 운영 릴리스 App ID (`release.yml`) | GitHub secret `ADMOB_IOS_APP_ID` → archive 전 PlistBuddy | 숫자 16자리 퍼블리셔·10자리 앱 ID 형식, 빈 값·테스트 퍼블리셔 `3940256099942544` 거부 |
| LAN TestFlight App ID (`ios-lan-test.yml`) | 선택 secret `ADMOB_IOS_APP_ID` → archive 전 PlistBuddy | 미설정 시 Info.plist의 공식 테스트 ID 유지; 운영 ID 형식·테스트 퍼블리셔 거부 검사 없음 |
| 보상형 Ad Unit ID (`/` 구분) | frontend의 iOS 전용 runtime config, `useAdMob.ts` | 운영 iOS 보상형 단위 발급 후 frontend 작업의 설정 키로 주입; mobile App ID와 다름 |

`release.yml`은 운영 App ID를 필수로 주입하고, archive의 ID 일치 및 테스트 퍼블리셔 제외를 검사한다. `ios-lan-test.yml`은 시크릿이 있을 때만 주입하며, archive의 ID가 앱 plist와 같은지만 검사한다. 두 경로 모두 `PlugIns/TerraWidgetExtension.appex`와 실행 파일 포함을 검사한 뒤 export/upload한다. 미사용 `ADMOB_APP_ID` xcconfig 키는 제거했으며, App ID는 `Info.plist` 기본값과 워크플로의 PlistBuddy 주입으로만 관리한다. 테스트 광고 요청 자체는 frontend 개발 설정으로 선택한다.

운영 URL의 로컬 동기화는 `NODE_ENV=production npx cap sync ios`로 실행한다(PowerShell: `$env:NODE_ENV='production'; npx cap sync ios`). `ios/App/App/capacitor.config.json`은 기존 Git 제외 산출물이며 `https://terraworld.web-qplay.kr`, `cleartext: false`를 확인한다. 체크인된 `Package.swift`는 도입 전 main의 형태(`.iOS(.v15)`, forward-slash 경로와 NOTE 주석 유지)에 AdMob package·product 두 줄만 추가한다. Windows CLI가 생성하는 역슬래시 경로는 macOS용 `/`로 정규화한다. `CordovaPluginPurchase`와 Camera 패키지·product 항목은 체크인하지 않으며 Capacitor 코어의 `Cordova` product는 유지한다. IAP용 `CordovaPluginPurchase` 항목은 CI의 `cap sync`가 재생성하고 `release.yml`의 IAP 게이트가 이를 검사한다. App의 배포 대상은 이미 iOS 16.4이므로 패키지의 `.v15` 표기로 설치 가능한 기기가 바뀌지 않는다.

## ATT와 개인정보 선언

frontend는 `AdMob.requestTrackingAuthorization()`을 초기화 전에 호출하고, 미결정 상태에서만 최초 시스템 프롬프트를 요청한다. 허용 시 개인화 요청, 거부·제한 시 재요청 없이 비개인화 광고를 요청하는 동작은 frontend 작업 및 실기기 검증 대상이다. ATT는 지역별 광고 동의 절차를 대체하지 않으므로 제공 지역에 필요한 UMP/동의 설정도 배포 전에 확인한다.

앱의 `PrivacyInfo.xcprivacy`는 앱 코드가 추적 도메인에 직접 연결하지 않으므로 `NSPrivacyTracking=false`, `NSPrivacyTrackingDomains`는 빈 배열로 둔다. Google Mobile Ads SDK의 추적·도메인 선언은 SDK 자체 개인정보 매니페스트가 담당한다. 이 앱 수준 설정이 ATT·개인화 광고를 비활성화하거나 SDK의 추적이 없다는 뜻은 아니다.

앱의 수집 데이터 유형은 **앱 코드가 직접 수집하는 것만 선언**한다. 기존 이메일·회원 ID·기타 데이터·사용자 콘텐츠·피트니스 5종 및 FileTimestamp 사유 `C617.1`을 보존한다. Google Mobile Ads·UMP SDK 수집분은 각 SDK의 개인정보 매니페스트와 **App Store Connect 개인정보 라벨**에서 관리한다. 이에 따라 앱 매니페스트에 중복 기재했던 DeviceID·AdvertisingData·ProductInteraction·CrashData·PerformanceData·OtherDiagnosticData 6종을 제거했다. 결과는 광고 도입 전 `f94167d`의 앱 매니페스트와 동일하다. 별도 제품 분석 SDK는 도입하지 않았다.

제거 이력 `821b688`의 Name·PhotosorVideos·PurchaseHistory·Contacts는 해당 수집 경로를 추가하지 않으므로 복원하지 않는다. 앱은 광고 SDK에 위치를 전달하지 않으므로 앱 매니페스트에 CoarseLocation도 추가하지 않는다. SDK의 IP 기반 대략적 위치를 포함해 실제 수집분은 ASC 라벨에 반영하고, 최종 제출 전에 Xcode의 SDK 포함 Privacy Report와 대조한다. 이 정리는 광고 SDK의 수집·추적이 없다는 뜻이 아니다. SDK 매니페스트의 추적 도메인 차단 및 ATT 거부 후 광고 동작은 실기기에서 확인한다.

`Info.plist`의 SKAdNetworkItems는 Google 공식 설정 예제의 50개 식별자를 반영한다. `821b688^`에는 이 목록이 없었다.

## 키보드 설정

`capacitor.config.ts`의 `plugins.Keyboard.resize`는 `native`다. frontend `app/plugins/capacitor.client.ts`의 런타임 `Keyboard.setResizeMode(native)`와 정렬해 초기 로드부터 같은 모드를 사용한다. 이 옵션은 iOS 전용이며 Android 블록과 동작은 변경하지 않는다. 다음 iOS 바이너리에 포함되며 iPhone 키보드 실기기 확인은 **PARTIAL** 상태를 유지한다.

## 배포 준비 및 검증

Apple Developer·AdMob·GitHub 시크릿·ASC 개인정보·SSV 설정은 [위젯 runbook의 사람 작업](terra-widget-runbook.md#ios-광고위젯-사람-작업-순서)에 모았다. 실기기 검증 매트릭스도 같은 문서를 사용한다. 실제 ID·프로파일·인증서는 저장소에 추가하지 않는다.

Android는 `android.includePlugins`에서 AdMob·카메라·결제를 제외하며 이번 변경에서 수정하지 않았다. Android용 ID 주입 예제를 현재 적용 상태로 해석하지 않는다.

공식 참고: [Google SDK 설정](https://developers.google.com/admob/ios/quick-start), [광고 SDK 수집 데이터](https://developers.google.com/admob/ios/privacy/data-disclosure), [ATT/IDFA](https://developers.google.com/admob/ios/privacy/idfa).
