import { describe, expect, it, vi } from "vitest";
import {
  createContentClient,
  parsePack,
  sha256,
  DEFAULT_PARAMETERS,
  InvalidContentError,
  type Pack,
  type ContentIO,
} from "./index";
const data = new TextEncoder().encode("test model").buffer;
const pack = (revision = "one"): Pack => ({
  schemaVersion: 1,
  sceneId: "woodfish",
  revision,
  engine: "woodfish@1",
  renderStyle: "original",
  model: { path: "model.glb", bytes: data.byteLength, sha256: sha256(data) },
  bindings: { body: "WoodfishBody", mallet: "Mallet" },
  parameters: structuredClone(DEFAULT_PARAMETERS),
  copy: { instruction: "轻点敲一下" },
});
const legacyPack = (revision = "one") => {
  const { renderStyle: _renderStyle, ...legacy } = pack(revision);
  return legacy;
};
const candidate = (revision: string) => ({
  pack: legacyPack(revision),
  base: "https://cdn.test/",
});
function setup() {
  let history: unknown = [];
  const cache = new Map<string, ArrayBuffer>();
  const io: ContentIO = {
    readHistory: async () => history,
    writeHistory: vi.fn(async (_key, value) => {
      history = value;
    }),
    readManifest: vi.fn(async () => pack()),
    readCachedAsset: vi.fn(async (a) => cache.get(a.sha256)),
    readAsset: vi.fn(async (a) => {
      cache.set(a.sha256, data);
      return data;
    }),
  };
  const client = createContentClient({
    io,
    bundled: pack("bundled"),
    bundledBase: "https://app.test/",
    manifestUrl: "https://cdn.test/woodfish.json",
  });
  return {
    io,
    client,
    cache,
    history: () => history as any,
    setHistory: (value: unknown) => {
      history = value;
    },
  };
}
describe("content contract", () => {
  it("defaults old packs to the original render style", () => {
    expect(parsePack(legacyPack()).renderStyle).toBe("original");
  });
  it("accepts only the approved render styles", () => {
    for (const renderStyle of ["toon-ink", "toon-soft"] as const)
      expect(parsePack({ ...pack(), renderStyle }).renderStyle).toBe(
        renderStyle,
      );
    for (const renderStyle of ["toon-custom", "<script>", {}])
      expect(() => parsePack({ ...pack(), renderStyle })).toThrow();
  });
  it("changes the normalized fingerprint input for a style-only update", () => {
    const original = parsePack(legacyPack());
    const ink = parsePack({ ...pack(), renderStyle: "toon-ink" });
    expect(ink.model.sha256).toBe(original.model.sha256);
    expect(
      sha256(new TextEncoder().encode(JSON.stringify(ink)).buffer),
    ).not.toBe(
      sha256(new TextEncoder().encode(JSON.stringify(original)).buffer),
    );
  });
  it("rejects code, rules, paths, incompatible engines and unsafe parameters", () => {
    expect(parsePack(pack()).revision).toBe("one");
    for (const bad of [
      { ...pack(), engine: "downloaded-js@1" },
      { ...pack(), schemaVersion: 99 },
      { ...pack(), script: "alert(1)" },
      { ...pack(), reward: 999 },
      { ...pack(), model: { ...pack().model, path: "../secret.glb" } },
      { ...pack(), model: { ...pack().model, bytes: 100 * 1024 * 1024 } },
      { ...pack(), parameters: { ...DEFAULT_PARAMETERS, headRadius: NaN } },
    ])
      expect(() => parsePack(bad)).toThrow();
  });
});
describe("local-first content", () => {
  it("uses old confirmed cache without checking the server", async () => {
    const s = setup();
    s.setHistory([candidate("old")]);
    s.cache.set(pack().model.sha256, data);
    expect((await s.client.load(async () => true)).pack.revision).toBe("old");
    expect(s.io.readManifest).not.toHaveBeenCalled();
    expect(s.io.readAsset).not.toHaveBeenCalled();
  });
  it("uses bootstrap immediately if cached files were evicted", async () => {
    const s = setup();
    s.setHistory([candidate("old")]);
    expect((await s.client.load(async () => true)).pack.revision).toBe(
      "bundled",
    );
    expect(s.io.readManifest).not.toHaveBeenCalled();
    expect(s.io.readAsset).toHaveBeenCalledExactlyOnceWith(
      pack("bundled").model,
      "https://app.test/model.glb",
      undefined,
    );
  });
  it("retries a confirmed package after a transient host initialization failure", async () => {
    const s = setup();
    s.setHistory([candidate("old")]);
    s.cache.set(pack().model.sha256, data);
    const failed = await s.client.load(async (p) => {
      if (p.revision === "old")
        throw new DOMException("Audio host suspended", "InvalidStateError");
      return true;
    });
    expect(failed.pack.revision).toBe("bundled");
    expect((await s.client.load(async () => true)).pack.revision).toBe("old");
  });
  it("requires durable cache writes and leaves previous pending content on quota failure", async () => {
    const s = setup();
    await s.client.prepareUpdate();
    const previous = s.history();
    s.io.readManifest = async () => pack("next");
    s.io.readAsset = vi.fn(async (_a, _url, _signal, required) => {
      if (required) throw new DOMException("Full", "QuotaExceededError");
      return data;
    });
    await s.client.prepareUpdate();
    expect(s.history()).toEqual(previous);
    expect(s.io.readAsset).toHaveBeenCalledWith(
      pack().model,
      "https://cdn.test/model.glb",
      undefined,
      true,
    );
  });
  it("stages content without changing a mounted lease or confirming it", async () => {
    const s = setup();
    const current = await s.client.load(async () => true);
    await s.client.prepareUpdate();
    expect(current.pack.revision).toBe("bundled");
    expect(s.history().pending.pack.revision).toBe("one");
    expect(s.history().confirmed).toEqual([]);
    const next = await s.client.load(async () => true);
    expect(next.pack.revision).toBe("one");
    expect(s.history().confirmed).toEqual([]);
    await next.confirm();
    await next.confirm();
    expect(s.history().confirmed[0].pack.revision).toBe("one");
    expect(s.history().pending).toBeUndefined();
  });
  it("isolates failed pending content and retains the last good model", async () => {
    const s = setup();
    s.setHistory([candidate("old")]);
    s.cache.set(pack().model.sha256, data);
    await s.client.prepareUpdate();
    const lease = await s.client.load(async (p) => {
      if (p.revision === "one") throw new InvalidContentError("bad mesh");
      return true;
    });
    expect(lease.pack.revision).toBe("old");
    expect(s.history().confirmed[0].pack.revision).toBe("old");
    await s.client.prepareUpdate();
    expect(s.history().pending).toBeUndefined();
  });
  it("does not stage partial or corrupt packages", async () => {
    const s = setup();
    const before = [candidate("old")];
    s.setHistory(before);
    s.io.readManifest = async () => ({
      ...pack(),
      sound: {
        path: "hit.wav",
        bytes: data.byteLength,
        sha256: "0".repeat(64),
      },
    });
    await s.client.prepareUpdate();
    expect(s.history()).toEqual(before);
  });
  it("keeps confirmed metadata while offline", async () => {
    const s = setup();
    const before = [candidate("old")];
    s.setHistory(before);
    s.io.readManifest = async () => {
      throw Error("offline");
    };
    await s.client.prepareUpdate();
    expect(s.history()).toEqual(before);
  });
  it("cancels before work starts and never stages an aborted transfer", async () => {
    const s = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      s.client.load(async () => true, { signal: controller.signal }),
    ).rejects.toThrow();
    await expect(
      s.client.prepareUpdate({ signal: controller.signal }),
    ).rejects.toThrow();
    expect(s.io.readManifest).not.toHaveBeenCalled();
    const active = new AbortController();
    s.io.readAsset = async () => {
      active.abort();
      return data;
    };
    await expect(
      s.client.prepareUpdate({ signal: active.signal }),
    ).rejects.toThrow();
    expect(s.io.writeHistory).not.toHaveBeenCalled();
  });
  it("coalesces refreshes and preserves confirmation during a download", async () => {
    const s = setup();
    s.setHistory([candidate("old")]);
    s.cache.set(pack().model.sha256, data);
    const old = await s.client.load(async () => true);
    let release!: () => void;
    s.io.readAsset = vi.fn(async () => {
      await new Promise<void>((r) => {
        release = r;
      });
      return data;
    });
    const a = s.client.prepareUpdate(),
      b = s.client.prepareUpdate();
    await vi.waitFor(() => expect(s.io.readAsset).toHaveBeenCalledTimes(1));
    await old.confirm();
    release();
    await Promise.all([a, b]);
    expect(s.io.readManifest).toHaveBeenCalledTimes(1);
    expect(s.history().pending.pack.revision).toBe("one");
    expect(s.history().confirmed[0].pack.revision).toBe("old");
  });
});
