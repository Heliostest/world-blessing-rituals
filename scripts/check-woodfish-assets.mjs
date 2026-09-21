import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../assets/woodfish/", import.meta.url);
const mesh = await readFile(new URL("body.bin", root));
const vertices = mesh.readUInt32LE(0),
  indices = mesh.readUInt32LE(4);
assert.equal(mesh.length, 8 + vertices * 24 + indices * 4);
assert.ok(indices / 3 < 80000, "Keep body below the mobile triangle budget");
const edges = new Map();
for (let v = 0; v < vertices; v++) {
  for (let d = 0; d < 3; d++)
    assert.ok(Number.isFinite(mesh.readFloatLE(8 + v * 12 + d * 4)));
  const n = [0, 1, 2].map((d) =>
    mesh.readFloatLE(8 + vertices * 12 + v * 12 + d * 4),
  );
  assert.ok(Math.abs(Math.hypot(...n) - 1) < 0.001);
}
for (let i = 0; i < indices; i += 3) {
  const face = [0, 1, 2].map((d) =>
    mesh.readUInt32LE(8 + vertices * 24 + (i + d) * 4),
  );
  assert.equal(new Set(face).size, 3, "No collapsed faces");
  for (let d = 0; d < 3; d++) {
    const a = face[d],
      b = face[(d + 1) % 3];
    assert.ok(a < vertices && b < vertices);
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const entry = edges.get(key) ?? { count: 0, direction: 0 };
    entry.count++;
    entry.direction += a < b ? 1 : -1;
    edges.set(key, entry);
  }
}
for (const edge of edges.values()) {
  assert.equal(
    edge.count,
    2,
    "Shell must be watertight, including the opening lip",
  );
  assert.equal(edge.direction, 0, "Consistent face winding");
}
for (const name of ["color", "normal", "roughness"]) {
  const png = await readFile(new URL(`${name}.png`, root));
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(png[24], 8);
  assert.equal(png[25], 2);
}
for (const name of ["color", "normal", "roughness"]) {
  const png = await readFile(new URL(`generated-v1/${name}.png`, root));
  assert.equal(png.readUInt32BE(16), 1254);
  assert.equal(png.readUInt32BE(20), 1254);
  assert.equal(png[24], 8);
  assert.equal(png[25], 2);
}
console.log(
  `Woodfish assets verified: ${vertices} vertices, ${indices / 3} triangles, closed manifold; three 1254px generated maps and three 512px procedural originals.`,
);
await import("./check-woodfish-glb.mjs");
