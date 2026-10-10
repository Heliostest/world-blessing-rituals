import type { RitualId } from "@wbr/core";

/** A box in page coordinates (fixed-position space), as measured live. */
export type Rect = { x: number; y: number; width: number; height: number };

/** One item's trip from the completion card to its home. */
export type RewardFlight = {
  /** The sticker that flies: an inventory crop, a scene icon, or the leaf note. */
  kind: RitualId | "leaf" | "scene";
  /** kind "scene": which scene's keepsake is flying home. */
  sceneId?: string;
  /** Measured before go(): go() scrolls to the top. */
  from: Rect;
  /** Lands on [data-collectible-id] (小天地 shelf), then [data-wish-id]. */
  collectibleId?: string;
  /** Lands on [data-wish-id] (a wish card) and badges the 心愿 tab. */
  wishId?: string;
  /** The tab the item falls back to (小天地), or flies to on ✕ / back. */
  tab?: "world" | "wishes";
  /** Spoken once the item has landed. */
  announce: string;
};

/** An item on its way home (flying), or just landed (新 mark, tab badge). */
export type RewardArrival = {
  /** Distinguishes one arrival from the next, for re-keyed CSS pops. */
  key: number;
  collectibleId?: string;
  wishId?: string;
  /** The tab that shows the +1 when nothing landed in the room itself. */
  tab?: "world" | "wishes";
  phase: "flying" | "landed";
};

export const ARRIVAL_LINGER_MS = 4000;

/** The element's rect, or an empty one where jsdom does no layout. */
export function rectOf(el: Element | null | undefined): Rect {
  const r = el?.getBoundingClientRect();
  return {
    x: r?.left ?? 0,
    y: r?.top ?? 0,
    width: r?.width ?? 0,
    height: r?.height ?? 0,
  };
}

/**
 * Whether motion should be skipped: the in-app 减少动态效果 toggle or the
 * system's own preference. The CSS kill switch cannot see Web Animations.
 */
export function shouldReduceMotion(setting: boolean): boolean {
  if (setting) return true;
  if (typeof matchMedia !== "function") return false;
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Where this flight lands: the shelf slot, the wish card, or the tab. */
export function resolveTarget(flight: RewardFlight): {
  el: Element | null;
  kind: "shelf" | "wish" | "tab" | "none";
} {
  if (flight.collectibleId) {
    const el = document.querySelector(
      `[data-collectible-id="${flight.collectibleId}"]`,
    );
    if (el) return { el, kind: "shelf" };
  }
  if (flight.wishId) {
    const el = document.querySelector(`[data-wish-id="${flight.wishId}"]`);
    if (el) return { el, kind: "wish" };
  }
  const el = document.querySelector(
    `[data-tab="${flight.tab ?? "world"}"]`,
  );
  return el ? { el, kind: "tab" } : { el: null, kind: "none" };
}

export type FlightPlan = {
  /** Outer wrapper: horizontal travel plus the shrink to the slot's size. */
  outer: Keyframe[];
  /** Inner wrapper: the vertical arc, rising then dropping in. */
  inner: Keyframe[];
  duration: number;
  /** How far above the from-rect's top the arc peaks, in px. */
  rise: number;
};

/**
 * The FLIP keyframes for one trip: the ghost starts exactly on `from` and
 * ends centred on `to`, with scale = to.width / from.width. Two nested
 * wrappers make the arc: the outer one translates and scales, the inner
 * one rides an overshooting translateY curve.
 */
export function flightKeyframes(from: Rect, to: Rect): FlightPlan {
  const scale =
    from.width > 0 && to.width > 0 ? to.width / from.width : 1;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  // Rise enough to peak above whichever rect sits higher, so the toss
  // reads as an arc even when the slot is above the card's sticker.
  const rise = 64 + Math.max(0, from.y - to.y);
  return {
    duration: 560,
    outer: [
      { transform: "translate(0px, 0px) scale(1)" },
      { transform: `translate(${dx}px, 0px) scale(${scale})` },
    ],
    inner: [
      { transform: "translateY(0px)" },
      { transform: `translateY(${-rise}px)`, offset: 0.5 },
      { transform: `translateY(${dy}px)` },
    ],
    rise,
  };
}
