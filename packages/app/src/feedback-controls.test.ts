// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { FeedbackControls } from "./feedback-controls";
import { Me } from "./pages";

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
