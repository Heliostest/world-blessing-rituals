// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Context, type AppContext } from "./context";
import { renderUI, typeInto } from "./dom-test-utils";
import { NewWish } from "./wishes";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);
const LINE = 24;

// jsdom does no layout: give a text area one 24px line per line of text,
// at least its rows, and a client height from its own height when set.
beforeAll(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return Math.max(this.rows, this.value.split("\n").length) * LINE;
    },
  });
  Object.defineProperty(HTMLTextAreaElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      return parseFloat(this.style.height) || this.rows * LINE;
    },
  });
});
afterAll(() => {
  delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
  delete (HTMLTextAreaElement.prototype as { clientHeight?: number }).clientHeight;
});

function renderNewWish() {
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { go: () => {}, dispatch: () => true } as unknown as AppContext },
      createElement(NewWish),
    ),
  );
  return { ...ui, field: ui.host.querySelector<HTMLTextAreaElement>("#wish-title")! };
}

describe("新建心愿 form", () => {
  it("grows the wish field with its text, and back to its rows", () => {
    const ui = renderNewWish();
    ui.field.style.borderTopWidth = "2px";
    ui.field.style.borderBottomWidth = "3px";
    typeInto(ui.field, "一\n二\n三\n四");
    expect(ui.field.style.height).toBe(`${4 * LINE + 5}px`);
    typeInto(ui.field, "一");
    expect(ui.field.style.height).toBe("");
    ui.unmount();
  });

  it("has no native resize grip on its rounded text areas", () => {
    expect(css.match(/\.form-card textarea,\n\.share-panel textarea \{[^}]*\}/)![0]).toMatch(
      /resize: none;/,
    );
  });

  it("says 仅自己可见 as a flat note with a lock, not as a boxed option row", () => {
    const ui = renderNewWish();
    const note = ui.host.querySelector(".return-plan .privacy-note")!;
    expect(note.textContent!.trim()).toBe("仅自己可见");
    expect(note.querySelector("svg")).not.toBeNull();
    expect(ui.host.querySelector(".private-row")).toBeNull();
    expect(css).not.toMatch(/\.private-row/);
    ui.unmount();
  });
});
