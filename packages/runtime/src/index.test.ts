import { afterEach, expect, it, vi } from "vitest";
import { dailyCollectibleId } from "@wbr/core";
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
it("keeps the collected keepsakes across a restart: saved on dispatch, restored on load", async () => {
  // One storage outliving the store, as localStorage / AsyncStorage outlive the App.
  let raw: string | null = null;
  const storage = {
    read: async () => raw,
    write: async (next: string) => {
      raw = next;
    },
  };
  const at = "2026-10-10T08:00:00.000Z";
  const first = createStore(storage);
  await first.load();
  for (const [day, sceneId, title, wishScene] of [
    ["2026-10-10", "tanzaku-tanabata", "短册系竹", true],
    ["2026-10-11", "woodfish", "敲一敲木鱼", false],
  ] as const)
    first.dispatch({
      type: "daily.scene",
      id: `visit-${day}`,
      sceneId,
      title,
      wishScene,
      day,
      startedAt: at,
      at,
    });
  first.dispatch({
    type: "collectible.spend",
    id: dailyCollectibleId("2026-10-10", "tanzaku-tanabata"),
    at,
  });
  await first.flush();
  const kept = first.getSnapshot().state!.collectibles;
  expect(kept).toHaveLength(2);
  expect(kept[0]).toMatchObject({ wishScene: true, spentAt: at });

  const second = createStore(storage);
  await second.load();
  expect(second.getSnapshot().status).toBe("saved");
  expect(second.getSnapshot().state!.collectibles).toEqual(kept);
});
