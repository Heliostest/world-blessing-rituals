// @vitest-environment jsdom
import { act, createElement, useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, reduce, restore, type Action } from "@wbr/core";
import { createStore } from "@wbr/runtime";
import { WISH_WRITE_COPY } from "@wbr/gestures";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { builtInScenes, SceneLibraryContext } from "./scene-library";
import { SceneExperience } from "./scene-experience";
import { sceneWish } from "./scene-wish";
import { clickOn, renderUI, settle } from "./dom-test-utils";

// The 3D scene is not under test: keep the context it would be given.
type Given = { saveWish?(text: string): void };
const scene = vi.hoisted(() => ({ context: undefined as Given | undefined }));
vi.mock("@wbr/scene-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wbr/scene-runtime")>()),
  mountScene: (config: { context: Given; ready(): void }) => {
    scene.context = config.context;
    queueMicrotask(() => config.ready());
    return {
      setActive() {},
      setReducedMotion() {},
      dispose() {},
      controller: null,
      initialized: Promise.resolve(),
    };
  },
}));

const AT = "2026-10-05T08:00:00.000Z";

describe("sceneWish", () => {
  it("makes the trimmed line a new 生活 wish that notes its scene", () => {
    expect(sceneWish("  希望家人平安  ", "crane", "w1", AT)).toEqual({
      type: "wish.create",
      id: "w1",
      title: "希望家人平安",
      intention: "",
      category: "life",
      sourceSceneId: "crane",
      at: AT,
    });
  });

  it("keeps nothing for a blank line", () => {
    expect(sceneWish(" \n ", "crane", "w1", AT)).toBeUndefined();
  });

  it("keeps all of a line longer than a title as its intention", () => {
    const line = "愿".repeat(70);
    const wish = sceneWish(line, "lantern", "w1", AT)!;
    expect(wish.title).toBe("愿".repeat(60));
    expect(wish.intention).toBe(line);
    expect(reduce(createState(), wish).wishes[0].intention).toBe(line);
  });

  it("says so in safe copy", () => {
    for (const text of [WISH_WRITE_COPY.note, WISH_WRITE_COPY.saved])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});

describe("a line written in a scene", () => {
  afterEach(() => {
    document.body.replaceChildren();
    scene.context = undefined;
  });

  /** Opens a bundled scene in an App backed by the real store. */
  async function open(sceneId: string, saved: string) {
    const writes: string[] = [];
    const store = createStore({
      read: async () => saved,
      write: async (raw) => {
        writes.push(raw);
      },
    });
    await store.load();
    const go = vi.fn();
    const entry = builtInScenes.find((e) => e.id === sceneId)!;
    // Stable, like the provider's memoized library.
    const library = { library: {}, ready: true } as never;
    function Harness() {
      const { state } = useSyncExternalStore(store.subscribe, store.getSnapshot);
      const value = {
        state: state!,
        go,
        back() {},
        active: true,
        canHaptic: false,
        feedback() {},
        haptic() {},
        prepareFeedback() {},
        decodeSound: vi.fn(),
        fulfillmentDrafts: {},
        setFulfillmentDraft() {},
        dispatch(action: Action) {
          try {
            const before = store.getSnapshot().state;
            store.dispatch(action);
            return store.getSnapshot().state !== before;
          } catch {
            return false;
          }
        },
      } as AppContext;
      return createElement(
        Context.Provider,
        { value },
        createElement(
          SceneLibraryContext.Provider,
          { value: library },
          createElement(SceneExperience, { entry }),
        ),
      );
    }
    const ui = renderUI(createElement(Harness));
    await settle();
    const write = (text: string) =>
      act(() => {
        scene.context!.saveWish!(text);
      });
    return {
      ...ui,
      store,
      go,
      writes,
      write,
      status: () => ui.host.querySelector(".scene-wish-saved[role=status]")!,
      wishes: () => store.getSnapshot().state!.wishes,
    };
  }

  it("is kept as a new wish beside an existing one, never over it, with 已存进心愿", async () => {
    // Opening a scene from a wish's page passes no wish along: the same case.
    const before = reduce(createState(), {
      type: "wish.create",
      id: "old",
      title: "旧的心愿",
      intention: "每天一点",
      at: AT,
    });
    const s = await open("crane", JSON.stringify(before));
    expect(scene.context?.saveWish).toBeTypeOf("function");
    expect(s.status().textContent).toBe("");

    s.write("  希望家人平安  ");
    expect(s.wishes()).toHaveLength(2);
    const [kept, old] = s.wishes();
    expect(old).toEqual(before.wishes[0]);
    expect(kept).toMatchObject({
      title: "希望家人平安",
      intention: "",
      category: "life",
      sourceSceneId: "crane",
      status: "active",
      notes: [],
    });
    expect(kept.id).not.toBe("old");

    expect(s.status().textContent).toContain(WISH_WRITE_COPY.saved);
    clickOn(
      [...s.status().querySelectorAll("button")].find(
        (b) => b.textContent === "去看看",
      )!,
    );
    expect(s.go).toHaveBeenCalledWith({ page: "wish", id: kept.id });

    // Saved on the device, for 心愿 to list.
    await s.store.flush();
    expect(restore(s.writes.at(-1)!).wishes[0]).toMatchObject({
      id: kept.id,
      sourceSceneId: "crane",
    });
    s.unmount();
  });

  it("keeps nothing for a blank line; each line written is its own wish", async () => {
    const s = await open("lantern", JSON.stringify(createState()));
    s.write("   ");
    expect(s.wishes()).toHaveLength(0);
    expect(s.status().textContent).toBe("");
    s.write("愿一");
    s.write("愿二");
    expect(s.wishes().map((w) => [w.title, w.sourceSceneId])).toEqual([
      ["愿二", "lantern"],
      ["愿一", "lantern"],
    ]);
    expect(new Set(s.wishes().map((w) => w.id)).size).toBe(2);
    s.unmount();
  });
});
