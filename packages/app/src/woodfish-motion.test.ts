import { expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  swingPose,
  handleRotation,
  HEAD_RADIUS,
  MIN_HANDLE_LIFT,
} from "./woodfish-motion";
import { DEFAULT_PARAMETERS } from "@wbr/content";
import { pressOutcome, QUICK_PRESS_MS } from "./woodfish-input";

it("tells a strike from a drag, cancellation and secondary touch; a long still press strikes too", () => {
  const press = (distance: number, elapsed: number, cancelled = false) =>
    pressOutcome({ distance, elapsed, cancelled });
  // A quick still tap strikes through the click that follows.
  expect(press(5, 120)).toBe("tap");
  expect(press(8, QUICK_PRESS_MS)).toBe("tap");
  // Held longer but still: it strikes on release (no click may follow).
  expect(press(0, QUICK_PRESS_MS + 1)).toBe("long");
  expect(press(0, 700)).toBe("long");
  expect(press(3, 5000)).toBe("long");
  // Moving the mallet is no strike, however quick or slow.
  expect(press(20, 120)).toBe("none");
  expect(press(9, 700)).toBe("none");
  // A second finger or a pointercancel calls it off.
  expect(press(0, 50, true)).toBe("none");
  expect(press(0, 700, true)).toBe("none");
});

it("keeps a rigid grip-to-head distance and never swings through the contact plane", () => {
  for (const normal of [
    new Vector3(0, 0, 1),
    new Vector3(0.45, 0.35, 0.82).normalize(),
    new Vector3(-0.5, 0.4, 0.75).normalize(),
    // Left flank and crown of the bundled shell (aim.x < 0).
    new Vector3(-0.62, 0.54, 0.57).normalize(),
    new Vector3(-0.31, 0.71, 0.63).normalize(),
    new Vector3(-0.47, 0.74, 0.47).normalize(),
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

it("keeps the handle out of the shell on left-half and crown strikes", () => {
  const offset = new Vector3(...DEFAULT_PARAMETERS.gripOffset);
  // Surface normals sampled from the bundled GLB across the strike clamp.
  const left = [
    [-0.59, 0.27, 0.76],
    [-0.62, 0.54, 0.57],
    [-0.65, 0.66, 0.38],
    [-0.58, 0.75, 0.31],
    [-0.47, 0.74, 0.47],
    [-0.31, 0.71, 0.63],
    [-0.11, 0.69, 0.71],
    [-0.43, 0.5, 0.75],
  ];
  // Previously the authored handle pointed back into the shell here.
  for (const n of left) {
    const normal = new Vector3(...n).normalize();
    expect(offset.clone().normalize().dot(normal)).toBeLessThan(0);
  }
  for (const n of [...left, [0, 0, 1], [0.37, 0.17, 0.91], [0.58, 0.69, 0.43]]) {
    const normal = new Vector3(...n).normalize();
    const point = new Vector3(-0.4, 0.6, 0.6);
    for (let angle = 0; angle <= 0.32; angle += 0.01) {
      const pose = swingPose(point, normal, angle);
      const handle = offset.clone().normalize().applyQuaternion(pose.rotation);
      if (angle === 0)
        expect(handle.dot(normal)).toBeGreaterThanOrEqual(MIN_HANDLE_LIFT - 1e-6);
      // Head and grip, and so the straight handle between, clear the tangent plane.
      expect(pose.grip.clone().sub(point).dot(normal)).toBeGreaterThan(
        HEAD_RADIUS,
      );
      // The mesh's authored grip lands on the lever pivot.
      expect(
        offset
          .clone()
          .applyQuaternion(pose.rotation)
          .add(pose.head)
          .distanceTo(pose.grip),
      ).toBeLessThan(1e-5);
    }
  }
});

it("leaves the authored mallet unturned where its handle already clears", () => {
  const normal = new Vector3(0.7, -0.1, 0.7).normalize();
  const offset = new Vector3(...DEFAULT_PARAMETERS.gripOffset);
  expect(offset.clone().normalize().dot(normal)).toBeGreaterThan(
    MIN_HANDLE_LIFT,
  );
  expect(handleRotation(normal, offset).angleTo(new Quaternion())).toBe(0);
});
