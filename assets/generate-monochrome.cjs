// 임시 브랜드 단색 자산: 정식 원본 수령 시 교체 후 재생성한다 (TerraWorld-IT/workspace#38).
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const source = path.join(__dirname, 'icon-monochrome.png');
  const res = path.join(__dirname, '../android/app/src/main/res');
  const silhouette = await sharp(source).trim().png().toBuffer();
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  // 생성기 3.0.5의 사용자 원본 모드는 레거시 크기를 사용하므로 adaptive 레이어 해상도를 보완한다.
  for (const [index, density] of ['ldpi', ...densities].entries()) {
    const size = [81, 108, 162, 216, 324, 432][index];
    for (const layer of ['foreground', 'background']) {
      const dir = path.join(res, `mipmap-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      await sharp(path.join(__dirname, `icon-${layer}.png`)).resize(size, size)
        .png().toFile(path.join(dir, `ic_launcher_${layer}.png`));
    }
  }
  for (const [prefix, name, sizes, scale] of [
    ['mipmap', 'ic_launcher_monochrome', [108, 162, 216, 324, 432], 0.66],
    ['drawable', 'ic_stat_distance', [24, 36, 48, 72, 96], 0.9],
  ]) {
    for (const [index, density] of densities.entries()) {
      const size = sizes[index];
      const inner = Math.round(size * scale);
      const resized = await sharp(silhouette)
        .resize(inner, inner, { fit: 'inside' }).png().toBuffer();
      const dir = path.join(res, `${prefix}-${density}`);
      fs.mkdirSync(dir, { recursive: true });
      const { data, info } = await sharp({ create: {
        width: size, height: size, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      } }).composite([{ input: resized, gravity: 'centre' }])
        .raw().toBuffer({ resolveWithObject: true });
      // 보간 과정의 회색 경계값을 제거하고 실루엣의 알파만 보존한다.
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        data[pixel] = data[pixel + 1] = data[pixel + 2] = 255;
      }
      await sharp(data, { raw: info }).png().toFile(path.join(dir, `${name}.png`));
      console.log(`${prefix}-${density}/${name}.png: ${size}px`);
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
