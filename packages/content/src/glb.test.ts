import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateWoodfishGLB } from "./glb";
const bindings = { body: "WoodfishBody", mallet: "Mallet" };
const bytes = readFileSync(
  new URL("../../../assets/woodfish/bundled-v1/woodfish.glb", import.meta.url),
);
const buffer = (value: Uint8Array) => value.slice().buffer as ArrayBuffer;
const jsonLength = bytes.readUInt32LE(12);
function mutate(update: (json: any) => void) {
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  update(json);
  const raw = Buffer.from(JSON.stringify(json)),
    padding = (4 - (raw.length % 4)) % 4;
  const chunk = Buffer.concat([raw, Buffer.alloc(padding, 32)]);
  const header = Buffer.from(bytes.subarray(0, 20)),
    binary = bytes.subarray(20 + jsonLength);
  header.writeUInt32LE(20 + chunk.length + binary.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  return buffer(Buffer.concat([header, chunk, binary]));
}
describe("woodfish GPU input budgets", () => {
  it("accepts the real self-contained bootstrap model", () => {
    expect(() => validateWoodfishGLB(buffer(bytes), bindings)).not.toThrow();
  });
  it("rejects external resources, oversized geometry and missing bindings before decode", () => {
    for (const change of [
      (json: any) => {
        json.images[0].uri = "https://unverified.test/image.png";
      },
      (json: any) => {
        json.accessors[0].count = 9999999;
      },
      (json: any) => {
        json.nodes[0].name = "Unexpected";
      },
      (json: any) => {
        json.extensionsUsed = ["KHR_draco_mesh_compression"];
      },
    ])
      expect(() => validateWoodfishGLB(mutate(change), bindings)).toThrow();
  });
  it("checks embedded image dimensions before GPU texture allocation", () => {
    const bad = Buffer.from(bytes);
    const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
    const offset =
      28 + jsonLength + json.bufferViews[json.images[0].bufferView].byteOffset;
    bad.writeUInt32BE(8192, offset + 16);
    expect(() => validateWoodfishGLB(buffer(bad), bindings)).toThrow(
      /dimensions budget/,
    );
  });
});
