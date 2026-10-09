// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState, type Wish } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { WISH_SCENE_IDS } from "./scene-placement";
import { WishDetail } from "./wishes";

const wish: Wish = {
  id: "w1",
  title: "希望这次面试顺利",
  intention: "",
  status: "active",
  archived: false,
  createdAt: "2026-10-07T08:00:00.000Z",
  notes: [],
};

/** An active wish's detail page, with the bundled scenes, as a parsed document. */
function renderDetail() {
  const state = { ...createState(), wishes: [wish] };
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: { state, dispatch: () => true, go: () => {} } as unknown as AppContext,
      },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        createElement(WishDetail, { id: wish.id }),
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("a wish's detail", () => {
  const doc = renderDetail();

  it("offers its practices as small tiles: the scene's badge, title and verb", () => {
    const tiles = [...doc.querySelectorAll(".wish-practice-actions > .practice-tile")];
    expect(tiles.map((t) => t.getAttribute("data-scene"))).toEqual([...WISH_SCENE_IDS]);
    for (const tile of tiles) {
      const id = tile.getAttribute("data-scene")!;
      expect(tile.querySelector(".scene-badge svg path"), id).not.toBeNull();
      expect(tile.querySelector("strong")!.textContent).toBe(
        builtInScenes.find((e) => e.id === id)!.title,
      );
      expect(tile.querySelector("small")!.textContent!.length, id).toBeGreaterThan(0);
    }
  });

  it("keeps 我的心愿实现了 as its one big button", () => {
    expect([...doc.querySelectorAll(".button")].map((b) => b.textContent)).toEqual([
      "我的心愿实现了",
    ]);
  });

  it("lays the tiles out in two columns", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "style.css"),
      "utf8",
    );
    const rule = css.match(/\.wish-practice-detail \.wish-practice-actions \{[^}]*\}/)![0];
    expect(rule).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
