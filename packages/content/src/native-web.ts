import { checkAbort, type Asset, type ContentIO } from "./index";
import { createWebContentIO, readBytes } from "./web";
import type { CacheOptions, CacheStats } from "./cache";
export type NativeContentBridge = {
  protectSceneAssets(owner: string, assets: Asset[]): Promise<void>;
  releaseSceneAssets(owner: string): Promise<void>;
  maintainSceneCache(options?: CacheOptions): Promise<CacheStats>;
  readSceneAsset(asset: Asset): Promise<string | null>;
  readContentHistory(key: string): Promise<unknown>;
  writeContentHistory(key: string, value: unknown): Promise<void>;
  fetchSceneAsset(
    asset: Asset,
    url: string,
    requestId: string,
  ): Promise<string>;
  cancelSceneAsset(requestId: string): Promise<void>;
};
/** Only small metadata/file URIs cross the native bridge, never binary/base64. */
export function createNativeContentIO(bridge: NativeContentBridge): ContentIO {
  const web = createWebContentIO();
  // Metro development runs the DOM on HTTP, where native file URIs are blocked.
  if (window.location.protocol !== "file:") return web;
  return {
    cache: {
      protect: (owner, assets) => bridge.protectSceneAssets(owner, assets),
      release: owner => bridge.releaseSceneAssets(owner),
      maintain: options => bridge.maintainSceneCache(options),
    },
    async readCachedAsset(asset, signal) {
      checkAbort(signal);
      const uri = await bridge.readSceneAsset(asset).catch(() => null);
      checkAbort(signal);
      if (!uri) return;
      try {
        return await readBytes(uri, asset.bytes, signal);
      } catch {
        checkAbort(signal);
        return;
      }
    },
    readManifest: web.readManifest,
    readHistory: (key) => bridge.readContentHistory(key),
    writeHistory: (key, value) => bridge.writeContentHistory(key, value),
    async readAsset(asset, url, signal) {
      checkAbort(signal);
      if (url.startsWith("file:")) return readBytes(url, asset.bytes, signal);
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let abort: () => void = () => {};
      const cancelled = new Promise<never>((_, reject) => {
        abort = () => {
          void bridge.cancelSceneAsset(requestId).catch(() => {});
          reject(new DOMException("Scene load cancelled", "AbortError"));
        };
        signal?.addEventListener("abort", abort, { once: true });
      });
      try {
        const uri = await Promise.race([
          bridge.fetchSceneAsset(asset, url, requestId),
          cancelled,
        ]);
        checkAbort(signal);
        return await readBytes(uri, asset.bytes, signal);
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
