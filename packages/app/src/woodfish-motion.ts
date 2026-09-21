import { Quaternion, Vector3 } from "three";
export const HEAD_RADIUS = 0.255;
const gripOffset = new Vector3(0.65, -0.9, 0.1);
/** A rigid lever rotating around the grip. Angle never crosses the contact plane. */
export function swingPose(point: Vector3, normal: Vector3, angle: number) {
  const center = point.clone().addScaledVector(normal, HEAD_RADIUS + 0.006);
  const grip = center.clone().add(gripOffset);
  const lever = center.clone().sub(grip);
  const axis = lever.clone().cross(normal).normalize();
  const rotation = new Quaternion().setFromAxisAngle(axis, Math.max(0, angle));
  return { head: lever.applyQuaternion(rotation).add(grip), grip, rotation };
}
