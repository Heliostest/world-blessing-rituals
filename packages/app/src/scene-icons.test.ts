// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dailyCollectibleId, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { SceneBadge, hasSceneIcon } from "./scene-icons";
import {
  BLESSING_SCENE_IDS,
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  WISH_SCENE_IDS,
  dailyCollectedPicks,
  dailyPrimaryScene,
  isWishScene,
} from "./scene-placement";
import { VESSEL_COPY } from "./vessels";

const day = "2026-10-07";

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

/** 心愿, live over `state`; `go` records where each tap leads. */
function openWishes(state: State = createState()) {
  const go = vi.fn();
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { state, dispatch: () => true, go } as unknown as AppContext },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        createElement(Wishes),
      ),
    ),
  );
  return {
    ...ui,
    go,
    pray: ui.host.querySelector<HTMLButtonElement>(".pray-button")!,
    picker: () => ui.host.querySelector("#vessel-picker"),
    cards: () => [...ui.host.querySelectorAll(".wish-practice-card")],
  };
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
  // An earlier keepsake of every placed scene: the day's walk, then three picks.
  const state = createState();
  state.collectibles.push(
    ...[...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS].map((id) =>
      keepsake("2026-10-01", id),
    ),
  );
  const primary = dailyPrimaryScene(builtInScenes, day)!;
  const picks = dailyCollectedPicks(builtInScenes, state.collectibles, day);
  const doc = render(createElement(Today, { day }), state);
  const cards = [...doc.querySelectorAll(".daily-set-card")];

  it("leads every card with its scene's drawn icon, keyed by scene id", () => {
    expect(picks).toHaveLength(3);
    expect(cards.map((c) => c.getAttribute("data-scene"))).toEqual(
      [primary, ...picks].map((e) => e.id),
    );
    for (const card of cards) {
      expect(card.firstElementChild!.className).toBe("scene-badge");
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
    }
  });

  it("labels cards with words only: no emoji or symbol glyphs", () => {
    const note = (entry: { id: string }, copy: { wishNote: string; blessingNote: string }) =>
      isWishScene(entry.id) ? copy.wishNote : copy.blessingNote;
    expect(cards.map((card) => card.textContent)).toEqual([
      `${primary.title}${note(primary, DAILY_SET_COPY)}`,
      ...picks.map((entry) => `${entry.title}${note(entry, DAILY_COLLECTED_COPY)}`),
    ]);
  });
});

describe("心愿's 祈愿 picker", () => {
  // One spent vessel, then two usable ones: the picker offers the usable two,
  // newest first, and never the spent one or a 祈福 keepsake.
  const state = createState();
  state.collectibles.push(
    keepsake("2026-10-05", "yeondeunghoe", "2026-10-06T08:00:00.000Z"),
    keepsake("2026-10-06", "tanzaku-tanabata"),
    keepsake("2026-10-07", "crane"),
    keepsake("2026-10-07", "woodfish"),
  );
  let ui: ReturnType<typeof openWishes>;
  afterEach(() => {
    ui.unmount();
    // jsdom has no scrollIntoView; a test may stand one in.
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it("opens folded: no 许愿小物 shelf, one 祈愿 button under the list", () => {
    ui = openWishes(state);
    expect(ui.host.querySelector(".wish-practice")).toBeNull();
    expect(ui.picker()).toBeNull();
    expect(ui.cards()).toHaveLength(0);
    expect(ui.pray.textContent).toBe(VESSEL_COPY.pray);
    expect(ui.pray.getAttribute("aria-expanded")).toBe("false");
    expect(ui.pray.previousElementSibling!.matches(".wish-list, .empty")).toBe(
      true,
    );
    expect(ui.pray.nextElementSibling!.className).toBe("privacy-note");
  });

  it("unfolds the picker under its button, into view, and folds it again", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    ui = openWishes(state);
    clickOn(ui.pray);
    const picker = ui.picker()!;
    expect(ui.pray.getAttribute("aria-expanded")).toBe("true");
    expect(ui.pray.getAttribute("aria-controls")).toBe(picker.id);
    expect(ui.pray.nextElementSibling).toBe(picker);
    expect(picker.querySelector("h2")!.textContent).toBe(VESSEL_COPY.heading);
    expect(picker.querySelector(".section-heading span")!.textContent).toBe(
      "2 个可用",
    );
    expect(scrolled).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "smooth",
    });
    clickOn(ui.pray);
    expect(ui.pray.getAttribute("aria-expanded")).toBe("false");
    expect(ui.picker()).toBeNull();
  });

  it("offers the unspent wish-type keepsakes only, newest first", () => {
    ui = openWishes(state);
    clickOn(ui.pray);
    expect(ui.cards().map((card) => card.getAttribute("data-scene"))).toEqual([
      "crane",
      "tanzaku-tanabata",
    ]);
    for (const card of ui.cards())
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
  });

  it("says the one action under the title, without repeating it", () => {
    ui = openWishes(state);
    clickOn(ui.pray);
    for (const card of ui.cards()) {
      const title = card.querySelector("strong")!.textContent!;
      const action = card.querySelector("small")!.textContent!;
      expect(action).toBe(VESSEL_COPY.use);
      expect(action).not.toContain(title);
    }
  });

  it("opens the picked keepsake's scene as a vessel visit", () => {
    ui = openWishes(state);
    clickOn(ui.pray);
    clickOn(ui.host.querySelector('.vessel-card[data-scene="crane"]')!);
    expect(ui.go).toHaveBeenCalledWith({
      page: "scene",
      id: "crane",
      entry: builtInScenes.find((e) => e.id === "crane"),
      daily: undefined,
      vessel: dailyCollectibleId("2026-10-07", "crane"),
      wishId: undefined,
    });
  });

  it("explains the picker when no keepsake is usable yet, and points to 今日", () => {
    ui = openWishes();
    clickOn(ui.pray);
    const picker = ui.picker()!;
    expect(picker.querySelector("h2")!.textContent).toBe(VESSEL_COPY.heading);
    expect(
      [...picker.querySelectorAll(".empty h3, .empty p, .empty button")].map(
        (el) => el.textContent!.trim(),
      ),
    ).toEqual([
      VESSEL_COPY.emptyTitle,
      VESSEL_COPY.emptyBody,
      VESSEL_COPY.emptyAction,
    ]);
    expect(ui.cards()).toHaveLength(0);
    clickOn(picker.querySelector(".empty button")!);
    expect(ui.go).toHaveBeenCalledWith({ page: "today" });
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