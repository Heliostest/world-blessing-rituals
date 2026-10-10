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
  sceneStage,
} from "./scene-placement";

/* jsdom ships no WebGL2 interfaces, and the preview's first gate is whether
   they exist at all: pose as a browser that can draw, so the static markup
   below shows the waiting stage. Effects — and with them real WebGL — only
   run in a live document, never in renderToStaticMarkup. */
(globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext ??=
  class WebGL2RenderingContext {};

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

  it("carries the day's walk live on its primary card only", () => {
    // One canvas a page: the primary hosts the live scene, the picks stay pictures.
    const previews = [...doc.querySelectorAll(".daily-set-preview")];
    expect(previews).toHaveLength(1);
    expect(previews[0]!.closest(".daily-set-card")).toBe(main);
    expect(row.querySelector(".daily-set-preview")).toBeNull();
    // Static markup shows the host waiting; effects mount WebGL only live.
    const preview = previews[0]!;
    expect(preview.getAttribute("data-status")).toBe("loading");
    // Look, don't touch: taps fall through to the card, which opens the walk.
    expect(preview.getAttribute("inert")).not.toBeNull();
    expect(preview.getAttribute("aria-hidden")).toBe("true");
    // data-scene and data-stage paint the scene page's own sky for the stage.
    const stage = preview.querySelector(".daily-set-preview-stage")!;
    expect(stage.className).toBe("library-scene-stage daily-set-preview-stage");
    expect(stage.getAttribute("data-scene")).toBe(primary.id);
    expect(stage.getAttribute("data-stage")).toBe(sceneStage(primary.id));
    // While the scene mounts, its icon floats on the sky.
    expect(preview.querySelector(".daily-set-preview-icon .scene-icon")).not.toBeNull();
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

  it("leads the picks with their scene badges; the primary with its live stage", () => {
    const doc = renderToday();
    for (const card of doc.querySelectorAll(".daily-collected-grid .daily-set-card"))
      expect(card.firstElementChild!.className).toBe("scene-badge");
    // The primary's live scene spans its top; the badge leads the row under it.
    const main = doc.querySelector(".daily-set-primary")!;
    expect(main.firstElementChild!.className).toBe("daily-set-preview");
    expect(main.children[1]!.className).toBe("scene-badge");
    expect(css).toMatch(/\n\.daily-set \{/);
    expect(css).toMatch(/\n\.daily-set-grid \{/);
    expect(css).toMatch(/\n\.daily-set-card \{/);
    expect(css).toMatch(/\n\.daily-set-primary \{/);
    expect(css).toMatch(/\n\.daily-set-preview \{/);
    expect(css).toMatch(/\n\.daily-set-preview-stage > canvas \{/);
    expect(css).toMatch(/\n\.daily-collected-grid \{/);
    expect(css).toMatch(/\n\.daily-collected-empty \{/);
  });

  it("sets the day's walk well above the picks, three to one row", () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    /** Declarations of the rule for exactly `selector`. */
    const rule = (selector: string) =>
      [...style.sheet!.cssRules].find(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === selector,
      )!.style;
    const px = (selector: string, prop: string) =>
      parseFloat(rule(selector).getPropertyValue(prop));
    const pick = ".daily-collected-grid > .daily-set-card";
    expect(rule(".daily-collected-grid").cssText).toMatch(
      /grid-template-columns: repeat\(3, minmax\(0(px)?, 1fr\)\)/,
    );
    expect(px(".daily-set-primary > .scene-badge", "width")).toBeGreaterThanOrEqual(
      1.5 * px(`${pick} > .scene-badge`, "width"),
    );
    expect(px(".daily-set-primary strong", "font-size")).toBeGreaterThanOrEqual(
      1.5 * px(`${pick} strong`, "font-size"),
    );
  });

  it("spans the primary's top with the live stage, above the old row", () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const rule = (selector: string) =>
      [...style.sheet!.cssRules].find(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === selector,
      )!.style;
    const px = (selector: string, prop: string) =>
      parseFloat(rule(selector).getPropertyValue(prop));
    const pick = ".daily-collected-grid > .daily-set-card";
    const preview = rule(".daily-set-preview");
    // A 16:10 window across the whole card, never itself the tap target.
    expect(preview.getPropertyValue("grid-column")).toBe("1 / -1");
    expect(preview.getPropertyValue("aspect-ratio")).toBe("16 / 10");
    expect(px(".daily-set-preview", "min-height")).toBeGreaterThanOrEqual(220);
    expect(preview.getPropertyValue("pointer-events")).toBe("none");
    // The live window dwarfs anything on a pick card: several times its badge.
    expect(px(".daily-set-preview", "min-height")).toBeGreaterThanOrEqual(
      3 * px(`${pick} > .scene-badge`, "width"),
    );
    // The row the card had sits under the stage, badge and arrow spanning it.
    expect(
      rule(".daily-set-primary > .daily-set-preview ~ strong").getPropertyValue("grid-row"),
    ).toBe("2");
    expect(
      rule(".daily-set-primary > .daily-set-preview ~ small").getPropertyValue("grid-row"),
    ).toBe("3");
    // Until the scene is ready, only its icon shows: the canvas fades in then.
    expect(
      rule('.daily-set-preview[data-status="ready"] .daily-set-preview-stage > canvas')
        .getPropertyValue("opacity"),
    ).toBe("1");
    expect(
      rule('.daily-set-preview[data-status="ready"] .daily-set-preview-icon')
        .getPropertyValue("opacity"),
    ).toBe("0");
  });
});
