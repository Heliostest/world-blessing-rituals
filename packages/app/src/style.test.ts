// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);
let rules: CSSStyleRule[] = [];

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  rules = [...style.sheet!.cssRules].filter(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule,
  );
});

/** Declarations of every rule for exactly this selector, in order. */
const declared = (selector: string) =>
  rules
    .filter((r) => r.selectorText === selector)
    .map((r) => r.style.cssText)
    .join(" ");
const px = (value: string) => parseFloat(value) || 0;

/** Renders `html` and returns its first element matching `selector`. */
function place(html: string, selector: string) {
  document.body.innerHTML = html;
  return document.body.querySelector<HTMLElement>(selector)!;
}

describe("touch targets", () => {
  it("gives every button at least 44px and no double-tap zoom", () => {
    expect(declared("button")).toMatch(/min-height: 44px/);
    expect(declared("button")).toMatch(/touch-action: manipulation/);
  });

  it.each([
    ["a text button", `<button class="text-button">浏览场景目录</button>`, "button"],
    [
      "已收集 in the achievements heading",
      `<section class="achievement-card"><div class="section-heading"><h2>我的小小成就</h2><button class="text-button">已收集</button></div></section>`,
      "button",
    ],
    ["a wish filter", `<div class="filter-row"><button>心愿灯</button></div>`, "button"],
    ["the + button", `<button class="round-button">+</button>`, "button"],
    ["a category chip", `<fieldset class="category-chips"><label>学业</label></fieldset>`, "label"],
    ["the ritual's wish picker", `<div class="ritual-link"><select></select></div>`, "select"],
    ["an older scene's button", `<div class="scene-overlay"><button class="scene-bow-tap">轻轻一礼</button></div>`, "button"],
  ])("makes %s at least 44px tall", (_name, html, selector) => {
    const style = getComputedStyle(place(html, selector));
    expect(Math.max(px(style.minHeight), px(style.height))).toBeGreaterThanOrEqual(44);
  });

  it("makes the + button 44px wide too", () => {
    expect(px(getComputedStyle(place(`<button class="round-button">+</button>`, "button")).width)).toBe(44);
  });

  it("keeps 已收集 from growing its heading row", () => {
    const style = getComputedStyle(
      place(`<section class="achievement-card"><button class="text-button">已收集</button></section>`, "button"),
    );
    expect(px(style.minHeight) + px(style.marginTop) + px(style.marginBottom)).toBeLessThanOrEqual(21);
  });

  it("extends the small pill buttons to a 44px target", () => {
    const pill = px(getComputedStyle(place(`<button class="small-button">记一笔</button>`, "button")).minHeight);
    const inset = declared(".small-button::before").match(/inset: (-?[\d.]+)px/);
    expect(inset).not.toBeNull();
    expect(pill - 2 * Number(inset![1])).toBeGreaterThanOrEqual(44);
  });
});
