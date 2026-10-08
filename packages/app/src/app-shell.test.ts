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

it("names a page in its ribbon only when the page has no title of its own", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const ui = renderUI(
    createElement(BlessingApp, {
      host: { read: async () => null, write: async () => {} },
    }),
  );
  await settle();
  const ribbon = () => ui.host.querySelector(".app-topbar h2")?.textContent ?? null;
  const tap = (selector: string, text: string) =>
    clickOn(
      [...ui.host.querySelectorAll(selector)].find((el) =>
        el.textContent?.includes(text),
      )!,
    );
  tap(".bottom-nav button", "我的");
  await settle();
  // Each of these pages opens with an h1 of the same words: no ribbon.
  for (const row of ["场景目录", "资源缓存", "仪式时光"]) {
    tap(".settings-row", row);
    await settle();
    expect(ribbon(), row).toBeNull();
    expect(ui.host.querySelector(".app-content h1")?.textContent, row).toBe(row);
    clickOn(ui.host.querySelector(".back-button")!);
    await settle();
  }
  tap(".bottom-nav button", "今日");
  await settle();
  tap(".wish-invitation", "许个愿");
  await settle();
  expect(ribbon()).toBe("许个小心愿");
  ui.unmount();
});
