// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { Today, ritualTitle } from "./home";
import {
  SCENE_DISCOVERY_COPY,
  SceneLibraryContext,
  builtInScenes,
} from "./scene-library";
import { recommendTodayScene } from "./scene-placement";

const day = "2026-10-07";

/** 今日 with the bundled scenes, as a parsed document. */
function renderToday() {
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
        createElement(Today, { day }),
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("今日 scene recommendation", () => {
  const doc = renderToday();
  const discovery = doc.querySelector(".scene-discovery")!;

  it("is one quiet scene row under a heading with the catalog link", () => {
    expect(discovery.querySelector("h2")!.textContent).toBe(
      SCENE_DISCOVERY_COPY.heading,
    );
    const links = [...discovery.querySelectorAll(".text-button")];
    expect(links.map((b) => b.textContent!.trim())).toEqual([
      SCENE_DISCOVERY_COPY.browse,
    ]);
    const rows = discovery.querySelectorAll(".scene-card");
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute("data-scene")).toBe(
      recommendTodayScene(builtInScenes, day)!.id,
    );
  });

  it("has no candy button, so the mint 开始今日仪式 leads the page", () => {
    expect(discovery.querySelector(".button")).toBeNull();
    const first = doc.querySelector(".button")!;
    expect(first.classList.contains("primary")).toBe(true);
    expect(first.textContent).toBe("开始今日仪式");
  });

  it("keeps its copy safe", () => {
    for (const text of Object.values(SCENE_DISCOVERY_COPY))
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

describe("今日 card alignment", () => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "style.css"),
    "utf8",
  );

  it("centres a feature card whole, its tag included", () => {
    const doc = renderToday();
    const cards = [...doc.querySelectorAll(".daily-card")];
    expect(cards.length).toBeGreaterThanOrEqual(2);
    // The tag is an inline chip straight in the card, so the card's
    // alignment is its alignment.
    for (const card of cards) expect(card.firstElementChild!.className).toBe("tag");
    expect(css.match(/\n\.daily-card \{[^}]*\}/)![0]).toMatch(/text-align: center;/);
    expect(css).toMatch(/\n\.tag \{[^}]*display: inline-flex;/);
  });
});
