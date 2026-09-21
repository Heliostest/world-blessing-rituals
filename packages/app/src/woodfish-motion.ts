import { Quaternion, Vector3 } from "three";
import { DEFAULT_PARAMETERS } from "@wbr/content";
export const HEAD_RADIUS = 0.255;
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
  const grip = center.clone().add(new Vector3(...parameters.gripOffset));
  const lever = center.clone().sub(grip);
  const axis = lever.clone().cross(normal).normalize();
  const rotation = new Quaternion().setFromAxisAngle(axis, Math.max(0, angle));
  return { head: lever.applyQuaternion(rotation).add(grip), grip, rotation };
}
