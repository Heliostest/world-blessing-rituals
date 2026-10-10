// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createState, dailyCollectibleId, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { dailySceneSet, isWishScene, WISH_SCENE_IDS } from "./scene-placement";

const day = "2026-10-07";

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

/** Renders `node` in an App with the bundled scenes, as a parsed document. */
function render(node: ReactNode, state: State = createState()) {
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
      if (/ritual-tile|wish-practice|daily-set|scene-card|scene-badge/.test(rule.selectorText))
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
        expect(rule.selectorText).not.toMatch(/ritual-tile|wish-practice|daily-set|scene-card|scene-badge|button/);
  });

  it("is what the cards and badges are painted with", () => {
    const declared = (selector: string) =>
      rules
        .filter((r) => r.selectorText === selector)
        .map((r) => r.style.cssText)
        .join(" ");
    expect(declared(".scene-badge")).toMatch(/var\(--candy-tint/);
    expect(declared(".scene-badge")).toMatch(/var\(--candy,/);
  });

  it("follows a scene from 今日 to 心愿 by its id", () => {
    const today = render(createElement(Today, { day }));
    // One usable keepsake for every wish scene, so 祈愿's whole picker is up.
    const state = createState();
    for (const id of WISH_SCENE_IDS)
      state.collectibles.push({
        id: dailyCollectibleId(day, id),
        kind: "scene",
        title: builtInScenes.find((e) => e.id === id)!.title,
        at: `${day}T08:00:00.000Z`,
        sceneId: id,
        ...(isWishScene(id) ? { wishScene: true } : {}),
      });
    const ui = renderUI(
      createElement(
        Context.Provider,
        { value: { state, dispatch: () => true, go: () => {} } as unknown as AppContext },
        createElement(
          SceneLibraryContext.Provider,
          { value: { entries: builtInScenes } as never },
          createElement(Wishes),
        ),
      ),
    );
    clickOn(ui.host.querySelector(".pray-button")!);
    const wishes = ui.host;
    expect(
      [...today.querySelectorAll(".daily-set-card")].map((t) => t.getAttribute("data-scene")),
    ).toEqual(dailySceneSet(builtInScenes, day).map((e) => e.id));
    for (const id of WISH_SCENE_IDS) {
      expect(wishes.querySelector(`.wish-practice-card[data-scene="${id}"] .scene-badge[data-scene="${id}"]`), id).not.toBeNull();
    }
    // The day's wish scene is the same candy on both surfaces: one id, one map.
    const shared = dailySceneSet(builtInScenes, day).find((e) => isWishScene(e.id))!.id;
    expect(
      today.querySelector(`.daily-set-card[data-scene="${shared}"] .scene-badge[data-scene="${shared}"]`),
    ).not.toBeNull();
    expect(
      wishes.querySelector(`.wish-practice-card[data-scene="${shared}"] .scene-badge[data-scene="${shared}"]`),
    ).not.toBeNull();
    ui.unmount();
  });
});