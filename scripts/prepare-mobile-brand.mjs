import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../apps/mobile-expo/assets/', import.meta.url));
await mkdir(directory, { recursive: true });
// Original vector mark using the shared product's mint, cream and green palette.
const mark = `<g stroke="#064a43" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"><path fill="#fbf3dc" d="M512 254C386 373 386 528 512 630C638 528 638 373 512 254Z"/><path fill="#64d9b0" d="M286 418C300 588 397 670 512 630C510 503 426 428 286 418Z"/><path fill="#64d9b0" d="M738 418C724 588 627 670 512 630C514 503 598 428 738 418Z"/><path fill="none" d="M512 452V721M410 740Q512 783 614 740"/></g><circle cx="710" cy="280" r="26" fill="#fff9e8"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#cdf1e6"/>${mark}</svg>`;
await writeFile(directory + '/icon.svg', svg);
await sharp(Buffer.from(svg)).png().toFile(directory + '/icon.png');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark}</svg>`)).png().toFile(directory + '/adaptive-icon.png');
console.log('Prepared original application icon and adaptive foreground.');
