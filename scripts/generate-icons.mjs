import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const svg = await readFile(new URL('../public/icons/eventsfeed-mark-v3.svg', import.meta.url));
const sizes = [180, 192, 512, 32];
for (const size of sizes) {
  await sharp(svg).resize(size, size).removeAlpha().png().toFile(new URL(`../public/icons/eventsfeed-${size}-v3.png`, import.meta.url).pathname);
}
const maskable = await sharp(svg).resize(410, 410).removeAlpha().png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#1d3d2e' } }).composite([{ input: maskable, left: 51, top: 51 }]).removeAlpha().png().toFile(new URL('../public/icons/eventsfeed-maskable-v3.png', import.meta.url).pathname);
await writeFile(new URL('../public/apple-touch-icon.png', import.meta.url), await readFile(new URL('../public/icons/eventsfeed-180-v3.png', import.meta.url)));
await writeFile(new URL('../public/favicon.svg', import.meta.url), svg);
console.log('Generated opaque PNG icons: Apple 180, app 192/512, maskable 512 and browser 32.');
