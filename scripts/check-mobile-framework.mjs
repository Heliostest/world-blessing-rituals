import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { prepareAppAssets } from "./prepare-app-assets.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "apps/mobile-expo");
const require = createRequire(path.join(app, "package.json"));
const cli = require.resolve("expo/bin/cli");
const output = path.join(app, ".expo-export-check", String(Date.now()));
const assets = await prepareAppAssets();
for (const platform of ["android", "ios"]) {
  const target = path.join(output, platform);
  await mkdir(target, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "export:embed",
        "--platform",
        platform,
        "--dev",
        "false",
        "--max-workers",
        "2",
        "--entry-file",
        path.join(app, "index.ts"),
        "--bundle-output",
        path.join(target, "main.bundle"),
        "--assets-dest",
        platform === "android" ? path.join(target, "res") : target,
      ],
      {
        cwd: app,
        env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Expo ${platform} failed: ${code}`)),
    );
  });
  const files = await walk(target);
  if ((await stat(path.join(target, "main.bundle"))).size < 1000)
    throw new Error("Missing native bundle");
  const html = files.filter((f) => f.endsWith(".html"));
  if (!html.length) throw new Error("Missing embedded DOM page");
  for (const file of html) {
    for (const asset of assets) {
      const bytes = await readFile(path.join(path.dirname(file), asset.file));
      if (
        bytes.length !== asset.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== asset.sha256
      )
        throw new Error(`Embedded asset mismatch: ${asset.file}`);
    }
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(
      /(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g,
    )) {
      const relative = match[1].split("?")[0];
      if (/^https?:/.test(relative))
        throw new Error("Remote JS/CSS cannot run offline");
      const candidate = path.resolve(
        path.dirname(file),
        relative.replace(/^\//, ""),
      );
      if (!(await stat(candidate)).size)
        throw new Error(`Empty DOM dependency: ${candidate}`);
    }
  }
  console.log(
    `${platform}: native bundle and embedded DOM HTML/JS/CSS verified.`,
  );
}
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
