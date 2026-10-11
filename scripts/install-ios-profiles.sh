#!/usr/bin/env bash
set -euo pipefail

# App과 Extension은 서로 다른 App Store 프로파일을 사용한다.
printf '%s' "$PROFILE_BASE64" | base64 -d > "$RUNNER_TEMP/app.mobileprovision"
printf '%s' "$WIDGET_PROFILE_BASE64" | base64 -d > "$RUNNER_TEMP/widget.mobileprovision"
for TARGET in app widget; do
  PROFILE="$RUNNER_TEMP/$TARGET.mobileprovision"
  security cms -D -i "$PROFILE" > "$RUNNER_TEMP/$TARGET-profile.plist"
  if [ "$TARGET" = app ]; then
    EXPECTED_NAME='TerraWorld App Store'
    EXPECTED_APP_ID='SMF6T723XR.app.terraworld.mobile'
    PROFILE_ENV='PROVISION_PROFILE_NAME'
  else
    EXPECTED_NAME='TerraWorld Widget App Store'
    EXPECTED_APP_ID='SMF6T723XR.app.terraworld.mobile.TerraWidgetExtension'
    PROFILE_ENV='WIDGET_PROVISION_PROFILE_NAME'
  fi
  # 잘못된 프로파일·App Group 누락은 archive 전에 차단한다. 값은 로그에 남기지 않는다.
  PROFILE_METADATA="$(EXPECTED_NAME="$EXPECTED_NAME" EXPECTED_APP_ID="$EXPECTED_APP_ID" \
    python3 - "$RUNNER_TEMP/$TARGET-profile.plist" <<'PY'
import datetime, os, plistlib, sys
with open(sys.argv[1], 'rb') as f:
    p = plistlib.load(f)
e = p.get('Entitlements', {})
valid = (
    p.get('Name') == os.environ['EXPECTED_NAME']
    and e.get('application-identifier') == os.environ['EXPECTED_APP_ID']
    and p.get('TeamIdentifier') == ['SMF6T723XR']
    and 'group.app.terraworld.mobile' in e.get('com.apple.security.application-groups', [])
    and e.get('get-task-allow') is False
    and not p.get('ProvisionedDevices') and not p.get('ProvisionsAllDevices')
    and p.get('ExpirationDate', datetime.datetime.min) > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
)
if not valid:
    sys.exit(f'::error::{os.environ["EXPECTED_NAME"]} 프로파일을 {os.environ["EXPECTED_APP_ID"]}용으로 발급하고 group.app.terraworld.mobile을 연결하세요. 팀·유효기간 및 docs/terra-widget-runbook.md의 사람 작업 1~5를 확인하세요')
print(p['UUID'])
print(p['Name'])
PY
  )"
  PROFILE_UUID="${PROFILE_METADATA%%$'\n'*}"
  PROFILE_NAME="${PROFILE_METADATA#*$'\n'}"
  for PROFILE_DIR in "$HOME/Library/MobileDevice/Provisioning Profiles" \
                     "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
    mkdir -p "$PROFILE_DIR"
    cp "$PROFILE" "$PROFILE_DIR/$PROFILE_UUID.mobileprovision"
  done
  echo "$PROFILE_ENV=$PROFILE_NAME" >> "$GITHUB_ENV"
done
