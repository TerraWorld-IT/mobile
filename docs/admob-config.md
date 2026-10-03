# AdMob Configuration (`@capacitor-community/admob`)

Last updated: 2026-05-16
Source: UltraPlan 2026-05-16 v2 § 1 M4 + § 3 M4

> **iOS 는 첫 출시에서 광고 제외 (2026-10-03 결정).** `capacitor.config.ts` 의 `ios.includePlugins` 가
> `@capacitor-community/admob` 을 뺀 allowlist 라 iOS 빌드(Package.swift)에는 AdMob 네이티브 SDK 가 없고,
> `Info.plist` 에서도 `GADApplicationIdentifier`·`NSUserTrackingUsageDescription` 을 제거했다
> (ATT 설명 문구만 있고 요청이 없으면 App Store 가이드라인 5.1.2 반려 소지). 아래 iOS 절의 설정은
> **iOS 광고 도입 시 복원용 참고**이며 현재 iOS 빌드에는 적용되지 않는다. 복원 시: includePlugins 에 admob
> 추가 → `npx cap sync ios` → Info.plist 에 `GADApplicationIdentifier`·ATT 문구·`SKAdNetworkItems`
> 복원 → PrivacyInfo.xcprivacy·App Store Connect 개인정보 설문 재검토. Android 는 아래 참고.
>
> 같은 시점에 iOS 에서 `@capacitor/camera` 도 제외했다(frontend 호출 0건). 따라서 `Info.plist` 의
> `NSCameraUsageDescription`·`NSPhotoLibraryUsageDescription` 도 없고, `PrivacyInfo.xcprivacy` 는 광고·분석·
> 사진·구매 이력·연락처 항목 없이 실제 수집(이메일·회원 ID·사용자 콘텐츠·피트니스·기타) 5종만 선언한다.
> 광고 도입 시에는 광고 식별자(DeviceID)·광고 목적 수집 항목도 매니페스트와 설문에 함께 추가해야 한다.
>
> **Android 도 Google Play 첫 출시에서 광고·결제 제외.** `capacitor.config.ts` 의 `android.includePlugins`
> allowlist 가 `@capacitor-community/admob`·`cordova-plugin-purchase`·`@capacitor/camera` 를 빼므로 GMA SDK·
> Play Billing·CameraX 가 APK/AAB 에 없고, 병합 매니페스트에서 `AD_ID`·`ACCESS_ADSERVICES_*`·`BILLING` 권한도
> 사라진다(Play Console 광고 ID 선언은 "사용 안 함"). `AndroidManifest.xml` 의 `APPLICATION_ID`·`OPTIMIZE_*`
> meta-data 와 `build.gradle` 의 `admobAppId` manifestPlaceholder 도 제거했다. `release.yml` 이 넘기는
> `-PADMOB_APP_ID` 는 읽는 곳이 없어 무시된다. 아래 Android 절은 **광고 도입 시 복원용 참고**다. 복원 시:
> includePlugins 에 admob(결제는 cordova-plugin-purchase) 추가 → `npx cap sync android` → 아래 meta-data·
> placeholder 복원 → Play Console 광고 ID 선언·Data safety 재검토.

## 현재 상태 (2026-05-16 기준)

`mobile/capacitor.config.ts` 의 `AdMob` 플러그인 설정은 **test 환경만** 명시:

```ts
plugins: {
  AdMob: {
    initializeForTesting: isDev,  // dev = true (Google test IDs)
  },
}
```

**누락 부분**: real ad unit ID 와 AdMob app ID 의 production 주입 메커니즘이 코드/문서에 명시되지 않음.

## Google AdMob 의 두 가지 ID

1. **App ID** (`ca-app-pub-XXXXX~YYYYY`) — 앱 등록 시 1회 발급. AndroidManifest / Info.plist 에 박혀야 SDK 가 init.
2. **Ad Unit ID** (`ca-app-pub-XXXXX/ZZZZZ`) — 광고 단위(rewarded / banner / interstitial) 마다 발급. 코드 (frontend `useAdMob.ts`) 에서 요청 시 지정.

## Production 주입 메커니즘 (정책 — 도입 필요)

### Android — App ID

`mobile/android/app/src/main/AndroidManifest.xml` 의 `<application>` 안에:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="${admobAppId}"/>
```

`mobile/android/app/build.gradle` 의 `defaultConfig` 또는 buildType 에:

```gradle
manifestPlaceholders = [
    admobAppId: project.findProperty("ADMOB_APP_ID") ?: "ca-app-pub-3940256099942544~3347511713"
]
```

- dev/test 빌드: 기본값 = Google 공식 test App ID (`ca-app-pub-3940256099942544~3347511713`)
- production: CI 가 `-PADMOB_APP_ID=ca-app-pub-<real>~<real>` 주입 (`mobile/.github/workflows/release.yml`)
- `gradle.properties` 에 real ID 박지 않음 (secret)

### iOS — App ID

`mobile/ios/App/App/Info.plist` 에:

```xml
<key>GADApplicationIdentifier</key>
<string>$(ADMOB_APP_ID)</string>
```

`mobile/ios/App/App/Config.xcconfig` (또는 release.xcconfig) 에:

```
// dev fallback (test App ID)
ADMOB_APP_ID = ca-app-pub-3940256099942544~1458002511
```

production 빌드는 CI 에서 release.xcconfig 의 ADMOB_APP_ID 를 real ID 로 overwrite (secret 주입).

### Ad Unit ID (frontend)

frontend `useAdMob.ts` 에서 환경별 분기:

- `import.meta.dev` → Google rewarded test unit (`ca-app-pub-3940256099942544/5224354917`)
- production → `useRuntimeConfig().public.admob.rewardedUnitId` (frontend `.env.production` 또는 build-time 주입)

frontend `nuxt.config.ts` `runtimeConfig.public.admob`:

```ts
runtimeConfig: {
  public: {
    admob: {
      rewardedUnitId: process.env.NUXT_PUBLIC_ADMOB_REWARDED_UNIT_ID ?? 'ca-app-pub-3940256099942544/5224354917',
    },
  },
}
```

## Secret Storage (정책)

| 환경 | App ID 출처 | Ad Unit ID 출처 |
|------|------------|----------------|
| dev (로컬) | hardcoded test ID (fallback in build.gradle / xcconfig) | hardcoded test ID (useAdMob.ts fallback) |
| dev (LAN device) | 동일 | 동일 |
| staging | GitHub Actions secret `ADMOB_APP_ID_STAGING` (별도 staging 앱 등록 시) | `NUXT_PUBLIC_ADMOB_REWARDED_UNIT_ID_STAGING` |
| production | GitHub Actions secret `ADMOB_APP_ID_PRODUCTION` | `NUXT_PUBLIC_ADMOB_REWARDED_UNIT_ID_PRODUCTION` |

**중요**: Ad Unit ID 는 client-side runtime 에서 노출되므로 `public.*` runtimeConfig 사용 가능. App ID 도 SDK init 시 노출되므로 secret 분류는 "configuration" 수준 — leak 시 abuse 방지는 AdMob 서버 정책 (앱 등록 verification) 으로 보장.

## Verification Gate (UltraPlan M4 § C)

본 정책 PR 머지 후:

1. **prod config diff gate**: `release.yml` 의 빌드 산출 `mobile/android/app/build/outputs/apk/release/*.apk` 또는 `mobile/ios/App/build/Build/Products/Release-iphoneos/App.app` 의 `AndroidManifest.xml` / `Info.plist` 에 test ID (`ca-app-pub-3940256099942544`) 가 없는지 grep:

   ```bash
   # Android
   ./gradlew assembleRelease
   unzip -p app/build/outputs/apk/release/app-release.apk AndroidManifest.xml | strings | grep -c "3940256099942544"
   # 기대: 0

   # iOS (macOS)
   /usr/libexec/PlistBuddy -c "Print :GADApplicationIdentifier" build/.../Info.plist | grep -c "3940256099942544"
   # 기대: 0
   ```

2. **CI step 추가**: `release.yml` 의 android-build / ios-build job 마지막에 위 grep 추가, hit > 0 시 fail.

## Outstanding

본 문서는 **정책 / 매뉴얼**. 실 적용 (manifestPlaceholders, xcconfig, ci.yml 변경) 은 별도 PR (UltraPlan M4 의 implementation 단계). 현재는:

- AdMob App ID (Android/iOS 각각) 실제 발급 — 사용자 영역 (Google AdMob 콘솔)
- 발급된 ID → GitHub Actions secret 등록 — 사용자 영역
- 정책 PR — Claude 영역 (본 문서 → manifestPlaceholders + xcconfig wire + CI verify step)

## References

- UltraPlan 2026-05-16 v2 § 1 M4 + § 3 M4
- Google AdMob test IDs: <https://developers.google.com/admob/android/test-ads> / <https://developers.google.com/admob/ios/test-ads>
- frontend `useAdMob.ts` (현재 fallback 로직 보유)
- 03-mobile.md (workspace 분석)
