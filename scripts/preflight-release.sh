#!/usr/bin/env bash
# preflight-release.sh — UltraPlan H6
#
# Local release 빌드 전 capacitor.config.* 가 production state 인지 검증.
# CI release.yml 의 첫 step 으로도 호출 가능.
#
# 검증:
#   1. NODE_ENV=production 환경에서 capacitor.config.ts 가 resolve 하는 server.url
#      이 https://terraworld.web-qplay.kr 인지
#   2. cleartext = false 인지
#   3. AdMob test ID (ca-app-pub-3940256099942544) 가 없는지
#   4. capacitor.config.json 이 체크인 됐는지 (gitignore 회피 검출)
#
# 플랫폼 호환성 (DX-002):
#   - **권장**: macOS / Linux. `set -euo pipefail` + `npx --yes tsx -e ...` 기본 동작.
#   - **Windows**: Git Bash (mingw) 에서 동작 가능. WSL2 권장.
#     - `cmd.exe` / PowerShell 직접 실행 불가 (`#!/usr/bin/env bash` shebang).
#     - 경로 구분자 (`/` vs `\`) 는 Git Bash 가 자동 변환. PowerShell 의
#       `bash scripts/preflight-release.sh` 호출은 동작.
#   - CI: GitHub Actions ubuntu-latest / macos-latest 기본. windows-latest 미지원.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

fail=0
note() { echo "  $1"; }
err()  { echo "  ❌ $1"; fail=1; }
ok()   { echo "  ✅ $1"; }

echo "== UltraPlan H6 preflight =="

# 1. capacitor.config.json 가 체크인 됐는지
echo
echo "[1/4] capacitor.config.json 체크인 확인"
if git -C "$MOBILE_DIR" ls-files --error-unmatch capacitor.config.json &>/dev/null; then
  err "capacitor.config.json 가 체크인 됨. SoT 는 capacitor.config.ts 만 — .json 은 빌드 산출물."
  note "조치: git rm --cached capacitor.config.json && git commit"
else
  ok "capacitor.config.json 미체크인 (.gitignore 적용)"
fi

# 2. NODE_ENV=production 로 config resolve
echo
echo "[2/4] production config resolve (NODE_ENV=production)"
config_dump=$(cd "$MOBILE_DIR" && NODE_ENV=production npx --yes tsx -e "
import config from './capacitor.config.ts'
console.log(JSON.stringify(config, null, 2))
" 2>&1 || echo "RESOLVE_FAIL")

if [[ "$config_dump" == *"RESOLVE_FAIL"* ]]; then
  err "config resolve 실패 — tsx 또는 capacitor.config.ts 점검 필요"
  echo "$config_dump"
else
  ok "config resolve 성공"
fi

# 3. server.url 검증
echo
echo "[3/4] server.url = https://terraworld.web-qplay.kr ?"
if echo "$config_dump" | grep -q '"url": *"https://terraworld\.web-qplay\.kr"'; then
  ok "production URL OK"
else
  err "production URL mismatch. dev URL 박혔을 가능성:"
  echo "$config_dump" | grep -E '"url"|"cleartext"' || true
fi

# 4. cleartext = false 검증
echo
echo "[4/4] cleartext = false ?"
if echo "$config_dump" | grep -q '"cleartext": *false'; then
  ok "cleartext = false"
else
  err "cleartext != false (HTTP 통신 허용 — SEC 위험)"
fi

# 5. (옵션) AdMob test ID 검출
echo
echo "[5/4] AdMob test ID 검출 (다음 단계는 release.xcconfig + manifest 차원)"
if grep -rn "ca-app-pub-3940256099942544" "$MOBILE_DIR/android" "$MOBILE_DIR/ios" 2>/dev/null \
    | grep -v "node_modules" | grep -v "\.git/" | head -5; then
  echo "  (위 hit 가 release 빌드 산출물 안에 있으면 fail. source 만 hit 면 OK — UltraPlan M4)"
fi

echo
if [[ $fail -ne 0 ]]; then
  echo "❌ preflight FAIL — 위 항목 수정 후 재실행"
  exit 1
fi
echo "✅ preflight PASS — release 빌드 진행 가능"
