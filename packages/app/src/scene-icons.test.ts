// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { SceneBadge, hasSceneIcon } from "./scene-icons";
import { TODAY_SCENE_IDS, WISH_SCENE_IDS } from "./scene-placement";

/** Renders `node` in an App with the bundled scenes, as a parsed document. */
function render(node: ReactNode) {
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: {
          state: createState(),
          dispatch: () => true,
          go: () => {},
        } as unknown as AppContext,
      },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        node,
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("今日 achievements grid", () => {
  const doc = render(createElement(Today, { day: "2026-10-07" }));
  const tiles = [...doc.querySelectorAll(".ritual-tile")];

  it("shows every tile's picture in the same item slot", () => {
    expect(tiles).toHaveLength(6);
    for (const tile of tiles)
      expect(tile.querySelectorAll(":scope > .art.art-small")).toHaveLength(1);
  });

  it("draws the practice scenes' icons by scene id", () => {
    const drawn = [...doc.querySelectorAll(".ritual-tile .scene-art")];
    expect(drawn.map((el) => el.getAttribute("data-scene"))).toEqual([
      ...TODAY_SCENE_IDS,
    ]);
    for (const art of drawn) expect(art.querySelector("svg path")).not.toBeNull();
  });

  it("labels tiles with words only: no emoji or symbol glyphs", () => {
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      "千纸鹤",
      "木鱼",
      "小灯笼",
      "风铃一响",
      "庭前一礼",
      "廊前轻转",
    ]);
  });
});

describe("心愿 practice cards", () => {
  const doc = render(createElement(Wishes));
  const cards = [...doc.querySelectorAll(".wish-practice-card")];

  it("lead with each scene's own drawn icon, keyed by scene id", () => {
    expect(cards.map((card) => card.getAttribute("data-scene"))).toEqual([
      ...WISH_SCENE_IDS,
    ]);
    for (const card of cards)
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
  });

  it("say the verb under the title, without repeating the title", () => {
    for (const card of cards) {
      const title = card.querySelector("strong")!.textContent!;
      const verb = card.querySelector("small")!.textContent!;
      expect(verb.length).toBeGreaterThan(0);
      expect(verb).not.toContain(title);
    }
  });
});

describe("scene badges", () => {
  it("have a drawn icon for every built-in scene", () => {
    for (const entry of builtInScenes)
      expect(hasSceneIcon(entry.id), entry.id).toBe(true);
  });

  it("show a leaf for a scene without one, so no row is left blank", () => {
    const html = renderToStaticMarkup(
      createElement(SceneBadge, { id: "a-new-remote-scene" }),
    );
    const badge = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(".scene-badge")!;
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.querySelector("svg path")).not.toBeNull();
    expect(badge.querySelector(".scene-icon")).toBeNull();
  });
});
