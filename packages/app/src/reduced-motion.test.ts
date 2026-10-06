// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "@wbr/runtime";
import { followSystemReducedMotion, initialSettings } from "./reduced-motion";

/** A system reduced-motion preference the test can flip. */
function stubSystem(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
  };
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    listeners,
    set(value: boolean) {
      query.matches = value;
      listeners.forEach((fn) => fn());
    },
  };
}

function memoryStore(saved: string | null = null) {
  const writes: string[] = [];
  const store = createStore(
    {
      read: async () => saved,
      write: async (raw) => {
        writes.push(raw);
      },
    },
    initialSettings,
  );
  return { store, writes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("system reduced motion", () => {
  it("starts a new save with 减少动态效果 on when the system asks for it", async () => {
    const system = stubSystem(true);
    const { store } = memoryStore();
    await store.load();
    expect(system.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
    );
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(true);
  });

  it("starts it off when the system does not, or cannot say", async () => {
    stubSystem(false);
    expect(initialSettings()).toEqual({ reducedMotion: false });
    vi.unstubAllGlobals();
    vi.stubGlobal("matchMedia", undefined);
    expect(initialSettings()).toEqual({ reducedMotion: false });
    const { store } = memoryStore();
    await store.load();
    expect(followSystemReducedMotion(store)).toBeTypeOf("function");
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(false);
  });

  it("keeps the choice in a save", async () => {
    stubSystem(true);
    const { store: first } = memoryStore();
    await first.load();
    first.dispatch({ type: "settings", key: "reducedMotion", value: false });
    const { store } = memoryStore(JSON.stringify(first.getSnapshot().state));
    await store.load();
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(false);
  });

  it("follows the system while the App is open, until stopped", async () => {
    const system = stubSystem(false);
    const { store, writes } = memoryStore();
    await store.load();
    const stop = followSystemReducedMotion(store);
    system.set(true);
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(true);
    await store.flush();
    expect(JSON.parse(writes.at(-1)!).settings.reducedMotion).toBe(true);
    system.set(false);
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(false);
    stop();
    expect(system.listeners.size).toBe(0);
    system.set(true);
    expect(store.getSnapshot().state?.settings.reducedMotion).toBe(false);
  });

  it("waits for the save to load before following", () => {
    const system = stubSystem(false);
    const { store, writes } = memoryStore();
    followSystemReducedMotion(store);
    expect(() => system.set(true)).not.toThrow();
    expect(writes).toHaveLength(0);
  });
});
