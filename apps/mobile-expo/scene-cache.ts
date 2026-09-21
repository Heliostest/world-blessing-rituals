import { Directory, File, Paths } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CACHE_BUDGET,
  createSHA256,
  parseAsset,
  type Asset,
} from "@wbr/content";

// Metadata and disposable files never share the personal-save key or directory.
const PREFIX = "wbr:scene-content:v1:";
const pending = new Map<string, () => void>();
let queue: Promise<unknown> = Promise.resolve();
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
export async function readContentHistory(key: string) {
  const raw = await AsyncStorage.getItem(PREFIX + key);
  return raw ? JSON.parse(raw) : [];
}
export async function writeContentHistory(key: string, value: unknown) {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
}
export async function cancelSceneAsset(requestId: string) {
  pending.get(requestId)?.();
}
/** A lookup never waits for the download queue or starts a network request. */
export async function readSceneAsset(raw: Asset): Promise<string | null> {
  const asset = parseAsset(raw);
  const file = new File(
    new Directory(Paths.cache, "wbr-scene-content-v1"),
    asset.sha256,
  );
  try {
    verify(file, asset);
    return file.uri;
  } catch {
    return null;
  }
}
export async function fetchSceneAsset(
  raw: Asset,
  url: string,
  requestId: string,
): Promise<string> {
  const asset = parseAsset(raw);
  if (!url.startsWith("https://")) throw Error("Native content requires HTTPS");
  let cancelled = false,
    pause: (() => void) | undefined;
  pending.set(requestId, () => {
    cancelled = true;
    pause?.();
  });
  const check = () => {
    if (cancelled) throw Error("Scene download cancelled");
  };
  // Serialized disk mutations bound download concurrency and avoid eviction races.
  const task = queue
    .catch(() => {})
    .then(async () => {
      check();
      const root = new Directory(Paths.cache, "wbr-scene-content-v1");
      root.create({ idempotent: true, intermediates: true });
      const file = new File(root, asset.sha256);
      let index: Record<string, number> = {};
      try {
        const raw = JSON.parse(
          (await AsyncStorage.getItem(PREFIX + "lru")) ?? "{}",
        );
        if (raw && typeof raw === "object" && !Array.isArray(raw))
          index = Object.fromEntries(
            Object.entries(raw).filter(
              (entry): entry is [string, number] =>
                /^[a-f0-9]{64}$/.test(entry[0]) &&
                typeof entry[1] === "number" &&
                Number.isFinite(entry[1]),
            ),
          );
      } catch {
        /* Rebuild index from files. */
      }
      check();
      try {
        verify(file, asset);
      } catch {
        if (file.exists) file.delete();
        const temporary = new File(
          root,
          `${asset.sha256}-${Date.now()}-${Math.random().toString(16).slice(2)}.part`,
        );
        const download = createDownloadResumable(
          url,
          temporary.uri,
          {},
          (progress) => {
            if (
              progress.totalBytesWritten > asset.bytes ||
              progress.totalBytesExpectedToWrite > asset.bytes
            ) {
              cancelled = true;
              pause?.();
            }
          },
        );
        let rejectStop: (reason: Error) => void = () => {};
        const stopped = new Promise<never>((_, reject) => {
          rejectStop = reject;
        });
        pause = () => {
          void download.pauseAsync().catch(() => {});
          rejectStop(Error("Scene transfer stopped"));
        };
        const timer = setTimeout(() => {
          cancelled = true;
          pause?.();
        }, 20000);
        const transfer = download.downloadAsync();
        try {
          await Promise.race([transfer, stopped]);
          check();
          verify(temporary, asset);
          temporary.move(file);
        } catch (error) {
          const cleanup = () => {
            try {
              if (temporary.exists) temporary.delete();
            } catch {
              /* Sweep stale partials later. */
            }
          };
          void transfer.then(cleanup, cleanup);
          throw error;
        } finally {
          clearTimeout(timer);
          pause = undefined;
          // A failed native writer may settle after cancellation; .part files are
          // never returned or counted as confirmed content and are swept below.
        }
      }
      check();
      index[asset.sha256] = Date.now();
      const files = root
        .list()
        .filter((entry): entry is File => entry instanceof File);
      for (const entry of files) {
        if (
          entry.name.endsWith(".part") &&
          Date.now() - (entry.modificationTime ?? Date.now()) > 3600000
        )
          entry.delete();
      }
      let total = files
        .filter((entry) => entry.exists)
        .reduce((sum, entry) => sum + entry.size, 0);
      for (const entry of files.sort(
        (a, b) => (index[a.name] ?? 0) - (index[b.name] ?? 0),
      )) {
        if (total <= CACHE_BUDGET) break;
        if (!entry.exists || entry.name.endsWith(".part")) continue;
        if (entry.name === asset.sha256) continue;
        total -= entry.size;
        entry.delete();
        delete index[entry.name];
      }
      await AsyncStorage.setItem(PREFIX + "lru", JSON.stringify(index));
      return file.uri;
    });
  queue = task;
  try {
    return await task;
  } finally {
    pending.delete(requestId);
  }
}
