// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderUI, settle } from "./dom-test-utils";
import { RewardFlightLayer } from "./reward-flight-layer";
import {
  flightKeyframes,
  resolveTarget,
  shouldReduceMotion,
  type RewardFlight,
} from "./reward-flight";

describe("flightKeyframes", () => {
  const plan = flightKeyframes(
    { x: 0, y: 600, width: 200, height: 200 },
    { x: 150, y: 300, width: 76, height: 76 },
  );

  it("starts the ghost exactly on the from rect and ends it centred on the slot", () => {
    expect(plan.outer[0].transform).toBe("translate(0px, 0px) scale(1)");
    // dx = 150 + 76/2 − (0 + 200/2), scale = 76 / 200.
    expect(plan.outer.at(-1).transform).toBe("translate(88px, 0px) scale(0.38)");
    const endY = Number(
      (plan.inner.at(-1).transform as string).match(
        /translateY\((-?[\d.]+)px\)/,
      )![1],
    );
    expect(endY).toBeCloseTo(300 + 38 - (600 + 100), 5);
  });

  it("peaks above both rects and stays within the time budget", () => {
    // rise = 64 + however much higher the slot sits.
    expect(plan.rise).toBe(64 + 300);
    expect(600 - plan.rise).toBeLessThan(300); // above the slot's top
    expect(plan.inner[1].offset).toBe(0.5);
    expect(plan.duration).toBeLessThanOrEqual(600);
  });
});

describe("shouldReduceMotion", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reduces for the in-app setting", () => {
    expect(shouldReduceMotion(true)).toBe(true);
  });

  it("reduces for the system query, and only for it", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    expect(shouldReduceMotion(false)).toBe(true);
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    expect(shouldReduceMotion(false)).toBe(false);
  });

  it("says no when there is no query to ask", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(shouldReduceMotion(false)).toBe(false);
  });
});

describe("resolveTarget", () => {
  afterEach(() => document.body.replaceChildren());

  it("prefers the shelf slot, then the wish card, then the tab, then nothing", () => {
    const flight: RewardFlight = {
      kind: "crane",
      from: { x: 0, y: 0, width: 10, height: 10 },
      collectibleId: "ritual:s",
      wishId: "w1",
      tab: "world",
      announce: "",
    };
    const shelf = document.createElement("div");
    shelf.dataset.collectibleId = "ritual:s";
    const wish = document.createElement("div");
    wish.dataset.wishId = "w1";
    const tab = document.createElement("button");
    tab.dataset.tab = "world";
    document.body.append(shelf, wish, tab);
    expect(resolveTarget(flight)).toMatchObject({ el: shelf, kind: "shelf" });
    expect(
      resolveTarget({ ...flight, collectibleId: undefined }),
    ).toMatchObject({ el: wish, kind: "wish" });
    expect(
      resolveTarget({ ...flight, collectibleId: undefined, wishId: undefined }),
    ).toMatchObject({ el: tab, kind: "tab" });
    // With no tab named, 小天地 is the default home; only an empty page
    // resolves to nothing.
    expect(
      resolveTarget({
        ...flight,
        collectibleId: undefined,
        wishId: undefined,
        tab: undefined,
      }),
    ).toMatchObject({ el: tab, kind: "tab" });
    document.body.replaceChildren();
    expect(
      resolveTarget({
        ...flight,
        collectibleId: undefined,
        wishId: undefined,
      }).kind,
    ).toBe("none");
  });

  it("falls back without throwing when the shelf slot is missing", () => {
    const flight: RewardFlight = {
      kind: "crane",
      from: { x: 0, y: 0, width: 10, height: 10 },
      collectibleId: "ritual:gone",
      tab: "wishes",
      announce: "",
    };
    const tab = document.createElement("button");
    tab.dataset.tab = "wishes";
    document.body.append(tab);
    expect(resolveTarget(flight)).toMatchObject({ el: tab, kind: "tab" });
  });
});

describe("RewardFlightLayer", () => {
  beforeEach(() => {
    // One deterministic "next frame", without waiting on jsdom's timer.
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => (queueMicrotask(() => cb(0)), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const flight = (over: Partial<RewardFlight> = {}): RewardFlight => ({
    kind: "crane",
    from: { x: 8, y: 8, width: 60, height: 60 },
    announce: "千纸鹤已放进小天地",
    ...over,
  });
  /** A landing slot, so the flight has somewhere to go. */
  function placeSlot() {
    const slot = document.createElement("div");
    slot.dataset.collectibleId = "ritual:s1";
    document.body.append(slot);
    return slot;
  }
  const mount = (f: RewardFlight, reducedMotion = false) => {
    const onLand = vi.fn();
    const ui = renderUI(
      createElement(RewardFlightLayer, { flight: f, reducedMotion, onLand }),
    );
    return { ui, onLand };
  };

  it("reveals at once without Web Animations (plain jsdom), reporting one landing", async () => {
    placeSlot();
    const { ui, onLand } = mount(flight({ collectibleId: "ritual:s1" }));
    await settle();
    expect(onLand).toHaveBeenCalledTimes(1);
    ui.unmount();
  });

  it("reveals at once under reduced motion, never animating", async () => {
    placeSlot();
    const animate = vi.fn();
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const { ui, onLand } = mount(flight({ collectibleId: "ritual:s1" }), true);
    await settle();
    expect(animate).not.toHaveBeenCalled();
    expect(onLand).toHaveBeenCalledTimes(1);
    delete (Element.prototype as { animate?: unknown }).animate;
    ui.unmount();
  });

  it("reveals at once when there is nothing to fly from or to", async () => {
    const fromNothing = mount(flight({ from: { x: 0, y: 0, width: 0, height: 0 } }));
    await settle();
    expect(fromNothing.onLand).toHaveBeenCalledTimes(1);
    fromNothing.ui.unmount();
    // No shelf slot, no wish card, no tab: nothing to resolve.
    const toNothing = mount(flight({ collectibleId: "ritual:s1" }));
    await settle();
    expect(toNothing.onLand).toHaveBeenCalledTimes(1);
    expect(() => toNothing.ui.unmount()).not.toThrow();
  });

  it("runs the FLIP trip and reports exactly one landing", async () => {
    placeSlot();
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const { ui, onLand } = mount(flight({ collectibleId: "ritual:s1" }));
    await settle();
    // The ghost itself: an outer and an inner wrapper animation, each
    // called as animate(keyframes, options).
    expect(animate).toHaveBeenCalledTimes(2);
    const [outerKeys, innerKeys] = animate.mock.calls as unknown as [
      [Keyframe[], unknown],
      [Keyframe[], unknown],
    ];
    expect(String(outerKeys[0][0].transform)).toContain("translate(0px, 0px)");
    expect(String(outerKeys[0].at(-1).transform)).toContain("scale(");
    expect(String(innerKeys[0][0].transform)).toContain("translateY(0px)");
    expect(onLand).toHaveBeenCalledTimes(1);
    delete (Element.prototype as { animate?: unknown }).animate;
    ui.unmount();
  });

  it("sends one leaf to the 心愿 tab afterwards, only when a wish is linked", async () => {
    placeSlot();
    const tab = document.createElement("button");
    tab.dataset.tab = "wishes";
    document.body.append(tab);
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const { ui, onLand } = mount(
      flight({ collectibleId: "ritual:s1", wishId: "w1" }),
    );
    await settle();
    // Sticker (2) + leaf (2).
    expect(animate).toHaveBeenCalledTimes(4);
    expect(onLand).toHaveBeenCalledTimes(1);
    delete (Element.prototype as { animate?: unknown }).animate;
    ui.unmount();
  });

  it("finishes early on a tap: the data is settled, the flight is garnish", async () => {
    placeSlot();
    const animate = vi.fn(
      () => ({ finished: new Promise<void>(() => {}) }),
    );
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const { ui, onLand } = mount(flight({ collectibleId: "ritual:s1" }));
    await settle();
    expect(onLand).not.toHaveBeenCalled();
    // The layer listens on the document, in the capture phase.
    document.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    );
    expect(onLand).toHaveBeenCalledTimes(1);
    delete (Element.prototype as { animate?: unknown }).animate;
    ui.unmount();
  });
});
