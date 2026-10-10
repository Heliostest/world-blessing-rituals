// @vitest-environment jsdom
import { act, createElement } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createState } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import {
  mountScene,
  type SceneController,
  type SceneSession,
} from "@wbr/scene-runtime";
import { Context, type AppContext } from "./context";
import { ContentContext } from "./content";
import {
  canPreviewScenes,
  DailyScenePreview,
  previewContent,
} from "./daily-scene-preview";
import type { ProceduralContext } from "./procedural-scene";
import type { WoodfishContext } from "./scene-engines";
import { builtInScenes } from "./scene-library";
import { sceneStage } from "./scene-placement";
import { renderUI } from "./dom-test-utils";

/* The real mountScene drives WebGL, which no test here has: what these tests
   hold is the preview's contract with it — the read-only context it hands
   down, and the pausing, resuming and disposing it asks for. Everything else
   the module exports stays real. */
vi.mock("@wbr/scene-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wbr/scene-runtime")>();
  return { ...actual, mountScene: vi.fn() };
});

type MountConfig = Parameters<typeof mountScene>[0];
/** The config the preview last mounted with, and the session handed back. */
let mounted: MountConfig | undefined;
const session: SceneSession<SceneController> = {
  controller: null,
  initialized: Promise.resolve(),
  dispose: vi.fn(),
  setActive: vi.fn(),
  setReducedMotion: vi.fn(),
};

const entryOf = (id: string): CatalogEntry =>
  builtInScenes.find((e) => e.id === id)!;
/** The App around a preview: active, sound on, unless said otherwise. */
const appContext = (overrides: Partial<AppContext> = {}) =>
  ({
    state: createState(),
    active: true,
    ...overrides,
  }) as unknown as AppContext;
const renderPreview = (
  entry: CatalogEntry,
  value: AppContext = appContext(),
  environment: object = {},
) =>
  renderUI(
    createElement(
      Context.Provider,
      { value },
      createElement(
        ContentContext.Provider,
        { value: environment },
        createElement(DailyScenePreview, { entry }),
      ),
    ),
  );

beforeEach(() => {
  // jsdom ships no WebGL2 interfaces; pose as a browser that can draw.
  vi.stubGlobal("WebGL2RenderingContext", class WebGL2RenderingContext {});
  vi.mocked(mountScene).mockImplementation((config) => {
    mounted = config;
    return session;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mounted = undefined;
  document.body.replaceChildren();
});

describe("今日's live preview of the day's walk", () => {
  it("stands a procedural scene at its first step, sound asleep", () => {
    renderPreview(entryOf("crane"));
    const context = mounted!.context as ProceduralContext;
    expect(context.progress).toBe(0);
    expect(context.sceneId).toBe("crane");
    expect(context.stage).toBe(sceneStage("crane"));
    // Read-only: checkpoints go nowhere, no sound plays, nothing is saved.
    expect(context.checkpoint(3)).toBeUndefined();
    expect(context.isSoundEnabled?.()).toBe(false);
    expect(context.saveWish).toBeUndefined();
    expect(context.prepareFeedback).toBeUndefined();
    expect(context.haptic).toBeUndefined();
  });

  it("mounts one session on the stage host, marked until the scene is ready", () => {
    const entry = entryOf("crane");
    const ui = renderPreview(entry);
    expect(mountScene).toHaveBeenCalledTimes(1);
    expect(mounted!.host.className).toBe(
      "library-scene-stage daily-set-preview-stage",
    );
    expect(mounted!.host.getAttribute("data-scene")).toBe("crane");
    expect(mounted!.active).toBe(true);
    expect(mounted!.reducedMotion).toBe(false);
    const preview = ui.host.querySelector(".daily-set-preview")!;
    expect(preview.getAttribute("data-status")).toBe("loading");
    act(() => mounted!.ready());
    expect(
      ui.host.querySelector(".daily-set-preview")!.getAttribute("data-status"),
    ).toBe("ready");
  });

  it("steps aside to the plain card when the scene fails", () => {
    const ui = renderPreview(entryOf("crane"));
    act(() => mounted!.failed(new Error("WebGL context lost")));
    expect(ui.host.querySelector(".daily-set-preview")).toBeNull();
    // Gone from the page, but its session still ends when the card does.
    expect(session.dispose).not.toHaveBeenCalled();
    ui.unmount();
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });

  it("draws nothing at all without WebGL2", () => {
    vi.unstubAllGlobals();
    expect(canPreviewScenes()).toBe(false);
    const ui = renderPreview(entryOf("crane"));
    expect(mountScene).not.toHaveBeenCalled();
    expect(ui.host.querySelector(".daily-set-preview")).toBeNull();
    ui.unmount();
  });

  it("pauses when the app sleeps or the stage scrolls away", () => {
    class Observer {
      static latest: Observer;
      callback: (entries: IntersectionObserverEntry[]) => void;
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        this.callback = callback;
        Observer.latest = this;
      }
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    const entry = entryOf("crane");
    const ui = renderPreview(entry);
    // Watching the frame: drawn while it is on screen…
    const frame = ui.host.querySelector(".daily-set-preview")!;
    expect(Observer.latest.observe).toHaveBeenCalledWith(frame);
    expect(session.setActive).toHaveBeenCalledWith(true);
    // …not while it is scrolled off (down to the picks on a short screen)…
    const seen = (intersecting: boolean) =>
      act(() =>
        Observer.latest.callback([
          { isIntersecting: intersecting } as IntersectionObserverEntry,
        ]),
      );
    seen(false);
    expect(session.setActive).toHaveBeenLastCalledWith(false);
    seen(true);
    expect(session.setActive).toHaveBeenLastCalledWith(true);
    // …and not while the App itself is backgrounded.
    ui.rerender(
      createElement(
        Context.Provider,
        { value: appContext({ active: false }) },
        createElement(
          ContentContext.Provider,
          { value: {} },
          createElement(DailyScenePreview, { entry }),
        ),
      ),
    );
    expect(session.setActive).toHaveBeenLastCalledWith(false);
    expect(mountScene).toHaveBeenCalledTimes(1);
    ui.unmount();
    expect(Observer.latest.disconnect).toHaveBeenCalled();
  });

  it("follows the motion preference without remounting", () => {
    const entry = entryOf("crane");
    const ui = renderPreview(
      entry,
      appContext({ state: createState({ reducedMotion: true }) }),
    );
    expect(mounted!.reducedMotion).toBe(true);
    expect(session.setReducedMotion).toHaveBeenCalledWith(true);
    ui.rerender(
      createElement(
        Context.Provider,
        { value: appContext({ state: createState({ reducedMotion: false }) }) },
        createElement(
          ContentContext.Provider,
          { value: {} },
          createElement(DailyScenePreview, { entry }),
        ),
      ),
    );
    expect(session.setReducedMotion).toHaveBeenLastCalledWith(false);
    expect(mountScene).toHaveBeenCalledTimes(1);
  });

  it("shows the woodfish without its sound or its updates", async () => {
    const entry = entryOf("woodfish");
    // The content environment's io, watching for a preview that writes.
    const reads = {
      readHistory: vi.fn(),
      writeHistory: vi.fn(),
      readManifest: vi.fn(),
      readAsset: vi.fn(),
      readCachedAsset: vi.fn(),
    };
    const ui = renderPreview(entry, appContext(), { io: reads });
    const context = mounted!.context as WoodfishContext;
    expect(context.sceneId).toBe("woodfish");
    // No sound in a preview: decoding never succeeds.
    await expect(context.decodeSound(new ArrayBuffer(0))).rejects.toThrow(
      "A preview has no sound",
    );
    // Its instructions and its strikes reach nobody.
    expect(context.onInstruction("轻轻一敲")).toBeUndefined();
    expect(context.impact()).toBeUndefined();
    // Its content never fetches an update in the background.
    await expect(context.content.prepareUpdate()).resolves.toBeUndefined();
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
    expect(
      ui.host.querySelector(".daily-set-preview-stage")!.getAttribute("data-stage"),
    ).toBe(sceneStage("woodfish"));
  });
});

describe("previewContent", () => {
  it("reads through load but keeps updates and confirmations to itself", async () => {
    const confirm = vi.fn(async () => {});
    const prepareUpdate = vi.fn(async () => {});
    const release = vi.fn(async () => {});
    const pack = { schemaVersion: 1, sceneId: "woodfish" } as never;
    const load = vi.fn(
      async (
        initialize: (
          pack: unknown,
          model: ArrayBuffer,
          sound?: ArrayBuffer,
        ) => Promise<unknown>,
      ) => {
        const value = await initialize(pack, new ArrayBuffer(8));
        return { pack, value, confirm, release };
      },
    );
    const wrapped = previewContent({ prepareUpdate, load } as never);
    // No refresh is prepared behind the scenes.
    await wrapped.prepareUpdate();
    expect(prepareUpdate).not.toHaveBeenCalled();
    // A load still runs the scene's own initialization and keeps its lease.
    const initialized = vi.fn(
      async (pack: unknown, model: ArrayBuffer) => `${String((pack as object))}:${model.byteLength}`,
    );
    const lease = await wrapped.load(initialized, {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(initialized).toHaveBeenCalledWith(pack, expect.any(ArrayBuffer));
    expect(lease.value).toBe(`${String(pack)}:8`);
    expect(lease.pack).toBe(pack);
    // But confirming the candidate changes nothing: only a walk moves it along.
    await lease.confirm();
    expect(confirm).not.toHaveBeenCalled();
    await lease.release?.();
    expect(release).toHaveBeenCalled();
  });
});
