import type { RenderStyleId } from "@wbr/content";

export const styleOptions = [
  { id: "original", label: "原始光照", detail: "保留材质与自然明暗" },
  { id: "toon-ink", label: "墨线卡通", detail: "插画色块 · 几何细轮廓" },
  { id: "toon-soft", label: "柔和卡通", detail: "哑光玩具 · 柔和明暗" },
] as const;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type DebugScene = {
  id: string;
  label: string;
  defaultStyle: RenderStyleId;
  override: RenderStyleId | null;
  actual: RenderStyleId;
};
type Entry = { state: DebugScene; apply(style: RenderStyleId): void };
const storageKey = "wbr.debug.scene-styles.v1";
function isStyle(value: unknown): value is RenderStyleId {
  return styleOptions.some((option) => option.id === value);
}

export function createDebugStyles() {
  let enabled = false;
  let storage: Storage | undefined;
  const choices = new Map<string, RenderStyleId>();
  const entries = new Map<symbol, Entry>();
  const listeners = new Set<() => void>();
  let snapshot: DebugScene[] = [];
  function publish() {
    snapshot = [...entries.values()].map(({ state }) => ({ ...state }));
    listeners.forEach((listener) => listener());
  }
  function apply(entry: Entry) {
    entry.state.override = enabled ? choices.get(entry.state.id) ?? null : null;
    entry.state.actual = entry.state.override ?? entry.state.defaultStyle;
    entry.apply(entry.state.actual);
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enable(nextStorage?: Storage) {
      if (enabled) return;
      enabled = true;
      storage = nextStorage;
      try {
        const saved: unknown = JSON.parse(storage?.getItem(storageKey) ?? "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          for (const [id, style] of Object.entries(saved)) {
            if (isStyle(style)) choices.set(id, style);
          }
        }
      } catch { /* Storage may be unavailable or contain an older format. */ }
      entries.forEach(apply);
      publish();
    },
    select(id: string, style: RenderStyleId | null) {
      if (!enabled || (style !== null && !isStyle(style))) return;
      if (style === null) choices.delete(id);
      else choices.set(id, style);
      try { storage?.setItem(storageKey, JSON.stringify(Object.fromEntries(choices))); }
      catch { /* Live preview remains usable when persistence is denied. */ }
      entries.forEach((entry) => { if (entry.state.id === id) apply(entry); });
      publish();
    },
    register(id: string, label: string, onStyle: (style: RenderStyleId) => void) {
      const token = Symbol(id);
      const entry: Entry = {
        state: { id, label, defaultStyle: "original", override: null, actual: "original" },
        apply: onStyle,
      };
      entries.set(token, entry);
      apply(entry);
      publish();
      return {
        setDefault(style: RenderStyleId) {
          if (!entries.has(token)) return;
          entry.state.defaultStyle = style;
          apply(entry);
          publish();
        },
        report(actual: RenderStyleId) {
          if (!entries.has(token) || actual === entry.state.actual) return;
          entry.state.actual = actual;
          publish();
        },
        dispose() { entries.delete(token); publish(); },
      };
    },
  };
}

export const debugStyles = createDebugStyles();
