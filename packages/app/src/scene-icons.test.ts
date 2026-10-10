// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState, dailyCollectibleId, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { SceneBadge, hasSceneIcon } from "./scene-icons";
import { DAILY_SET_COPY, dailySceneSet, isWishScene } from "./scene-placement";
import { VESSEL_COPY } from "./vessels";

const day = "2026-10-07";
const set = dailySceneSet(builtInScenes, day);

/** Renders `node` in an App with the bundled scenes, as a parsed document. */
function render(node: ReactNode, state: State = createState()) {
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: {
          state,
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

/** One collected daily keepsake for `sceneId`, spent for a wish when `spent`. */
function keepsake(day: string, sceneId: string, spent?: string) {
  const entry = builtInScenes.find((e) => e.id === sceneId)!;
  return {
    id: dailyCollectibleId(day, sceneId),
    kind: "scene" as const,
    title: entry.title,
    at: `${day}T08:00:00.000Z`,
    sceneId,
    ...(isWishScene(sceneId) ? { wishScene: true } : {}),
    ...(spent ? { spentAt: spent } : {}),
  };
}

describe("今日's daily set badges", () => {
  const doc = render(createElement(Today, { day }));
  const cards = [...doc.querySelectorAll(".daily-set-card")];

  it("leads every card with its scene's drawn icon, keyed by scene id", () => {
    expect(cards.map((c) => c.getAttribute("data-scene"))).toEqual(
      set.map((e) => e.id),
    );
    for (const card of cards) {
      expect(card.firstElementChild!.className).toBe("scene-badge");
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
    }
  });

  it("labels cards with words only: no emoji or symbol glyphs", () => {
    expect(cards.map((card) => card.textContent)).toEqual(
      set.map((entry) =>
        `${entry.title}${isWishScene(entry.id) ? DAILY_SET_COPY.wishNote : DAILY_SET_COPY.blessingNote}`,
      ),
    );
  });
});

describe("心愿's 许愿小物 shelf", () => {
  // One spent vessel, then two usable ones: the shelf shows the usable two,
  // newest first, and never the spent one or a 祈福 keepsake.
  const state = createState();
  state.collectibles.push(
    keepsake("2026-10-05", "yeondeunghoe", "2026-10-06T08:00:00.000Z"),
    keepsake("2026-10-06", "tanzaku-tanabata"),
    keepsake("2026-10-07", "crane"),
    keepsake("2026-10-07", "woodfish"),
  );
  const doc = render(createElement(Wishes), state);
  const cards = [...doc.querySelectorAll(".wish-practice-card")];

  it("offers the unspent wish-type keepsakes only, newest first", () => {
    expect(cards.map((card) => card.getAttribute("data-scene"))).toEqual([
      "crane",
      "tanzaku-tanabata",
    ]);
    for (const card of cards)
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
  });

  it("says the one action under the title, without repeating it", () => {
    for (const card of cards) {
      const title = card.querySelector("strong")!.textContent!;
      const action = card.querySelector("small")!.textContent!;
      expect(action).toBe(VESSEL_COPY.use);
      expect(action).not.toContain(title);
    }
  });

  it("explains the shelf when no keepsake is usable yet", () => {
    const empty = render(createElement(Wishes));
    const shelf = empty.querySelector(".wish-practice")!;
    expect(shelf.querySelector("h2")!.textContent).toBe(VESSEL_COPY.heading);
    expect(
      [...shelf.querySelectorAll(".empty h3, .empty p, .empty button")].map(
        (el) => el.textContent!.trim(),
      ),
    ).toEqual([
      VESSEL_COPY.emptyTitle,
      VESSEL_COPY.emptyBody,
      VESSEL_COPY.emptyAction,
    ]);
    expect(empty.querySelectorAll(".wish-practice-card")).toHaveLength(0);
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