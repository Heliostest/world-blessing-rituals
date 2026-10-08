// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { Today } from "./home";
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
