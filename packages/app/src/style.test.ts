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
// jsdom's cascade ignores selector specificity (the last declaration wins), so
// these checks only assert values a browser resolves the same way.

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  // Top-level rules and those inside @media blocks.
  rules = [...style.sheet!.cssRules]
    .flatMap((r) => (r instanceof CSSMediaRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
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

describe("text fields", () => {
  it("never sizes a text field below 16px, so iOS does not zoom in on focus", () => {
    const size = (r: CSSStyleRule) => r.style.getPropertyValue("font-size");
    const sized = rules.filter(
      (r) => /\b(input|textarea|select)\b/.test(r.selectorText) && /^\d/.test(size(r)),
    );
    expect(sized.length).toBeGreaterThan(0);
    for (const rule of sized)
      expect(px(size(rule)), rule.selectorText).toBeGreaterThanOrEqual(16);
  });

  it.each([
    ["the wish title", `<section class="form-card"><textarea></textarea></section>`, "textarea"],
    ["a 还愿 note", `<section class="form-card"><div class="return-note"><textarea></textarea></div></section>`, "textarea"],
    ["the share text", `<div class="share-panel"><textarea></textarea></div>`, "textarea"],
    ["the ritual's wish picker", `<div class="ritual-link"><select></select></div>`, "select"],
  ])("sets %s at 16px", (_name, html, selector) => {
    expect(getComputedStyle(place(html, selector)).fontSize).toBe("16px");
  });
});

describe("scene load error", () => {
  it("wraps a long detail inside the card, so 重试打开 stays on screen", () => {
    const rule = declared(".scene-load-error");
    expect(rule).toMatch(/grid-template-columns: minmax\(0(px)?, 1fr\)/);
    expect(rule).toMatch(/overflow-wrap: anywhere/);
    expect(declared(".scene-load-error code")).toMatch(/white-space: pre-wrap/);
  });
});

describe("non-text contrast (WCAG 1.4.11)", () => {
  /** A colour token's hex value, from :root in the stylesheet. */
  const token = (name: string) =>
    css.match(new RegExp(`${name}: (#[0-9a-f]{6});`))![1];
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("gives a field an outline of 3:1 or more on the mint page, sand and its paper fill", () => {
    for (const ground of ["--island", "--sand", "--paper"])
      expect(ratio(token("--field-edge"), token(ground)), ground).toBeGreaterThanOrEqual(3);
  });

  /** Declarations of every rule whose selector list includes `selector`. */
  const declaredFor = (selector: string) =>
    rules
      .filter((r) => r.selectorText.split(/\s*,\s*/).includes(selector))
      .map((r) => r.style.cssText)
      .join(" ");

  it.each([
    ["the wish and note text areas", ".form-card textarea"],
    ["the share text", ".share-panel textarea"],
    ["the 场景目录 search", ".scene-search input"],
    ["the cache limit", ".cache-manager select"],
    ["a scene's wish box", ".scene-wish-slot input"],
    ["a 还愿 choice's radio box", ".choice-row input"],
    ["a switch", ".switch"],
    ["a step still to come", ".scene-step-dot"],
  ])("outlines %s with it", (_name, selector) => {
    expect(declaredFor(selector)).toMatch(/border: 2(\.5)?px solid var\(--field-edge\)/);
  });

  it("rings the ritual's wish picker, a field on the mint page, with it", () => {
    expect(declared(".ritual-link")).toMatch(/0(px)? 0(px)? 0(px)? 2px var\(--field-edge\)/);
  });

  it("draws a switch that is on in leaf ink, 3:1 or more on sand", () => {
    expect(declared(".switch:checked")).toMatch(/border-color: var\(--leaf-ink\)/);
    expect(
      rules
        .filter((r) => /^\.switch:checked::?before$/.test(r.selectorText))
        .map((r) => r.style.cssText)
        .join(" "),
    ).toMatch(/border-color: var\(--leaf-ink\)/);
    expect(ratio(token("--leaf-ink"), token("--sand"))).toBeGreaterThanOrEqual(3);
  });
});

describe("了解此仪式 disclosure", () => {
  it("is a flat down chevron that flips open, not a ledged go-to chevron", () => {
    const closed = declared(".ritual-narrative > summary::before");
    expect(closed).toMatch(/m6 9 6 6 6-6/);
    expect(closed).not.toMatch(/m9 5 7 7-7 7/);
    expect(closed).not.toMatch(/ledge/);
    // Ring only: every shadow sits flat (no y offset), unlike a ledge.
    expect(closed).toMatch(/box-shadow: 0(px)? 0(px)? 0(px)? 2px/);
    expect(declared(".ritual-narrative[open] > summary::before")).toMatch(
      /rotate\(180deg\)/,
    );
  });
});

describe("scene overlay", () => {
  const overlay = (cream: boolean) =>
    `<div class="scene-overlay${cream ? " scene-overlay--cream" : ""}"><div class="scene-hit-layer"></div><div class="scene-title">t</div><div class="scene-step-dots"></div><div class="scene-hint">h</div><button class="scene-bow-tap">b</button><div class="scene-wish-slot"></div></div>`;
  const events = (selector: string) =>
    getComputedStyle(document.querySelector(selector)!).pointerEvents;

  it("hides the name plate on the App's stage, where the page h1 names the scene", () => {
    expect(declared(".library-scene-stage .scene-title")).toMatch(/display: none/);
  });

  it.each([false, true])("lets taps through title, dots and hint (cream: %s)", (cream) => {
    place(overlay(cream), ".scene-overlay");
    for (const label of [".scene-title", ".scene-step-dots", ".scene-hint"])
      expect(events(label), label).toBe("none");
    for (const control of [".scene-hit-layer", ".scene-bow-tap", ".scene-wish-slot"])
      expect(events(control), control).toBe("auto");
  });
});
