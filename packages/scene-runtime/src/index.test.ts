import { describe, expect, it, vi } from "vitest";
import {
  createSceneRegistry,
  mountScene,
  type SceneMountOptions,
} from "./index";
function setup() {
  let changed: (() => void) | undefined;
  const visibility = {
    hidden: false,
    subscribe: (fn: () => void) => {
      changed = fn;
      return () => {
        changed = undefined;
      };
    },
  };
  const controller = {
    setActive: vi.fn(),
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
    strike: vi.fn(),
  };
  let options!: SceneMountOptions;
  const engine = {
    create: vi.fn((_host, _context, state) => {
      options = state;
      return controller;
    }),
  };
  const ready = vi.fn(),
    failed = vi.fn();
  return {
    visibility,
    controller,
    engine,
    ready,
    failed,
    options: () => options,
    change: () => changed?.(),
    subscribed: () => !!changed,
    mount: (load = async () => engine) =>
      mountScene({
        host: {} as HTMLDivElement,
        context: {},
        load,
        active: true,
        reducedMotion: false,
        visibility,
        ready,
        failed,
      }),
  };
}
describe("scene lifecycle host", () => {
  it("never creates an engine when a lazy import finishes after unmount", async () => {
    const s = setup();
    let resolve!: (value: typeof s.engine) => void;
    const session = s.mount(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    session.dispose();
    resolve(s.engine);
    await session.initialized;
    expect(s.engine.create).not.toHaveBeenCalled();
    expect(s.subscribed()).toBe(false);
  });
  it("uses the latest pause and motion settings when import finishes", async () => {
    const s = setup();
    let resolve!: (value: typeof s.engine) => void;
    const session = s.mount(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    session.setActive(false);
    session.setReducedMotion(true);
    resolve(s.engine);
    await session.initialized;
    expect(s.options().active).toBe(false);
    expect(s.options().reducedMotion).toBe(true);
    session.controller?.strike();
    expect(s.controller.strike).toHaveBeenCalledOnce();
    session.dispose();
  });
  it("combines page visibility with user pause and unsubscribes on dispose", async () => {
    const s = setup();
    const session = s.mount();
    await session.initialized;
    s.visibility.hidden = true;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(false);
    s.visibility.hidden = false;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(true);
    session.setActive(false);
    s.visibility.hidden = true;
    s.change();
    s.visibility.hidden = false;
    s.change();
    expect(s.controller.setActive).toHaveBeenLastCalledWith(false);
    session.dispose();
    session.dispose();
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.subscribed()).toBe(false);
  });
  it("aborts and disposes once on failure and suppresses late readiness", async () => {
    const s = setup();
    const session = s.mount();
    await session.initialized;
    s.options().failed(Error("context lost"));
    s.options().ready();
    await Promise.resolve();
    expect(s.options().signal.aborted).toBe(true);
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.failed).toHaveBeenCalledOnce();
    expect(s.ready).not.toHaveBeenCalled();
    expect(session.controller).toBeNull();
    session.dispose();
    expect(s.controller.dispose).toHaveBeenCalledOnce();
  });
  it("handles synchronous engine callbacks without leaking the returned controller", async () => {
    const s = setup();
    s.engine.create.mockImplementation((_h, _c, options) => {
      options.failed(Error("startup"));
      return s.controller;
    });
    const session = s.mount();
    await session.initialized;
    expect(s.controller.dispose).toHaveBeenCalledOnce();
    expect(s.failed).toHaveBeenCalledOnce();
  });
  it("reports lazy-import failure without mounting or retaining listeners", async () => {
    const s = setup();
    const session = s.mount(async () => {
      throw Error("chunk missing");
    });
    await session.initialized;
    expect(s.engine.create).not.toHaveBeenCalled();
    expect(s.failed).toHaveBeenCalledOnce();
    expect(s.subscribed()).toBe(false);
  });
});
describe("engine registry", () => {
  it("only loads the requested engine and retries failed imports", async () => {
    const s = setup();
    const first = vi
        .fn()
        .mockRejectedValueOnce(Error("offline"))
        .mockResolvedValue(s.engine),
      second = vi.fn(async () => s.engine);
    const registry = createSceneRegistry({ "one@1": first, "two@1": second });
    expect(first).not.toHaveBeenCalled();
    await expect(registry.load("one@1")).rejects.toThrow();
    expect(await registry.load("one@1")).toBe(s.engine);
    expect(second).not.toHaveBeenCalled();
  });
});
