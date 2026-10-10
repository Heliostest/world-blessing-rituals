import { readFile, mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root = new URL('../store/android/', import.meta.url);
await mkdir(root, { recursive: true });
// Render the original vector source; do not alter product screenshots.
const icon = await readFile(new URL('../apps/mobile-expo/assets/icon.svg', import.meta.url));
await sharp(icon).resize(512, 512).removeAlpha().png().toFile(fileURLToPath(new URL('icon-512.png', root)));
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<rect width="1024" height="500" fill="#cdf1e6"/>
<circle cx="900" cy="75" r="135" fill="#aff0dd"/><circle cx="850" cy="390" r="165" fill="#f8edcc"/>
<g font-family="Microsoft YaHei, sans-serif" fill="#064a43"><text x="76" y="177" font-size="68" font-weight="800">一日一念</text><text x="78" y="254" font-size="29">把一点心意，留给自己</text><text x="78" y="321" font-size="23">心愿记录 · 轻松小仪式 · 珍藏日常</text></g>
<g stroke="#75502e" stroke-width="8" stroke-linejoin="round"><path fill="#e8ba7a" d="M678 322Q646 264 701 233Q713 175 771 170Q843 163 899 231Q942 292 885 327Q774 369 678 322Z"/><path fill="none" d="M698 285Q780 263 883 279"/><circle cx="699" cy="285" r="17" fill="#75502e"/><path d="M834 220L918 322" stroke="#b98346" stroke-width="26"/><ellipse cx="819" cy="204" rx="34" ry="27" fill="#cf9a50"/></g>
<g stroke="#608b6c" stroke-width="5" stroke-linejoin="round"><path fill="#fffdf5" d="M670 97L704 137L769 106L740 150L670 153L644 129L594 137Z"/><path fill="#d6ead4" d="M670 97L678 151L704 137Z"/></g>
<g fill="#58c8b1"><circle cx="580" cy="327" r="10"/><circle cx="945" cy="410" r="11"/><circle cx="935" cy="165" r="7"/></g></svg>`;
await writeFile(new URL('feature-graphic.svg', root), feature);
await sharp(Buffer.from(feature)).removeAlpha().png().toFile(fileURLToPath(new URL('feature-graphic-1024x500.png', root)));
const ios = JSON.parse(await readFile(new URL('../store/ios/zh-Hans.json', import.meta.url), 'utf8'));
await writeFile(new URL('full-description.txt', root), ios.description + '\n');
const listing = JSON.parse(await readFile(new URL('zh-CN.json', root), 'utf8'));
const manifest = [];
for (const file of listing.screenshots) {
  const metadata = await sharp(fileURLToPath(new URL(`../store/screenshots/android/zh-CN/${file}`, import.meta.url))).metadata();
  if (metadata.width !== 1080 || metadata.height !== 1920 || metadata.hasAlpha) throw Error(`Invalid Play screenshot: ${file}`);
  manifest.push({ file, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha });
}
await writeFile(new URL('assets.json', root), JSON.stringify({ source: listing.screenCaptureSource, screenshots: manifest, icon: { file: 'icon-512.png', width: 512, height: 512 }, featureGraphic: { file: 'feature-graphic-1024x500.png', width: 1024, height: 500 } }, null, 2) + '\n');
console.log('Prepared Play icon, feature graphic, description and four verified actual product screenshots.');
