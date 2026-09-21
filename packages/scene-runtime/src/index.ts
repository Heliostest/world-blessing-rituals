export type SceneSettings = { active: boolean; reducedMotion: boolean };
export type SceneMountOptions = SceneSettings & {
  signal: AbortSignal;
  ready(): void;
  failed(error?: unknown): void;
};
export interface SceneController {
  setActive(active: boolean): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}
export interface SceneEngine<Context, Controller extends SceneController> {
  create(
    host: HTMLDivElement,
    context: Context,
    options: SceneMountOptions,
  ): Controller;
}
export type SceneSession<Controller extends SceneController> =
  SceneController & {
    readonly controller: Controller | null;
    /** Engine module mounted, not necessarily first-frame ready. Never rejects. */
    initialized: Promise<void>;
  };
export type Visibility = {
  readonly hidden: boolean;
  subscribe(listener: () => void): () => void;
};
function pageVisibility(): Visibility {
  return {
    get hidden() {
      return document.hidden;
    },
    subscribe(listener) {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}
/** The host owns lifecycle and cancellation; an engine owns its GPU/input state. */
export function mountScene<Context, Controller extends SceneController>(
  config: SceneSettings & {
    host: HTMLDivElement;
    context: Context;
    load(): Promise<SceneEngine<Context, Controller>>;
    visibility?: Visibility;
    ready(): void;
    failed(error?: unknown): void;
  },
): SceneSession<Controller> {
  const cancellation = new AbortController();
  const visibility = config.visibility ?? pageVisibility();
  let active = config.active,
    reducedMotion = config.reducedMotion;
  let stopped = false,
    reported = false;
  let controller: Controller | null = null;
  const unsubscribe = visibility.subscribe(() =>
    controller?.setActive(active && !visibility.hidden),
  );
  function dispose() {
    if (stopped) return;
    stopped = true;
    cancellation.abort();
    unsubscribe();
    const previous = controller;
    controller = null;
    try {
      previous?.dispose();
    } catch {
      /* Continue teardown even after GPU loss. */
    }
  }
  function failed(error?: unknown) {
    if (stopped) return;
    dispose();
    config.failed(error);
  }
  const initialized = (async () => {
    try {
      const engine = await config.load();
      if (stopped) return;
      const instance = engine.create(config.host, config.context, {
        active: active && !visibility.hidden,
        reducedMotion,
        signal: cancellation.signal,
        ready: () =>
          queueMicrotask(() => {
            if (stopped || reported) return;
            reported = true;
            config.ready();
          }),
        failed,
      });
      // An engine may fail synchronously during create(), before assignment.
      if (stopped) {
        instance.dispose();
        return;
      }
      controller = instance;
    } catch (error) {
      failed(error);
    }
  })();
  return {
    get controller() {
      return controller;
    },
    initialized,
    dispose,
    setActive(value) {
      active = value;
      if (!stopped) controller?.setActive(active && !visibility.hidden);
    },
    setReducedMotion(value) {
      reducedMotion = value;
      if (!stopped) controller?.setReducedMotion(value);
    },
  };
}
/** Local code-only registry. Each key retains its engine's context/controller types. */
export function createSceneRegistry<
  Entries extends Record<string, () => Promise<SceneEngine<any, any>>>,
>(entries: Entries) {
  return {
    load<Key extends keyof Entries>(id: Key): ReturnType<Entries[Key]> {
      if (!Object.prototype.hasOwnProperty.call(entries, id))
        return Promise.reject(Error("Unknown scene engine")) as ReturnType<
          Entries[Key]
        >;
      return entries[id]() as ReturnType<Entries[Key]>;
    },
  };
}
