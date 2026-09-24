import { describe, expect, it } from "vitest";
import { createSceneLibrary, parseCatalog, type SceneManifest } from "./catalog";
import { sha256, type ContentIO } from "./index";

function setup() {
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const manifest: SceneManifest = { schemaVersion: 1, sceneId: "spring", engine: "spring@1", revision: "v1", assets: { config: { path: "shared.json", bytes: 3, sha256: sha256(bytes) } }, config: {} };
  const entry = { id: "spring", title: "Spring", engine: "spring@1", revision: "v1", manifestUrl: "https://cdn.test/spring-v1.json" };
  const metadata = new Map<string, unknown>(), files = new Map<string, ArrayBuffer>();
  let transfers = 0, manifests = 0, offline = false;
  const protectedOwners = new Set<string>();
  const io: ContentIO = {
    cache: { protect: async owner => { protectedOwners.add(owner); }, release: async owner => { protectedOwners.delete(owner); }, maintain: async () => ({ bytes: 0, budget: 100, protectedBytes: 0, reservedBytes: 0, overBudget: false, entries: [] }) },
    readHistory: async key => metadata.get(key), writeHistory: async (key, value) => { metadata.set(key, value); },
    readManifest: async url => { manifests++; if (offline) throw Error("offline"); return url.includes("catalog") ? { schemaVersion: 1, scenes: Array.from({length: 500}, (_, n) => ({ ...entry, id: `s${n}` })) } : manifest; },
    readCachedAsset: async a => files.get(a.sha256),
    readAsset: async a => { transfers++; if (offline) throw Error("offline"); files.set(a.sha256, bytes); return bytes; },
  };
  const make = () => createSceneLibrary({ io, supports: engine => engine === "spring@1" });
  return { entry, manifest, io, make, files, protectedOwners, library: make(), transfers: () => transfers, manifests: () => manifests, offline: () => { offline = true; } };
}
describe("on-demand scene library", () => {
  it("lists 500 metadata entries and recommends without downloading dependencies or manifests", async () => {
    const s = setup();
    const catalog = await s.library.catalog("https://cdn.test/catalog.json");
    expect(catalog).toHaveLength(500);
    expect(s.transfers()).toBe(0); expect(s.manifests()).toBe(1);
  });
  it("downloads on first open, hits cache on reopen, repairs evicted historical assets after restart", async () => {
    const s = setup();
    let lease = await s.library.open(s.entry); await lease.release();
    lease = await s.library.open(s.entry); await lease.release();
    expect(s.transfers()).toBe(1);
    s.files.clear();
    lease = await s.make().open(s.entry); await lease.release();
    expect(s.transfers()).toBe(2);
    expect(s.manifests()).toBe(1);
    expect(s.protectedOwners.size).toBe(0);
  });
  it("opens saved complete content offline but reports an evicted offline scene as failure", async () => {
    const s = setup();
    const first = await s.library.open(s.entry); await first.release(); s.offline();
    const offline = await s.make().open(s.entry); await offline.release();
    s.files.clear();
    await expect(s.library.open(s.entry)).rejects.toThrow("offline");
    expect(s.protectedOwners.size).toBe(0);
  });
  it("rejects unsupported engines before downloads and validates identity and bounded paths", async () => {
    const s = setup();
    await expect(s.library.open({ ...s.entry, engine: "future@1" })).rejects.toThrow(/upgrade/i);
    expect(s.manifests()).toBe(0);
    await expect(s.library.open({ ...s.entry, id: "other" })).rejects.toThrow(/identity/i);
    expect(s.transfers()).toBe(0);
    expect(() => parseCatalog({ schemaVersion: 1, scenes: [{ ...s.entry, manifestUrl: "javascript:alert(1)" }] }, "https://cdn.test/catalog.json")).toThrow();
  });
  it("does not publish ready on cancellation and releases the whole dependency lease", async () => {
    const s = setup(), cancel = new AbortController();
    s.io.readAsset = async () => { cancel.abort(); return new Uint8Array([1, 2, 3]).buffer; };
    await expect(s.library.open(s.entry, { signal: cancel.signal })).rejects.toThrow();
    expect(s.protectedOwners.size).toBe(0);
  });
});
