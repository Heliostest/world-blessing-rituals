import { Directory, File, Paths } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSHA256, type Asset } from "@wbr/content";
import {
  createAssetCache,
  type CacheOptions,
  type CacheEntry,
} from "@wbr/content/cache";
const PREFIX = "wbr:scene-content:v1:";
const root = () => new Directory(Paths.cache, "wbr-scene-content-v1");
const pending = new Map<string, AbortController>();
const cancelledRequests = new Set<string>();
const partials = new Set<string>();
const sceneOwners = new Set<string>();
let epoch = 0;
let indexWrites: Promise<unknown> = Promise.resolve();
async function index(): Promise<Record<string, number>> {
  try {
    const value = JSON.parse(
      (await AsyncStorage.getItem(PREFIX + "lru")) ?? "{}",
    );
    return Object.fromEntries(
      Object.entries(value ?? {}).filter(
        ([key, used]) =>
          /^[a-f0-9]{64}$/.test(key) &&
          typeof used === "number" &&
          Number.isFinite(used),
      ),
    ) as Record<string, number>;
  } catch {
    return {};
  }
}
function updateIndex(fn: (index: Record<string, number>) => void) {
  const task = indexWrites
    .catch(() => {})
    .then(async () => {
      const value = await index();
      fn(value);
      await AsyncStorage.setItem(PREFIX + "lru", JSON.stringify(value));
    });
  indexWrites = task;
  return task;
}
function verify(file: File, asset: Asset) {
  if (!file.exists || file.size !== asset.bytes)
    throw Error("Invalid scene file size");
  const hasher = createSHA256(),
    handle = file.open();
  try {
    let remaining = asset.bytes;
    while (remaining > 0) {
      const bytes = handle.readBytes(Math.min(256 * 1024, remaining));
      if (!bytes.length) throw Error("Truncated scene file");
      hasher.update(bytes);
      remaining -= bytes.length;
    }
    const digest = Array.from(hasher.digest(), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== asset.sha256) throw Error("Scene file integrity failed");
  } finally {
    handle.close();
  }
}

const cache = createAssetCache<string>({
  async list() {
    const directory = root();
    directory.create({ idempotent: true, intermediates: true });
    const used = await index();
    const entries: CacheEntry[] = directory
      .list()
      .filter(
        (f): f is File => f instanceof File && /^[a-f0-9]{64}$/.test(f.name),
      )
      .map((f) => ({ key: f.name, size: f.size, used: used[f.name] ?? 0 }));
    const keys = new Set(entries.map((e) => e.key));
    await updateIndex((current) => {
      for (const key of Object.keys(current))
        if (!keys.has(key)) delete current[key];
    });
    return entries;
  },
  async read(asset) {
    const file = new File(root(), asset.sha256);
    try {
      verify(file, asset);
      return file.uri;
    } catch {
      if (file.exists) file.delete();
      return;
    }
  },
  touch: (key, at) =>
    updateIndex((value) => {
      value[key] = at;
    }),
  async remove(key) {
    const file = new File(root(), key);
    if (file.exists) file.delete();
    await updateIndex((value) => {
      delete value[key];
    });
  },
  async sweep() {
    const directory = root();
    directory.create({ idempotent: true, intermediates: true });
    for (const file of directory.list()) {
      if (
        file instanceof File &&
        file.name.endsWith(".part") &&
        !partials.has(file.uri)
      )
        file.delete();
    }
  },
  async download(asset, url, signal) {
    signal?.throwIfAborted();
    if (!url.startsWith("https://"))
      throw Error("Native content requires HTTPS");
    // Account for an atomic temp file before starting the network transfer.
    const available = Paths.availableDiskSpace;
    if (typeof available === "number" && available < asset.bytes + 1024 * 1024)
      throw Error("Insufficient disk space for scene");
    const directory = root();
    directory.create({ idempotent: true, intermediates: true });
    const temporary = new File(
      directory,
      `${asset.sha256}-${Date.now()}-${Math.random().toString(16).slice(2)}.part`,
    );
    const originalUri = temporary.uri;
    partials.add(originalUri);
    let stop: () => void = () => {};
    const download = createDownloadResumable(
      url,
      temporary.uri,
      {},
      (progress) => {
        if (
          progress.totalBytesWritten > asset.bytes ||
          progress.totalBytesExpectedToWrite > asset.bytes
        )
          stop();
      },
    );
    let rejectStop: (error: Error) => void = () => {};
    let stopping: Promise<void> | undefined;
    const stopped = new Promise<never>((_, reject) => {
      rejectStop = reject;
    });
    stop = () => {
      stopping ??= download.cancelAsync();
      void stopping.catch(() => {});
      rejectStop(Error("Scene transfer interrupted or exceeded size limit"));
    };
    signal?.throwIfAborted();
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(stop, 20000);
    const transfer = download.downloadAsync();
    const cleanup = () => {
      partials.delete(originalUri);
      try {
        const file = new File(directory, originalUri.split("/").at(-1)!);
        if (file.exists) file.delete();
      } catch {
        /* next lifecycle sweep retries */
      }
    };
    try {
      const result = await Promise.race([transfer, stopped]);
      signal?.throwIfAborted();
      if (
        result &&
        result.status !== undefined &&
        (result.status < 200 || result.status >= 300)
      )
        throw Error(`Content HTTP ${result.status}`);
      verify(temporary, asset);
      const file = new File(directory, asset.sha256);
      temporary.move(file);
      return file.uri;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      if (stopping) {
        try { await stopping; cleanup(); }
        catch {
          // If native cannot acknowledge cancellation, do not release capacity
          // while its writer might still be running. Cached reads stay available.
          await transfer.then(cleanup, cleanup);
        }
      } else cleanup();
      void transfer.then(cleanup, cleanup);
    }
  },
});
export async function readContentHistory(key: string) {
  const raw = await AsyncStorage.getItem(PREFIX + key);
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
export async function writeContentHistory(key: string, value: unknown) {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
}
export async function readSceneAsset(asset: Asset): Promise<string | null> {
  return (await cache.read(asset)) ?? null;
}
export async function fetchSceneAsset(
  asset: Asset,
  url: string,
  requestId: string,
): Promise<string> {
  const controller = new AbortController();
  pending.set(requestId, controller);
  if (cancelledRequests.delete(requestId)) controller.abort();
  try {
    return await cache.fetch(asset, url, controller.signal);
  } finally {
    pending.delete(requestId);
  }
}
export async function cancelSceneAsset(requestId: string) {
  if (pending.has(requestId)) pending.get(requestId)!.abort();
  else {
    // DOM bridge messages can arrive out of order; IDs are unique per request.
    cancelledRequests.add(requestId);
    if (cancelledRequests.size > 256)
      cancelledRequests.delete(cancelledRequests.values().next().value!);
  }
}
export async function protectSceneAssets(owner: string, assets: Asset[]) {
  const started = epoch;
  sceneOwners.add(owner);
  try {
    await cache.protect(owner, assets);
    if (started !== epoch) {
      await cache.release(owner);
      throw Error("Scene host restarted");
    }
  } catch (error) {
    sceneOwners.delete(owner);
    throw error;
  }
}
export async function releaseSceneAssets(owner: string) {
  sceneOwners.delete(owner);
  await cache.release(owner);
}
export async function maintainSceneCache(options?: CacheOptions) {
  return cache.maintain(options);
}
/** A terminated DOM host cannot release its leases; the native shell owns recovery. */
export async function resetSceneCacheSession() {
  epoch++;
  for (const controller of pending.values()) controller.abort();
  const owners = [...sceneOwners];
  sceneOwners.clear();
  for (const owner of owners) await cache.release(owner);
  await cache.maintain();
}
