# iOS 네이티브 앱 — 클라우드 빌드 → TestFlight 설치 가이드 (LAN 테스트)

Mac 없이 GitHub Actions(클라우드 macOS)로 iOS 앱을 빌드해 TestFlight 로 아이폰에 설치하는 절차.
앱은 원격 WebView 셸이라, 이 빌드는 **개발 PC LAN 서버**(`http://192.168.79.119:3000`)를 가리킨다
→ 아이폰이 개발 PC 와 **같은 WiFi** 일 때 동작(집 밖/셀룰러 X).

- Bundle ID: `app.terraworld.mobile`
- 워크플로: `.github/workflows/ios-lan-test.yml` (`workflow_dispatch`, 입력 `server_url` 기본 = LAN)
- 프로덕션 릴리스(`release.yml`, `v*` 태그, https://terraworld.web-qplay.kr)와는 별개

---

## A. Apple 쪽 준비 (사용자 — 본인 Apple Developer 계정에서만 가능)

### A-1. App Store Connect API 키 발급 (업로드용)
1. https://appstoreconnect.apple.com → **Users and Access** → **Integrations** 탭 → **App Store Connect API** (Team Keys)
2. **Generate API Key** → 이름 아무거나(예: `github-ci`), **Access = App Manager** (또는 Admin)
3. 생성되면 3가지 확보:
   - **Key ID** (10자, 예 `ABCD1234EF`) → GitHub secret `APPLE_API_KEY_ID`
   - **Issuer ID** (페이지 상단 UUID) → GitHub secret `APPLE_API_ISSUER_ID`
   - **`AuthKey_XXXXXXXXXX.p8` 파일 다운로드** (⚠️ 딱 한 번만 받을 수 있음 — 잘 보관)
4. https://developer.apple.com/account → **Membership details** → **Team ID** 확인 → GitHub secret `APPLE_TEAM_ID`에 **`SMF6T723XR` 필수 등록**. App·Extension 프로젝트와 다른 팀이면 워크플로가 실패한다.

### A-2. 앱 레코드 생성 (TestFlight 업로드 대상)
1. App Store Connect → **Apps** → **➕ → New App**
2. Platform **iOS**, Name **TerraWorld**, Primary Language **Korean**, **Bundle ID = `app.terraworld.mobile`**
   (목록에 없으면: https://developer.apple.com/account → **Identifiers** → ➕ → App IDs → `app.terraworld.mobile` 등록 후 재시도)
3. SKU 아무 문자열(예 `terraworld-001`). 생성만 하면 됨(스토어 정보 미입력 OK).

### A-3. 내부 테스터 등록 (본인 아이폰으로 받기)
1. 아이폰에 **TestFlight** 앱 설치 (App Store)
2. App Store Connect → 해당 앱 → **TestFlight** 탭 → **Internal Testing** → 그룹 생성 → 본인 Apple ID 추가
   (내부 테스터는 Beta 심사 없이 처리 즉시 설치 가능)

### A-4. App·Widget 서명 자원 준비
팀 **`SMF6T723XR`**에서 App Group **`group.app.terraworld.mobile`**을 준비하고, App ID **`app.terraworld.mobile`**과 위젯 Extension App ID **`app.terraworld.mobile.TerraWidgetExtension`** 모두에 연결한다.
같은 Distribution 인증서로 App Store 프로파일 **`TerraWorld App Store`**(App)와 **`TerraWorld Widget App Store`**(Widget)를 준비한다. App Group이 없는 기존 App 프로파일은 재발급해야 한다.
서명에 사용할 Distribution 인증서·개인키가 포함된 **`.p12` 파일과 내보내기 암호**도 준비한다. 워크플로는 이를 임포트해 재사용한다.

상세 절차는 [위젯 런북의 「iOS 광고·위젯 사람 작업 순서」](terra-widget-runbook.md#ios-광고위젯-사람-작업-순서)를 따른다: **1. App Group 생성 → 2. 기존 App ID에 연결 → 3. Extension App ID 생성·연결 → 4. 두 App Store 프로파일 발급 → 5. GitHub Actions secrets 설정**. 광고 App ID 준비는 같은 절의 **6. AdMob iOS 앱 등록**을 참조한다.

---

## B. GitHub Secrets 설정 (사용자 — 값이 나(AI)에게 노출되지 않도록 직접 등록)

리포 `TerraWorld-IT/mobile` → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret 이름 | 값 |
|---|---|
| `APPLE_API_KEY_ID` | A-1 의 Key ID (10자) |
| `APPLE_API_ISSUER_ID` | A-1 의 Issuer ID (UUID) |
| `APPLE_API_KEY_P8_BASE64` | `.p8` 파일을 base64 인코딩한 **한 줄 문자열** (아래 참조) |
| `APPLE_DISTRIBUTION_CERT_P12_BASE64` | A-4 의 Distribution 인증서·개인키 `.p12`를 base64 인코딩한 한 줄 문자열 |
| `APPLE_DISTRIBUTION_CERT_PASSWORD` | 해당 `.p12` 내보내기 암호 (빈 값이면 필수 시크릿 검사 실패) |
| `APPLE_PROVISIONING_PROFILE_BASE64` | A-4 의 `TerraWorld App Store` App 프로파일(`.mobileprovision`)을 base64 인코딩한 한 줄 문자열 |
| `APPLE_WIDGET_PROVISIONING_PROFILE_BASE64` | A-4 의 `TerraWorld Widget App Store` Extension 프로파일(`.mobileprovision`)을 base64 인코딩한 한 줄 문자열 |
| `APPLE_TEAM_ID` | **필수**, App·Extension 팀 **`SMF6T723XR`** |

위 **8개는 모두 필수**다. 두 프로파일의 이름·App ID·팀·App Group·App Store 배포 유형·유효기간을 archive 전에 검사한다.

| 선택 Secret 이름 | 값 |
|---|---|
| `ADMOB_IOS_APP_ID` | iOS AdMob App ID. 미등록 시 Info.plist의 Google 공식 테스트 App ID로 빌드됨. 이 기본값은 LAN 테스트용이며 운영 배포용이 아님 |

`.p8` → base64 한 줄 만들기:
```bash
# macOS/Linux
base64 -w0 AuthKey_ABCD1234EF.p8    # (mac 이면 -w0 대신) base64 AuthKey_*.p8 | tr -d '\n'
```
```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_ABCD1234EF.p8")) | Set-Clipboard
```
출력 문자열 전체를 `APPLE_API_KEY_P8_BASE64` 값으로 붙여넣기.
`.p12`와 두 `.mobileprovision` 파일도 위 명령의 파일 경로를 각각 바꾸어 인코딩하고, B 표의 해당 시크릿에 등록한다. `.p12` 암호는 인코딩하지 않고 `APPLE_DISTRIBUTION_CERT_PASSWORD`에 등록한다.

> 🔒 `.p8`·키 값은 채팅에 붙여넣지 마세요 — GitHub Secrets 에만 넣으면 워크플로가 안전하게 사용합니다.

---

## C. 빌드 실행 → TestFlight

1. 개발 PC 의 **서버(backend+frontend)가 실행 중**인지 확인 (`docs/runbooks/local-lan-phone-test.md`).
   LAN IP 가 `192.168.79.119` 가 맞는지 확인 — 바뀌었으면 워크플로 실행 시 `server_url` 입력을 바꾸면 됨.
2. GitHub → `TerraWorld-IT/mobile` → **Actions** → **iOS LAN Test (TestFlight)** → **Run workflow**
   - `server_url` 기본값(`http://192.168.79.119:3000`) 확인/수정 → **Run**
3. macOS 러너가 빌드·서명·업로드(약 5~15분). 성공 시 App Store Connect **TestFlight** 에 빌드가 뜸
   (첫 업로드는 Apple 처리에 몇 분~30분 소요될 수 있음).
4. 처리 완료되면 아이폰 **TestFlight 앱**에 TerraWorld 가 나타남 → **설치** → 실행
   (같은 WiFi + PC 서버 실행 중이어야 화면이 로드됨).

---

## D. 트러블슈팅
| 증상 | 원인/조치 |
|---|---|
| `GitHub Actions secret <이름> 누락` / `LAN TestFlight도 업로드 API 키·Distribution 인증서·App 및 Widget App Store 프로파일이 필요합니다.` | B 의 필수 8개 시크릿 이름·빈 값 확인. A-4 및 런북 사람 작업 1~5에 따라 두 프로파일 준비 |
| `APPLE_TEAM_ID를 App·Extension의 팀 SMF6T723XR로 설정하세요` | B 의 `APPLE_TEAM_ID`를 정확히 `SMF6T723XR`로 설정 |
| `<프로파일 이름> 프로파일을 <App ID>용으로 발급하고 group.app.terraworld.mobile을 연결하세요.` | App은 `TerraWorld App Store` / `SMF6T723XR.app.terraworld.mobile`, Widget은 `TerraWorld Widget App Store` / `SMF6T723XR.app.terraworld.mobile.TerraWidgetExtension`인지 확인. 두 프로파일 모두 팀 `SMF6T723XR`·App Group·App Store 배포 유형·유효기간 확인 후 재발급·시크릿 교체(A-4, 런북 사람 작업 1~5) |
| 인증서 임포트 또는 archive 단계 서명 실패 | `.p12`·내보내기 암호·인증서/개인키와 두 프로파일을 확인(A-4, B). 워크플로의 `security find-identity` 결과와 xcodebuild 오류 확인 |
| `archive에 TerraWidgetExtension.appex 누락` | archive의 `App.app/PlugIns/TerraWidgetExtension.appex`에 Info.plist와 Extension 실행 파일이 모두 필요한 검사다. 개발 담당자가 App scheme의 Extension 빌드·포함 설정 확인 |
| `archive의 AdMob App ID가 App/Info.plist 설정과 일치하지 않음` | 개발 담당자가 archive의 `GADApplicationIdentifier`와 빌드 입력 `ios/App/App/Info.plist` 비교. 선택 시크릿 적용 단계와 archive 결과 확인 |
| altool 업로드 실패(app not found) | A-2 앱 레코드(bundle `app.terraworld.mobile`) 미생성 |
| 앱은 뜨는데 "연결 중…"만 | 아이폰이 PC 와 다른 WiFi / PC 서버 미실행 / 방화벽(3000·8080) / 공유기 AP isolation |
| TestFlight 에 빌드 안 보임 | Apple 처리 지연(대기) 또는 CFBundleVersion 중복 — 재실행(run_number 자동 증가) |

## 참고: 프로덕션 전환 시
도메인+서버 확보 후에는 `release.yml`(태그 `v*`)로 `https://terraworld.web-qplay.kr` 를 가리키는 정식 빌드를 만든다.
그때 이 LAN 테스트 워크플로는 불필요(삭제 가능). 웹(backend/frontend) 프로덕션 배포는 별도(CI/CD 결함 CI-1~9 수정 후).
