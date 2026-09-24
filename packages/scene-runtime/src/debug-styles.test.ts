import { describe, expect, it } from "vitest";
import { createDebugStyles } from "./debug-styles";

describe("per-scene debug styles", () => {
  it("applies overrides independently, restores the latest content default, and detaches on disposal", () => {
    const store = createDebugStyles();
    store.enable();
    let woodfish = "", spring = "";
    const a = store.register("woodfish", "木鱼", (style) => { woodfish = style; });
    const b = store.register("spring", "泉", (style) => { spring = style; });
    a.setDefault("toon-soft");
    store.select("woodfish", "toon-ink");
    store.select("spring", "original");
    a.setDefault("original");
    expect(woodfish).toBe("toon-ink");
    expect(spring).toBe("original");
    store.select("woodfish", null);
    expect(woodfish).toBe("original");
    a.dispose();
    store.select("woodfish", "toon-soft");
    expect(woodfish).toBe("original");
    expect(store.getSnapshot().map((s) => s.id)).toEqual(["spring"]);
    b.dispose();
    expect(store.getSnapshot()).toEqual([]);
  });

  it("persists choices across mounts and reloads but never applies them without debug enabled", () => {
    let saved: string | null = null;
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const first = createDebugStyles();
    first.enable(storage);
    first.select("woodfish", "toon-ink");
    const second = createDebugStyles();
    let rendered = "";
    const registration = second.register("woodfish", "木鱼", (style) => { rendered = style; });
    registration.setDefault("toon-soft");
    expect(rendered).toBe("toon-soft");
    second.enable(storage);
    expect(rendered).toBe("toon-ink");
    registration.dispose();
    second.register("woodfish", "木鱼", (style) => { rendered = style; });
    expect(rendered).toBe("toon-ink");
  });

  it("ignores invalid stored presets and keeps live switching usable when storage is denied", () => {
    const store = createDebugStyles();
    store.enable({ getItem: () => '{"woodfish":"unknown","spring":"toon-soft"}', setItem: () => { throw Error("denied"); } });
    let rendered = "";
    store.register("woodfish", "木鱼", (style) => { rendered = style; });
    expect(rendered).toBe("original");
    store.select("woodfish", "toon-ink");
    expect(rendered).toBe("toon-ink");
    const denied = createDebugStyles();
    expect(() => denied.enable({ getItem: () => { throw Error("denied"); }, setItem() {} })).not.toThrow();
  });
});
