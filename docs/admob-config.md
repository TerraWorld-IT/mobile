# iOS 보상형 광고 설정 (`@capacitor-community/admob`)

갱신: 2026-10-08. iOS에 기존 토큰 보상형 광고 SDK와 ATT 설정을 복원했다. 배너·전면 광고, 카메라·사진 읽기, 별도 분석 SDK는 도입하지 않는다. Android 광고·결제 제외 정책은 그대로다. iOS IAP 플러그인과 릴리스 IAP gate도 유지한다.

저장소 설정과 서명 전 검사를 구현한 상태이며 macOS 빌드·TestFlight·실기기 광고 시청은 미검증이다. 기능 노출과 보상 지급은 별도 frontend 작업 `ios-widget-ads-frontend`(iOS 진입점, 광고 단위 ID, ATT 결과에 따른 광고 요청)와 함께 검증해야 한다. 네이티브 SDK 포함만으로 사용자 기능 완료를 뜻하지 않는다.

## 두 종류의 ID와 주입 위치

| 구분 | 설정 위치 | 기본값/검사 |
|---|---|---|
| iOS App ID (`~` 구분) | `ios/App/App/Info.plist`의 `GADApplicationIdentifier` | 개발·mobile-ci는 공식 테스트 ID `ca-app-pub-3940256099942544~1458002511` |
| 서명 릴리스 App ID | GitHub secret `ADMOB_IOS_APP_ID` → archive 전 PlistBuddy | 숫자 16자리 퍼블리셔·10자리 앱 ID 형식, 빈 값·테스트 퍼블리셔 `3940256099942544` 거부 |
| 보상형 Ad Unit ID (`/` 구분) | frontend의 iOS 전용 runtime config, `useAdMob.ts` | 운영 iOS 보상형 단위 발급 후 frontend 작업의 설정 키로 주입; mobile App ID와 다름 |

`release.yml`과 `ios-lan-test.yml`은 앱 plist만 덮어쓰며, 과거 `ADMOB_APP_ID_IOS`/xcconfig append 경로를 사용하지 않는다. archive 안의 App ID가 입력값과 일치하고 테스트 ID가 아닌지, `PlugIns/TerraWidgetExtension.appex`와 실행 파일이 포함됐는지 검사한 뒤 export/upload한다. 테스트 광고 요청 자체는 frontend 개발 설정으로 선택한다.

운영 URL의 로컬 동기화는 `NODE_ENV=production npx cap sync ios`로 실행한다(PowerShell: `$env:NODE_ENV='production'; npx cap sync ios`). `ios/App/App/capacitor.config.json`은 기존 Git 제외 산출물이며 `https://terraworld.web-qplay.kr`, `cleartext: false`를 확인한다. Windows CLI가 생성하는 `Package.swift` 경로의 역슬래시는 macOS에서 해석되지 않으므로 커밋 전 `/`로 정규화한다. Cordova IAP 패키지는 sync가 재생성한다.

## ATT와 개인정보 선언

frontend는 `AdMob.requestTrackingAuthorization()`을 초기화 전에 호출하고, 미결정 상태에서만 최초 시스템 프롬프트를 요청한다. 허용 시 개인화 요청, 거부·제한 시 재요청 없이 비개인화 광고를 요청하는 동작은 frontend 작업 및 실기기 검증 대상이다. ATT는 지역별 광고 동의 절차를 대체하지 않으므로 제공 지역에 필요한 UMP/동의 설정도 배포 전에 확인한다.

`PrivacyInfo.xcprivacy`는 기존 이메일·회원 ID·기타 데이터·사용자 콘텐츠·피트니스 5종 및 FileTimestamp 사유 `C617.1`을 보존하고 `NSPrivacyTracking=true`로 변경한다. DeviceID·ProductInteraction을 광고 목적에 맞게 복원하고 AdvertisingData·CrashData·PerformanceData·OtherDiagnosticData를 추가했다. 광고 SDK의 분석 목적은 선언하지만 별도 제품 분석 SDK를 도입한 것은 아니다. CrashData는 사용자 연결·추적 false, 다른 광고 항목은 연결·추적 true로 선언한다. 최종 제출 전 Xcode의 SDK 포함 Privacy Report와 ASC 라벨을 함께 확인한다.

제거 이력 `821b688`의 Name·PhotosorVideos·PurchaseHistory·Contacts는 이번 도입에서 해당 수집 경로를 추가하지 않으므로 복원하지 않았다. 옛 DeviceID·ProductInteraction의 분석 전용/추적 false 선언도 그대로 재사용하지 않는다. 앱은 광고 SDK에 위치를 전달하지 않으므로 앱 매니페스트의 CoarseLocation 선언은 제거했다. SDK가 IP로 추정하는 대략적 위치는 SDK 자체 매니페스트와 함께 확인하고, App Store Connect 개인정보 라벨에는 SDK 수집분을 포함한다. `NSPrivacyTrackingDomains`는 기존 빈 배열을 유지하며 앱 수준에서 광고 도메인을 추측해 추가하지 않는다. SDK 자체 매니페스트의 추적 도메인 차단 및 ATT 거부 후 광고 동작은 실기기에서 확인한다.

`Info.plist`의 SKAdNetworkItems는 Google 공식 설정 예제의 50개 식별자를 반영한다. `821b688^`에는 이 목록이 없었다.

## 배포 준비 및 검증

Apple Developer·AdMob·GitHub 시크릿·ASC 개인정보·SSV 설정은 [위젯 runbook의 사람 작업](terra-widget-runbook.md#ios-광고위젯-사람-작업-순서)에 모았다. 실기기 검증 매트릭스도 같은 문서를 사용한다. 실제 ID·프로파일·인증서는 저장소에 추가하지 않는다.

Android는 `android.includePlugins`에서 AdMob·카메라·결제를 제외하며 이번 변경에서 수정하지 않았다. Android용 ID 주입 예제를 현재 적용 상태로 해석하지 않는다.

공식 참고: [Google SDK 설정](https://developers.google.com/admob/ios/quick-start), [광고 SDK 수집 데이터](https://developers.google.com/admob/ios/privacy/data-disclosure), [ATT/IDFA](https://developers.google.com/admob/ios/privacy/idfa).
