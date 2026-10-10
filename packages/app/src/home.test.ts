// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dailyCollectibleId, createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { Today, ritualTitle } from "./home";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { DAILY_SET_COPY, dailySceneSet, isWishScene } from "./scene-placement";

const day = "2026-10-07";
const set = dailySceneSet(builtInScenes, day);

/** 今日 with the bundled scenes (and optional keepsakes), as a document. */
function renderToday(collectibles = true) {
  const state = createState();
  if (collectibles)
    state.collectibles.push({
      id: dailyCollectibleId(day, set[0].id),
      kind: "scene",
      title: set[0].title,
      at: "2026-10-07T08:00:00.000Z",
      sceneId: set[0].id,
      ...(isWishScene(set[0].id) ? { wishScene: true } : {}),
    });
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

describe("今日's daily set", () => {
  const doc = renderToday();
  const section = doc.querySelector(".daily-set")!;
  const cards = [...section.querySelectorAll(".daily-set-card")];
  const collected = cards.find((c) => c.querySelector(".collected-dot"))!;

  it("is all the page holds: no wish invitation, no scene-catalog link", () => {
    expect(
      [...doc.querySelector(".today-page")!.children].map((el) => el.className),
    ).toEqual(["home-heading", "lead", "daily-set"]);
    expect(doc.querySelector(".wish-invitation")).toBeNull();
    // The 功德 pill and the day's three cards are its only buttons.
    expect(
      [...doc.querySelectorAll("button")].map((b) => b.className),
    ).toEqual(["merit-pill", ...set.map(() => "daily-set-card")]);
  });

  it("offers three scene cards under the heading: two 祈福, one 许愿", () => {
    expect(section.querySelector("h2")!.textContent).toBe(
      DAILY_SET_COPY.heading,
    );
    const cards = [...section.querySelectorAll(".daily-set-card")];
    expect(cards.map((c) => c.getAttribute("data-scene"))).toEqual(
      set.map((e) => e.id),
    );
    const types = cards.map((c) => c.getAttribute("data-type"));
    expect(types.filter((t) => t === "wish")).toHaveLength(1);
    expect(types.filter((t) => t === "blessing")).toHaveLength(2);
  });

  it("says each card's type under its title, and the day's collected one is checked", () => {
    const cards = [...section.querySelectorAll(".daily-set-card")];
    for (const card of cards) {
      const entry = set.find((e) => e.id === card.getAttribute("data-scene"))!;
      expect(card.querySelector("strong")!.textContent).toBe(entry.title);
      expect(card.querySelector("small")!.textContent!.trim()).toBe(
        card === collected
          ? DAILY_SET_COPY.collected
          : isWishScene(entry.id)
            ? DAILY_SET_COPY.wishNote
            : DAILY_SET_COPY.blessingNote,
      );
    }
    expect(collected.querySelector(".collected-dot")).not.toBeNull();
    for (const card of cards)
      if (card !== collected)
        expect(card.querySelector(".collected-dot")).toBeNull();
  });

  it("keeps its copy safe", () => {
    for (const text of [
      DAILY_SET_COPY.heading,
      DAILY_SET_COPY.sub,
      DAILY_SET_COPY.blessingNote,
      DAILY_SET_COPY.wishNote,
      DAILY_SET_COPY.collected,
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
  });
});