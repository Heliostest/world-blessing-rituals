import { Quaternion, Vector3 } from "three";
import { DEFAULT_PARAMETERS } from "@wbr/content";
export const HEAD_RADIUS = 0.255;
/** Minimum handle elevation out of the contact tangent plane, as sin(angle). */
export const MIN_HANDLE_LIFT = Math.sin(0.35);
const MAX_HANDLE_LIFT = Math.sin(0.9);
/**
 * Minimal turn of the authored mallet so its handle leaves the struck surface.
 * The GLB handle runs toward +x/-y; on the left flank and the crown that
 * direction points back into the shell, so it's tilted out along the normal.
 */
export function handleRotation(normal: Vector3, gripOffset: Vector3) {
  const authored = gripOffset.clone().normalize();
  const lift = authored.dot(normal);
  if (lift >= MIN_HANDLE_LIFT && lift <= MAX_HANDLE_LIFT)
    return new Quaternion();
  let tangent = authored.clone().addScaledVector(normal, -lift);
  // Handle square to the surface: lean it toward the viewer instead.
  if (tangent.lengthSq() < 1e-6)
    tangent = new Vector3(0, 0, 1).addScaledVector(normal, -normal.z);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  const sin = Math.min(Math.max(lift, MIN_HANDLE_LIFT), MAX_HANDLE_LIFT);
  const handle = tangent
    .normalize()
    .multiplyScalar(Math.sqrt(1 - sin * sin))
    .addScaledVector(normal, sin);
  return new Quaternion().setFromUnitVectors(authored, handle);
}
/** A rigid lever rotating around the grip. Angle never crosses the contact plane. */
export function swingPose(
  point: Vector3,
  normal: Vector3,
  angle: number,
  parameters = DEFAULT_PARAMETERS,
) {
  const center = point
    .clone()
    .addScaledVector(normal, parameters.headRadius + 0.006);
  const offset = new Vector3(...parameters.gripOffset);
  const base = handleRotation(normal, offset);
  const grip = center.clone().add(offset.applyQuaternion(base));
  const lever = center.clone().sub(grip);
  const axis = lever.clone().cross(normal).normalize();
  const swing = new Quaternion().setFromAxisAngle(axis, Math.max(0, angle));
  return {
    head: lever.applyQuaternion(swing).add(grip),
    grip,
    rotation: swing.multiply(base),
  };
}
