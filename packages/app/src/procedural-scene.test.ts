// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { proceduralEngine } from "./procedural-scene";
import { createTilt } from "@wbr/gestures";
const fixture = vi.hoisted(() => ({
  progress: 0,
  context: undefined as any,
  instance: undefined as any,
}));
vi.mock("@wbr/scenes", () => ({
  loadScene: async () => ({
    create: (context: any) => {
      fixture.context = context;
      const tilt = createTilt({
        pourAngleDeg: 40,
        holdMs: 280,
        onPour: () => {
          fixture.progress = 1;
        },
      });
      fixture.instance = {
        start() {
          tilt.mount(context.overlay, {});
        },
        update(dt: number) {
          tilt.update(dt);
        },
        dispose() {
          tilt.dispose();
        },
      };
      return fixture.instance;
    },
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  fixture.progress = 0;
});
it("keeps real gesture elapsed time when decorative motion is reduced", async () => {
  let callback: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    callback = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const engine = await proceduralEngine("theravada-water");
  const host = document.createElement("div");
  const controller = engine.create(
    host,
    { progress: 0, sceneId: "water", checkpoint: () => {} },
    {
      active: true,
      reducedMotion: true,
      signal: new AbortController().signal,
      ready: () => {},
      failed: () => {},
    },
  );
  const overlay = fixture.context.overlay as HTMLElement;
  overlay.setPointerCapture = () => {};
  for (const [type, y] of [
    ["pointerdown", 200],
    ["pointermove", 100],
  ] as const) {
    const event = new Event(type);
    Object.assign(event, { clientY: y, pointerId: 1 });
    overlay.dispatchEvent(event);
  }
  const start = performance.now();
  for (let i = 1; i <= 10; i++) callback(start + i * 50);
  expect(fixture.progress).toBe(1);
  controller.dispose();
});
it("forwards App sound/haptics feedback to the scene context", async () => {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const engine = await proceduralEngine("furin-wind-chime");
  const prepareFeedback = vi.fn(),
    haptic = vi.fn();
  let sound = true;
  const controller = engine.create(
    document.createElement("div"),
    {
      progress: 0,
      sceneId: "furin",
      checkpoint: () => {},
      prepareFeedback,
      haptic,
      isSoundEnabled: () => sound,
    },
    {
      active: true,
      reducedMotion: false,
      signal: new AbortController().signal,
      ready: () => {},
      failed: () => {},
    },
  );
  fixture.context.prepareFeedback();
  fixture.context.haptic();
  expect(prepareFeedback).toHaveBeenCalledOnce();
  expect(haptic).toHaveBeenCalledOnce();
  expect(fixture.context.isSoundEnabled()).toBe(true);
  sound = false;
  expect(fixture.context.isSoundEnabled()).toBe(false);
  controller.dispose();
});
it("hands the scene the App's saveWish, so its wish box can keep a line", async () => {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const engine = await proceduralEngine("crane");
  const saveWish = vi.fn();
  const controller = engine.create(
    document.createElement("div"),
    { progress: 0, sceneId: "crane", checkpoint: () => {}, saveWish },
    {
      active: true,
      reducedMotion: false,
      signal: new AbortController().signal,
      ready: () => {},
      failed: () => {},
    },
  );
  fixture.context.saveWish("愿家人平安");
  expect(saveWish).toHaveBeenCalledWith("愿家人平安");
  controller.dispose();
});
