// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createState, reduce, type State } from "@wbr/core";
import { BlessingApp } from "./App";
import { clickOn, renderUI, settle } from "./dom-test-utils";

// The 3D woodfish is not under test: a ready session whose mallet can be
// kept busy, or let rest, so the settle beat's whenIdle() wait is observable.
const scene = vi.hoisted(() => ({ idle: Promise.resolve() as Promise<void> }));
vi.mock("@wbr/scene-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wbr/scene-runtime")>()),
  mountScene: (config: { ready(): void }) => {
    queueMicrotask(() => config.ready());
    const lifecycle = { setActive() {}, setReducedMotion() {}, dispose() {} };
    return {
      ...lifecycle,
      initialized: Promise.resolve(),
      controller: {
        ...lifecycle,
        strike: () => {},
        whenIdle: () => scene.idle,
        movePointer() {},
        stopFollowing() {},
        inspect() {},
      },
    };
  },
}));

const AT = "2026-10-05T08:00:00.000Z";
type Ritual = "woodfish" | "crane";

/** A save with one open session `progress` steps in, optionally for w1. */
function withSession(ritual: Ritual, progress: number, forWish = false) {
  const state = createState();
  return {
    ...state,
    activeSession: {
      id: "s1",
      ritual,
      progress,
      startedAt: AT,
      ...(forWish ? { wishId: "w1" } : {}),
    },
  };
}
/** A save holding one wish, plus the same open session linked to it. */
function withWishSession(
  status: "active" | "realized",
  ritual: Ritual,
  progress: number,
): State {
  let state = reduce(createState(), {
    type: "wish.create",
    id: "w1",
    title: "面试顺利",
    intention: "",
    at: AT,
  });
  if (status === "realized")
    state = reduce(state, { type: "wish.realize", id: "w1", at: AT });
  return {
    ...state,
    activeSession: withSession(ritual, progress, true).activeSession,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  scene.idle = Promise.resolve();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** The App on a memory host, already loaded to 今日. */
async function openApp(state: State) {
  const storage = { read: async () => JSON.stringify(state), write: async () => {} };
  const ui = renderUI(createElement(BlessingApp, { host: storage }));
  await settle();
  return { ...ui, storage };
}
const pageOf = (ui: { host: HTMLElement }) =>
  ui.host.querySelector<HTMLElement>(".app-shell")!.dataset.page;

/** From 今日, through the resume banner, onto the ritual page. */
async function openRitual(ui: { host: HTMLElement }) {
  clickOn(ui.host.querySelector(".resume-banner")!);
  await settle();
  expect(pageOf(ui)).toBe("ritual");
}
/** Strike the remaining steps, then let the beat settle the session. */
async function settleRitual(ui: { host: HTMLElement }, steps: number) {
  const object = ui.host.querySelector(".ritual-object")!;
  for (let i = 0; i < steps; i++) clickOn(object);
  await settle();
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(pageOf(ui)).toBe("complete");
}
/** The App's one polite live region. */
const spoken = (ui: { host: HTMLElement }) =>
  ui.host.querySelector("p[role='status']")?.textContent ?? "";

describe("the settle beat (P0)", () => {
  it("settles the last strike by itself: no 完成仪式 button, one card, one of each leftover", async () => {
    const ui = await openApp(withSession("crane", 3));
    await openRitual(ui);
    // No second confirm exists, and the object stands down at ready.
    const object = ui.host.querySelector<HTMLButtonElement>(".ritual-object")!;
    clickOn(object);
    await settle();
    expect(ui.host.textContent).not.toContain("完成仪式");
    expect(object.disabled).toBe(true);
    // The settle moment speaks through the beat line.
    const line = ui.host.querySelector(".tap-instruction")!;
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.textContent).toContain("这一刻，已经很好。");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(pageOf(ui)).toBe("complete");

    // Exactly one primary confirm, and it names the item.
    const primary = [
      ...ui.host.querySelectorAll(".completion .button.primary"),
    ];
    expect(primary).toHaveLength(1);
    expect(primary[0].textContent).toBe("收下千纸鹤");
    expect(ui.host.querySelector(".reward-destination")?.textContent).toBe(
      "它会住进你的小天地",
    );
    expect(ui.host.querySelector("[data-reward-sticker]")).not.toBeNull();

    clickOn(primary[0]);
    // On 小天地: the sticker flew (instantly, jsdom has no Web Animations)
    // and landed on its own slot, rung 新, with the count bumped to one.
    expect(pageOf(ui)).toBe("world");
    const slot = ui.host.querySelector('[data-collectible-id="ritual:s1"]')!;
    expect(slot).not.toBeNull();
    expect(slot.querySelector(".new-mark")?.textContent).toBe("新");
    expect(ui.host.querySelector(".count-pill")?.textContent).toContain(
      "1 件珍藏",
    );
    expect(spoken(ui)).toContain("千纸鹤已放进小天地");
    // The arrival navigation carries the motion; page-in stood down for it.
    expect(
      ui.host.querySelector<HTMLElement>(".app-content")!.style.animation,
    ).toBe("none");
    // …and only for it: a later dock visit to 小天地 gets its page-in back.
    clickOn(ui.host.querySelector('[data-tab="today"]')!);
    await settle();
    clickOn(ui.host.querySelector('[data-tab="world"]')!);
    await settle();
    expect(
      ui.host.querySelector<HTMLElement>(".app-content")!.style.animation,
    ).toBe("");
    ui.unmount();
  });

  it("settles a 12/12 woodfish left unsettled when the page opens, once the mallet rests", async () => {
    let rest!: () => void;
    scene.idle = new Promise<void>((resolve) => {
      rest = resolve;
    });
    const ui = await openApp(withSession("woodfish", 12));
    await openRitual(ui);
    // Waiting for the mallet: nothing settles before it rests…
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(pageOf(ui)).toBe("ritual");
    // …then 400ms after it does.
    await act(async () => {
      rest();
    });
    await settle();
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(pageOf(ui)).toBe("ritual");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(pageOf(ui)).toBe("complete");
    // Settled exactly once: one collectible.
    clickOn(ui.host.querySelector(".completion .button.primary")!);
    expect(ui.host.querySelector(".count-pill")?.textContent).toContain(
      "1 件珍藏",
    );
    ui.unmount();
  });

  it("never lets a stuck mallet stall the beat past the 3s cap", async () => {
    scene.idle = new Promise(() => {});
    const ui = await openApp(withSession("woodfish", 12));
    await openRitual(ui);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(pageOf(ui)).toBe("ritual");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(pageOf(ui)).toBe("complete");
    ui.unmount();
  });

  it("keeps the session when you leave during the beat, and settles it once on return", async () => {
    const ui = await openApp(withSession("crane", 3));
    await openRitual(ui);
    clickOn(ui.host.querySelector(".ritual-object")!);
    await settle();
    // Leave before the beat ends: no navigation, session still open.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    clickOn(ui.host.querySelector(".back-button")!);
    await settle();
    expect(pageOf(ui)).toBe("today");
    expect(ui.host.querySelector(".resume-banner")).not.toBeNull();

    // Returning settles the same session exactly once.
    await openRitual(ui);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(pageOf(ui)).toBe("complete");
    clickOn(ui.host.querySelector(".completion .button.primary")!);
    expect(ui.host.querySelector(".count-pill")?.textContent).toContain(
      "1 件珍藏",
    );

    // With the session settled, a different ritual tile opens that ritual,
    // not a hijacked woodfish.
    clickOn(ui.host.querySelector('[data-tab="today"]')!);
    await settle();
    clickOn(ui.host.querySelector('.ritual-tile[data-scene="crane"]')!);
    await settle();
    expect(pageOf(ui)).toBe("ritual");
    expect(ui.host.querySelector(".ritual-goal")?.textContent).toContain(
      "0 / 4",
    );
    ui.unmount();
  });
});

describe("the reward card's exits (P0/P1)", () => {
  it("✕ goes to 今日 and badges the 小天地 tab with +1", async () => {
    const ui = await openApp(withSession("crane", 3));
    await openRitual(ui);
    await settleRitual(ui, 1);
    clickOn(ui.host.querySelector('button[aria-label="关闭完成页"]')!);
    await settle();
    expect(pageOf(ui)).toBe("today");
    expect(
      ui.host.querySelector('.bottom-nav [data-tab="world"] i')?.textContent,
    ).toBe("+1");
    expect(spoken(ui)).toContain("千纸鹤已放进小天地");
    // Nothing landed in the room itself on this exit: no shelf marks.
    expect(ui.host.querySelectorAll(".new-mark")).toHaveLength(0);
    ui.unmount();
  });

  it("Android back leaves the card the same way ✕ does", async () => {
    const ui = await openApp(withSession("crane", 3));
    await openRitual(ui);
    await settleRitual(ui, 1);
    ui.rerender(
      createElement(BlessingApp, { host: ui.storage, backRequest: 1 }),
    );
    await settle();
    expect(pageOf(ui)).toBe("today");
    expect(
      ui.host.querySelector('.bottom-nav [data-tab="world"] i')?.textContent,
    ).toBe("+1");
    expect(ui.host.querySelector(".reward-flight-layer")).toBeNull();
    ui.unmount();
  });

  it("names a linked active wish on the card and badges 心愿", async () => {
    const ui = await openApp(withWishSession("active", "crane", 3));
    await openRitual(ui);
    await settleRitual(ui, 1);
    expect(ui.host.textContent).toContain("也为「面试顺利」记了一笔");
    clickOn(ui.host.querySelector(".completion .button.primary")!);
    expect(pageOf(ui)).toBe("world");
    expect(
      ui.host.querySelector('.bottom-nav [data-tab="wishes"] i')?.textContent,
    ).toBe("+1");
    ui.unmount();
  });

  it("keeps 继续还愿 for a realized wish, with no flight", async () => {
    const ui = await openApp(withWishSession("realized", "crane", 4));
    await openRitual(ui);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(pageOf(ui)).toBe("complete");
    const primary = ui.host.querySelector(".completion .button.primary")!;
    expect(primary.textContent).toBe("继续还愿 · 留下这份心情");
    expect(ui.host.querySelector("[data-reward-sticker]")).toBeNull();
    clickOn(primary);
    expect(pageOf(ui)).toBe("fulfill");
    expect(ui.host.querySelector(".reward-flight-layer")).toBeNull();
    ui.unmount();
  });
});
