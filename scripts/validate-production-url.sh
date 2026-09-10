#!/usr/bin/env bash
# 기존 프로덕션 설정을 직접 해석해 폴백 URL 중복 정의 없이 검증한다.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
NODE_ENV=production node <<'NODE'
const fs = require('node:fs');
const ts = require('typescript');

try {
  // npm ci 로 설치한 TypeScript 를 사용하며 별도 도구를 다운로드하지 않는다.
  require.extensions['.ts'] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
  const config = require('./capacitor.config.ts').default;
  const url = config.server?.url;
  // URL 파서가 보정하는 호스트 없는 표기, 공백, 역슬래시도 거부한다.
  if (typeof url !== 'string' || !/^https:\/\/[^/\\\s?#]/.test(url) || /[\s\\]/.test(url)) {
    throw new Error();
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error();

  if (!process.env.MOBILE_PROD_URL?.trim()) {
    console.log('::warning::MOBILE_PROD_URL 미설정으로 릴리스가 하드코딩 폴백 URL에 의존합니다.');
  }
  console.log('프로덕션 URL 검증 통과');
} catch {
  console.error('::error::프로덕션 URL을 해석하지 못했거나 유효한 https:// URL이 아닙니다. 릴리스를 중단합니다.');
  process.exit(1);
}
NODE
