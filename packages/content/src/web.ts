import { createAssetCache, type CacheEntry } from "./cache";
import {
  CACHE_BUDGET,
  checkAbort,
  verifyAsset,
  type Asset,
  type ContentIO,
} from "./index";

/** Also works for the file: origin in an embedded Expo DOM component. */
export function readBytes(
  url: string,
  limit: number,
  signal?: AbortSignal,
  timeout = 20000,
): Promise<ArrayBuffer> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(xhr.response);
    };
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.timeout = timeout;
    xhr.onprogress = (e) => {
      if (e.loaded > limit || (e.lengthComputable && e.total > limit))
        xhr.abort();
    };
    xhr.onload = () => {
      if (
        (xhr.status === 0 && url.startsWith("file:")) ||
        (xhr.status >= 200 && xhr.status < 300)
      ) {
        if (
          xhr.response instanceof ArrayBuffer &&
          xhr.response.byteLength <= limit
        )
          finish();
        else finish(Error("Content exceeds size limit"));
      } else finish(Error(`Content HTTP ${xhr.status}`));
    };
    xhr.onerror =
      xhr.onabort =
      xhr.ontimeout =
        () => finish(Error("Content transfer interrupted"));
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send();
  });
}
type Cached = { key: string; bytes: ArrayBuffer; used: number };
export function createWebContentIO(): ContentIO {
  let database: Promise<IDBDatabase> | undefined;
  function db(): Promise<IDBDatabase> {
    if (database) return database;
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("wbr-scene-content-v1", 1);
      let failed = false;
      const timer = setTimeout(() => { failed = true; reject(Error("Content cache unavailable")); }, 1500);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("assets", { keyPath: "key" });
        request.result.createObjectStore("asset-index", { keyPath: "key" });
        request.result.createObjectStore("metadata");
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (failed) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => { clearTimeout(timer); failed = true; reject(Error("Content cache unavailable")); };
    }).catch(error => { database = undefined; throw error; });
    return database;
  }
  async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(stores, mode);
      let value: T;
      const timer = setTimeout(() => { try { tx.abort(); } catch {} reject(Error("Cache timed out")); }, 5000);
      tx.oncomplete = () => { clearTimeout(timer); resolve(value); };
      tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(tx.error ?? Error("Cache transaction failed")); };
      try { run(tx, v => { value = v; }); }
      catch (error) { clearTimeout(timer); tx.abort(); reject(error); }
    });
  }
  const get = (store: string, key: string) => transaction<any>([store], "readonly", (tx, result) => {
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => result(request.result);
  });
  const put = (store: string, key: string, value: unknown) => transaction<void>([store], "readwrite", tx => { tx.objectStore(store).put(value, key); });
  const remove = (key: string) => transaction<void>(["assets", "asset-index"], "readwrite", tx => {
    tx.objectStore("assets").delete(key); tx.objectStore("asset-index").delete(key);
  });
  const cache = createAssetCache<ArrayBuffer>({
    // Read only the small index: listing hundreds of scenes never loads binaries.
    list: () => transaction<CacheEntry[]>(["asset-index"], "readonly", (tx, result) => {
      const request = tx.objectStore("asset-index").getAll();
      request.onsuccess = () => result(request.result);
    }),
    read: async asset => {
      const item: Cached | undefined = await get("assets", asset.sha256);
      if (!item) { await remove(asset.sha256); return; }
      try { verifyAsset(asset, item.bytes); return item.bytes; }
      catch { await remove(asset.sha256); return; }
    },
    touch: (key, used) => transaction<void>(["asset-index"], "readwrite", tx => {
      const store = tx.objectStore("asset-index"), request = store.get(key);
      request.onsuccess = () => { if (request.result) store.put({ ...request.result, used }); };
    }),
    remove,
    download: async (asset, url, signal) => {
      const bytes = await readBytes(url, asset.bytes, signal);
      checkAbort(signal); verifyAsset(asset, bytes);
      await transaction<void>(["assets", "asset-index"], "readwrite", tx => {
        tx.objectStore("assets").put({ key: asset.sha256, bytes, used: Date.now() });
        tx.objectStore("asset-index").put({ key: asset.sha256, size: bytes.byteLength, used: Date.now() });
      });
      return bytes;
    },
  });
  return {
    cache,
    readCachedAsset: async (asset, signal) => {
      try { return await cache.read(asset, signal); }
      catch { checkAbort(signal); return; }
    },
    readManifest: async (url, signal) => JSON.parse(new TextDecoder().decode(await readBytes(url, 2 * 1024 * 1024, signal, 5000))),
    readHistory: key => get("metadata", key),
    writeHistory: (key, value) => put("metadata", key, value),
    async readAsset(asset, url, signal, requireCache = false) {
      if (requireCache) return cache.fetch(asset, url, signal);
      // Embedded fallback remains usable when browser storage is unavailable.
      const cached = await cache.read(asset, signal).catch(() => undefined);
      if (cached) return cached;
      const bytes = await readBytes(url, asset.bytes, signal);
      checkAbort(signal); verifyAsset(asset, bytes);
      return bytes;
    },
  };
}
