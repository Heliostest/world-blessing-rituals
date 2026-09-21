import { expect, it } from "vitest";
import { Vector3 } from "three";
import { swingPose, HEAD_RADIUS } from "./woodfish-motion";
import { isTap } from "./woodfish-input";

it("distinguishes a tap from a drag, long press, cancellation and secondary touch", () => {
  expect(isTap({ distance: 5, elapsed: 120, cancelled: false })).toBe(true);
  expect(isTap({ distance: 20, elapsed: 120, cancelled: false })).toBe(false);
  expect(isTap({ distance: 0, elapsed: 700, cancelled: false })).toBe(false);
  expect(isTap({ distance: 0, elapsed: 50, cancelled: true })).toBe(false);
});

it("keeps a rigid grip-to-head distance and never swings through the contact plane", () => {
  for (const normal of [
    new Vector3(0, 0, 1),
    new Vector3(0.45, 0.35, 0.82).normalize(),
    new Vector3(-0.5, 0.4, 0.75).normalize(),
  ]) {
    const point = new Vector3(0.2, 0.6, 0.6);
    const contact = swingPose(point, normal, 0);
    expect(contact.head.clone().sub(point).dot(normal)).toBeCloseTo(
      HEAD_RADIUS + 0.006,
      5,
    );
    for (let angle = 0; angle <= 0.4; angle += 0.005) {
      const pose = swingPose(point, normal, angle);
      expect(pose.head.distanceTo(pose.grip)).toBeCloseTo(
        contact.head.distanceTo(contact.grip),
        5,
      );
      expect(pose.head.clone().sub(point).dot(normal)).toBeGreaterThanOrEqual(
        HEAD_RADIUS + 0.0059,
      );
      expect(pose.rotation.length()).toBeCloseTo(1, 6);
    }
  }
});
