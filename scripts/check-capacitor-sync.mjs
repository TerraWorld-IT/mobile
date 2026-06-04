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
//   0 — aligned
//   1 — mismatch detected (or fixture asserted mismatch)
//   2 — invocation error (file missing, JSON parse fail)

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKSPACE_ROOT = resolve(__dirname, '..', '..')

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

function main() {
  const args = process.argv.slice(2)
  const fixtureIdx = args.indexOf('--fixture')

  let frontend, mobile
  if (fixtureIdx >= 0 && args[fixtureIdx + 1]) {
    const fixture = loadJson(resolve(WORKSPACE_ROOT, args[fixtureIdx + 1]))
    frontend = fixture.frontend
    mobile = fixture.mobile
    console.log(`[fixture mode] ${args[fixtureIdx + 1]}`)
  } else {
    const fePkg = loadJson(resolve(WORKSPACE_ROOT, 'frontend', 'package.json'))
    const mbPkg = loadJson(resolve(WORKSPACE_ROOT, 'mobile', 'package.json'))
    frontend = extractCapacitorDeps(fePkg)
    mobile = extractCapacitorDeps(mbPkg)
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
  process.exit(0)
}

main()
