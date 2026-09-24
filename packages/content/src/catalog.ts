import { checkAbort, parseAsset, sha256, verifyAsset, type Asset, type ContentIO } from "./index.ts";

export type CatalogEntry = { id: string; title: string; engine: string; revision: string; manifestUrl: string };
export type SceneManifest = {
  schemaVersion: 1; sceneId: string; engine: string; revision: string;
  assets: Record<string, Asset>; config: Record<string, unknown>;
};
export type SceneProgress = { phase: "manifest" | "downloading" | "ready"; completedBytes: number; totalBytes: number };
export type SceneLease = {
  manifest: SceneManifest;
  read(name: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  release(): Promise<void>;
};
const token = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._@-]{0,95}$/.test(v);
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
export function contentURL(value: string, base?: string) {
  const url = new URL(value, base);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))))
    throw Error("Content requires HTTPS");
  return url.href;
}
export function parseCatalog(raw: unknown, base: string): CatalogEntry[] {
  if (!object(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.scenes) || raw.scenes.length > 5000) throw Error("Invalid scene catalog");
  const ids = new Set<string>();
  return raw.scenes.map((e: unknown) => {
    if (!object(e) || !token(e.id) || !token(e.engine) || !token(e.revision) || typeof e.title !== "string" || !e.title.trim() || e.title.length > 100 || typeof e.manifestUrl !== "string" || e.manifestUrl.length > 2048 || ids.has(e.id))
      throw Error("Invalid catalog entry");
    ids.add(e.id);
    return { id: e.id, title: e.title, engine: e.engine, revision: e.revision, manifestUrl: contentURL(e.manifestUrl, base) };
  });
}
export function parseSceneManifest(raw: unknown): SceneManifest {
  if (!object(raw) || raw.schemaVersion !== 1 || !token(raw.sceneId) || !token(raw.engine) || !token(raw.revision) || !object(raw.assets) || !object(raw.config) || Object.keys(raw.assets).length > 128 || JSON.stringify(raw.config).length > 65536)
    throw Error("Invalid scene manifest");
  const assets: Record<string, Asset> = Object.create(null);
  const hashes = new Map<string, number>();
  for (const [name, value] of Object.entries(raw.assets)) {
    if (!token(name) || ["__proto__", "constructor", "prototype"].includes(name)) throw Error("Invalid asset name");
    const asset = parseAsset(value);
    if (hashes.has(asset.sha256) && hashes.get(asset.sha256) !== asset.bytes) throw Error("Conflicting asset sizes");
    hashes.set(asset.sha256, asset.bytes); assets[name] = asset;
  }
  return { schemaVersion: 1, sceneId: raw.sceneId, revision: raw.revision, engine: raw.engine, assets, config: raw.config };
}
/** Recommendation is metadata-only; a notification should carry the same catalog entry/id. */
export function recommendScene(entries: CatalogEntry[], day: string): CatalogEntry | undefined {
  const hash = sha256(new TextEncoder().encode(day).buffer);
  return entries[parseInt(hash.slice(0, 8), 16) % entries.length];
}
const entryKey = (entry: CatalogEntry) => `scene-manifest:${sha256(new TextEncoder().encode(JSON.stringify([entry.id, entry.engine, entry.revision, entry.manifestUrl])).buffer)}`;
let nextOwner = 0;
export function createSceneLibrary(options: {
  io: ContentIO;
  supports(engine: string): boolean;
  validate?(manifest: SceneManifest): void;
}) {
  const { io } = options;
  async function saved(entry: CatalogEntry) {
    try {
      const manifest = parseSceneManifest(await io.readHistory(entryKey(entry)));
      match(entry, manifest); return manifest;
    } catch { return undefined; }
  }
  function match(entry: CatalogEntry, manifest: SceneManifest) {
    if (manifest.sceneId !== entry.id || manifest.engine !== entry.engine || manifest.revision !== entry.revision) throw Error("Scene identity mismatch");
    options.validate?.(manifest);
  }
  return {
    async catalog(url: string, signal?: AbortSignal) {
      const endpoint = contentURL(url), key = `catalog:${endpoint}`;
      try {
        const entries = parseCatalog(await io.readManifest(endpoint, signal), endpoint);
        checkAbort(signal);
        await io.writeHistory(key, { schemaVersion: 1, scenes: entries }).catch(() => {});
        return entries;
      } catch (error) {
        checkAbort(signal);
        const prior = await io.readHistory(key).catch(() => undefined);
        if (!prior) throw error;
        return parseCatalog(prior, endpoint);
      }
    },
    saved,
    async status(entry: CatalogEntry, hashes: Set<string>): Promise<"unknown" | "cached" | "missing"> {
      const manifest = await saved(entry);
      if (!manifest) return "unknown";
      return Object.values(manifest.assets).every(a => hashes.has(a.sha256)) ? "cached" : "missing";
    },
    async open(entry: CatalogEntry, settings: { signal?: AbortSignal; onProgress?(value: SceneProgress): void } = {}): Promise<SceneLease> {
      const { signal } = settings;
      checkAbort(signal);
      if (!options.supports(entry.engine)) throw Error("Please upgrade the app for this scene engine");
      if (!io.cache) throw Error("Managed scene cache unavailable");
      const url = contentURL(entry.manifestUrl);
      settings.onProgress?.({ phase: "manifest", completedBytes: 0, totalBytes: 0 });
      const manifest = (await saved(entry)) ?? parseSceneManifest(await io.readManifest(url, signal));
      checkAbort(signal); match(entry, manifest);
      const assets = [...new Map(Object.values(manifest.assets).map(a => [a.sha256, a])).values()];
      const owner = `scene:${Date.now()}:${++nextOwner}`;
      let released = false;
      const release = async () => {
        if (released) return;
        released = true; signal?.removeEventListener("abort", abort);
        await io.cache!.release(owner);
      };
      const abort = () => { void release().catch(() => {}); };
      await io.cache.protect(owner, assets);
      signal?.addEventListener("abort", abort, { once: true });
      let completedBytes = 0;
      const totalBytes = assets.reduce((n, a) => n + a.bytes, 0);
      try {
        checkAbort(signal);
        for (const asset of assets) {
          settings.onProgress?.({ phase: "downloading", completedBytes, totalBytes });
          const bytes = (await io.readCachedAsset(asset, signal)) ?? await io.readAsset(asset, new URL(asset.path, url).href, signal, true);
          checkAbort(signal); verifyAsset(asset, bytes);
          completedBytes += asset.bytes;
        }
        // Metadata is a repair recipe, not a claim that the OS still retains files.
        await io.writeHistory(entryKey(entry), manifest);
        checkAbort(signal);
        settings.onProgress?.({ phase: "ready", completedBytes, totalBytes });
        return { manifest, release, async read(name, readSignal) {
          if (released) throw Error("Scene lease released");
          const asset = manifest.assets[name];
          if (!asset) throw Error("Unknown scene asset");
          const bytes = await io.readCachedAsset(asset, readSignal ?? signal);
          if (!bytes) throw Error("Scene resource was removed; retry to download");
          verifyAsset(asset, bytes); return bytes;
        } };
      } catch (error) { await release(); throw error; }
    },
  };
}
