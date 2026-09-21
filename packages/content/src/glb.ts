/** Budget and dependency checks happen before allocating Three/GPU resources.
 * woodfish@1 accepts uncompressed GLB with embedded PNG textures only.
 * Additional codecs and larger geometry need an explicit engine contract.
 */
export function validateWoodfishGLB(
  bytes: ArrayBuffer,
  bindings: { body: string; mallet: string },
) {
  const header = new DataView(bytes);
  if (
    bytes.byteLength < 20 ||
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== bytes.byteLength ||
    header.getUint32(16, true) !== 0x4e4f534a
  )
    throw Error("Invalid GLB");
  const length = header.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes, 20, length)),
  );
  const binStart = 28 + length;
  if (
    header.getUint32(24 + length, true) !== 0x004e4942 ||
    binStart + header.getUint32(20 + length, true) !== bytes.byteLength
  )
    throw Error("Invalid GLB binary chunk");
  if (
    json.buffers?.length !== 1 ||
    !Array.isArray(json.nodes) ||
    json.nodes.length > 8 ||
    !Array.isArray(json.meshes) ||
    json.meshes.length > 8 ||
    (json.materials?.length ?? 0) > 8 ||
    (json.images?.length ?? 0) > 12 ||
    (json.accessors?.length ?? 0) > 32 ||
    json.extensionsUsed?.length
  )
    throw Error("Unsupported GLB layout");
  if (
    [...json.buffers, ...(json.images ?? [])].some(
      (item: { uri?: string }) => item.uri !== undefined,
    )
  )
    throw Error("External GLB resources are unsupported");
  if (
    bindings.body === bindings.mallet ||
    ![bindings.body, bindings.mallet].every((name) =>
      json.nodes.some(
        (node: { name: string; mesh?: number }) =>
          node.name === name && Number.isInteger(node.mesh),
      ),
    )
  )
    throw Error("Missing model bindings");
  for (const accessor of json.accessors ?? []) {
    if (
      !Number.isInteger(accessor.count) ||
      accessor.count < 1 ||
      accessor.count > 300000
    )
      throw Error("Geometry exceeds budget");
  }
  let triangles = 0;
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) {
      if (primitive.mode !== undefined && primitive.mode !== 4)
        throw Error("Expected triangle mesh");
      triangles +=
        json.accessors[primitive.indices ?? primitive.attributes.POSITION]
          .count / 3;
    }
  if (triangles > 100000 || triangles < 1)
    throw Error("Geometry exceeds budget");
  let pixels = 0;
  for (const image of json.images ?? []) {
    const view = json.bufferViews?.[image.bufferView];
    if (
      image.mimeType !== "image/png" ||
      !view ||
      view.byteLength < 24 ||
      view.buffer !== 0
    )
      throw Error("Unsupported scene texture");
    const offset = binStart + (view.byteOffset ?? 0);
    if (
      offset < binStart ||
      offset + view.byteLength > bytes.byteLength ||
      header.getUint32(offset) !== 0x89504e47 ||
      header.getUint32(offset + 4) !== 0x0d0a1a0a ||
      header.getUint32(offset + 12) !== 0x49484452
    )
      throw Error("Invalid PNG texture");
    const width = header.getUint32(offset + 16),
      height = header.getUint32(offset + 20);
    if (!width || !height || width > 2048 || height > 2048)
      throw Error("Texture exceeds dimensions budget");
    pixels += width * height;
  }
  if (pixels > 16 * 1024 * 1024)
    throw Error("Textures exceed decoded pixel budget");
}
