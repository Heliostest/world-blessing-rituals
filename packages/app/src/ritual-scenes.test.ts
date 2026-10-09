// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createState,
  dailyRitual,
  localDay,
  reduce,
  type RitualId,
  type State,
} from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { BlessingApp } from "./App";
import { Context, type AppContext } from "./context";
import { HISTORY_SCENE_LINE } from "./pages";
import {
  SCENE_RETURN_CTA,
  SCENE_RETURN_DONE_COPY,
} from "./scene-experience";
import {
  SceneLibraryContext,
  builtInScenes,
  useOpenRitual,
} from "./scene-library";
import { clickOn, renderUI, settle, typeInto } from "./dom-test-utils";

// The 3D scenes are not under test: keep the context the last one was given.
type Given = {
  progress?: number;
  checkpoint?(n: number): void;
  saveWish?(text: string): void;
};
const scene = vi.hoisted(() => ({ context: undefined as Given | undefined }));
vi.mock("@wbr/scene-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wbr/scene-runtime")>()),
  mountScene: (config: { context: Given; ready(): void }) => {
    scene.context = config.context;
    queueMicrotask(() => config.ready());
    const lifecycle = { setActive() {}, setReducedMotion() {}, dispose() {} };
    return {
      ...lifecycle,
      initialized: Promise.resolve(),
      controller: {
        ...lifecycle,
        strike() {},
        whenIdle: () => Promise.resolve(),
        movePointer() {},
        stopFollowing() {},
        inspect() {},
      },
    };
  },
}));

const AT = "2026-10-05T08:00:00.000Z";
const entryOf = (id: string) => builtInScenes.find((e) => e.id === id)!;

/** `state` with each named scene's record saved `progress` steps in. */
function withRecords(progress: Record<string, number>, state = createState()) {
  return {
    ...state,
    sceneRecords: Object.entries(progress).map(([id, n]) => {
      const { title, engine, revision, manifestUrl } = entryOf(id);
      return {
        id,
        title,
        engine,
        revision,
        manifestUrl,
        progress: n,
        favorite: false,
        lastOpened: AT,
      };
    }),
  };
}
/** A save holding w1, 面试顺利, already realized. */
function withRealizedWish(returnMethod: "kindness" | "ritual" = "ritual") {
  const state = reduce(createState(), {
    type: "wish.create",
    id: "w1",
    title: "面试顺利",
    intention: "",
    returnMethod,
    at: AT,
  });
  return reduce(state, { type: "wish.realize", id: "w1", at: AT });
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  scene.context = undefined;
});

/** The App on a memory host, loaded to 今日; `saved()` reads its last save. */
async function openApp(state: State) {
  let raw = JSON.stringify(state);
  const host = {
    read: async () => raw,
    write: async (next: string) => {
      raw = next;
    },
  };
  const ui = renderUI(createElement(BlessingApp, { host }));
  await settle();
  const all = (selector: string) => [...ui.host.querySelectorAll(selector)];
  return {
    ...ui,
    saved: async () => {
      await settle();
      return JSON.parse(raw) as State;
    },
    page: () => ui.host.querySelector<HTMLElement>(".app-shell")!.dataset.page,
    sceneTitle: () => ui.host.querySelector(".scene-experience h1")?.textContent,
    sceneProgress: () => ui.host.querySelector(".scene-progress")?.textContent,
    doneButtons: () =>
      all(".scene-done-row button").map((b) => b.textContent),
    /** The first button whose text includes `text`. */
    button: (text: string, within = "") =>
      all(`${within} button`).find((b) => b.textContent?.includes(text))!,
    /** Taps `el`, then lets the page that opens settle. */
    async tap(el: Element) {
      clickOn(el);
      await settle();
    },
    /** Walks the open procedural scene to its last step. */
    async walk() {
      for (const n of [1, 2, 3]) act(() => scene.context!.checkpoint!(n));
      await settle();
    },
  };
}

describe("今日's ritual entries", () => {
  it("开始今日仪式 opens the day's ritual as its 3D scene", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(".daily-card .button.primary")!);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf(dailyRitual(localDay())).title);
    ui.unmount();
  });

  it("opens each 成就 tile as its ritual's scene", async () => {
    const ui = await openApp(createState());
    for (const ritual of ["crane", "woodfish", "lantern"]) {
      await ui.tap(ui.host.querySelector(`.ritual-tile[data-scene="${ritual}"]`)!);
      expect(ui.page(), ritual).toBe("scene");
      expect(ui.sceneTitle(), ritual).toBe(entryOf(ritual).title);
      await ui.tap(ui.host.querySelector(".back-button")!);
    }
    ui.unmount();
  });

  it("starts a finished scene over, and picks a half-walked one up where it was", async () => {
    const ui = await openApp(withRecords({ crane: 3, lantern: 1, woodfish: 12 }));
    const tile = (id: string) =>
      ui.host.querySelector(`.ritual-tile[data-scene="${id}"]`)!;
    await ui.tap(tile("crane"));
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    expect(scene.context?.progress).toBe(0);
    await ui.tap(ui.host.querySelector(".back-button")!);
    await ui.tap(tile("lantern"));
    expect(ui.sceneProgress()).toBe("已完成 1 / 3");
    expect(scene.context?.progress).toBe(1);
    await ui.tap(ui.host.querySelector(".back-button")!);
    // The woodfish would otherwise stand disabled at 12.
    await ui.tap(tile("woodfish"));
    expect(ui.sceneProgress()).toBe("已完成 0 / 12");
    ui.unmount();
  });

  it("keeps a finished scene as it is when opened as a practice, not a ritual", async () => {
    const ui = await openApp(withRecords({ crane: 3 }));
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(
      ui.host.querySelector('.wish-practice-card[data-scene="crane"]')!,
    );
    expect(ui.sceneProgress()).toBe("已完成 3 / 3");
    ui.unmount();
  });

  it("leaves the resume banner on the 2D page, for a session begun there", async () => {
    const ui = await openApp({
      ...createState(),
      activeSession: { id: "s1", ritual: "crane", progress: 1, startedAt: AT },
    });
    await ui.tap(ui.host.querySelector(".resume-banner")!);
    expect(ui.page()).toBe("ritual");
    ui.unmount();
  });
});

describe("仪式时光", () => {
  it("names merit only where a ritual settled with it, and 再次体验 opens the scene afresh", async () => {
    // A 2D lantern settled with merit, then a crane walked as a scene for w1.
    let state: State = withRecords({ crane: 3 }, withRealizedWish());
    state = reduce(state, { type: "ritual.start", id: "r2d", ritual: "lantern", at: AT });
    for (let i = 0; i < 3; i++) state = reduce(state, { type: "ritual.step" });
    state = reduce(state, { type: "ritual.finish", id: "r2d", at: AT });
    state = reduce(state, {
      type: "ritual.scene",
      id: "visit",
      ritual: "crane",
      wishId: "w1",
      startedAt: AT,
      at: AT,
    });
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="me"]')!);
    await ui.tap(ui.button("仪式时光", ".settings-card"));
    const lines = [...ui.host.querySelectorAll(".timeline li p")].map(
      (p) => p.textContent!,
    );
    // Newest first.
    expect(lines).toEqual([
      `${HISTORY_SCENE_LINE} · 为「面试顺利」记了一笔`,
      "功德 +10 · 收藏了暖心灯",
    ]);
    expect(() => assertSafeCopy(lines[0])).not.toThrow();

    await ui.tap(ui.button("再次体验", ".timeline li:first-child"));
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    ui.unmount();
  });
});

describe("还愿 through the crane scene", () => {
  it("folds from the start, counts for the wish without merit, and leads back to 来还个愿", async () => {
    // A half-folded crane, and a 2D woodfish session left open.
    const ui = await openApp({
      ...withRecords({ crane: 2 }, withRealizedWish()),
      activeSession: { id: "open", ritual: "woodfish", progress: 5, startedAt: AT },
    });
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
    await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
    expect(ui.page()).toBe("fulfill");
    // The open 2D session is not this ritual: no 继续未完成的仪式.
    const start = ui.button("去完成还愿小仪式", ".linked-ritual");
    expect(start.textContent).toBe("去完成还愿小仪式");
    expect(ui.host.textContent).not.toContain("继续未完成的仪式");

    await ui.tap(start);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    expect(scene.context?.progress).toBe(0);
    const forWish = ui.host.querySelector(".scene-caption")!.textContent!;
    expect(forWish).toBe("这一次，为「面试顺利」还愿。");
    expect(() => assertSafeCopy(forWish)).not.toThrow();

    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_RETURN_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_RETURN_CTA]);
    let saved = await ui.saved();
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]).toMatchObject({
      ritual: "crane",
      wishId: "w1",
      progress: 4,
    });
    expect(saved.wishes[0].notes.map((n) => n.text)).toEqual([
      "为这个心愿，折一只纸鹤",
    ]);
    expect(saved.ledger).toEqual([]);
    expect(saved.collectibles).toEqual([]);
    expect(saved.activeSession).toMatchObject({ id: "open", progress: 5 });

    await ui.tap(ui.button(SCENE_RETURN_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("fulfill");
    expect(ui.host.querySelector(".linked-ritual")?.textContent).toContain(
      "已为这个心愿完成小仪式",
    );
    typeInto(ui.host.querySelector("#return-note")!, "谢谢一直努力的自己");
    await ui.tap(ui.button("完成还愿", "form"));
    expect(ui.page()).toBe("collection");
    saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({
      status: "fulfilled",
      returnMethod: "ritual",
    });
    // The 如愿 badge is the only keepsake, and no merit was ever given.
    expect(saved.collectibles.map((c) => c.kind)).toEqual(["badge"]);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("keeps the wish on a crane scene already open lower in the stack", async () => {
    const ui = await openApp(createState());
    // 心愿 → the crane practice, whose wish box keeps a new wish…
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(
      ui.host.querySelector('.wish-practice-card[data-scene="crane"]')!,
    );
    act(() => scene.context!.saveWish!("面试顺利"));
    // …which comes true, to be fulfilled by ritual.
    await ui.tap(ui.button("去看看", ".scene-wish-saved"));
    expect(ui.page()).toBe("wish");
    await ui.tap(ui.button("我的心愿实现了"));
    expect(ui.page()).toBe("fulfill");
    await ui.tap(ui.host.querySelector('input[name="return-method"][value="ritual"]')!);
    // Back to the crane route below: it now carries the wish.
    await ui.tap(ui.button("去完成还愿小仪式"));
    expect(ui.page()).toBe("scene");
    expect(ui.host.querySelector(".scene-caption")?.textContent).toBe(
      "这一次，为「面试顺利」还愿。",
    );
    await ui.walk();
    expect(ui.doneButtons()).toEqual([SCENE_RETURN_CTA]);
    await ui.tap(ui.button(SCENE_RETURN_CTA));
    expect(ui.page()).toBe("fulfill");
    expect(ui.host.querySelector(".linked-ritual")?.textContent).toContain(
      "已为这个心愿完成小仪式",
    );
    ui.unmount();
  });
});

describe("useOpenRitual", () => {
  /** The hook as 今日 holds it, over `state` and a catalog of `entries`. */
  function opener(state: State, entries: CatalogEntry[] = builtInScenes) {
    const go = vi.fn();
    const dispatch = vi.fn(() => true);
    let open!: ReturnType<typeof useOpenRitual>;
    function Probe() {
      open = useOpenRitual();
      return null;
    }
    renderToStaticMarkup(
      createElement(
        Context.Provider,
        { value: { state, go, dispatch } as unknown as AppContext },
        createElement(
          SceneLibraryContext.Provider,
          { value: { entries } as never },
          createElement(Probe),
        ),
      ),
    );
    return { open, go, dispatch };
  }
  const reset = (id: RitualId) => ({ type: "scene.progress", id, progress: 0 });

  it("opens the scene as it stands, unless it is done", () => {
    const fresh = opener(createState());
    fresh.open("lantern");
    expect(fresh.dispatch).not.toHaveBeenCalled();
    expect(fresh.go).toHaveBeenCalledWith({
      page: "scene",
      id: "lantern",
      entry: entryOf("lantern"),
      wishId: undefined,
    });
    const half = opener(withRecords({ woodfish: 11 }));
    half.open("woodfish");
    expect(half.dispatch).not.toHaveBeenCalled();
    const done = opener(withRecords({ woodfish: 12 }));
    done.open("woodfish");
    expect(done.dispatch).toHaveBeenCalledWith(reset("woodfish"));
  });

  it("starts a 还愿 visit at 0, even half-walked", () => {
    const { open, go, dispatch } = opener(withRecords({ crane: 1 }));
    open("crane", "w1");
    expect(dispatch).toHaveBeenCalledWith(reset("crane"));
    expect(go).toHaveBeenCalledWith(
      expect.objectContaining({ page: "scene", id: "crane", wishId: "w1" }),
    );
  });

  it("falls back to the 2D page only when the catalog has no playable scene", () => {
    const without = opener(
      createState(),
      builtInScenes.filter((e) => e.id !== "crane"),
    );
    without.open("crane", "w1");
    expect(without.go).toHaveBeenCalledWith({
      page: "ritual",
      id: "crane",
      wishId: "w1",
    });
    const newer = opener(createState(), [
      { ...entryOf("lantern"), engine: "lantern@9" },
    ]);
    newer.open("lantern");
    expect(newer.go).toHaveBeenCalledWith(
      expect.objectContaining({ page: "ritual", id: "lantern" }),
    );
    expect(newer.dispatch).not.toHaveBeenCalled();
  });
});

describe("ritual scene copy", () => {
  it("keeps the 还愿 lines and the 仪式时光 line safe", () => {
    for (const text of [
      SCENE_RETURN_DONE_COPY,
      SCENE_RETURN_CTA,
      HISTORY_SCENE_LINE,
      "去完成还愿小仪式",
    ])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});
