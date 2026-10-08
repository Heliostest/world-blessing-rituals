// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createState, type Wish } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { WISH_SCENE_IDS } from "./scene-placement";
import { WishDetail } from "./wishes";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);
let rules: CSSStyleRule[] = [];
beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  rules = [...style.sheet!.cssRules].filter(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule,
  );
});

const wish: Wish = {
  id: "w1",
  title: "希望这次面试顺利",
  intention: "",
  status: "active",
  archived: false,
  createdAt: "2026-10-07T08:00:00.000Z",
  notes: [],
};

/** Renders `node` in an App with the bundled scenes and one active wish. */
function render(node: ReactNode) {
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
        node,
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("scene candy", () => {
  /** The rules of the shared map: bare [data-scene] selectors. */
  const map = () => rules.filter((r) => r.selectorText.startsWith("[data-scene"));

  it("colours no list by position", () => {
    for (const rule of rules)
      if (/ritual-tile|wish-practice|scene-card|scene-badge/.test(rule.selectorText))
        expect(rule.selectorText).not.toMatch(/nth-(child|of-type)/);
  });

  it("is one map that names each scene once and sets every candy tier", () => {
    const ids = map().flatMap((r) =>
      [...r.selectorText.matchAll(/\[data-scene="([^"]+)"\]/g)].map((m) => m[1]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(map().some((r) => r.selectorText === "[data-scene]")).toBe(true);
    for (const rule of map())
      for (const tier of ["--candy", "--candy-hi", "--candy-ledge", "--candy-tint", "--candy-ring"])
        expect(rule.style.getPropertyValue(tier), `${rule.selectorText} ${tier}`).not.toBe("");
    // No tile, card, badge or button picks a candy for one scene by itself.
    for (const rule of rules)
      if (!rule.selectorText.startsWith("[data-scene") && /\[data-scene="/.test(rule.selectorText))
        expect(rule.selectorText).not.toMatch(/ritual-tile|wish-practice|scene-card|scene-badge|button/);
  });

  it("is what the tiles, badges and practice buttons are painted with", () => {
    const declared = (selector: string) =>
      rules
        .filter((r) => r.selectorText === selector)
        .map((r) => r.style.cssText)
        .join(" ");
    expect(declared(".ritual-tile")).toMatch(/var\(--candy-tint/);
    expect(declared(".scene-badge")).toMatch(/var\(--candy-tint/);
    expect(declared(".scene-badge")).toMatch(/var\(--candy,/);
    expect(declared(".wish-practice-actions .button[data-scene]")).toMatch(/var\(--candy-hi\)/);
  });

  it("follows a scene from 今日 to 心愿 to a wish's detail by its id", () => {
    const today = render(createElement(Today, { day: "2026-10-07" }));
    const wishes = render(createElement(Wishes));
    const detail = render(createElement(WishDetail, { id: wish.id }));
    expect(
      [...today.querySelectorAll(".ritual-tile")].map((t) => t.getAttribute("data-scene")),
    ).toEqual(["crane", "woodfish", "lantern", "furin-wind-chime", "shinto-torii", "tibetan-wheel"]);
    for (const id of WISH_SCENE_IDS) {
      expect(wishes.querySelector(`.wish-practice-card[data-scene="${id}"] .scene-badge[data-scene="${id}"]`), id).not.toBeNull();
      expect(detail.querySelector(`.wish-practice-actions [data-scene="${id}"]`), id).not.toBeNull();
    }
    // The 2D crane on 今日 and the crane practice on 心愿 are one candy.
    expect(today.querySelector('.ritual-tile[data-scene="crane"]')).not.toBeNull();
  });
});
