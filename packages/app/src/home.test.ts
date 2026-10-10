// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  dailyCollectibleId,
  createState,
  type Collectible,
} from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { Today, ritualTitle } from "./home";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import {
  BLESSING_SCENE_IDS,
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  WISH_SCENE_IDS,
  dailyCollectedPicks,
  dailyPrimaryScene,
  isWishScene,
} from "./scene-placement";

const day = "2026-10-07";
const primary = dailyPrimaryScene(builtInScenes, day)!;

/** The keepsake a daily walk of `sceneId` left on `on`. */
const keepsake = (sceneId: string, on = "2026-10-01"): Collectible => ({
  id: dailyCollectibleId(on, sceneId),
  kind: "scene",
  title: builtInScenes.find((e) => e.id === sceneId)!.title,
  at: `${on}T08:00:00.000Z`,
  sceneId,
  ...(isWishScene(sceneId) ? { wishScene: true } : {}),
});
/** One earlier keepsake of every placed scene, and today's walk collected. */
const kept = [
  ...[...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS].map((id) => keepsake(id)),
  keepsake(primary.id, day),
];

/** 今日 with the bundled scenes and `collectibles`, as a document. */
function renderToday(collectibles: Collectible[] = kept) {
  const state = createState();
  state.collectibles.push(...collectibles);
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
        createElement(Today, { day }),
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}
const scenesOf = (cards: Element[]) =>
  cards.map((c) => c.getAttribute("data-scene"));

describe("今日's daily set", () => {
  const doc = renderToday();
  const main = doc.querySelector(".daily-set-primary")!;
  const row = doc.querySelector(".daily-collected")!;
  const picks = dailyCollectedPicks(builtInScenes, kept, day);

  it("is all the page holds: the day's walk, then picks from 小天地", () => {
    expect(
      [...doc.querySelector(".today-page")!.children].map((el) => el.className),
    ).toEqual(["home-heading", "lead", "daily-set", "daily-set daily-collected"]);
    expect(doc.querySelector(".wish-invitation")).toBeNull();
    // The 功德 pill, the day's walk and the three picks are its only buttons.
    expect(
      [...doc.querySelectorAll("button")].map((b) => b.className),
    ).toEqual([
      "merit-pill",
      "daily-set-card daily-set-primary",
      "daily-set-card",
      "daily-set-card",
      "daily-set-card",
    ]);
  });

  it("leads with the day's one walk, checked once collected", () => {
    const section = main.closest("section")!;
    expect(section.querySelector("h2")!.textContent).toBe(DAILY_SET_COPY.heading);
    expect(section.querySelector(".daily-set-blurb")!.textContent).toBe(
      DAILY_SET_COPY.sub,
    );
    expect(main.getAttribute("data-scene")).toBe(primary.id);
    expect(main.querySelector("strong")!.textContent).toBe(primary.title);
    expect(main.querySelector("small")!.textContent).toBe(DAILY_SET_COPY.collected);
    expect(main.querySelector(".collected-dot")).not.toBeNull();
    // Not collected yet: the card says its type instead.
    const fresh = renderToday([]).querySelector(".daily-set-primary")!;
    expect(fresh.querySelector("small")!.textContent).toBe(
      isWishScene(primary.id) ? DAILY_SET_COPY.wishNote : DAILY_SET_COPY.blessingNote,
    );
    expect(fresh.querySelector(".collected-dot")).toBeNull();
  });

  it("then offers three kept scenes: exactly one 许愿, two 祈福", () => {
    expect(row.querySelector("h2")!.textContent).toBe(DAILY_COLLECTED_COPY.heading);
    expect(row.querySelector(".daily-set-blurb")!.textContent).toBe(
      DAILY_COLLECTED_COPY.sub,
    );
    const cards = [...row.querySelectorAll(".daily-set-card")];
    expect(scenesOf(cards)).toEqual(picks.map((e) => e.id));
    const types = cards.map((c) => c.getAttribute("data-type"));
    expect(types.filter((t) => t === "wish")).toHaveLength(1);
    expect(types.filter((t) => t === "blessing")).toHaveLength(2);
    for (const card of cards) {
      const entry = picks.find((e) => e.id === card.getAttribute("data-scene"))!;
      expect(card.querySelector("strong")!.textContent).toBe(entry.title);
      expect(card.querySelector("small")!.textContent).toBe(
        isWishScene(entry.id)
          ? DAILY_COLLECTED_COPY.wishNote
          : DAILY_COLLECTED_COPY.blessingNote,
      );
      expect(card.querySelector(".collected-dot")).toBeNull();
    }
  });

  it("holds a calm empty state while nothing is kept from an earlier day", () => {
    for (const collectibles of [[], [keepsake(primary.id, day)]]) {
      const doc = renderToday(collectibles);
      expect(doc.querySelector(".daily-set-primary")).not.toBeNull();
      const row = doc.querySelector(".daily-collected")!;
      expect(row.querySelector(".daily-set-card")).toBeNull();
      expect(row.querySelector(".daily-collected-empty")!.textContent).toBe(
        DAILY_COLLECTED_COPY.emptyTitle + DAILY_COLLECTED_COPY.emptyBody,
      );
    }
  });

  it("shows only what is kept, one 许愿 at most, under the shorter line", () => {
    const partial = (collectibles: Collectible[]) => {
      const row = renderToday(collectibles).querySelector(".daily-collected")!;
      expect(row.querySelector(".daily-set-blurb")!.textContent).toBe(
        DAILY_COLLECTED_COPY.partial,
      );
      return [...row.querySelectorAll(".daily-set-card")];
    };
    const two = partial([keepsake("crane"), keepsake("lantern"), keepsake("woodfish")]);
    expect(two.map((c) => c.getAttribute("data-type"))).toEqual(["blessing", "wish"]);
    // Three 祈福 and no 许愿 kept yet: a full row, but not the full mix.
    const blessings = partial(BLESSING_SCENE_IDS.map((id) => keepsake(id)));
    expect(blessings.map((c) => c.getAttribute("data-type"))).toEqual([
      "blessing",
      "blessing",
      "blessing",
    ]);
  });

  it("keeps its copy safe", () => {
    for (const text of [
      ...Object.values(DAILY_SET_COPY),
      ...Object.values(DAILY_COLLECTED_COPY),
    ])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});

/** Edits (insert, delete, replace) between two titles, by character. */
function distance(a: string, b: string) {
  const [x, y] = [[...a], [...b]];
  let row = y.map((_, j) => j + 1);
  for (let i = 0; i < x.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < y.length; j++)
      next.push(
        Math.min(row[j] + 1, next[j] + 1, (j ? row[j - 1] : i) + (x[i] === y[j] ? 0 : 1)),
      );
    row = next.slice(1);
  }
  return row[y.length - 1] ?? x.length;
}

describe("2D ritual and 3D scene names", () => {
  it("never pass for each other: they differ by three characters or more", () => {
    expect(distance("点亮一盏心愿灯", "点一盏心愿灯")).toBe(1);
    for (const ritual of Object.values(ritualTitle))
      for (const scene of builtInScenes)
        expect(
          distance(ritual, scene.title),
          `${ritual} / ${scene.title}`,
        ).toBeGreaterThanOrEqual(3);
  });
});

describe("今日 card layout", () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "style.css"),
    "utf8",
  );

  it("leads each card with its scene badge, laid out by grid rules", () => {
    const doc = renderToday();
    for (const card of doc.querySelectorAll(".daily-set-card"))
      expect(card.firstElementChild!.className).toBe("scene-badge");
    expect(css).toMatch(/\n\.daily-set \{/);
    expect(css).toMatch(/\n\.daily-set-grid \{/);
    expect(css).toMatch(/\n\.daily-set-card \{/);
    expect(css).toMatch(/\n\.daily-set-primary \{/);
    expect(css).toMatch(/\n\.daily-collected-grid \{/);
    expect(css).toMatch(/\n\.daily-collected-empty \{/);
  });
});