import { reduce, restore, type Action, type State } from "@wbr/core";
/**
 * The one save: the whole State (keepsakes included) as JSON, written on every
 * dispatch. The web host keeps it in localStorage; the phone App keeps it in
 * AsyncStorage under the same key (apps/mobile-expo/App.tsx).
 */
export const SAVE_KEY = "cyber-bless:personal:v1";
export type Storage = {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
};
/** `haptic` only where the host can vibrate; the App hides its 震动 toggle otherwise. */
export type Host = Storage & { haptic?(): Promise<void> };
type Snapshot = {
  state: State | null;
  status: "loading" | "load-error" | "saving" | "saved" | "save-error";
  error?: string;
};
export function createStore(
  storage: Storage,
  /** Settings for a brand-new save, read when it is first loaded. */
  initialSettings?: () => Partial<State["settings"]>,
) {
  let snapshot: Snapshot = { state: null, status: "loading" };
  let queue = Promise.resolve();
  let revision = 0;
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((fn) => fn());
  };
  const save = () => {
    if (!snapshot.state) return;
    const raw = JSON.stringify(snapshot.state);
    const current = ++revision;
    publish({ ...snapshot, status: "saving", error: undefined });
    queue = queue
      .then(() => storage.write(raw))
      .then(() => {
        if (current === revision)
          publish({ ...snapshot, status: "saved", error: undefined });
      })
      .catch(() => {
        if (current === revision)
          publish({
            ...snapshot,
            status: "save-error",
            error: "这次变化还没保存，请重试并暂时保留页面。",
          });
      });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    load() {
      if (loading) return loading;
      publish({ state: null, status: "loading" });
      loading = storage
        .read()
        .then((raw) =>
          publish({ state: restore(raw, initialSettings?.()), status: "saved" }),
        )
        .catch(() =>
          publish({
            state: null,
            status: "load-error",
            error: "暂时无法读取记录，原数据已保留。请重新读取。",
          }),
        )
        .finally(() => {
          loading = undefined;
        });
      return loading;
    },
    dispatch(action: Action) {
      if (!snapshot.state) throw new Error("请先读取记录");
      const next = reduce(snapshot.state, action);
      if (next === snapshot.state) return;
      snapshot = { ...snapshot, state: next };
      save();
    },
    retry: save,
    flush: () => queue,
  };
}
export type Store = ReturnType<typeof createStore>;
export function browserHost(): Host {
  // Checked once: iOS browsers have no Vibration API, so no haptics there.
  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  return {
    read: async () => localStorage.getItem(SAVE_KEY),
    write: async (raw) => localStorage.setItem(SAVE_KEY, raw),
    ...(canVibrate
      ? {
          haptic: async () => {
            navigator.vibrate(12);
          },
        }
      : {}),
  };
}
