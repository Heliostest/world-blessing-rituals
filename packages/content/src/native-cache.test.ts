import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256 } from "./index";
import {
  fetchSceneAsset,
  readSceneAsset,
  cancelSceneAsset,
  readContentHistory,
  writeContentHistory,
  protectSceneAssets,
  releaseSceneAssets,
  maintainSceneCache,
  resetSceneCacheSession,
} from "../../../apps/mobile-expo/scene-cache";

const disk = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  metadata: new Map<string, string>(),
  downloads: 0,
  payload: new Uint8Array(),
  fail: false,
  paused: false,
  hold: false,
  free: 1024 * 1024 * 1024,
  stopGate: undefined as Promise<void> | undefined,
  reject: undefined as ((error: Error) => void) | undefined,
}));
vi.mock("@wbr/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./index")>()),
  CACHE_BUDGET: 1024 * 1024,
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => disk.metadata.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      disk.metadata.set(key, value);
    },
  },
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = dir.uri + "/" + name;
    }
    get name() {
      return this.uri.split("/").at(-1)!;
    }
    get exists() {
      return disk.files.has(this.uri);
    }
    get size() {
      return disk.files.get(this.uri)?.byteLength ?? 0;
    }
    get modificationTime() {
      return Date.now();
    }
    delete() {
      disk.files.delete(this.uri);
    }
    move(other: File) {
      disk.files.set(other.uri, disk.files.get(this.uri)!);
      disk.files.delete(this.uri);
      this.uri = other.uri;
    }
    open() {
      let offset = 0;
      return {
        readBytes: (length: number) => {
          const bytes = disk.files
            .get(this.uri)!
            .slice(offset, offset + length);
          offset += bytes.length;
          return bytes;
        },
        close() {},
      };
    }
  }
  class Directory {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = base + "/" + name;
    }
    create() {}
    list() {
      return [...disk.files.keys()]
        .filter((uri) => uri.startsWith(this.uri))
        .map((uri) => new File(this, uri.split("/").at(-1)!));
    }
  }
  return { File, Directory, Paths: { cache: "file:///cache", get availableDiskSpace() { return disk.free; } } };
});
vi.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: (_url: string, uri: string) => ({
    downloadAsync: async () => {
      disk.downloads++;
      if (disk.hold)
        return new Promise((_, reject) => {
          disk.reject = reject;
        });
      disk.files.set(uri, disk.payload);
      if (disk.fail) throw Error("network interrupted");
      return { uri };
    },
    pauseAsync: async () => {
      disk.paused = true;
      disk.reject?.(Error("paused"));
    },
    cancelAsync: async () => {
      disk.paused = true;
      await disk.stopGate;
      disk.reject?.(Error("cancelled"));
    },
  }),
}));
const asset = (bytes: Uint8Array) => ({
  path: "model.glb",
  bytes: bytes.byteLength,
  sha256: sha256(bytes.slice().buffer),
});
beforeEach(async () => {
  await resetSceneCacheSession();
  await maintainSceneCache({ budget: 1024 * 1024 });
  disk.files.clear();
  disk.metadata.clear();
  disk.downloads = 0;
  disk.fail = false;
  disk.paused = false;
  disk.hold = false;
  disk.free = 1024 * 1024 * 1024;
  disk.stopGate = undefined;
  disk.reject = undefined;
  disk.payload = new TextEncoder().encode("native scene");
});
describe("native content cache", () => {
  it("retains a running writer reservation until native cancellation is acknowledged", async () => {
    let acknowledge!: () => void;
    disk.stopGate = new Promise(resolve => { acknowledge = resolve; });
    disk.hold = true;
    const a = asset(disk.payload);
    const job = fetchSceneAsset(a, "https://cdn.test/a.glb", "writer");
    const stopped = job.catch(() => undefined);
    await vi.waitFor(() => expect(disk.downloads).toBe(1));
    await cancelSceneAsset("writer");
    await stopped;
    await new Promise(resolve => setTimeout(resolve, 10));
    try { expect((await maintainSceneCache()).reservedBytes).toBe(a.bytes); }
    finally { acknowledge(); await Promise.resolve(); }
    await vi.waitFor(async () => expect((await maintainSceneCache()).reservedBytes).toBe(0));
  });
  it("rejects disk exhaustion before transfer and permits retry after space is available", async () => {
    disk.free = 0;
    await expect(fetchSceneAsset(asset(disk.payload), "https://cdn.test/a.glb", "full")).rejects.toThrow(/disk space/);
    expect(disk.downloads).toBe(0);
    disk.free = 1024 * 1024 * 1024;
    await expect(fetchSceneAsset(asset(disk.payload), "https://cdn.test/a.glb", "retry")).resolves.toMatch(/^file:/);
  });
  it("updates normal read LRU and protects shared scene dependencies across clear", async () => {
    const a = asset(disk.payload);
    await fetchSceneAsset(a, "https://cdn.test/a.glb", "a");
    disk.metadata.set("wbr:scene-content:v1:lru", JSON.stringify({ [a.sha256]: 1 }));
    await readSceneAsset(a);
    expect(JSON.parse(disk.metadata.get("wbr:scene-content:v1:lru")!)[a.sha256]).toBeGreaterThan(1);
    await protectSceneAssets("one", [a]); await protectSceneAssets("two", [a]);
    await releaseSceneAssets("one");
    await maintainSceneCache({ clear: true });
    expect(await readSceneAsset(a)).not.toBeNull();
    await resetSceneCacheSession();
    expect((await maintainSceneCache({ clear: true })).bytes).toBe(0);
  });
  it("sweeps interrupted files on startup and reconciles OS-deleted files", async () => {
    const a = asset(disk.payload);
    const uri = await fetchSceneAsset(a, "https://cdn.test/a.glb", "a");
    disk.files.set("file:///cache/wbr-scene-content-v1/interrupted.part", disk.payload);
    disk.files.delete(uri);
    expect((await maintainSceneCache()).bytes).toBe(0);
    expect(disk.files.size).toBe(0);
    expect(await readSceneAsset(a)).toBeNull();
  });
  it("cancels a bridge request arriving after its cancel message", async () => {
    await cancelSceneAsset("early");
    await expect(fetchSceneAsset(asset(disk.payload), "https://cdn.test/a.glb", "early")).rejects.toThrow();
    expect(disk.downloads).toBe(0);
  });
  it("looks up cached files while a background download is stalled", async () => {
    const cachedAsset = asset(disk.payload);
    const uri = await fetchSceneAsset(
      cachedAsset,
      "https://cdn.test/model.glb",
      "cached",
    );
    disk.payload = new TextEncoder().encode("next version");
    disk.hold = true;
    const download = fetchSceneAsset(
      asset(disk.payload),
      "https://cdn.test/new.glb",
      "background",
    );
    const rejection = expect(download).rejects.toThrow();
    await vi.waitFor(() => expect(disk.downloads).toBe(2));
    expect(await readSceneAsset(cachedAsset)).toBe(uri);
    expect(await readSceneAsset(asset(disk.payload))).toBeNull();
    expect(disk.downloads).toBe(2);
    await cancelSceneAsset("background");
    await rejection;
  });
  it("shares a hash-addressed file across concurrent requests and isolates metadata", async () => {
    const a = asset(disk.payload);
    const [one, two] = await Promise.all([
      fetchSceneAsset(a, "https://cdn.test/model.glb", "one"),
      fetchSceneAsset(a, "https://cdn.test/model.glb", "two"),
    ]);
    expect(one).toBe(two);
    expect(one).toMatch(/^file:/);
    expect(disk.downloads).toBe(1);
    await writeContentHistory("scene", [{ revision: "one" }]);
    expect(await readContentHistory("scene")).toEqual([{ revision: "one" }]);
    expect(disk.metadata.has("cyber-bless:personal:v1")).toBe(false);
  });
  it("rejects corrupted and partial downloads without exposing a final URI", async () => {
    const a = asset(disk.payload);
    disk.payload = new TextEncoder().encode("corrupt data");
    await expect(
      fetchSceneAsset(a, "https://cdn.test/model.glb", "bad"),
    ).rejects.toThrow();
    expect([...disk.files.keys()].some((key) => key.endsWith(a.sha256))).toBe(
      false,
    );
    disk.fail = true;
    await expect(
      fetchSceneAsset(
        asset(disk.payload),
        "https://cdn.test/model.glb",
        "partial",
      ),
    ).rejects.toThrow();
    await Promise.resolve();
    expect(disk.files.size).toBe(0);
  });
  it("cancels active downloads and allows the queue to continue", async () => {
    disk.hold = true;
    const pending = fetchSceneAsset(
      asset(disk.payload),
      "https://cdn.test/model.glb",
      "held",
    );
    await vi.waitFor(() => expect(disk.downloads).toBe(1));
    const rejection = expect(pending).rejects.toThrow();
    await cancelSceneAsset("held");
    await rejection;
    expect(disk.paused).toBe(true);
    disk.hold = false;
    await expect(
      fetchSceneAsset(
        asset(disk.payload),
        "https://cdn.test/model.glb",
        "next",
      ),
    ).resolves.toMatch(/^file:/);
  });
  it("bounds cached files with LRU eviction and repairs malformed LRU metadata", async () => {
    disk.metadata.set("wbr:scene-content:v1:lru", "null");
    for (let i = 0; i < 3; i++) {
      disk.payload = new Uint8Array(400000).fill(i);
      await fetchSceneAsset(
        asset(disk.payload),
        "https://cdn.test/model.glb",
        String(i),
      );
    }
    expect(disk.files.size).toBe(2);
    expect(
      [...disk.files.values()].reduce(
        (sum, bytes) => sum + bytes.byteLength,
        0,
      ),
    ).toBeLessThanOrEqual(1024 * 1024);
  });
});
