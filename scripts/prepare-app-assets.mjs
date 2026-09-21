import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareBundledContent } from "./publish-scene-content.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const assetFiles = [
  "reference-ui/wishes.png",
  "reference-ui/rituals.png",
  "fonts/noto-sans-sc.woff2",
  "fonts/OFL.txt",
  "woodfish/bundled-v1/woodfish.glb",
];
export async function prepareAppAssets() {
  await prepareBundledContent();
  const assets = [];
  const destinations = ["apps/mobile-expo/public", "apps/cyber-bless/public"];
  // Both directories contain generated output only, never authoring inputs.
  for (const relative of destinations) {
    const target = path.resolve(root, relative);
    if (path.relative(root, target) !== path.normalize(relative))
      throw Error("Unsafe generated path");
    await rm(target, { recursive: true, force: true });
  }
  for (const file of assetFiles) {
    const source = path.join(root, "assets", file);
    for (const target of destinations) {
      const destination = path.join(root, target, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
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
