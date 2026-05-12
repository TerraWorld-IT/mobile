# TerraWorld Mobile

TerraWorld Android 앱 — Capacitor 8 기반 WebView 래퍼. 실제 콘텐츠는 [`frontend/`](../frontend) (Nuxt 4) 에서 렌더링하며, 본 프로젝트는 네이티브 plugin (push, share, AdMob 등) 만 등록한다.

## 빠른 시작

```bash
# 의존성 설치 (npm 사용 — 아래 "PM 선택" 참고)
npm install

# Capacitor → Android 동기화
npx cap sync android

# 디버그 APK 빌드 (Android Studio 없이)
npm run build:android
# → android/app/build/outputs/apk/debug/app-debug.apk

# 또는 Android Studio 에서 열기
npm run open:android
```

## PM 선택 — npm intentional

`frontend/` 가 **bun** 을 쓰는 것과 달리 `mobile/` 은 **npm** 을 사용한다. 이유:

- Capacitor CLI(`@capacitor/cli`) 와 plugin 의 native 코드 동기화 절차(`npx cap sync` 등)가 npm 기반에서 가장 검증되어 있음.
- `mobile/` 은 의존성이 작고 (Capacitor plugin 들 정도) lockfile 변경이 거의 없어 PM 통일의 이득이 적음.
- 두 프로젝트가 별도 repo · 별도 CI 라 PM 분리해도 충돌 없음.

새 의존성 추가 시 반드시 `package-lock.json` 도 함께 commit.

## 출시 빌드

태그를 `v` 로 시작해서 push 하면 [`.github/workflows/release.yml`](.github/workflows/release.yml) 이 자동으로 서명 AAB 를 빌드한다.

```bash
git tag v1.0.0
git push origin v1.0.0
# → Actions 에서 app-release-aab artifact 다운로드 가능
# → Play Console 비공개 테스트 / 프로덕션 검수에 업로드
```

### Release 서명 keystore 설정 (1회)

1. keystore 생성 (이미 `keystore/terraworld-release.keystore` 있으면 재사용)
   ```bash
   keytool -genkey -v -keystore keystore/terraworld-release.keystore \
     -alias terraworld -keyalg RSA -keysize 2048 -validity 10000
   ```
2. base64 인코딩
   ```bash
   base64 -w0 keystore/terraworld-release.keystore   # Linux
   base64 -i keystore/terraworld-release.keystore   # macOS
   ```
3. GitHub Secrets 등록 (Settings → Secrets and variables → Actions)
   - `ANDROID_KEYSTORE_BASE64` — 위 base64 결과
   - `ANDROID_KEYSTORE_PASSWORD` — keystore 비밀번호
   - `ANDROID_KEY_ALIAS` — `terraworld`
   - `ANDROID_KEY_PASSWORD` — 키 비밀번호

> ⚠ keystore 파일은 절대 repo 에 commit 하지 말 것 (`.gitignore` 에 `*.keystore` 등록 권장). 분실 시 동일 appId 로 업데이트 영구 불가.

## Capacitor 설정

[`capacitor.config.ts`](capacitor.config.ts) — appId, webDir, server.url(원격 콘텐츠), 활성화 plugin (Splash/StatusBar/Keyboard/Push/AdMob).

dev 모드 (`NODE_ENV !== 'production'`) 는 기본적으로 Android 에뮬레이터의 호스트 alias (`http://10.0.2.2:3000`) 를 로드. iOS 시뮬레이터·실기기·LAN 환경은 `CAP_DEV_URL` 환경변수로 override:

```bash
# iOS 시뮬레이터 — host 와 동일 네트워크
CAP_DEV_URL=http://localhost:3000 npx cap sync ios

# 실기기 (Android/iOS) — PC LAN IP 지정
CAP_DEV_URL=http://192.168.1.42:3000 npx cap sync
```

env 미지정 시 기존 동작 (`10.0.2.2:3000`) 유지 — backwards compatible.

## 네이티브 plugin

| plugin | 역할 |
|---|---|
| `@capacitor-community/admob` | 보상형 광고 (시들기 복원 / 햇살 일일 보상) |
| `@capacitor/app` | back button, 앱 라이프사이클 |
| `@capacitor/camera` | 사진 첨부 (추후) |
| `@capacitor/filesystem` | 스크린샷 PNG 임시 저장 → 공유 시트 |
| `@capacitor/haptics` | 햅틱 피드백 |
| `@capacitor/keyboard` | 키보드 resize |
| `@capacitor/push-notifications` | 푸시 알림 |
| `@capacitor/share` | 시스템 공유 시트 |
| `@capacitor/splash-screen` | 스플래시 |
| `@capacitor/status-bar` | 상태바 색상 |

새 plugin 추가 시 `frontend/package.json` 과 동일 버전으로 동기화.

## 출시 일정 (참고)

- 개발자 신원 인증 ~ 2026-08-31 (Play Console)
- 비공개 테스트 2026-09-15 ~ 10-01 (테스터 20명, 14일 상시 설치)
- 프로덕션 검수 2026-10-02 ~ 10-15
- 정식 출시 2026-10-22

상세는 `docs/테라월드_김태겸_기획서.md` 의 5-나 참고.
