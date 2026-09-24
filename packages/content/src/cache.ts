import { CACHE_BUDGET, checkAbort, parseAsset, type Asset } from "./index";

export type CacheEntry = { key: string; size: number; used: number };
export type CacheStats = {
  bytes: number; budget: number; protectedBytes: number; reservedBytes: number;
  overBudget: boolean; entries: CacheEntry[];
};
export type CacheOptions = { budget?: number; clear?: boolean };
export type CacheControl = {
  protect(owner: string, assets: Asset[]): Promise<void>;
  release(owner: string): Promise<void>;
  maintain(options?: CacheOptions): Promise<CacheStats>;
};
/** Drivers verify reads and atomically publish verified downloads. Never list partial files. */
export type CacheDriver<T> = {
  list(): Promise<CacheEntry[]>;
  read(asset: Asset): Promise<T | undefined>;
  touch(key: string, at: number): Promise<void>;
  remove(key: string): Promise<void>;
  download(asset: Asset, url: string, signal?: AbortSignal): Promise<T>;
  sweep?(): Promise<void>;
};

export function createAssetCache<T>(driver: CacheDriver<T>, options: { budget?: number; now?: () => number } = {}) {
  let budget = options.budget ?? CACHE_BUDGET;
  const now = options.now ?? Date.now;
  const owners = new Map<string, Asset[]>();
  let mutations: Promise<unknown> = Promise.resolve(), downloads: Promise<unknown> = Promise.resolve();
  let sequence = 0;
  function atomic<R>(fn: () => Promise<R>) {
    const task = mutations.catch(() => {}).then(fn);
    mutations = task;
    return task;
  }
  function protectedAssets() {
    const assets = new Map<string, Asset>();
    for (const list of owners.values()) for (const a of list) {
      if (assets.has(a.sha256) && assets.get(a.sha256)!.bytes !== a.bytes)
        throw Error("Conflicting content size");
      assets.set(a.sha256, a);
    }
    return assets;
  }
  async function prune(clear = false): Promise<CacheStats> {
    await driver.sweep?.();
    const protectedSet = protectedAssets();
    const entries = await driver.list();
    const present = new Set(entries.map(e => e.key));
    const reservedBytes = [...protectedSet.values()].reduce((n, a) => n + (present.has(a.sha256) ? 0 : a.bytes), 0);
    let bytes = entries.reduce((n, e) => n + e.size, 0);
    const removed = new Set<string>();
    for (const e of entries.sort((a, b) => a.used - b.used || a.key.localeCompare(b.key))) {
      if (!clear && bytes + reservedBytes <= budget) break;
      if (protectedSet.has(e.key)) continue;
      await driver.remove(e.key);
      bytes -= e.size; removed.add(e.key);
    }
    return { bytes, budget, reservedBytes,
      protectedBytes: entries.filter(e => protectedSet.has(e.key)).reduce((n, e) => n + e.size, 0),
      overBudget: bytes + reservedBytes > budget, entries: entries.filter(e => !removed.has(e.key)) };
  }
  const control: CacheControl = {
    protect(owner, raw) {
      return atomic(async () => {
        const assets = raw.map(parseAsset);
        const previous = owners.get(owner);
        owners.set(owner, assets);
        try {
          if ([...protectedAssets().values()].reduce((n, a) => n + a.bytes, 0) > budget)
            throw Error("Scene cache budget exceeded; close another scene or increase budget");
          await prune();
        } catch (error) {
          if (previous) owners.set(owner, previous); else owners.delete(owner);
          throw error;
        }
      });
    },
    release(owner) { return atomic(async () => { owners.delete(owner); await prune(); }); },
    maintain(settings = {}) {
      return atomic(async () => {
        if (settings.budget !== undefined) {
          if (!Number.isSafeInteger(settings.budget) || settings.budget < 1) throw Error("Invalid cache budget");
          budget = settings.budget;
        }
        return prune(settings.clear);
      });
    },
  };
  const read = (asset: Asset, signal?: AbortSignal) => atomic(async () => {
    checkAbort(signal);
    const value = await driver.read(parseAsset(asset));
    checkAbort(signal);
    if (value !== undefined) await driver.touch(asset.sha256, now());
    return value;
  });
  return {
    ...control, read,
    async fetch(asset: Asset, url: string, signal?: AbortSignal): Promise<T> {
      checkAbort(signal);
      const owner = `transfer:${++sequence}`;
      await control.protect(owner, [asset]);
      let started = false, settled = false;
      const task = downloads.catch(() => {}).then(async () => {
        checkAbort(signal);
        started = true;
        const cached = await read(asset, signal);
        if (cached !== undefined) return cached;
        const value = await driver.download(asset, url, signal);
        checkAbort(signal);
        await atomic(() => driver.touch(asset.sha256, now()));
        return value;
      });
      downloads = task;
      void task.then(() => { settled = true; }, () => { settled = true; });
      let abort: () => void = () => {};
      const cancelled = new Promise<never>((_, reject) => {
        abort = () => reject(new DOMException("Content load cancelled", "AbortError"));
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
      try { return await Promise.race([task, cancelled]); }
      finally {
        signal?.removeEventListener("abort", abort);
        if (!started || settled) await control.release(owner);
        else {
          // A running writer retains its reservation until it acknowledges stop.
          void task.then(() => control.release(owner), () => control.release(owner)).catch(() => {});
        }
      }
    },
  };
}
