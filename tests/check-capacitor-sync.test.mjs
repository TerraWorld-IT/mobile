// check-capacitor-sync.mjs 의 플랫폼별 includePlugins 검사 — 돌연변이 검증.
//
// 실제 capacitor.config.ts·package.json 을 한 군데씩 일부러 어긋나게 바꾼 픽스처를 임시 디렉터리에
// 만들어, 원본은 통과하고 각 돌연변이는 실패(exit 1)하는지 확인한다.
// 실행: node --test tests/check-capacitor-sync.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(MOBILE_ROOT, 'scripts', 'check-capacitor-sync.mjs')
const CONFIG_SRC = readFileSync(join(MOBILE_ROOT, 'capacitor.config.ts'), 'utf8')
const PACKAGE = JSON.parse(readFileSync(join(MOBILE_ROOT, 'package.json'), 'utf8'))

function run(configSrc, pkg) {
  const dir = mkdtempSync(join(tmpdir(), 'cap-sync-'))
  try {
    const configPath = join(dir, 'capacitor.config.ts')
    const packagePath = join(dir, 'package.json')
    writeFileSync(configPath, configSrc)
    writeFileSync(packagePath, JSON.stringify(pkg))
    return spawnSync(process.execPath, [SCRIPT, '--plugins-only', '--config', configPath, '--package', packagePath], {
      cwd: MOBILE_ROOT,
      encoding: 'utf8',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// 플랫폼 블록(`  ios: {` / `  android: {`) 안에서만 한 번 치환한다. 치환이 안 되면 테스트가
// 아무것도 검증하지 않게 되므로 즉시 실패시킨다.
function mutatePlatform(platform, from, to) {
  const start = CONFIG_SRC.indexOf(`\n  ${platform}: {`)
  assert.ok(start >= 0, `${platform} 블록을 찾지 못했다`)
  const end = CONFIG_SRC.indexOf('\n  },', start)
  const block = CONFIG_SRC.slice(start, end)
  assert.ok(block.includes(from), `${platform} 블록에 ${from} 이 없다`)
  return CONFIG_SRC.slice(0, start) + block.replace(from, to) + CONFIG_SRC.slice(end)
}

function assertDrift(result, pattern) {
  assert.equal(result.status, 1, `exit 1 기대 — stdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  assert.match(result.stderr, pattern)
}

test('현재 설정은 통과한다', () => {
  const result = run(CONFIG_SRC, PACKAGE)
  assert.equal(result.status, 0, result.stderr)
})

test('Android 에 제외 대상(admob)을 넣으면 실패한다', () => {
  const config = mutatePlatform('android', `'@capacitor/app',`, `'@capacitor/app',\n      '@capacitor-community/admob',`)
  assertDrift(run(config, PACKAGE), /android: @capacitor-community\/admob 은 제외 대상인데 포함됐다/)
})

test('Android 에 결제 플러그인(iOS 에만 유지)을 넣으면 실패한다', () => {
  const config = mutatePlatform('android', `'@capacitor/app',`, `'@capacitor/app',\n      'cordova-plugin-purchase',`)
  assertDrift(run(config, PACKAGE), /android: cordova-plugin-purchase 은 제외 대상인데 포함됐다/)
})

test('iOS 에서 cordova-plugin-purchase 를 빼면 실패한다', () => {
  const config = mutatePlatform('ios', `      'cordova-plugin-purchase',\n`, '')
  assertDrift(run(config, PACKAGE), /ios: cordova-plugin-purchase 이 includePlugins 에서 빠졌다/)
})

test('iOS 에 카메라를 넣으면 실패한다', () => {
  const config = mutatePlatform('ios', `'@capacitor/app',`, `'@capacitor/app',\n      '@capacitor/camera',`)
  assertDrift(run(config, PACKAGE), /ios: @capacitor\/camera 은 제외 대상인데 포함됐다/)
})

test('android.includePlugins 를 지우면(전체 포함으로 회귀) 실패한다', () => {
  const config = mutatePlatform('android', 'includePlugins: [', 'removedIncludePlugins: [')
  assertDrift(run(config, PACKAGE), /android\.includePlugins 가 없다/)
})

test('dependencies 에 없는 플러그인을 목록에 넣으면 실패한다', () => {
  const config = mutatePlatform('android', `'@capacitor/app',`, `'@capacitor/app',\n      '@capacitor/geolocation',`)
  assertDrift(run(config, PACKAGE), /android\.includePlugins 의 @capacitor\/geolocation 이 package\.json dependencies 에 없다/)
})

test('새 의존성을 allowlist 에 빠뜨리면 두 플랫폼 모두 실패한다', () => {
  const pkg = { ...PACKAGE, dependencies: { ...PACKAGE.dependencies, '@capacitor/geolocation': '^8.0.0' } }
  const result = run(CONFIG_SRC, pkg)
  assertDrift(result, /ios: @capacitor\/geolocation 이 includePlugins 에서 빠졌다/)
  assert.match(result.stderr, /android: @capacitor\/geolocation 이 includePlugins 에서 빠졌다/)
})

test('제외 대상 의존성이 사라지면 실패한다(제외 목록 갱신 강제)', () => {
  const { '@capacitor/camera': _camera, ...dependencies } = PACKAGE.dependencies
  assertDrift(run(CONFIG_SRC, { ...PACKAGE, dependencies }), /@capacitor\/camera 은 제외 대상인데 포함됐다 \(또는 dependencies 에서 사라졌다\)/)
})
