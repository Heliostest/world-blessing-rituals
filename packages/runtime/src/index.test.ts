import { afterEach, expect, it, vi } from "vitest";
import { browserHost, createStore } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("offers haptics only where the browser can vibrate", async () => {
  const vibrate = vi.fn(() => true);
  vi.stubGlobal("navigator", { vibrate });
  const host = browserHost();
  expect(host.haptic).toBeTypeOf("function");
  await host.haptic!();
  expect(vibrate).toHaveBeenCalledWith(12);
  // iOS Safari: no Vibration API, so no haptic for the App to offer.
  vi.stubGlobal("navigator", {});
  expect(browserHost().haptic).toBeUndefined();
  vi.stubGlobal("navigator", undefined);
  expect(browserHost().haptic).toBeUndefined();
});

it("preserves corrupt data and blocks writes until it can load", async () => {
  const writes: string[] = [];
  const store = createStore({
    read: async () => "{bad",
    write: async (raw) => {
      writes.push(raw);
    },
  });
  await store.load();
  expect(store.getSnapshot().status).toBe("load-error");
  expect(() =>
    store.dispatch({ type: "settings", key: "sound", value: false }),
  ).toThrow();
  expect(writes).toHaveLength(0);
});
it("serializes rapid saves and retries the latest snapshot after failure", async () => {
  const writes: string[] = [];
  let fail = true;
  const store = createStore({
    read: async () => null,
    write: async (raw) => {
      if (fail) throw new Error("full");
      writes.push(raw);
    },
  });
  await store.load();
  store.dispatch({ type: "settings", key: "sound", value: false });
  await store.flush();
  expect(store.getSnapshot().status).toBe("save-error");
  fail = false;
  store.dispatch({ type: "settings", key: "haptics", value: false });
  await store.flush();
  expect(store.getSnapshot().status).toBe("saved");
  expect(JSON.parse(writes.at(-1)!).settings).toMatchObject({
    sound: false,
    haptics: false,
  });
});
it("gives a brand-new save the initial settings, and leaves a saved one alone", async () => {
  const fresh = createStore(
    { read: async () => null, write: async () => {} },
    () => ({ reducedMotion: true }),
  );
  await fresh.load();
  expect(fresh.getSnapshot().state?.settings.reducedMotion).toBe(true);

  const raw = JSON.stringify({ ...fresh.getSnapshot().state, settings: { sound: true, haptics: true, reducedMotion: false } });
  const saved = createStore(
    { read: async () => raw, write: async () => {} },
    () => ({ reducedMotion: true }),
  );
  await saved.load();
  expect(saved.getSnapshot().state?.settings.reducedMotion).toBe(false);
});
