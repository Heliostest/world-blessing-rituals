// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Context, type AppContext } from "./context";
import { Woodfish } from "./woodfish";
import { renderUI, settle } from "./dom-test-utils";

// The 3D scene itself is not under test: a ready session whose mallet strikes.
const fake = vi.hoisted(() => ({ strike: () => {} }));
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
        strike: () => fake.strike(),
        movePointer() {},
        stopFollowing() {},
        inspect() {},
      },
    };
  },
}));

let clock = 0;
beforeEach(() => {
  clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  // jsdom has no pointer capture.
  Object.assign(HTMLElement.prototype, {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function renderWoodfish() {
  const onStrike = vi.fn(() => true);
  const strike = vi.fn();
  fake.strike = strike;
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { decodeSound: vi.fn() } as unknown as AppContext },
      createElement(Woodfish, {
        pulse: 0,
        active: true,
        reducedMotion: false,
        view: "front",
        disabled: false,
        onStrike,
        onImpact: () => {},
        onInstruction: () => {},
        contentClient: {} as never,
      }),
    ),
  );
  await settle();
  const button = ui.host.querySelector("button")!;
  /** A pointer (or click/menu) event on the woodfish, as a finger by default. */
  const send = (
    type: string,
    { x = 100, pointerType = "touch", detail = 1 } = {},
  ) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: 100,
      button: 0,
      detail,
    });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: pointerType },
      isPrimary: { value: true },
    });
    act(() => {
      button.dispatchEvent(event);
    });
    return event;
  };
  return { ...ui, send, onStrike, strike };
}

describe("木鱼 presses", () => {
  it("strikes once for a quick tap, through its click", async () => {
    const w = await renderWoodfish();
    w.send("pointerdown");
    clock += 120;
    w.send("pointerup");
    expect(w.onStrike).not.toHaveBeenCalled();
    w.send("click");
    expect(w.onStrike).toHaveBeenCalledTimes(1);
    expect(w.strike).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it("strikes on release for a long still press; a click after it does not strike again", async () => {
    const w = await renderWoodfish();
    w.send("pointerdown");
    clock += 600;
    w.send("pointerup");
    expect(w.onStrike).toHaveBeenCalledTimes(1);
    expect(w.strike).toHaveBeenCalledTimes(1);
    w.send("click");
    expect(w.onStrike).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it("keeps a long press through the menu event Android sends while the finger is down", async () => {
    const w = await renderWoodfish();
    w.send("pointerdown");
    clock += 500;
    expect(w.send("contextmenu").defaultPrevented).toBe(true);
    clock += 300;
    w.send("pointerup");
    expect(w.onStrike).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it("does not strike for a drag, however long, or a cancelled press", async () => {
    const w = await renderWoodfish();
    w.send("pointerdown");
    w.send("pointermove", { x: 130 });
    clock += 600;
    w.send("pointerup");
    w.send("click");
    w.send("pointerdown");
    clock += 600;
    w.send("pointercancel");
    w.send("pointerup");
    w.send("click");
    expect(w.onStrike).not.toHaveBeenCalled();
    w.unmount();
  });

  it("opens no menu on a right click, and strikes for a mouse click or Enter as before", async () => {
    const w = await renderWoodfish();
    expect(w.send("contextmenu", { pointerType: "mouse" }).defaultPrevented).toBe(true);
    expect(w.onStrike).not.toHaveBeenCalled();
    // A slow mouse click is still a click.
    w.send("pointerdown", { pointerType: "mouse" });
    clock += 900;
    w.send("pointerup", { pointerType: "mouse" });
    expect(w.onStrike).not.toHaveBeenCalled();
    w.send("click");
    expect(w.onStrike).toHaveBeenCalledTimes(1);
    // Keyboard activation arrives as a click with detail 0.
    w.send("click", { detail: 0 });
    expect(w.onStrike).toHaveBeenCalledTimes(2);
    w.unmount();
  });
});
