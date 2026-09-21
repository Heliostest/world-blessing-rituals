// Deterministic interim assets. These are NOT GPT Image 2.5 output.
// Run: node scripts/generate-woodfish.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const dir = new URL("../assets/woodfish/", import.meta.url);
await mkdir(dir, { recursive: true });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothMin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
};
const ellipsoid = (x, y, z, rx, ry, rz) =>
  (Math.hypot(x / rx, y / ry, z / rz) - 1) * Math.min(rx, ry, rz);
function field(x, y, z) {
  const body = ellipsoid(x, y - 0.1, z, 1.1, 1.08, 0.79);
  const beak = ellipsoid(x + 0.96, y + 0.6, z, 0.32, 0.245, 0.45);
  let shell = smoothMin(body, beak, 0.22);
  // Flatten the foot, then hollow the solid. The back remains closed.
  shell = -smoothMin(-shell, y + 0.91, 0.08);
  const cavity = ellipsoid(x - 0.03, y - 0.1, z, 0.79, 0.78, 0.51);
  const hole = Math.max(Math.hypot(x + 0.32, y + 0.1) - 0.165, 0.2 - z);
  const slit = Math.max(
    Math.abs(y - (0.23 * x - 0.028)) - 0.047,
    -0.32 - x,
    x - 1.4,
    0.2 - z,
  );
  const opening = smoothMin(hole, slit, 0.06);
  return -smoothMin(-shell, Math.min(cavity, opening), 0.035);
}
function normal(p) {
  const e = 0.001;
  const n = [
    field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]),
    field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]),
    field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e),
  ];
  const l = Math.hypot(...n);
  return n.map((v) => v / l);
}
const vertices = [],
  normals = [];
function triangle(a, b, c) {
  const n = normal(a.map((v, i) => (v + b[i] + c[i]) / 3));
  const ab = b.map((v, i) => v - a[i]),
    ac = c.map((v, i) => v - a[i]);
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  if (cross.reduce((s, v, i) => s + v * n[i], 0) < 0) [b, c] = [c, b];
  for (const p of [a, b, c]) {
    vertices.push(...p);
    normals.push(...normal(p));
  }
}
const tetrahedra = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
];
const offsets = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const step = 0.0475;
for (let x = -1.51937; x < 1.25; x += step)
  for (let y = -1.05163; y < 1.3; y += step)
    for (let z = -0.93971; z < 0.94; z += step) {
      const ps = offsets.map((o) => [
        x + o[0] * step,
        y + o[1] * step,
        z + o[2] * step,
      ]);
      const ds = ps.map((p) => field(...p));
      if (ds.every((d) => d >= 0) || ds.every((d) => d < 0)) continue;
      for (const tet of tetrahedra) {
        const inside = tet.filter((i) => ds[i] < 0),
          outside = tet.filter((i) => ds[i] >= 0);
        const edge = (a, b) =>
          ps[a].map((v, i) => v + ((ps[b][i] - v) * ds[a]) / (ds[a] - ds[b]));
        if (inside.length === 1)
          triangle(...outside.map((b) => edge(inside[0], b)));
        if (inside.length === 3)
          triangle(...inside.map((a) => edge(a, outside[0])));
        if (inside.length === 2) {
          const [a, b] = inside,
            [c, d] = outside;
          triangle(edge(a, c), edge(a, d), edge(b, c));
          triangle(edge(a, d), edge(b, d), edge(b, c));
        }
      }
    }
// Deduplicate the marching-tetrahedra vertices; uint32 indices + float32 attributes.
const unique = new Map(),
  positions = [],
  ns = [],
  indices = [];
for (let i = 0; i < vertices.length; i += 3) {
  const key = vertices
    .slice(i, i + 3)
    .map((v) => v.toFixed(8))
    .join(",");
  if (!unique.has(key)) {
    unique.set(key, positions.length / 3);
    positions.push(...vertices.slice(i, i + 3));
    ns.push(...normals.slice(i, i + 3));
  }
  indices.push(unique.get(key));
}
// Exact zero crossings at the flat foot can yield collapsed or repeated faces.
const faces = new Set(),
  cleanIndices = [];
for (let i = 0; i < indices.length; i += 3) {
  const face = indices.slice(i, i + 3);
  if (new Set(face).size < 3) continue;
  const key = [...face].sort((a, b) => a - b).join(",");
  if (faces.has(key)) continue;
  faces.add(key);
  cleanIndices.push(...face);
}
// Propagate winding through edge adjacency: the SDF gradient alone can be
// ambiguous for tiny triangles at the lip / inner-cavity transition.
const edgeFaces = new Map(),
  adjacency = Array.from({ length: cleanIndices.length / 3 }, () => []);
for (let i = 0; i < cleanIndices.length; i += 3) {
  for (let j = 0; j < 3; j++) {
    const a = cleanIndices[i + j],
      b = cleanIndices[i + ((j + 1) % 3)],
      key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const entry = { face: i / 3, dir: a < b ? 1 : -1 };
    const other = edgeFaces.get(key);
    if (other) {
      adjacency[entry.face].push([other.face, -entry.dir * other.dir]);
      adjacency[other.face].push([entry.face, -entry.dir * other.dir]);
    } else edgeFaces.set(key, entry);
  }
}
const orientation = new Int8Array(adjacency.length);
orientation[0] = 1;
const pending = [0];
while (pending.length) {
  const f = pending.pop();
  for (const [other, sign] of adjacency[f])
    if (!orientation[other]) {
      orientation[other] = orientation[f] * sign;
      pending.push(other);
    }
}
if (orientation.some((v) => !v)) throw new Error("Disconnected woodfish shell");
for (let f = 0; f < orientation.length; f++)
  if (orientation[f] < 0)
    [cleanIndices[f * 3 + 1], cleanIndices[f * 3 + 2]] = [
      cleanIndices[f * 3 + 2],
      cleanIndices[f * 3 + 1],
    ];
let volume = 0;
for (let i = 0; i < cleanIndices.length; i += 3) {
  const [a, b, c] = cleanIndices
    .slice(i, i + 3)
    .map((v) => positions.slice(v * 3, v * 3 + 3));
  volume +=
    a[0] * (b[1] * c[2] - b[2] * c[1]) +
    a[1] * (b[2] * c[0] - b[0] * c[2]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
}
if (volume < 0)
  for (let i = 0; i < cleanIndices.length; i += 3)
    [cleanIndices[i + 1], cleanIndices[i + 2]] = [
      cleanIndices[i + 2],
      cleanIndices[i + 1],
    ];
const header = new Uint32Array([positions.length / 3, cleanIndices.length]);
await writeFile(
  new URL("body.bin", dir),
  Buffer.concat([
    Buffer.from(header.buffer),
    Buffer.from(new Float32Array(positions).buffer),
    Buffer.from(new Float32Array(ns).buffer),
    Buffer.from(new Uint32Array(cleanIndices).buffer),
  ]),
);

// All three periodic maps come from the same height field, with no baked light.
const size = 512,
  heights = new Float32Array(size * size),
  tau = 2 * Math.PI;
function noise(x, y, nx, ny) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const hash = (a, b) => {
    const v =
      Math.sin(
        (((a % nx) + nx) % nx) * 127.1 + (((b % ny) + ny) % ny) * 311.7,
      ) * 43758.5453;
    return v - Math.floor(v);
  };
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  return (
    (hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx) * (1 - sy) +
    (hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx) * sy
  );
}
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const u = (x / size) * tau,
      v = (y / size) * tau;
    const warp =
      0.27 * Math.sin(u + 1.3 * Math.sin(v)) +
      0.11 * Math.sin(3 * u - 2 * v) +
      0.045 * Math.sin(7 * u + v);
    const grain =
      (noise((x / size) * 12, (y / size) * 210 + warp * 7, 12, 210) - 0.5) * 2 +
      0.35 *
        (noise((x / size) * 35, (y / size) * 430 + warp * 13, 35, 430) - 0.5) +
      0.2 * Math.sin(79 * v + warp * 23);
    const pore = Math.pow(
      Math.max(
        0,
        Math.sin(173 * v + 4 * Math.sin(11 * u)) * Math.sin(71 * u + v),
      ),
      12,
    );
    heights[y * size + x] =
      grain * 0.45 + 0.05 * Math.sin(8 * v + warp * 3) - pore * 0.15;
  }
const color = Buffer.alloc(size * size * 3),
  rough = Buffer.alloc(size * size * 3),
  normalMap = Buffer.alloc(size * size * 3);
const sample = (x, y) =>
  heights[((y + size) % size) * size + ((x + size) % size)];
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3,
      h = sample(x, y),
      tone = 1 + h * 0.38;
    color[i] = clamp(163 * tone, 0, 255);
    color[i + 1] = clamp(115 * tone, 0, 255);
    color[i + 2] = clamp(78 * tone, 0, 255);
    const r = clamp(177 - h * 28, 0, 255);
    rough.fill(r, i, i + 3);
    const nx = (sample(x - 1, y) - sample(x + 1, y)) * 0.5,
      ny = (sample(x, y - 1) - sample(x, y + 1)) * 0.5,
      l = Math.hypot(nx, ny, 1);
    normalMap[i] = ((nx / l) * 0.5 + 0.5) * 255;
    normalMap[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
    normalMap[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
  }
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    l = Buffer.alloc(4),
    c = Buffer.alloc(4);
  l.writeUInt32BE(data.length);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, c]);
}
function png(data) {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(size, 0);
  h.writeUInt32BE(size, 4);
  h[8] = 8;
  h[9] = 2;
  const rows = [];
  for (let y = 0; y < size; y++)
    rows.push(
      Buffer.from([0]),
      data.subarray(y * size * 3, (y + 1) * size * 3),
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const [name, data] of [
  ["color", color],
  ["normal", normalMap],
  ["roughness", rough],
])
  await writeFile(new URL(`${name}.png`, dir), png(data));
console.log(
  `Woodfish: ${positions.length / 3} vertices, ${cleanIndices.length / 3} triangles; three aligned ${size}px maps.`,
);
