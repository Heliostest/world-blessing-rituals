// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import {
  builtInScenes,
  CATALOG_EMPTY_COPY,
  SceneCatalog,
  SceneLibraryContext,
} from "./scene-library";
import { clickOn, renderUI, settle, typeInto } from "./dom-test-utils";

function renderCatalog() {
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { go: () => {} } as unknown as AppContext },
      createElement(
        SceneLibraryContext.Provider,
        {
          value: {
            entries: builtInScenes,
            library: { status: async () => "bundled" },
            stats: undefined,
            error: "",
            ready: true,
            maintain: async () => undefined,
          } as never,
        },
        createElement(SceneCatalog),
      ),
    ),
  );
  return {
    ...ui,
    input: ui.host.querySelector<HTMLInputElement>(".scene-search input")!,
    cards: () => ui.host.querySelectorAll(".scene-card").length,
    empty: () => ui.host.querySelector<HTMLElement>(".empty"),
  };
}

describe("场景目录 search", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("says so gently when nothing matches, and clears back to every scene", async () => {
    const ui = renderCatalog();
    await settle();
    expect(ui.cards()).toBe(builtInScenes.length);
    expect(ui.empty()).toBeNull();

    typeInto(ui.input, "没有这样的场景");
    await settle();
    expect(ui.cards()).toBe(0);
    const empty = ui.empty()!;
    expect(empty.getAttribute("role")).toBe("status");
    expect(empty.textContent).toContain(CATALOG_EMPTY_COPY.title);
    expect(empty.textContent).toContain(CATALOG_EMPTY_COPY.body);

    clickOn(
      [...empty.querySelectorAll("button")].find(
        (b) => b.textContent === CATALOG_EMPTY_COPY.clear,
      )!,
    );
    await settle();
    expect(ui.input.value).toBe("");
    expect(document.activeElement).toBe(ui.input);
    expect(ui.cards()).toBe(builtInScenes.length);
    expect(ui.empty()).toBeNull();
    ui.unmount();
  });

  it("lists matches without the note, ignoring spaces around the words", async () => {
    const ui = renderCatalog();
    typeInto(ui.input, " 木鱼 ");
    await settle();
    expect(ui.cards()).toBe(1);
    expect(ui.empty()).toBeNull();
    ui.unmount();
  });

  it("keeps the note's copy safe", () => {
    for (const text of Object.values(CATALOG_EMPTY_COPY))
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});
