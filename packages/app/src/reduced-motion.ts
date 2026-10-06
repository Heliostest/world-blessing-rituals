import type { State } from "@wbr/core";
import type { Store } from "@wbr/runtime";

const QUERY = "(prefers-reduced-motion: reduce)";

/** The system's reduced-motion query, where the platform has one. */
function systemQuery(): MediaQueryList | undefined {
  return typeof globalThis.matchMedia === "function"
    ? globalThis.matchMedia(QUERY)
    : undefined;
}

/** Settings for a brand-new save: 减少动态效果 starts as the system asks. */
export function initialSettings(): Partial<State["settings"]> {
  return { reducedMotion: systemQuery()?.matches ?? false };
}

/**
 * Follows the system when its reduced-motion preference changes while the App
 * is open; the toggle in 我的 can still override it. Returns a stop.
 */
export function followSystemReducedMotion(store: Store): () => void {
  const query = systemQuery();
  if (typeof query?.addEventListener !== "function") return () => {};
  const follow = () => {
    const state = store.getSnapshot().state;
    if (state && state.settings.reducedMotion !== query.matches)
      store.dispatch({
        type: "settings",
        key: "reducedMotion",
        value: query.matches,
      });
  };
  query.addEventListener("change", follow);
  return () => query.removeEventListener("change", follow);
}
