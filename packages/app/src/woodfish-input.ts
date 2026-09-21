/** Maximum travel, not end-point distance: dragging out and back isn't a tap. */
export function isTap({
  distance,
  elapsed,
  cancelled,
}: {
  distance: number;
  elapsed: number;
  cancelled: boolean;
}) {
  return !cancelled && distance <= 8 && elapsed <= 350;
}
