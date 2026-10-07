// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { BlessingApp } from "./App";
import { clickOn, renderUI, settle } from "./dom-test-utils";

const elementScrollTo = HTMLElement.prototype.scrollTo;
afterEach(() => {
  HTMLElement.prototype.scrollTo = elementScrollTo;
  vi.restoreAllMocks();
});

it("opens a new page at the top of the shell, which scrolls inside the desktop frame", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const shellScrolls: unknown[][] = [];
  HTMLElement.prototype.scrollTo = function (this: HTMLElement, ...args: unknown[]) {
    if (this.classList.contains("app-shell")) shellScrolls.push(args);
  } as typeof HTMLElement.prototype.scrollTo;
  const ui = renderUI(
    createElement(BlessingApp, {
      host: { read: async () => null, write: async () => {} },
    }),
  );
  await settle();
  const tab = [...ui.host.querySelectorAll(".bottom-nav button")].find((b) =>
    b.textContent?.includes("心愿"),
  )!;
  clickOn(tab);
  expect(shellScrolls).toEqual([[0, 0]]);
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  ui.unmount();
});
