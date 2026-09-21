import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function check(file, budget, triangleBudget) {
  const bytes = await readFile(new URL(file, import.meta.url));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < budget, "Mobile GLB file budget");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const bin = bytes.subarray(28 + jsonLength);
  assert.equal(gltf.buffers.length, 1);
  assert.ok(!gltf.buffers[0].uri, "No external network dependencies");
  assert.deepEqual(gltf.nodes.map((n) => n.name).sort(), [
    "Mallet",
    "WoodfishBody",
  ]);
  for (const node of gltf.nodes) {
    assert.deepEqual(
      node.translation ?? [0, 0, 0],
      [0, 0, 0],
      "Export at animation origin, not studio preview placement",
    );
    assert.deepEqual(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1]);
    assert.deepEqual(node.scale ?? [1, 1, 1], [1, 1, 1]);
    assert.ok(
      !node.matrix,
      "Bake model transforms into geometry for strike raycasts",
    );
  }

  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const components = {
    5126: [4, "readFloatLE"],
    5125: [4, "readUInt32LE"],
    5123: [2, "readUInt16LE"],
  };
  function accessor(index) {
    const a = gltf.accessors[index],
      view = gltf.bufferViews[a.bufferView];
    const [size, read] = components[a.componentType];
    const width = widths[a.type],
      stride = view.byteStride ?? size * width;
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: width }, (_, j) =>
        bin[read](offset + i * stride + j * size),
      ),
    );
  }
  let triangles = 0;
  for (const mesh of gltf.meshes) {
    assert.equal(mesh.primitives.length, 1, "One draw call per wooden object");
    const primitive = mesh.primitives[0],
      a = primitive.attributes;
    for (const key of ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"])
      assert.ok(Number.isInteger(a[key]), `${mesh.name}: missing ${key}`);
    const positions = accessor(a.POSITION);
    const normals = accessor(a.NORMAL),
      tangents = accessor(a.TANGENT),
      uvs = accessor(a.TEXCOORD_0);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(positions[i].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...normals[i]) - 1) < 0.002);
      assert.ok(Math.abs(Math.hypot(...tangents[i].slice(0, 3)) - 1) < 0.002);
      assert.ok(Math.abs(tangents[i][3]) === 1);
      assert.ok(
        uvs[i].every((v) => v >= -1e-5 && v <= 1.00001),
        "UVs stay inside atlas",
      );
    }
    const indices = accessor(primitive.indices).flat();
    triangles += indices.length / 3;
    const edges = new Map();
    // glTF splits vertices at UV seams. Weld exact positions only for topology QA.
    const keys = positions.map((p) => p.join(","));
    for (let i = 0; i < indices.length; i += 3) {
      const face = indices.slice(i, i + 3).map((j) => keys[j]);
      assert.equal(new Set(face).size, 3, "No collapsed exported triangles");
      for (let j = 0; j < 3; j++) {
        const x = face[j],
          y = face[(j + 1) % 3];
        const key = x < y ? `${x}|${y}` : `${y}|${x}`;
        const entry = edges.get(key) ?? { count: 0, winding: 0 };
        entry.count++;
        entry.winding += x < y ? 1 : -1;
        edges.set(key, entry);
      }
    }
    for (const edge of edges.values()) {
      assert.equal(edge.count, 2, "Closed shell including carved opening");
      assert.equal(edge.winding, 0, "Consistent outward face winding");
    }
  }
  assert.ok(triangles < triangleBudget, "Combined mobile geometry budget");
  for (const material of gltf.materials) {
    assert.ok(material.normalTexture);
    assert.ok(material.occlusionTexture);
    assert.ok(material.pbrMetallicRoughness.baseColorTexture);
    assert.equal(material.pbrMetallicRoughness.metallicFactor, 0);
    assert.equal(
      material.occlusionTexture.index,
      material.pbrMetallicRoughness.metallicRoughnessTexture.index,
    );
    assert.ok(
      !material.doubleSided,
      "A closed carved shell needs no backface shortcut",
    );
  }
  for (const image of gltf.images) {
    assert.ok(
      !image.uri && Number.isInteger(image.bufferView),
      "Textures embedded for offline use",
    );
  }
  console.log(
    `Blender GLB verified: ${triangles} triangles, UVs/tangents, closed shells, embedded PBR + AO, ${(bytes.length / 1048576).toFixed(2)} MiB.`,
  );
}
await check("../assets/woodfish/blender-v2/woodfish.glb", 12 * 1048576, 100000);
await check("../assets/woodfish/bundled-v1/woodfish.glb", 2 * 1048576, 30000);
