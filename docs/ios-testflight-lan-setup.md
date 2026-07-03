# iOS 네이티브 앱 — 클라우드 빌드 → TestFlight 설치 가이드 (LAN 테스트)

Mac 없이 GitHub Actions(클라우드 macOS)로 iOS 앱을 빌드해 TestFlight 로 아이폰에 설치하는 절차.
앱은 원격 WebView 셸이라, 이 빌드는 **개발 PC LAN 서버**(`http://192.168.79.119:3000`)를 가리킨다
→ 아이폰이 개발 PC 와 **같은 WiFi** 일 때 동작(집 밖/셀룰러 X).

- Bundle ID: `app.terraworld.mobile`
- 워크플로: `.github/workflows/ios-lan-test.yml` (`workflow_dispatch`, 입력 `server_url` 기본 = LAN)
- 프로덕션 릴리스(`release.yml`, `v*` 태그, https://terraworld.app)와는 별개

---

## A. Apple 쪽 준비 (사용자 — 본인 Apple Developer 계정에서만 가능)

### A-1. App Store Connect API 키 발급 (헤드리스 서명·업로드용)
1. https://appstoreconnect.apple.com → **Users and Access** → **Integrations** 탭 → **App Store Connect API** (Team Keys)
2. **Generate API Key** → 이름 아무거나(예: `github-ci`), **Access = App Manager** (또는 Admin)
3. 생성되면 3가지 확보:
   - **Key ID** (10자, 예 `ABCD1234EF`) → GitHub secret `APPLE_API_KEY_ID`
   - **Issuer ID** (페이지 상단 UUID) → GitHub secret `APPLE_API_ISSUER_ID`
   - **`AuthKey_XXXXXXXXXX.p8` 파일 다운로드** (⚠️ 딱 한 번만 받을 수 있음 — 잘 보관)
4. Team ID(10자): https://developer.apple.com/account → **Membership details** → **Team ID** → GitHub secret `APPLE_TEAM_ID` (멀티팀 계정이면 필수, 아니면 선택)

### A-2. 앱 레코드 생성 (TestFlight 업로드 대상)
1. App Store Connect → **Apps** → **➕ → New App**
2. Platform **iOS**, Name **TerraWorld**, Primary Language **Korean**, **Bundle ID = `app.terraworld.mobile`**
   (목록에 없으면: https://developer.apple.com/account → **Identifiers** → ➕ → App IDs → `app.terraworld.mobile` 등록 후 재시도)
3. SKU 아무 문자열(예 `terraworld-001`). 생성만 하면 됨(스토어 정보 미입력 OK).

### A-3. 내부 테스터 등록 (본인 아이폰으로 받기)
1. 아이폰에 **TestFlight** 앱 설치 (App Store)
2. App Store Connect → 해당 앱 → **TestFlight** 탭 → **Internal Testing** → 그룹 생성 → 본인 Apple ID 추가
   (내부 테스터는 Beta 심사 없이 처리 즉시 설치 가능)

---

## B. GitHub Secrets 설정 (사용자 — 값이 나(AI)에게 노출되지 않도록 직접 등록)

리포 `TerraWorld-IT/mobile` → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret 이름 | 값 |
|---|---|
| `APPLE_API_KEY_ID` | A-1 의 Key ID (10자) |
| `APPLE_API_ISSUER_ID` | A-1 의 Issuer ID (UUID) |
| `APPLE_API_KEY_P8_BASE64` | `.p8` 파일을 base64 인코딩한 **한 줄 문자열** (아래 참조) |
| `APPLE_TEAM_ID` | Team ID (10자, 선택이지만 권장) |

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
| 워크플로가 "필수 Apple secrets 부재"로 실패 | B 의 secret 3개 미등록 — 이름 오타 확인 |
| archive 단계 서명 실패 | A-1 키 Access 권한 부족(App Manager↑) / 번들ID 미등록(A-2 3) / 멀티팀이면 `APPLE_TEAM_ID` 등록 |
| altool 업로드 실패(app not found) | A-2 앱 레코드(bundle `app.terraworld.mobile`) 미생성 |
| 앱은 뜨는데 "연결 중…"만 | 아이폰이 PC 와 다른 WiFi / PC 서버 미실행 / 방화벽(3000·8080) / 공유기 AP isolation |
| TestFlight 에 빌드 안 보임 | Apple 처리 지연(대기) 또는 CFBundleVersion 중복 — 재실행(run_number 자동 증가) |

## 참고: 프로덕션 전환 시
도메인+서버 확보 후에는 `release.yml`(태그 `v*`)로 `https://terraworld.app` 를 가리키는 정식 빌드를 만든다.
그때 이 LAN 테스트 워크플로는 불필요(삭제 가능). 웹(backend/frontend) 프로덕션 배포는 별도(CI/CD 결함 CI-1~9 수정 후).
