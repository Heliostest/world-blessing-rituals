// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createState,
  dailyCollectibleId,
  localDay,
  reduce,
  type State,
} from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { BlessingApp } from "./App";
import { Context, type AppContext } from "./context";
import { HISTORY_SCENE_LINE } from "./pages";
import {
  SCENE_DAILY_CAPTION,
  SCENE_DAILY_CTA,
  SCENE_DISCARD_CTA,
  SCENE_DISCARDED_COPY,
  SCENE_DONE_COPY,
  SCENE_DONE_CTA,
  SCENE_DONE_WISH_CTA,
  SCENE_KEEP_CTA,
  SCENE_KEEP_QUESTION,
  SCENE_RETURN_CTA,
  SCENE_RETURN_DONE_COPY,
  SCENE_VESSEL_DONE_COPY,
  sceneDailyAnnounce,
  sceneDailyDoneCopy,
} from "./scene-experience";
import {
  SceneLibraryContext,
  builtInScenes,
  useOpenScene,
  useOpenRitual,
} from "./scene-library";
import { dailyPrimaryScene, isWishScene } from "./scene-placement";
import { FULFILL_VESSEL_COPY, VESSEL_COPY } from "./vessels";
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
const DAY = localDay();
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
/** One collected daily keepsake for `sceneId`, spent for a wish when `spent`. */
function keepsake(sceneId: string, day: string, spent?: string) {
  return {
    id: dailyCollectibleId(day, sceneId),
    kind: "scene" as const,
    title: entryOf(sceneId).title,
    at: `${day}T08:00:00.000Z`,
    sceneId,
    ...(isWishScene(sceneId) ? { wishScene: true } : {}),
    ...(spent ? { spentAt: spent } : {}),
  };
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

describe("今日's daily set", () => {
  // A day whose main walk is a 许愿 scene, walked by its three checkpoints;
  // the App reads the day off the clock, so the clock is set to it.
  const WISH_DAY = Array.from(
    { length: 28 },
    (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
  ).find((d) => isWishScene(dailyPrimaryScene(builtInScenes, d)!.id))!;
  const sceneId = dailyPrimaryScene(builtInScenes, WISH_DAY)!.id;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${WISH_DAY}T12:00:00`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects the day's keepsake once: a walk, a sticker, a flight to 小天地", async () => {
    const ui = await openApp(createState());
    const card = ui.host.querySelector(
      `.daily-set-primary[data-scene="${sceneId}"]`,
    )!;
    await ui.tap(card);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf(sceneId).title);
    expect(ui.host.querySelector(".scene-caption")?.textContent).toBe(
      SCENE_DAILY_CAPTION,
    );

    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      sceneDailyDoneCopy(entryOf(sceneId).title),
    );
    expect(ui.doneButtons()).toEqual([SCENE_DAILY_CTA]);
    expect(
      ui.host.querySelector("[data-reward-sticker] .scene-art"),
    ).not.toBeNull();

    await ui.tap(ui.button(SCENE_DAILY_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("world");
    // The sticker landed on its new shelf slot.
    expect(
      ui.host.querySelector(
        `[data-collectible-id="${dailyCollectibleId(WISH_DAY, sceneId)}"]`,
      ),
    ).not.toBeNull();
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.collectibles[0]).toMatchObject({
      id: dailyCollectibleId(WISH_DAY, sceneId),
      kind: "scene",
      sceneId,
      wishScene: true,
    });
    expect(saved.ledger).toHaveLength(1);
    expect(saved.ledger[0].amount).toBe(10);
    ui.unmount();
  });

  it("settles the day only once: a second walk of the same scene collects nothing", async () => {
    const ui = await openApp(createState());
    await ui.tap(ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!);
    await ui.walk();
    await ui.tap(ui.button(SCENE_DAILY_CTA, ".scene-done-row"));
    await ui.tap(ui.host.querySelector('[data-tab="today"]')!);
    const card = ui.host.querySelector(`.daily-set-primary[data-scene="${sceneId}"]`)!;
    expect(card.querySelector("small")!.textContent!.trim()).toBe("今天已收下");
    // Today's keepsake joins the picks from 小天地 tomorrow, not today.
    expect(ui.host.querySelector(".daily-collected .daily-set-card")).toBeNull();
    await ui.tap(card);
    // A flagged visit starts the scene over.
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toHaveLength(1);
    expect(saved.ledger).toHaveLength(1);
    ui.unmount();
  });

  it("walks a pick from 小天地 again as a 回看: nothing collected, nothing spent", async () => {
    const kept = [
      keepsake("tanzaku-tanabata", "2026-09-30"),
      keepsake("furin-wind-chime", "2026-09-29"),
      keepsake("shinto-torii", "2026-09-28"),
    ];
    const ui = await openApp({ ...createState(), collectibles: kept });
    const picks = [...ui.host.querySelectorAll(".daily-collected .daily-set-card")];
    expect(picks.map((c) => c.getAttribute("data-scene")).sort()).toEqual(
      ["furin-wind-chime", "shinto-torii", "tanzaku-tanabata"],
    );
    await ui.tap(
      ui.host.querySelector('.daily-collected [data-scene="tanzaku-tanabata"]')!,
    );
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("tanzaku-tanabata").title);
    // Not the day's walk: no daily caption, and the plain done row.
    expect(ui.host.querySelector(".scene-caption")).toBeNull();
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.collectibles).toEqual(kept);
    expect(saved.ledger).toEqual([]);
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

describe("许愿 through a keepsake", () => {
  async function openVessel(sceneId: string, state = createState()) {
    state.collectibles.push(keepsake(sceneId, "2026-10-05"));
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    // 祈愿 unfolds the picker of 许愿小物 under the list.
    await ui.tap(ui.button(VESSEL_COPY.pray, ".app-content"));
    const card = ui.host.querySelector(
      `#vessel-picker .wish-practice-card[data-scene="${sceneId}"]`,
    )!;
    expect(card.querySelector("small")!.textContent).toBe(VESSEL_COPY.use);
    await ui.tap(card);
    expect(ui.page()).toBe("scene");
    // A 许愿 walk carries no caption: it is not for a wish.
    expect(ui.host.querySelector(".scene-caption")).toBeNull();
    return ui;
  }

  it("spends the keepsake by the walk, then keeps the line as a new 心愿", async () => {
    const ui = await openVessel("crane");
    act(() => scene.context!.saveWish!("面试顺利"));
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_VESSEL_DONE_COPY,
    );
    expect(ui.host.querySelector(".scene-keep-line")?.textContent).toBe(
      "「面试顺利」",
    );
    expect(ui.host.querySelector(".scene-keep-question")?.textContent).toBe(
      SCENE_KEEP_QUESTION,
    );
    expect(ui.doneButtons()).toEqual([SCENE_KEEP_CTA, SCENE_DISCARD_CTA]);
    // The keepsake is spent whichever way the line goes; no wish yet.
    let saved = await ui.saved();
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    expect(saved.wishes).toHaveLength(0);

    await ui.tap(ui.button(SCENE_KEEP_CTA, ".scene-done-row"));
    expect(ui.doneButtons()).toEqual([SCENE_DONE_WISH_CTA]);
    await ui.tap(ui.button(SCENE_DONE_WISH_CTA, ".scene-done-row"));
    expect(ui.page()).toBe("wishes");
    expect(ui.host.querySelector(".wish-card strong")?.textContent).toBe(
      "面试顺利",
    );
    saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ title: "面试顺利", status: "active" });
    ui.unmount();
  });

  it("keeps nothing when the line is not kept", async () => {
    const ui = await openVessel("tanzaku-tanabata");
    act(() => scene.context!.saveWish!("希望家人平安"));
    await ui.walk();
    await ui.tap(ui.button(SCENE_DISCARD_CTA, ".scene-done-row"));
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_DISCARDED_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_DONE_CTA]);
    const saved = await ui.saved();
    expect(saved.wishes).toHaveLength(0);
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    ui.unmount();
  });

  it("offers its own line for a scene with no wish box", async () => {
    const ui = await openVessel("yeondeunghoe");
    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_VESSEL_DONE_COPY,
    );
    typeInto(ui.host.querySelector("#scene-keep-line")!, "家人平安");
    await ui.tap(ui.host.querySelector(".scene-keep-form button[type='submit']")!);
    expect(ui.doneButtons()).toEqual([SCENE_DONE_WISH_CTA]);
    const saved = await ui.saved();
    expect(saved.wishes[0]).toMatchObject({ title: "家人平安" });
    expect(saved.collectibles[0]).toMatchObject({ spentAt: expect.any(String) });
    ui.unmount();
  });
});

describe("还愿 through a keepsake", () => {
  it("spends the keepsake for the wish: a note, no merit, the badge only", async () => {
    const state = withRecords({ crane: 2 }, withRealizedWish());
    state.collectibles.push(keepsake("crane", "2026-10-05"));
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
    await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
    expect(ui.page()).toBe("fulfill");
    expect(ui.host.querySelector(".linked-ritual")!.textContent).toContain(
      FULFILL_VESSEL_COPY.pick,
    );
    // The crane record stands half-walked: a 还愿 visit still starts at 0.
    await ui.tap(ui.host.querySelector('.vessel-card[data-scene="crane"]')!);
    expect(ui.page()).toBe("scene");
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
    expect(scene.context?.progress).toBe(0);
    expect(ui.host.querySelector(".scene-caption")!.textContent).toBe(
      "这一次，为「面试顺利」还愿。",
    );
    // A 还愿 walk keeps nothing from its box: the box says so itself.
    expect(scene.context?.saveWish).toBeUndefined();

    await ui.walk();
    expect(ui.host.querySelector(".scene-done")?.textContent).toBe(
      SCENE_RETURN_DONE_COPY,
    );
    expect(ui.doneButtons()).toEqual([SCENE_RETURN_CTA]);
    let saved = await ui.saved();
    // The vessel path leaves no session: the spent keepsake is the record.
    expect(saved.sessions).toHaveLength(0);
    expect(saved.collectibles[0]).toMatchObject({
      spentAt: expect.any(String),
      wishId: "w1",
    });
    expect(saved.wishes[0].notes.map((n) => n.text)).toEqual([
      "为这个心愿，折一只纸鹤",
    ]);
    expect(saved.ledger).toEqual([]);

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
    // The 如愿 badge joins the spent keepsake, and no merit was ever given.
    expect(saved.collectibles.map((c) => c.kind)).toEqual(["scene", "badge"]);
    expect(saved.ledger).toEqual([]);
    ui.unmount();
  });

  it("points back to 今日 when no keepsake is usable yet", async () => {
    const ui = await openApp(withRealizedWish());
    await ui.tap(ui.host.querySelector('[data-tab="wishes"]')!);
    await ui.tap(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
    await ui.tap(ui.button("来还个愿", ".wish-detail-page"));
    const linked = ui.host.querySelector(".linked-ritual")!;
    expect(linked.textContent).toContain(FULFILL_VESSEL_COPY.none);
    await ui.tap(ui.button(FULFILL_VESSEL_COPY.noneAction, ".linked-ritual"));
    expect(ui.page()).toBe("today");
    ui.unmount();
  });
});

describe("小天地's 回看", () => {
  it("reopens the collected scene from its start, and says where a spent keepsake went", async () => {
    const state = withRecords({ crane: 3 });
    state.collectibles.push(
      keepsake("crane", "2026-10-05", "2026-10-06T08:00:00.000Z"),
      keepsake("woodfish", "2026-10-06"),
    );
    const ui = await openApp(state);
    await ui.tap(ui.host.querySelector('[data-tab="world"]')!);
    // A collected scene shows its drawn icon, in the shelf and the grid.
    expect(ui.host.querySelectorAll(".room-shelf .scene-art")).toHaveLength(2);
    expect(ui.host.querySelectorAll(".collection-grid .scene-art")).toHaveLength(2);
    await ui.tap(
      ui.host.querySelector(
        `[data-collectible-id="${dailyCollectibleId("2026-10-05", "crane")}"]`,
      )!,
    );
    expect(ui.page()).toBe("collection");
    expect(ui.host.querySelector(".form-card .tag")?.textContent).toBe(
      "许愿小物",
    );
    const spent = ui.host.querySelector(".vessel-spent-line")!.textContent!;
    expect(spent).toBe("已拿去许过愿");
    expect(() => assertSafeCopy(spent)).not.toThrow();

    await ui.tap(ui.button("回看这场仪式", ".form-card"));
    expect(ui.page()).toBe("scene");
    expect(ui.sceneTitle()).toBe(entryOf("crane").title);
    expect(ui.sceneProgress()).toBe("已完成 0 / 3");
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

describe("useOpenRitual", () => {
  /** The hook as 仪式时光 holds it, over `state` and a catalog of `entries`. */
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
  const reset = (id: string) => ({ type: "scene.progress", id, progress: 0 });

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

describe("useOpenScene", () => {
  /** The hook as 今日/心愿/小天地 hold it, over `state` and a catalog. */
  function opener(state: State) {
    const go = vi.fn();
    const dispatch = vi.fn(() => true);
    let open!: ReturnType<typeof useOpenScene>;
    function Probe() {
      open = useOpenScene();
      return null;
    }
    renderToStaticMarkup(
      createElement(
        Context.Provider,
        { value: { state, go, dispatch } as unknown as AppContext },
        createElement(
          SceneLibraryContext.Provider,
          { value: { entries: builtInScenes } as never },
          createElement(Probe),
        ),
      ),
    );
    return { open, go, dispatch };
  }
  const reset = (id: string) => ({ type: "scene.progress", id, progress: 0 });

  it("opens a scene as it stands; a flagged visit always starts over", () => {
    const fresh = opener(createState());
    fresh.open(entryOf("lantern"));
    expect(fresh.dispatch).not.toHaveBeenCalled();
    expect(fresh.go).toHaveBeenCalledWith({
      page: "scene",
      id: "lantern",
      entry: entryOf("lantern"),
      daily: undefined,
      vessel: undefined,
      wishId: undefined,
    });
    // A done scene, unflagged: opened as it stands.
    const done = opener(withRecords({ woodfish: 12 }));
    done.open(entryOf("woodfish"));
    expect(done.dispatch).not.toHaveBeenCalled();
    // Any flagged visit — daily, vessel, 还愿, 回看 — resets first.
    const half = opener(withRecords({ crane: 1 }));
    half.open(entryOf("crane"), { vessel: "v1" });
    expect(half.dispatch).toHaveBeenCalledWith(reset("crane"));
    const walked = opener(withRecords({ crane: 3 }));
    walked.open(entryOf("crane"), { replay: true });
    expect(walked.dispatch).toHaveBeenCalledWith(reset("crane"));
  });

  it("passes the visit's flags on to the scene route", () => {
    const { open, go } = opener(createState());
    open(entryOf("tanzaku-tanabata"), {
      daily: DAY,
      vessel: "v1",
      wishId: "w1",
    });
    expect(go).toHaveBeenCalledWith({
      page: "scene",
      id: "tanzaku-tanabata",
      entry: entryOf("tanzaku-tanabata"),
      daily: DAY,
      vessel: "v1",
      wishId: "w1",
    });
  });
});

describe("ritual scene copy", () => {
  it("keeps the daily, vessel and 还愿 lines safe", () => {
    for (const text of [
      SCENE_RETURN_DONE_COPY,
      SCENE_RETURN_CTA,
      SCENE_VESSEL_DONE_COPY,
      SCENE_KEEP_QUESTION,
      SCENE_KEEP_CTA,
      SCENE_DISCARD_CTA,
      SCENE_DISCARDED_COPY,
      SCENE_DAILY_CTA,
      SCENE_DAILY_CAPTION,
      sceneDailyDoneCopy("短册系竹"),
      sceneDailyAnnounce("短册系竹"),
      ...Object.values(VESSEL_COPY),
      FULFILL_VESSEL_COPY.pick,
      FULFILL_VESSEL_COPY.none,
      FULFILL_VESSEL_COPY.noneAction,
      "已拿去许过愿",
      "回看这场仪式",
    ])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});