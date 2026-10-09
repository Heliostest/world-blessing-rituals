import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetFiles } from "../../../scripts/prepare-app-assets.mjs";
import { fontStyles } from "./assets";

/** Each @font-face block of the font CSS the App injects. */
const faces = fontStyles.match(/@font-face\{[^}]*\}/g) ?? [];
const nunito = faces.filter((face) => face.includes("font-family:'Nunito'"));

describe("bundled fonts", () => {
  it("ships Nunito's latin subset at 500, 700 and 900, so digits are rounded on every device", () => {
    expect(nunito.map((face) => face.match(/font-weight:(\d+);/)?.[1])).toEqual([
      "500",
      "700",
      "900",
    ]);
    for (const face of nunito) {
      // Latin only: CJK falls through to the rounded system faces, then Blessing Sans.
      expect(face).toMatch(/unicode-range:U\+0000-00FF;/);
      expect(face).toMatch(/font-display:swap;/);
    }
  });

  it("loads every face from the App's own assets, never the network", () => {
    const files = faces.map((face) => face.match(/src:url\('\/([^']+)'\)/)?.[1]);
    expect(files).toHaveLength(4);
    for (const file of files) {
      expect(file).toMatch(/^fonts\/[\w.-]+\.woff2$/);
      // Copied into both apps' public dirs (and checked in the Expo export).
      expect(assetFiles).toContain(file);
      expect(existsSync(new URL(`../../../assets/${file}`, import.meta.url)), file).toBe(true);
    }
    // The OFL travels with Nunito, as with Noto Sans SC.
    expect(assetFiles).toContain("fonts/nunito-OFL.txt");
  });

  it("puts the bundled Nunito first in the island's rounded stack", () => {
    const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
    expect(css).toMatch(/--font-round: "Nunito", /);
  });
});
