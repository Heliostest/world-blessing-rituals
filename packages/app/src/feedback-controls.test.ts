// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { FeedbackControls } from "./feedback-controls";
import { Me } from "./pages";
import { FavoriteChip, SCENE_FAVORITE_LABEL } from "./scene-experience";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);

/** Renders `node` inside an App whose host can, or cannot, vibrate. */
const render = (node: ReactNode, canHaptic: boolean) =>
  renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: {
          state: createState(),
          dispatch: () => true,
          go: () => {},
          canHaptic,
        } as unknown as AppContext,
      },
      node,
    ),
  );

describe("震动 toggle", () => {
  it.each([true, false])(
    "appears beside 音效 in scenes only where the host can vibrate (%s)",
    (canHaptic) => {
      const html = render(createElement(FeedbackControls), canHaptic);
      expect(html).toContain("音效");
      expect(html.includes("震动")).toBe(canHaptic);
      expect(html.match(/type="checkbox"/g)).toHaveLength(canHaptic ? 2 : 1);
    },
  );

  it.each([true, false])(
    "appears in 我的 settings only where the host can vibrate (%s)",
    (canHaptic) => {
      const html = render(createElement(Me), canHaptic);
      expect(html).toContain("仪式声音");
      expect(html).toContain("减少动态效果");
      expect(html.includes("轻触反馈")).toBe(canHaptic);
    },
  );
});

describe("收藏 on a scene page", () => {
  const chip = (favorite: boolean, dispatch: (a: unknown) => boolean = () => true) =>
    renderUI(
      createElement(
        Context.Provider,
        { value: { dispatch } as unknown as AppContext },
        createElement(FavoriteChip, { id: "crane", favorite }),
      ),
    );

  it.each([false, true])(
    "is a heart toggle chip whose state is aria-pressed, not its name (favourite: %s)",
    (favorite) => {
      const ui = chip(favorite);
      const button = ui.host.querySelector("button.favorite-chip")!;
      expect(button.getAttribute("aria-pressed")).toBe(String(favorite));
      expect(button.textContent).toBe(SCENE_FAVORITE_LABEL);
      expect(button.querySelector("svg path")).not.toBeNull();
      ui.unmount();
    },
  );

  it.each([false, true])("toggles the scene's favourite (from %s)", (favorite) => {
    const actions: unknown[] = [];
    const ui = chip(favorite, (a) => (actions.push(a), true));
    clickOn(ui.host.querySelector("button.favorite-chip")!);
    expect(actions).toEqual([{ type: "scene.favorite", id: "crane", favorite: !favorite }]);
    ui.unmount();
  });

  it("sits in the 音效／震动 row, which wraps it onto its own line when full", () => {
    const html = render(
      createElement(FeedbackControls, null, createElement("button", { className: "favorite-chip" })),
      true,
    );
    const row = new DOMParser().parseFromString(html, "text/html").querySelector(".feedback-controls")!;
    expect(row.lastElementChild!.className).toBe("favorite-chip");
    expect(css).toMatch(/\.feedback-controls \{[^}]*flex-wrap: wrap;/);
  });

  it("is a ring, not a ledge, and its copy is safe", () => {
    const rule = css.match(/\.favorite-chip \{[^}]*\}/)![0];
    expect(rule).toMatch(/box-shadow: 0 0 0 2px/);
    expect(rule).not.toMatch(/box-shadow:[^;]*0 [1-9]px 0/);
    expect(() => assertSafeCopy(SCENE_FAVORITE_LABEL)).not.toThrow();
  });
});
