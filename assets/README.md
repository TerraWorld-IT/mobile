# 임시 브랜드 네이티브 자산

이 디렉토리의 PNG 원본 및 Android/iOS 파생 이미지는 **임시 브랜드 자산**이다.
정식 디자인 원본 수령 시 교체 후 재생성한다. 추적 이슈: TerraWorld-IT/workspace#38.
거리 전경서비스의 단색 상태바 아이콘 참조 수정은 영구 유지한다.

## 원본과 파생물

- `icon-only.png`: iOS 및 Android 레거시 런처 아이콘.
- `icon-foreground.png`, `icon-background.png`: Android adaptive 아이콘용 병과 크림 배경.
- `splash.png`, `splash-dark.png`: 라이트 크림 및 다크 차콜 스플래시.
- `icon-monochrome.png`: 흰색 병 실루엣과 투명 배경. 테마 아이콘 및 알림 아이콘의 공통 원본.
- `android/app/src/main/res/`: 전 밀도 런처·스플래시 및 단색 아이콘 생성물.
- `ios/App/App/Assets.xcassets/`: 기존 AppIcon/Splash 자산 세트에 생성한 아이콘과 라이트/다크 스플래시.

## 재생성

패키지 매니저는 npm이며 `@capacitor/assets` 3.0.5를 개발 의존성으로 사용한다.
네이티브 플랫폼 플래그로 웹 자산 생성을 제외한다.

```sh
npm ci
npx @capacitor/assets generate --ios --android --iconBackgroundColor '#FFF8EB' --iconBackgroundColorDark '#1b1814' --splashBackgroundColor '#FFF8EB' --splashBackgroundColorDark '#1b1814'
node assets/generate-monochrome.cjs
```

단색 생성 스크립트는 원본의 투명 여백을 잘라낸 후, 가장 긴 변 기준으로 테마 아이콘은
캔버스의 약 66%, 상태바 아이콘은 약 90%에 맞추어 중앙 배치한다.
테마 아이콘은 108/162/216/324/432px, 상태바 아이콘은 24/36/48/72/96px이다.
Firebase 기본 알림의 `ic_notification.xml`은 같은 밀도별 `ic_stat_distance` PNG를 참조한다.

생성기 3.0.5의 사용자 원본 모드는 adaptive 레이어에도 레거시 크기(48~192px)를 사용한다.
후처리 스크립트는 원본에서 foreground/background를 108~432px(ldpi 81px)로 다시 생성해
기존 adaptive XML의 직접 참조 방식에서 사용할 해상도를 보완한다.

생성기는 AndroidManifest.xml의 서식과 adaptive XML을 다시 쓴다.
재생성 후 Manifest의 불필요한 서식 변경을 제거하고, adaptive XML의 기존
`@color/ic_launcher_background` 및 `@mipmap/ic_launcher_foreground` 참조를 유지한다.
두 adaptive XML의 임시 주석 및 `<monochrome>` 항목을 유지하고,
`values/ic_launcher_background.xml`의 크림색과 `values[-night]/styles.xml`의 라이트/다크
스플래시 배경도 확인한다. 생성기가 `values-night`를 직접 만들지는 않는다.

PNG 및 JSON은 주석 문법이 없으므로 이 문서와 xcassets의 안내 문서가 생성물의 임시 표식이다.
Android XML 및 단색 생성 스크립트에도 교체 전제 주석을 남긴다.

## WP7b 검증 기록

작업 브랜치: `feat/brand-assets-wp7b`, 시작 HEAD: `b11b5ace4de33b8ed1e3c66af44ce5f554b5f9a2`.
초기 작업 트리는 변경사항이 없었다. 모든 수정은 지정된 자산·리소스·서비스·패키지 범위에 한정한다.

| 검증 | 원 exit 및 결과 |
| --- | --- |
| `npm view '@capacitor/assets@3' version --json` | 0, 최신 3.x = 3.0.5 |
| `npm install --save-dev '@capacitor/assets@^3.0.5'` | 0, 기존 lockfile 항목의 버전 변경 0 |
| 위 네이티브 자산 생성 명령 | 0, 생성기 로그 Android 74건·iOS 7건 |
| `node assets/generate-monochrome.cjs` | 0, adaptive 레이어 해상도 및 단색 파생물 생성 |
| `npx cap sync android` | 0, 동기화 완료; Android assets 빌드 생성물은 커밋 제외 |
| `node assets/verify-assets.cjs` | 최종 0, 아래 자산 AC 전체 통과 |
| Python `json` / `plistlib` 파싱 | 0, Contents.json 3개 및 Info.plist 1개 |
| 원본 PNG 바이트 대조 | 0, 제공된 원본 6개와 복사본 6개 일치 |
| `npm run check:parity` | 0 / SKIP, 이 worktree의 형제 `wt/frontend/package.json` 부재 |
| `gradlew.bat assembleDebug --no-daemon` | 0, 최초 BUILD SUCCESSFUL 1분 4초; 401개 중 337 executed·64 from cache |
| `gradlew.bat assembleDebug --no-daemon --console=plain` | 0, 최종 이미지 변경 후 BUILD SUCCESSFUL 22초; 401개 중 8 executed·393 up-to-date |
| `git diff --check` | 0 |

Android 빌드는 PATH의 OpenJDK 21.0.2 및 프로세스 환경변수
`ANDROID_HOME=C:/Users/tgkim/AppData/Local/Android/Sdk`를 사용했다.
실제 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됐으며 Git에 포함하지 않는다.
iOS 빌드는 Windows에 Xcode/xcodebuild가 없어 미검증이다. 기기·시뮬레이터 표시 및 원격 CI는 미검증이다.

검증 스크립트는 adaptive XML 2개의 기존 background/foreground 불변과 monochrome 1개씩,
알림 bitmap 참조, 다크 스타일을 XML로 파싱한다. 런처 15개가 기준 커밋과 다른 바이트인지,
단색 10개의 크기·흰색 RGB·비어 있지 않은 알파·투명 여백·중앙 배치·66%/90% 비율,
라이트/다크 스플래시 10쌍의 크기와 바이트 차이, iOS 1024 아이콘 및 6개 스플래시 중
다크 appearance 3개, FGS 참조 및 변경 경로 허용 범위도 검사한다.
iOS 아이콘은 별도 메타데이터 검사에서 1024×1024, RGB 3채널, 알파 없음도 확인했다.

초기 검증은 두 차례 exit 1이었다. 첫 번째는 생성기의 adaptive foreground가 48px여서
108px 기대값과 달랐고, 두 번째는 sharp 보간 경계가 완전한 흰색이 아니었다.
검증 기준을 유지하고 생성 스크립트에서 원본 해상도 재생성 및 RGB 흰색 정규화로 수정한 뒤 통과했다.
PNG 육안 확인에서 런처와 다크 스플래시가 제공된 브랜드 그림으로 교체됐음을 확인했다.

설치 시 npm은 취약점 9개(중간 3·높음 5·치명적 1)를 출력했다.
이 작업에서 의존성 감사나 임의의 `npm audit fix`는 수행하지 않았다.
서명 커밋의 최종 결과는 코디네이터의 worker_done 본문에 보고하며, push는 수행하지 않는다.
