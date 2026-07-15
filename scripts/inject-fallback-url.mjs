// capacitor:copy:after 훅 (package.json) — cap copy 가 www/ 를 네이티브 자산으로 복사한 뒤,
// 폴백 페이지(www/index.html → assets)의 __TW_SERVER_URL__ 플레이스홀더를 실제 server.url 로 치환.
//
// 왜 필요한가: errorPath 폴백의 "다시 시도" 는 원격 앱 URL 로 replace 해야 하는데,
// 그 URL 은 빌드마다 다르다 (dev = MOBILE_SERVER_URL/10.0.2.2, release = MOBILE_PROD_URL
// 오버라이드 가능). 소스에 production 을 하드코딩하면 dev 장애 시 production 으로 이탈한다.
// URL 해석은 capacitor.config.ts 의 server.url 분기와 동일해야 한다 — 변경 시 함께 갱신할 것.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const isDev = process.env.NODE_ENV !== 'production'
const serverUrl = isDev
  ? (process.env.MOBILE_SERVER_URL ?? 'http://10.0.2.2:3000')
  : (process.env.MOBILE_PROD_URL ?? 'https://terraworld.web-qplay.kr')

const PLACEHOLDER = '__TW_SERVER_URL__'
const targets = [
  'android/app/src/main/assets/public/index.html',
  'ios/App/App/public/index.html',
]

let patched = 0
for (const path of targets) {
  if (!existsSync(path)) continue
  const html = readFileSync(path, 'utf8')
  if (!html.includes(PLACEHOLDER)) continue
  writeFileSync(path, html.replaceAll(PLACEHOLDER, serverUrl))
  patched += 1
  console.log(`[inject-fallback-url] ${path} → ${serverUrl}`)
}
if (patched === 0) {
  // copy 대상 플랫폼에 placeholder 가 없으면 이미 치환됐거나 자산 미복사 — 정보성 로그만.
  console.log('[inject-fallback-url] no placeholder found (already injected or assets absent)')
}
