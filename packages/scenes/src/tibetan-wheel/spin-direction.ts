/**
 * Clockwise seen from above (looking down −Y) is a *negative* rotation about
 * +Y in Three.js's right-handed, Y-up frame. The drum's front face (toward the
 * +Z camera) therefore moves to the viewer's left.
 */
export const CLOCKWISE_FROM_ABOVE = -1

/**
 * Drum drive from a `createSpin` angle delta (positive = pointer moved right).
 * Only right-to-left motion pushes the front face the clockwise way; the
 * reverse direction is refused and yields 0.
 */
export function clockwiseImpulse(deltaAngle: number): number {
  return deltaAngle < 0 ? -deltaAngle : 0
}
