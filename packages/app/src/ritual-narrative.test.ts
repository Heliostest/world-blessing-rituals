// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assertSafeCopy } from "@wbr/shared";
import { PRODUCT_ORIGINAL, sceneRegistry } from "@wbr/scenes";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { builtInScenes } from "./scene-library";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cjkCount = (s: string) =>
  [...s].filter((c) => /\p{Script=Han}/u.test(c) && c !== "〇").length;
const render = (sceneId: string) =>
  renderToStaticMarkup(createElement(RitualNarrativeBlurb, { sceneId }));
const withNarrative = builtInScenes.filter((e) => e.narrative);

describe("RitualNarrativeBlurb", () => {
  it.each(["celtic-folk-spring", "theravada-water", "no-such-scene"])(
    "renders nothing without a narrative (%s)",
    (id) => {
      expect(render(id)).toBe("");
    },
  );

  it("renders a collapsed details block with the narrative", () => {
    const woodfish = builtInScenes.find((e) => e.id === "woodfish")!;
    const container = document.createElement("div");
    container.innerHTML = render("woodfish");
    const details = container.querySelector("details.ritual-narrative")!;
    expect(details).not.toBeNull();
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("了解此仪式");
    expect(details.querySelector("p")?.textContent).toBe(woodfish.narrative);
  });
});

describe("builtInScenes narratives", () => {
  it("covers the approved micro-rituals and the five new scenes", () => {
    expect(withNarrative.map((e) => e.id).sort()).toEqual([
      "crane",
      "furin-wind-chime",
      "lantern",
      "shinto-torii",
      "slavic-wreath",
      "tanzaku-tanabata",
      "tibetan-wheel",
      "woodfish",
      "yeondeunghoe",
    ]);
  });

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s frames itself as practice or homage",
    (_id, narrative) => {
      expect(narrative).toMatch(/练习|致敬/);
    },
  );

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s has 80–120 汉字 and safe copy",
    (_id, narrative) => {
      const count = cjkCount(narrative);
      expect(count).toBeGreaterThanOrEqual(80);
      expect(count).toBeLessThanOrEqual(120);
      expect(() => assertSafeCopy(narrative)).not.toThrow();
    },
  );

  const productOriginal = sceneRegistry
    .filter((s) => s.traditionSlug === PRODUCT_ORIGINAL)
    .map((s) => s.id);

  it("product-original scenes claim no tradition and say so", () => {
    expect(productOriginal).toEqual(["crane", "lantern"]);
    for (const id of productOriginal) {
      const entry = builtInScenes.find((e) => e.id === id)!;
      expect(entry.traditionSlug).toBeUndefined();
      expect(entry.narrative).toMatch(/产品(原创|改编)/);
    }
  });

  it.each(
    builtInScenes
      .filter((e) => !productOriginal.includes(e.id))
      .map((e) => [e.id, e.traditionSlug]),
  )(
    "%s traditionSlug points to an existing tradition card",
    (id, slug) => {
      expect(slug).toBeTruthy();
      expect(
        existsSync(join(repoRoot, "content/traditions", `${slug}.md`)),
      ).toBe(true);
      const registered = sceneRegistry.find((s) => s.id === id);
      if (registered) expect(slug).toBe(registered.traditionSlug);
      else expect(id).toBe("woodfish");
    },
  );
});
