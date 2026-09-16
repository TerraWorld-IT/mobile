// 디자이너 확정 앱아이콘·스플래시 자산의 생성물 검증 (2026-09-16 교체). 기준 커밋(baseline)과 런처 바이트가 달라졌는지도 본다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const sharp = require('sharp');
const { parseStringPromise } = require('xml2js');
const res = 'android/app/src/main/res';
const ios = 'ios/App/App/Assets.xcassets';
const baseline = 'b11b5ace4de33b8ed1e3c66af44ce5f554b5f9a2';
const read = p => fs.readFileSync(p, 'utf8');

async function main() {
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const p = `${res}/mipmap-anydpi-v26/${name}.xml`;
    const parsed = (await parseStringPromise(read(p)))['adaptive-icon'];
    assert.equal(parsed.monochrome.length, 1);
    assert.equal(parsed.monochrome[0].$['android:drawable'], '@mipmap/ic_launcher_monochrome');
    const old = (await parseStringPromise(cp.execFileSync('git', ['show', `${baseline}:${p}`], {encoding:'utf8'})))['adaptive-icon'];
    assert.deepEqual(parsed.background, old.background);
    assert.deepEqual(parsed.foreground, old.foreground);
    assert.match(read(p), /디자이너 확정 자산/);
  }
  const notification = (await parseStringPromise(read(`${res}/drawable/ic_notification.xml`))).bitmap;
  assert.equal(notification.$['android:src'], '@drawable/ic_stat_distance');
  const night = (await parseStringPromise(read(`${res}/values-night/styles.xml`))).resources.style[0];
  assert(night.item.some(x => x.$.name === 'windowSplashScreenBackground' && x._ === '#FFFFFF'));
  assert(night.item.some(x => x.$.name === 'android:background' && x._ === '@drawable/splash'));
  console.log('PASS XML: adaptive 2개, 알림 1개, 야간 스타일 1개');

  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  for (const [i, density] of densities.entries()) {
    for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
      const p = `${res}/mipmap-${density}/${name}.png`;
      assert(!fs.readFileSync(p).equals(cp.execFileSync('git', ['show', `${baseline}:${p}`])));
      const meta = await sharp(p).metadata();
      const expected = name.endsWith('foreground') ? [108,162,216,324,432][i] : [48,72,96,144,192][i];
      assert.equal(meta.width, expected); assert.equal(meta.height, expected);
    }
    for (const [folder, name, size, scale] of [
      ['mipmap', 'ic_launcher_monochrome', [108,162,216,324,432][i], 0.66],
      ['drawable', 'ic_stat_distance', [24,36,48,72,96][i], 0.9],
    ]) {
      const {data, info} = await sharp(`${res}/${folder}-${density}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width, size); assert.equal(info.height, size);
      let minX = size, minY = size, maxX = -1, maxY = -1, transparent = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const p = (y * size + x) * 4;
        if (!data[p + 3]) { transparent++; continue; }
        assert(data[p] === 255 && data[p+1] === 255 && data[p+2] === 255, `${name}: 흰색 아님`);
        minX = Math.min(minX,x); minY = Math.min(minY,y); maxX = Math.max(maxX,x); maxY = Math.max(maxY,y);
      }
      assert(maxX >= minX && transparent > 0);
      assert(Math.abs(Math.max(maxX-minX+1,maxY-minY+1) - Math.round(size*scale)) <= 2);
      assert(Math.abs(minX - (size-1-maxX)) <= 1 && Math.abs(minY - (size-1-maxY)) <= 1);
    }
    for (const orientation of ['land','port']) {
      const light = `${res}/drawable-${orientation}-${density}/splash.png`;
      const dark = `${res}/drawable-${orientation}-night-${density}/splash.png`;
      const lm = await sharp(light).metadata(), dm = await sharp(dark).metadata();
      assert.equal(lm.width,dm.width); assert.equal(lm.height,dm.height);
      // 디자인 스펙(2026-09-16): 스플래시는 라이트·다크 모두 흰 배경 + 아이콘 중앙 — 두 파일이 같아도 된다.
      // 대신 배경이 실제로 흰색인지(모서리 픽셀) 확인한다.
      for (const p of [light, dark]) {
        const {data, info} = await sharp(p).removeAlpha().raw().toBuffer({resolveWithObject:true});
        for (const [x, y] of [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]]) {
          const i = (y * info.width + x) * info.channels;
          assert(data[i] === 255 && data[i+1] === 255 && data[i+2] === 255, `${p}: 모서리가 흰색이 아님`);
        }
      }
    }
  }
  console.log('PASS 밀도: 런처 15개 변경, 단색 10개 크기/흰색/알파/중앙/비율, 라이트·다크 스플래시 10쌍(흰 배경)');

  const icon = JSON.parse(read(`${ios}/AppIcon.appiconset/Contents.json`));
  assert(icon.images.some(x => x.size === '1024x1024'));
  const meta = await sharp(`${ios}/AppIcon.appiconset/${icon.images[0].filename}`).metadata();
  assert.equal(meta.width,1024); assert.equal(meta.height,1024);
  const splash = JSON.parse(read(`${ios}/Splash.imageset/Contents.json`));
  assert.equal(splash.images.filter(x => x.appearances?.some(a => a.value === 'dark')).length,3);
  for (const item of splash.images) {
    const m = await sharp(`${ios}/Splash.imageset/${item.filename}`).metadata();
    assert.equal(m.width,2732); assert.equal(m.height,2732);
  }
  const service = read('android/app/src/main/java/app/terraworld/mobile/DistanceTrackingService.java');
  assert.match(service, /setSmallIcon\(R\.drawable\.ic_stat_distance\)/);
  assert(!service.includes('getApplicationInfo().icon'));
  assert.match(read('assets/README.md'), /디자이너 확정/);
  assert.match(read(`${ios}/README.md`), /디자이너 확정/);
  console.log('PASS iOS 1024 아이콘/스플래시 6개/다크 appearance 3개, FGS 참조, 확정 표식');

  // 작업 트리의 변경(HEAD 대비)이 자산·리소스·스플래시 설정 범위 안인지 — 생성기가 Manifest/pbxproj 를 건드린 채 남지 않게.
  const tracked = cp.execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n');
  const untracked = cp.execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
  for (const p of [...tracked,...untracked].filter(Boolean)) {
    assert(/^(assets\/|android\/app\/src\/main\/res\/|ios\/App\/App\/Assets\.xcassets\/|android\/app\/src\/main\/java\/app\/terraworld\/mobile\/DistanceTrackingService\.java$|capacitor\.config\.ts$|package(?:-lock)?\.json$)/.test(p), `범위 밖 변경: ${p}`);
  }
  console.log('PASS 변경 경로 허용 범위; 웹/Manifest/pbxproj/API 변경 0');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
