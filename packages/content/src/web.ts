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
  function db() {
    return (database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("wbr-scene-content-v1", 1);
      let failed = false;
      const fail = () => {
        failed = true;
        clearTimeout(timer);
        reject(Error("Content cache unavailable"));
      };
      const timer = setTimeout(fail, 1500);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("assets", { keyPath: "key" });
        request.result.createObjectStore("asset-index", { keyPath: "key" });
        request.result.createObjectStore("metadata");
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (failed) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = request.onblocked = fail;
    }));
  }
  async function get(store: string, key: string): Promise<any> {
    const database = await db();
    return new Promise((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).get(key);
      const timer = setTimeout(
        () => reject(Error("Content cache timed out")),
        1500,
      );
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
    });
  }
  async function put(store: string, key: string, value: unknown) {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(
        store === "assets" ? [store, "asset-index"] : [store],
        "readwrite",
      );
      const timer = setTimeout(() => {
        try {
          tx.abort();
        } catch {
          /* The completion event may already be queued. */
        }
        reject(Error("Content cache timed out"));
      }, 1500);
      tx.oncomplete = () => {
        clearTimeout(timer);
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        clearTimeout(timer);
        reject(tx.error);
      };
      try {
        if (store === "assets") {
          const assets = tx.objectStore(store);
          assets.put(value);
          const item = value as Cached;
          const meta = tx.objectStore("asset-index");
          meta.put({ key, size: item.bytes.byteLength, used: item.used });
          const request = meta.openCursor();
          const entries: { key: IDBValidKey; size: number; used: number }[] =
            [];
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              entries.push(cursor.value);
              cursor.continue();
            } else {
              let size = entries.reduce((s, e) => s + e.size, 0);
              for (const entry of entries.sort((a, b) => a.used - b.used)) {
                if (size <= CACHE_BUDGET) break;
                if (entry.key === key) continue;
                assets.delete(entry.key);
                meta.delete(entry.key);
                size -= entry.size;
              }
            }
          };
        } else tx.objectStore(store).put(value, key);
      } catch (error) {
        clearTimeout(timer);
        tx.abort();
        reject(error);
      }
    });
  }
  async function readCachedAsset(asset: Asset, signal?: AbortSignal) {
    checkAbort(signal);
    try {
      const cached: Cached | undefined = await get("assets", asset.sha256);
      checkAbort(signal);
      if (!cached) return;
      verifyAsset(asset, cached.bytes);
      // Touch only small metadata; do not rewrite a binary on every cache hit.
      void db()
        .then((database) => {
          const tx = database.transaction("asset-index", "readwrite");
          tx.objectStore("asset-index").put({
            key: asset.sha256,
            size: cached.bytes.byteLength,
            used: Date.now(),
          });
        })
        .catch(() => {});
      return cached.bytes;
    } catch {
      checkAbort(signal);
      return;
    }
  }
  return {
    readCachedAsset,
    readManifest: async (url, signal) =>
      JSON.parse(
        new TextDecoder().decode(await readBytes(url, 65536, signal, 2500)),
      ),
    readHistory: (key) => get("metadata", key),
    writeHistory: (key, value) => put("metadata", key, value),
    async readAsset(asset: Asset, url, signal, requireCache = false) {
      checkAbort(signal);
      const cached = await readCachedAsset(asset, signal);
      if (cached) return cached;
      const bytes = await readBytes(url, asset.bytes, signal);
      checkAbort(signal);
      verifyAsset(asset, bytes);
      await put("assets", asset.sha256, {
        key: asset.sha256,
        bytes,
        used: Date.now(),
      }).catch((error) => {
        if (requireCache) throw error;
      });
      return bytes;
    },
  };
}
