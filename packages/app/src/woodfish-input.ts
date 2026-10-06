/** Presses up to this long end in the browser's own click; longer ones may not. */
export const QUICK_PRESS_MS = 350;

/**
 * How a press on the woodfish ends: "tap" strikes through the click that
 * follows, "long" strikes on release (mobile browsers send no click after a
 * long press), "none" does not strike. A still press strikes however long it
 * was held. Maximum travel, not end-point distance: dragging out and back
 * moves the mallet and isn't a strike.
 */
export function pressOutcome({
  distance,
  elapsed,
  cancelled,
}: {
  distance: number;
  elapsed: number;
  cancelled: boolean;
}): "tap" | "long" | "none" {
  if (cancelled || distance > 8) return "none";
  return elapsed <= QUICK_PRESS_MS ? "tap" : "long";
}
