import { describe, expect, it } from "vitest";
import { createAssetCache, type CacheDriver } from "./cache";
import { sha256, type Asset } from "./index";

function setup() {
  const files = new Map<string, { bytes: ArrayBuffer; used: number }>();
  let transfers = 0, offline = false, failWrite = false;
  const data = (n: number) => new Uint8Array(4).fill(n).buffer;
  const asset = (n: number): Asset => ({ path: `${n}.glb`, bytes: 4, sha256: sha256(data(n)) });
  const driver: CacheDriver<ArrayBuffer> = {
    list: async () => [...files].map(([key, v]) => ({ key, size: v.bytes.byteLength, used: v.used })),
    read: async (a) => files.get(a.sha256)?.bytes,
    touch: async (key, used) => { const f = files.get(key); if (f) f.used = used; },
    remove: async (key) => { files.delete(key); },
    download: async (a, url, signal) => {
      transfers++;
      if (offline) throw Error("offline");
      if (failWrite) throw Error("disk full");
      signal?.throwIfAborted();
      const bytes = data(Number(url));
      files.set(a.sha256, { bytes, used: 0 });
      return bytes;
    },
  };
  let tick = 0;
  const make = () => createAssetCache(driver, { budget: 8, now: () => ++tick });
  return { files, asset, make, cache: make(), transfers: () => transfers, offline: () => { offline = true; }, fail: () => { failWrite = true; } };
}
describe("shared disposable cache", () => {
  it("promptly releases a cancelled queued reservation while another transfer is stalled", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    const a: Asset = { path: "a.glb", bytes: 4, sha256: "a".repeat(64) };
    const b: Asset = { ...a, sha256: "b".repeat(64) }, c: Asset = { ...a, sha256: "c".repeat(64) };
    const cache = createAssetCache({ list: async () => [], read: async () => undefined, touch: async () => {}, remove: async () => {}, download: async () => { await waiting; return "uri"; } }, { budget: 8 });
    const one = cache.fetch(a, "a");
    await new Promise(resolve => setTimeout(resolve, 5));
    const abort = new AbortController(), two = cache.fetch(b, "b", abort.signal);
    const caught = two.catch(() => "cancelled");
    await new Promise(resolve => setTimeout(resolve, 5));
    abort.abort();
    const result = await Promise.race([caught, new Promise(resolve => setTimeout(() => resolve("still queued"), 30))]);
    // Always unblock the external transport, even on an assertion failure.
    try {
      expect(result).toBe("cancelled");
      await cache.protect("new scene", [c]);
      expect((await cache.maintain()).reservedBytes).toBe(8);
    } finally { finish(); await one; await caught; }
  });
  it("touches ordinary hits, evicts oldest, and re-downloads after restart", async () => {
    const s = setup();
    await s.cache.fetch(s.asset(1), "1");
    await s.cache.fetch(s.asset(2), "2");
    await s.cache.read(s.asset(1));
    await s.cache.fetch(s.asset(3), "3");
    expect(s.files.has(s.asset(1).sha256)).toBe(true);
    expect(s.files.has(s.asset(2).sha256)).toBe(false);
    await s.make().fetch(s.asset(2), "2");
    expect(s.transfers()).toBe(4);
    expect((await s.cache.maintain()).bytes).toBe(8);
  });
  it("reserves a whole pack, protects shared references, refuses impossible downloads", async () => {
    const s = setup(), a = s.asset(1), b = s.asset(2);
    await s.cache.protect("scene-a", [a, b]);
    await s.cache.protect("scene-b", [a]);
    await s.cache.fetch(a, "1");
    await s.cache.fetch(b, "2");
    await expect(s.cache.fetch(s.asset(3), "3")).rejects.toThrow(/budget/i);
    expect(s.transfers()).toBe(2);
    await s.cache.release("scene-a");
    await s.cache.maintain({ clear: true });
    expect([...s.files.keys()]).toEqual([a.sha256]);
    await s.cache.release("scene-b");
    expect((await s.cache.maintain({ clear: true })).bytes).toBe(0);
  });
  it("deduplicates concurrent transfers and does not delete protected files when budget shrinks", async () => {
    const s = setup(), a = s.asset(1);
    await s.cache.protect("active", [a]);
    await Promise.all([s.cache.fetch(a, "1"), s.cache.fetch(a, "1")]);
    expect(s.transfers()).toBe(1);
    const stats = await s.cache.maintain({ budget: 2 });
    expect(stats.bytes).toBe(4);
    expect(stats.protectedBytes).toBe(4);
    expect(stats.overBudget).toBe(true);
    await s.cache.release("active");
    expect((await s.cache.maintain()).bytes).toBe(0);
  });
  it("preserves offline hits and releases failed/cancelled reservations", async () => {
    const s = setup();
    await s.cache.fetch(s.asset(1), "1");
    s.offline();
    expect(await s.cache.fetch(s.asset(1), "1")).toBeDefined();
    await expect(s.cache.fetch(s.asset(2), "2")).rejects.toThrow("offline");
    const controller = new AbortController(); controller.abort();
    await expect(s.cache.fetch(s.asset(2), "2", controller.signal)).rejects.toThrow();
    expect((await s.cache.maintain({ clear: true })).bytes).toBe(0);
    const full = setup(); full.fail();
    await expect(full.cache.fetch(full.asset(1), "1")).rejects.toThrow("disk full");
    expect((await full.cache.maintain()).protectedBytes).toBe(0);
  });
});
