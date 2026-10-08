#!/usr/bin/env node
// check-capacitor-sync.mjs — UltraPlan M12
//
// frontend/package.json 과 mobile/package.json 의 @capacitor/* + @capacitor-community/*
// 버전이 정확히 일치하는지 검증.
//
// frontend 의 JS bridge 와 mobile 의 native plugin module 버전이 mismatch 면
// 런타임 method 시그니처 어긋나거나 plugin 부재 가능.
//
// SoT 결정 (UltraPlan / ADR 미작성 시): mobile/package.json (cap sync 출발점)
// — 본 script 는 mobile=SoT 로 가정하고 frontend 가 mismatch 면 fail.
//
// Usage:
//   node mobile/scripts/check-capacitor-sync.mjs
//   node mobile/scripts/check-capacitor-sync.mjs --fixture mobile/tests/fixtures/capacitor-mismatch.json
//
// Exit codes:
//   0 — aligned, 또는 형제 frontend clone 부재로 검사 skip
//   1 — mismatch detected (or fixture asserted mismatch)
//   2 — invocation error (자기 package.json 부재, fixture 부재, JSON parse fail)
//
// 파리티 검사는 frontend/ 와 mobile/ 이 나란히 놓인 워크스페이스에서만 성립한다.
// mobile 단독 체크아웃(CI 등)에서는 실패가 아니라 skip(exit 0) — 없는 파일을
// 에러로 올리면 게이트가 상시 red 가 되어 오히려 무시된다.
//
// 플랫폼별 includePlugins 검사 (frontend 유무와 무관하게 항상 실행):
// capacitor.config.ts 의 ios/android.includePlugins 는 cap sync 가 네이티브 프로젝트에 넣을 플러그인
// allowlist 다. 목록의 모든 항목이 mobile/package.json dependencies 에 있어야 하고, dependencies 중
// 목록에서 빠진 플러그인은 정확히 EXPECTED_EXCLUDED 와 같아야 한다 — 새 의존성을 allowlist 에
// 빠뜨리거나(조용히 미포함) 제외 결정(광고·결제·카메라)을 되돌리는 변경을 잡는다.
//   node scripts/check-capacitor-sync.mjs --plugins-only [--config <capacitor.config.ts>] [--package <package.json>]
// --config/--package 는 현재 디렉터리 기준 경로 (테스트의 돌연변이 픽스처용).

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '..', '..')
const MOBILE_ROOT = resolve(__dirname, '..')

// 첫 출시 제외 결정 (2026-09-11, Android 는 Play 출시 준비에서 동일 적용). 바꿀 때는
// capacitor.config.ts 의 주석·네이티브 설정 복원 목록과 함께 갱신한다.
const EXPECTED_EXCLUDED = {
  android: ['@capacitor-community/admob', '@capacitor/camera', 'cordova-plugin-purchase'],
  // iOS는 보상형 광고를 포함하며 release.yml 'iOS IAP gate' 때문에 cordova-plugin-purchase 를 유지한다.
  ios: ['@capacitor/camera'],
}
// dependencies 중 cap sync 플러그인이 아닌 런타임 패키지.
const NON_PLUGIN_DEPS = new Set(['@capacitor/core'])

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`ERROR: file not found: ${path}`)
    process.exit(2)
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`ERROR: JSON parse fail: ${path} — ${e.message}`)
    process.exit(2)
  }
}

function extractCapacitorDeps(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  const out = {}
  for (const [name, version] of Object.entries(deps)) {
    if (name.startsWith('@capacitor/') || name.startsWith('@capacitor-community/')) {
      out[name] = version
    }
  }
  return out
}

function compareDeps(frontend, mobile) {
  const allKeys = new Set([...Object.keys(frontend), ...Object.keys(mobile)])
  const mismatches = []
  const mobileOnly = []
  const frontendOnly = []

  for (const key of allKeys) {
    const fe = frontend[key]
    const mb = mobile[key]
    if (fe && mb && fe !== mb) {
      mismatches.push({ name: key, frontend: fe, mobile: mb })
    } else if (mb && !fe) {
      // mobile-only plugin 는 정상 (CLI / android / ios)
      if (!['@capacitor/cli', '@capacitor/android', '@capacitor/ios'].includes(key)) {
        mobileOnly.push({ name: key, mobile: mb })
      }
    } else if (fe && !mb) {
      frontendOnly.push({ name: key, frontend: fe })
    }
  }

  return { mismatches, mobileOnly, frontendOnly }
}

// capacitor.config.ts 를 타입만 벗겨 실제로 평가한다 — 정규식 추출보다 설정 구조 변경에 강하다.
// mobile 의 typescript(devDependency) 우선, 없으면(frontend 쪽 hook 에서 호출 등) Node 내장 type stripping.
function transpileTs(source, path) {
  try {
    const ts = createRequire(resolve(MOBILE_ROOT, 'package.json'))('typescript')
    return ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: path,
    }).outputText
  } catch {
    const { stripTypeScriptTypes } = createRequire(import.meta.url)('node:module')
    if (typeof stripTypeScriptTypes !== 'function') {
      console.error(`ERROR: ${path} 를 읽으려면 mobile 의 typescript(npm ci) 또는 Node 22.13+ 가 필요하다`)
      process.exit(2)
    }
    return stripTypeScriptTypes(source)
  }
}

async function loadCapacitorConfig(path) {
  if (!existsSync(path)) {
    console.error(`ERROR: file not found: ${path}`)
    process.exit(2)
  }
  const js = transpileTs(readFileSync(path, 'utf8'), path)
  try {
    const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
    return mod.default
  } catch (e) {
    console.error(`ERROR: capacitor config 평가 실패: ${path} — ${e.message}`)
    process.exit(2)
  }
}

function checkIncludePlugins(config, pkg) {
  const deps = pkg.dependencies || {}
  const candidates = Object.keys(deps).filter(name => !NON_PLUGIN_DEPS.has(name))
  const errors = []
  for (const platform of Object.keys(EXPECTED_EXCLUDED)) {
    const list = config?.[platform]?.includePlugins
    if (!Array.isArray(list)) {
      errors.push(`${platform}.includePlugins 가 없다 — 없으면 cap sync 가 dependencies 의 모든 플러그인을 넣는다`)
      continue
    }
    for (const name of list) {
      if (!(name in deps)) errors.push(`${platform}.includePlugins 의 ${name} 이 package.json dependencies 에 없다`)
    }
    const excluded = new Set(candidates.filter(name => !list.includes(name)))
    const expected = new Set(EXPECTED_EXCLUDED[platform])
    for (const name of excluded) {
      if (!expected.has(name)) errors.push(`${platform}: ${name} 이 includePlugins 에서 빠졌다 (의도된 제외 목록에 없음)`)
    }
    for (const name of expected) {
      if (!excluded.has(name)) errors.push(`${platform}: ${name} 은 제외 대상인데 포함됐다 (또는 dependencies 에서 사라졌다)`)
    }
  }
  return errors
}

function argValue(args, flag) {
  const idx = args.indexOf(flag)
  return idx >= 0 ? args[idx + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const fixtureIdx = args.indexOf('--fixture')

  const configPath = resolve(process.cwd(), argValue(args, '--config') ?? resolve(MOBILE_ROOT, 'capacitor.config.ts'))
  const packagePath = resolve(process.cwd(), argValue(args, '--package') ?? resolve(MOBILE_ROOT, 'package.json'))
  const pluginErrors = checkIncludePlugins(await loadCapacitorConfig(configPath), loadJson(packagePath))
  if (pluginErrors.length > 0) {
    console.error(`❌ includePlugins drift (${pluginErrors.length}):`)
    for (const e of pluginErrors) console.error(`  - ${e}`)
  } else {
    console.log('✅ includePlugins: ios·android 제외 목록이 의도와 일치한다.')
  }
  const pluginFail = pluginErrors.length > 0
  if (args.includes('--plugins-only')) process.exit(pluginFail ? 1 : 0)

  let frontend, mobile
  if (fixtureIdx >= 0 && args[fixtureIdx + 1]) {
    const fixture = loadJson(resolve(WORKSPACE_ROOT, args[fixtureIdx + 1]))
    frontend = fixture.frontend
    mobile = fixture.mobile
    console.log(`[fixture mode] ${args[fixtureIdx + 1]}`)
  } else {
    const fePath = resolve(WORKSPACE_ROOT, 'frontend', 'package.json')
    // 단독 체크아웃에는 비교 대상이 없다 — 게이트를 fail 시키지 않고 명시적으로 skip.
    if (!existsSync(fePath)) {
      console.log(`SKIP: frontend/package.json 없음 — ${fePath}`)
      console.log('파리티 검사는 frontend/ 와 mobile/ 이 나란히 있는 워크스페이스에서만 동작한다.')
      process.exit(pluginFail ? 1 : 0)
    }
    // 자기 package.json 은 워크스페이스 레이아웃(디렉터리명 mobile)에 의존하지 않도록
    // 스크립트 위치 기준으로 해석한다.
    const mbPath = resolve(__dirname, '..', 'package.json')
    frontend = extractCapacitorDeps(loadJson(fePath))
    mobile = extractCapacitorDeps(loadJson(mbPath))
  }

  const { mismatches, mobileOnly, frontendOnly } = compareDeps(frontend, mobile)

  console.log(`Capacitor deps: frontend=${Object.keys(frontend).length} mobile=${Object.keys(mobile).length}`)

  if (mismatches.length > 0) {
    console.error(`\n❌ Version mismatch (${mismatches.length}):`)
    for (const m of mismatches) {
      console.error(`  - ${m.name}: frontend=${m.frontend} ↔ mobile=${m.mobile}`)
    }
  }

  if (mobileOnly.length > 0) {
    console.error(`\n⚠️  mobile-only (frontend 가 import 안 함):`)
    for (const m of mobileOnly) {
      console.error(`  - ${m.name}@${m.mobile}`)
    }
  }

  if (frontendOnly.length > 0) {
    console.error(`\n❌ frontend-only (mobile 에 native module 부재):`)
    for (const f of frontendOnly) {
      console.error(`  - ${f.name}@${f.frontend}`)
    }
  }

  const fail = mismatches.length > 0 || frontendOnly.length > 0
  if (fail) {
    console.error(`\nFAIL: Capacitor sync drift detected. Run cap sync after aligning versions.`)
    process.exit(1)
  }

  console.log(`\n✅ Capacitor versions aligned (${Object.keys(frontend).length} shared, ${mobileOnly.length} mobile-only).`)
  if (pluginFail) {
    console.error('\nFAIL: includePlugins drift detected.')
    process.exit(1)
  }
  process.exit(0)
}

await main()
