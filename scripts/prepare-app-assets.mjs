import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const assetFiles = [
  "reference-ui/wishes.png",
  "reference-ui/rituals.png",
  "fonts/noto-sans-sc.woff2",
  "fonts/OFL.txt",
];
export async function prepareAppAssets() {
  const assets = [];
  for (const file of assetFiles) {
    const source = path.join(root, "assets", file);
    const destination = path.join(root, "apps/mobile-expo/public", file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    const bytes = await readFile(source);
    assets.push({
      file,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return assets;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const assets = await prepareAppAssets();
  console.log(`Prepared ${assets.length} local image/font/license assets.`);
}
