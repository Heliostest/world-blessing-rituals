// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createState, type Collectible, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";

const AT = "2026-10-27T08:00:00.000Z";
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function keepsake(id: string, sceneId: string, spent = false): Collectible {
  return { id, kind: "scene", title: sceneId, sceneId, wishScene: true, at: AT,
    ...(spent ? { spentAt: AT } : {}) };
}
function open(state: State) {
  const go = vi.fn(), dispatch = vi.fn((_action: unknown) => true);
  const feedback = vi.fn(), prepareFeedback = vi.fn();
  const ui = renderUI(createElement(Context.Provider,
    { value: { state, go, dispatch, feedback, prepareFeedback, active: true } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider,
      { value: { entries: builtInScenes } as never }, createElement(Wishes))));
  mounted.push(ui);
  return { ...ui, go, dispatch, feedback, prepareFeedback };
}
function item(ui: ReturnType<typeof open>, id: string) {
  return ui.host.querySelector<HTMLButtonElement>(`.wish-rack-item[data-collectible-id="${id}"]`)!;
}
function openItem(ui: ReturnType<typeof open>, id: string) {
  return item(ui, id).closest(".wish-rack-slot")!.querySelector<HTMLButtonElement>(".wish-rack-open")!;
}

describe("collected prayer rituals on the wish rack", () => {
  it.each([false, true])("excludes a blessing collection even when its saved wish flag is %s", wishScene => {
    const state = createState();
    state.collectibles = [
      { ...keepsake("chime", "furin-wind-chime"), wishScene },
      { ...keepsake("bulls", "pucara-rooftop-bulls"), wishScene },
      { ...keepsake("pine", "japanese-kadomatsu"), wishScene },
      { ...keepsake("candy", "shichigosan-chitose-ame"), wishScene },
    ];
    const before = JSON.stringify(state);
    const ui = open(state);
    expect(ui.host.querySelector(".wish-ritual-rack")).toBeNull();
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
  it("responds to object taps in place without spending, writing, or navigating", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "crane", true)];
    const before = JSON.stringify(state);
    const ui = open(state);
    clickOn(item(ui, "used"));
    expect(ui.prepareFeedback).toHaveBeenCalledOnce();
    expect(ui.feedback).toHaveBeenCalledOnce();
    expect(ui.go).not.toHaveBeenCalled();
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
  it("keeps all copies in one browseable row instead of hiding objects behind expansion", () => {
    const state = createState();
    state.collectibles = [keepsake("a", "crane", true), keepsake("b", "crane"),
      keepsake("c", "tanzaku-tanabata"), keepsake("d", "daruma-eye-painting")];
    const ui = open(state);
    expect(ui.host.querySelectorAll(".wish-rack-row")).toHaveLength(1);
    expect(ui.host.querySelectorAll(".wish-rack-item")).toHaveLength(4);
    expect(ui.host.querySelector(".wish-rack-toggle")).toBeNull();
  });
  it("uses the primary wish category while keeping non-writing wish collections", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "tanzaku-tanabata", true), keepsake("unused", "crane"),
      { ...keepsake("kept", "alasita-miniature-house"), wishScene: false },
      keepsake("blessing", "uchide-wishing-mallet"),
      { ...keepsake("reflection", "woodfish"), wishScene: false },
      keepsake("reminder", "omikuji"), keepsake("gratitude", "phuang-malai"),
      keepsake("reverence", "diya-oil-lamp"), keepsake("celebration", "navruz-sumalak"),
      { id: "badge", kind: "badge", title: "如愿", at: AT },
      keepsake("hidden", "lantern")];
    const before = JSON.stringify(state);
    const ui = open(state);
    expect([...ui.host.querySelectorAll(".wish-rack-item")].map(el => el.getAttribute("data-collectible-id"))).toEqual(["unused", "used", "kept"]);
    expect(item(ui, "unused").dataset.rackStatus).toBe("unused");
    expect(item(ui, "used").dataset.rackStatus).toBe("used");
    expect(ui.host.querySelector(".wish-rack-count")?.textContent).toBe("1 个未用");
    expect(openItem(ui, "unused").textContent).toContain("折一只纸鹤");
    clickOn(openItem(ui, "kept"));
    expect(ui.go).toHaveBeenCalledWith({ page: "collection", id: "kept" });
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
  it("opens the exact unused vessel without spending it or creating a wish on click", () => {
    const state = createState();
    state.collectibles = [keepsake("unused", "crane")];
    const ui = open(state);
    clickOn(openItem(ui, "unused"));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: "crane", vessel: "unused" }));
    expect(state.collectibles[0].spentAt).toBeUndefined();
    expect(ui.dispatch.mock.calls.some(([a]) => ["collectible.spend", "wish.create"].includes((a as {type:string}).type))).toBe(false);
  });
  it("shows used and non-writing acquired objects through their own collection details", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "crane", true), keepsake("no-writing", "alasita-miniature-house")];
    const ui = open(state);
    clickOn(openItem(ui, "used"));
    expect(ui.go).toHaveBeenLastCalledWith({ page: "collection", id: "used" });
    clickOn(openItem(ui, "no-writing"));
    expect(ui.go).toHaveBeenLastCalledWith({ page: "collection", id: "no-writing" });
    expect(item(ui, "no-writing").dataset.rackStatus).toBe("unused");
  });
  it("continues a spent old draft before other objects without clearing its text or progress", () => {
    const state = createState();
    state.collectibles = [keepsake("unused", "crane"), keepsake("pending", "alasita-miniature-house", true)];
    state.vesselDrafts = { pending: { line: "愿家人平安", at: AT } };
    const ui = open(state);
    expect(ui.host.querySelector(".wish-rack-item")?.getAttribute("data-collectible-id")).toBe("pending");
    expect(item(ui, "pending").dataset.rackStatus).toBe("pending");
    clickOn(openItem(ui, "pending"));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", vessel: "pending" }));
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(state.vesselDrafts.pending.line).toBe("愿家人平安");
  });
  it("keeps same-scene copies separate with their own collection destinations", () => {
    const state = createState();
    state.collectibles = [keepsake("a", "crane", true), keepsake("b", "crane"), keepsake("c", "tanzaku-tanabata"), keepsake("d", "daruma-eye-painting")];
    const ui = open(state);
    expect(ui.host.querySelectorAll(".wish-rack-item")).toHaveLength(4);
    expect(item(ui, "a").dataset.rackStatus).toBe("used");
    expect(item(ui, "b").dataset.rackStatus).toBe("unused");
    clickOn(openItem(ui, "a"));
    expect(ui.go).toHaveBeenLastCalledWith({ page: "collection", id: "a" });
  });
  it("moves keyboard focus along the objects without activating them", () => {
    const state = createState();
    state.collectibles = [keepsake("a", "crane"), keepsake("b", "tanzaku-tanabata")];
    const ui = open(state);
    item(ui, "b").focus();
    act(() => item(ui, "b").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement).toBe(item(ui, "a"));
    expect(ui.go).not.toHaveBeenCalled();
    expect(ui.feedback).not.toHaveBeenCalled();
  });
  it("does not play feedback or open a collection after dragging over an object", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "crane", true)];
    const ui = open(state), target = item(ui, "used");
    function pointer(type: string, x: number) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: 10 });
      act(() => target.dispatchEvent(event));
    }
    pointer("pointerdown", 100); pointer("pointermove", 40); pointer("pointerup", 40);
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
    expect(ui.feedback).not.toHaveBeenCalled();
    expect(ui.go).not.toHaveBeenCalled();
    // The next deliberate tap works normally.
    pointer("pointerdown", 40); pointer("pointerup", 40);
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })));
    expect(ui.feedback).toHaveBeenCalledOnce();
  });
  it("ignores mouse movement after a release outside the rack", () => {
    const state = createState();
    state.collectibles = [keepsake("used", "crane", true)];
    const ui = open(state), row = ui.host.querySelector<HTMLElement>(".wish-rack-row")!;
    const capture = vi.fn(); row.setPointerCapture = capture;
    function pointer(type: string, x: number, buttons: number) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, pointerType: "mouse", button: 0, buttons, clientX: x, clientY: 10 });
      act(() => row.dispatchEvent(event));
    }
    pointer("pointerdown", 100, 1);
    // The release happened outside this node; only the next hover reaches it.
    pointer("pointermove", 30, 0);
    expect(capture).not.toHaveBeenCalled();
    expect(row.scrollLeft).toBe(0);
  });
  it("leaves no empty showcase when the user has not acquired a prayer object", () => {
    const state = createState();
    state.collectibles = [keepsake("reflection", "woodfish"), keepsake("gratitude", "phuang-malai")];
    const ui = open(state);
    expect(ui.host.querySelector(".wish-ritual-rack")).toBeNull();
    expect(ui.host.querySelectorAll(".pray-button")).toHaveLength(1);
  });
});

describe("wish rack's idle hint", () => {
  let hidden = false, focused = true;
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false; focused = true;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => hidden ? "hidden" : "visible");
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
    // These tests retain the real page, rack and event handlers without a GPU.
    vi.stubGlobal("WebGL2RenderingContext", undefined);
  });
  function rack() {
    const state = createState();
    state.collectibles = [keepsake("crane", "crane"), keepsake("strip", "tanzaku-tanabata")];
    const ui = open(state), hint = ui.host.querySelector<HTMLElement>(".wish-rack-hint")!;
    const page = ui.host.querySelector<HTMLElement>(".wishes-page")!;
    const buttons = [...ui.host.querySelectorAll<HTMLButtonElement>(".wish-rack-item")];
    function expectVisible(visible: boolean) {
      // The same caption keeps its layout row, even while hidden from reading.
      expect(ui.host.querySelector(".wish-rack-hint")).toBe(hint);
      expect(hint.hidden).toBe(false);
      expect(hint.dataset.visible).toBe(String(visible));
      expect(hint.getAttribute("aria-hidden")).toBe(String(!visible));
      for (const button of buttons)
        expect(button.getAttribute("aria-describedby")).toBe(visible ? hint.id : null);
    }
    return { ...ui, hint, page, expectVisible };
  }
  const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));
  function visibility(value: boolean) {
    hidden = value;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
  }
  function focus(value: boolean) {
    focused = value;
    act(() => window.dispatchEvent(new Event(value ? "focus" : "blur")));
  }
  function operate(page: HTMLElement, type: string) {
    const event = type === "keydown" ? new KeyboardEvent(type, { key: "Tab", bubbles: true })
      : type === "wheel" ? new WheelEvent(type, { deltaY: 30, bubbles: true })
      : new Event(type, { bubbles: type !== "scroll" });
    act(() => page.dispatchEvent(event));
  }

  it("names prayer rituals and waits a full three idle seconds before showing its existing caption", () => {
    const s = rack();
    expect(s.host.querySelector(".wish-rack-heading h2")?.textContent).toBe("祈愿仪式");
    expect(s.host.querySelector(".wish-ritual-rack")?.getAttribute("aria-label")).toBe("祈愿仪式");
    expect(s.hint.textContent).toBe("点按小物，听听回应");
    expect(s.hint.id).toBeTruthy();
    s.expectVisible(false);
    advance(2999); s.expectVisible(false);
    advance(1); s.expectVisible(true);
    expect(s.go).not.toHaveBeenCalled();
    expect(s.feedback).not.toHaveBeenCalled();
  });

  it.each(["pointerdown", "keydown", "scroll", "wheel"])("hides on page %s and restarts the complete idle interval", type => {
    const s = rack();
    advance(3000); s.expectVisible(true);
    operate(s.page, type); s.expectVisible(false);
    advance(2000); s.expectVisible(false);
    // Another operation while already hidden must also restart the timer.
    operate(s.page, type);
    advance(2999); s.expectVisible(false);
    advance(1); s.expectVisible(true);
    expect(s.go).not.toHaveBeenCalled();
    expect(s.dispatch).not.toHaveBeenCalled();
  });

  it.each(["blur", "hidden"])("does not count time while %s and starts fresh after returning", mode => {
    const s = rack();
    const pause = () => mode === "blur" ? focus(false) : visibility(true);
    const resume = () => mode === "blur" ? focus(true) : visibility(false);
    advance(2000); pause(); s.expectVisible(false);
    advance(10000); s.expectVisible(false);
    resume(); advance(2999); s.expectVisible(false);
    advance(1); s.expectVisible(true);
    pause(); s.expectVisible(false);
    advance(10000); s.expectVisible(false);
    resume(); advance(2999); s.expectVisible(false);
    advance(1); s.expectVisible(true);
  });

  it.each(["blur", "hidden"])("does not start an idle interval when mounted %s", mode => {
    if (mode === "blur") focused = false;
    else hidden = true;
    const s = rack();
    advance(10000); s.expectVisible(false);
    if (mode === "blur") focus(true);
    else visibility(false);
    advance(2999); s.expectVisible(false);
    advance(1); s.expectVisible(true);
  });

  it("cancels the pending hint and page listeners when the wishes page unmounts", () => {
    const before = vi.getTimerCount(), s = rack();
    advance(2999); s.expectVisible(false);
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    s.unmount();
    mounted.splice(mounted.findIndex(ui => ui.host === s.host), 1);
    expect(vi.getTimerCount()).toBe(before);
    expect(s.hint.isConnected).toBe(false);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    advance(10000);
    expect(vi.getTimerCount()).toBe(before);
    expect(s.hint.dataset.visible).toBe("false");
    expect(s.go).not.toHaveBeenCalled();
  });
});
