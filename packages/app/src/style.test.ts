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

describe("non-text contrast (WCAG 1.4.11)", () => {
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

describe("polka dots", () => {
  /** A dot layer: the page's --dots, or a small hard-stopped radial gradient. */
  const dotted = (rule: string) =>
    /var\(--dots\)|radial-gradient\([^()]*px, transparent/.test(rule);

  it("stay on the grounds: the page and a stage", () => {
    expect(dotted(declared(".app-shell"))).toBe(true);
    expect(dotted(declared(".library-scene-stage"))).toBe(true);
  });

  it.each([".wish-hero", ".practice-card"])(
    "never sit on dots: %s, a card on the dotted page, is a solid tint",
    (selector) => {
      expect(dotted(declared(selector))).toBe(false);
      expect(declared(selector)).toMatch(/background: var\(--[a-z]+-tint\);/);
    },
  );

  it("leave 小天地's room: warm striped wallpaper, its line still AA", () => {
    const room = declared(".room");
    expect(dotted(room)).toBe(false);
    expect(room).not.toMatch(/#dcf6ef|#c3ecdf/); // the page's mint
    const stripes = room.match(/repeating-linear-gradient\(\s*90deg,((?:[^()]|\([^()]*\))*)\)/);
    expect(stripes).not.toBeNull();
    const colours = [...stripes![1].matchAll(/var\((--[a-z-]+)\)|(#[0-9a-f]{6})\b/g)].map(
      (m) => (m[1] ? token(m[1]) : m[2]),
    );
    expect(colours).toContain(token("--butter-tint"));
    // 留个位置… sits on the wall in --ink-soft.
    expect(declared(".empty-shelf")).toMatch(/color: var\(--ink-soft\)/);
    for (const colour of colours)
      expect(ratio(token("--ink-soft"), colour), colour).toBeGreaterThanOrEqual(4.5);
  });
});

describe("type size", () => {
  it("sets no text below 12px, so CJK stays legible; only the desktop note's Latin caps are 11px", () => {
    const small = rules
      .filter((r) => parseFloat(r.style.getPropertyValue("font-size")) < 12)
      .map((r) => r.selectorText);
    expect(small).toEqual([".desktop-note > span:last-child"]);
  });
});

describe("scene page lines", () => {
  /** Declarations of every rule whose selector list includes `selector`. */
  const declaredFor = (selector: string) =>
    rules
      .filter((r) => r.selectorText.split(/\s*,\s*/).includes(selector))
      .map((r) => r.style.cssText)
      .join(" ");

  it.each([".scene-caption", ".scene-instruction", ".scene-done"])(
    "sets %s in the island body voice, with room around it",
    (selector) => {
      const rule = declaredFor(selector);
      expect(rule).toMatch(/color: var\(--ink-soft\)/);
      expect(rule).toMatch(/font-weight: 600/);
      expect(rule).toMatch(/margin: /);
    },
  );
});

describe("2D ritual stage", () => {
  it("keeps the lantern's string clear of the feedback lines, as the crane's", () => {
    expect(declared(".ritual-lantern .ritual-object")).toMatch(/margin-top: 16px/);
    expect(declared(".art-variant-default:not(.art-small)")).toMatch(/margin: 16px auto/);
  });
});

describe("page ribbon", () => {
  it("stays on one line, 12px clear of the back button, with an ellipsis when too long", () => {
    const ribbon = declared(".app-topbar h2");
    expect(ribbon).toMatch(/max-width: calc\(100% - 104px\)/);
    expect(ribbon).toMatch(/white-space: nowrap/);
    expect(ribbon).toMatch(/overflow: hidden/);
    expect(ribbon).toMatch(/text-overflow: ellipsis/);
  });

  it("folds its tails under a front tilted back, as the island Title does", () => {
    expect(declared(".app-topbar h2::after")).toMatch(
      /transform: perspective\(11\.5em\) rotateX\(3deg\)/,
    );
    // The folds are darker than the tails, the tails darker than the front.
    const back = declared(".app-topbar h2::before");
    expect(back).toMatch(/var\(--mint-ledge\)/);
    const fold = back.match(/#[0-9a-f]{6}/)![0];
    expect(luminance(fold)).toBeLessThan(luminance(token("--mint-ledge")));
    expect(luminance(token("--mint-ledge"))).toBeLessThan(luminance(token("--mint")));
  });

  it("hangs the tails inside the h2 and takes the drop back, so the front stays level with the back button", () => {
    const ribbon = declared(".app-topbar h2");
    expect(ribbon).toMatch(/isolation: isolate/);
    expect(ribbon).toMatch(/margin-bottom: calc\(-1 \* var\(--drop\)\)/);
    expect(ribbon).toMatch(/padding: 6px 30px calc\(8px \+ var\(--drop\)\)/);
  });
});

describe("completion page", () => {
  it("fades the sunburst on every side, on its own layer under the reward", () => {
    // A mask on .celebration itself would fade the number, postcard and badge.
    expect(declared(".celebration")).not.toMatch(/mask/);
    expect(declared(".celebration")).toMatch(/isolation: isolate/);
    const rays = declared(".celebration::before");
    expect(rays).toMatch(/repeating-conic-gradient/);
    expect(rays).toMatch(/mask-image: radial-gradient\(closest-side/);
    expect(rays).toMatch(/z-index: -1/);
  });

  it("puts the close button in the 68px bar, level with every page's back button", () => {
    const bar = place(
      `<header class="app-topbar completion-topbar"><button class="back-button"></button></header>`,
      "header",
    );
    expect(getComputedStyle(bar).height).toBe("68px");
  });

  it("enters in stages, not all at once, with the confirm last", () => {
    expect(declared(".completion > *")).toMatch(
      /animation: completion-in 0\.3s var\(--ease\) backwards/,
    );
    expect(declared(".completion > .celebration")).toMatch(/animation-delay: 0\.08s/);
    expect(declared(".completion > .button")).toMatch(/animation-delay: 0\.3s/);
    expect(declared(".completion .reward-number")).toMatch(/animation: completion-pop/);
    expect(declared(".completion .title-badge")).toMatch(/animation: completion-stamp/);
  });

  it("shows the item's own sticker in an inventory slot, named with its destination", () => {
    const sticker = declared(".reward-sticker");
    expect(sticker).toMatch(/background: var\(--slot\)/);
    expect(sticker).toMatch(/border: 3px solid var\(--rim\)/);
    expect(declared(".reward-destination")).toMatch(/color: var\(--ink-soft\)/);
    expect(declared(".reward-wish-note")).toMatch(/color: var\(--muted\)/);
  });
});

describe("reward flight", () => {
  it("fixes the ghost layer above the dock and the save pill, touching nothing", () => {
    const layer = declared(".reward-flight-layer");
    expect(layer).toMatch(/position: fixed/);
    expect(layer).toMatch(/inset: 0/);
    expect(layer).toMatch(/pointer-events: none/);
    expect(layer).toMatch(/z-index: 30/);
    // The dock (10) and the save pill (20) both sit below it.
    expect(px(declared(".bottom-nav").match(/z-index: (\d+)/)![1])).toBeLessThan(30);
  });

  it("styles the tab badge as a 12px butter bubble with a ring, never a ledge", () => {
    const badge = place(
      `<nav class="bottom-nav"><button><span>今日</span><i>+1</i></button></nav>`,
      ".bottom-nav i",
    );
    const style = getComputedStyle(badge);
    expect(px(style.fontSize)).toBeGreaterThanOrEqual(12);
    const rule = declared(".bottom-nav i");
    expect(rule).toMatch(/background: var\(--butter\)/);
    // Ring only: the shadow sits flat (no y offset), unlike a ledge.
    expect(rule).toMatch(/box-shadow: 0(px)? 0(px)? 0(px)? 2px var\(--butter-ledge\)/);
    expect(rule).not.toMatch(/box-shadow:[^;]*\b0 [1-9]\d*px 0\b/);
    expect(ratio(token("--ink"), token("--butter"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["reward-land", "tab-hop", "badge-pop", "sparkle", "completion-in"])(
    "defines the %s keyframes",
    (name) => {
      expect(css).toMatch(new RegExp(`@keyframes ${name} \\{`));
    },
  );

  it("hides an arriving slot by opacity, so it stays in the accessibility tree", () => {
    const rule = declared("[data-arriving]");
    expect(rule).toMatch(/opacity: 0/);
    expect(rule).not.toMatch(/visibility/);
    expect(rule).not.toMatch(/display/);
  });

  it("rings a landed slot with a static 新 mark, and lets sparks end invisible", () => {
    const mark = declared(".new-mark");
    expect(mark).toMatch(/background: var\(--leaf\)/);
    expect(mark).toMatch(/box-shadow: 0(px)? 0(px)? 0(px)? 2px var\(--leaf-ledge\)/);
    expect(declared(".reward-landed")).toMatch(/animation: reward-land/);
    // Base opacity 0, so with animations off the sparks never show.
    expect(declared(".reward-sparks i")).toMatch(/opacity: 0/);
    expect(declared(".reward-sparks i:nth-child(1)")).toMatch(/--spark-x: -24px/);
  });

  it("bumps the count pill and hops the tab at landing", () => {
    expect(declared(".count-pill.pill-bump")).toMatch(/animation: badge-pop/);
    expect(declared(".bottom-nav button.tab-hop")).toMatch(/animation: tab-hop/);
  });

  it("keeps the kill switch total, so none of the new motion runs reduced", () => {
    const kill = rules
      .filter((r) => r.selectorText.split(/\s*,\s*/).includes(".reduce-motion *"))
      .map((r) => r.style.cssText)
      .join(" ");
    expect(kill).toMatch(/animation: none !important/);
    expect(kill).toMatch(/transition: none !important/);
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
  const overlay = (stage: boolean) =>
    `<div class="scene-overlay${stage ? " scene-overlay--stage" : ""}"><div class="scene-hit-layer"></div><div class="scene-title">t</div><div class="scene-step-dots"></div><div class="scene-hint">h</div><button class="scene-bow-tap">b</button><div class="scene-wish-slot"></div></div>`;
  const events = (selector: string) =>
    getComputedStyle(document.querySelector(selector)!).pointerEvents;

  it("frames the night stage like every stage: only its canvas is night", () => {
    const night = declared('.library-scene-stage[data-stage="night"]');
    expect(night).toMatch(/background/);
    expect(night).not.toMatch(/border/);
    expect(night).not.toMatch(/box-shadow/);
    expect(declared(".library-scene-stage")).toMatch(/border: 4px solid var\(--rim\)/);
  });

  it("hangs each night scene's moon in its own sky, smaller than the default", () => {
    const moon = (scene: string) =>
      rules
        .filter((r) =>
          r.selectorText.split(/\s*,\s*/).includes(`.library-scene-stage[data-scene="${scene}"]::before`),
        )
        .map((r) => r.style.cssText)
        .join(" ");
    // 月下一灯: top left, off the crossbar's right end where the default sat.
    expect(moon("lantern")).toMatch(/left: 18px/);
    // 燃灯: in the gap between the two high companion lanterns.
    expect(moon("yeondeunghoe")).toMatch(/left: 52%/);
    for (const scene of ["lantern", "yeondeunghoe"]) {
      expect(moon(scene), scene).toMatch(/right: auto/);
      expect(moon(scene), scene).toMatch(/width: 34px/);
    }
    expect(declared('.library-scene-stage[data-stage="night"]::before')).toMatch(/width: 44px/);
  });

  it("opens the day stage on a clear blue sky, so pale subjects part from it", () => {
    expect(declared(".library-scene-stage")).toMatch(/--day-sky: linear-gradient\(\s*180deg,\s*#bfe6f7 0%/);
    expect(declared(".library-scene-stage")).toMatch(/background: .*var\(--day-sky\)/s);
  });

  it("grounds the floating crane on the stage: its own sky and a shadow under it", () => {
    const crane = '.library-scene-stage[data-scene="crane"]';
    expect(declared(crane)).toMatch(/--day-sky: linear-gradient/);
    // Behind the canvas, below the paper's lowest point (84% of the canvas).
    const shadow = declared(`${crane}::before`);
    expect(shadow).toMatch(/z-index: -1/);
    expect(shadow).toMatch(/top: calc\(var\(--canvas-h\) \* 0\.9\)/);
  });

  it("hides the name plate on the App's stage, where the page h1 names the scene", () => {
    expect(declared(".library-scene-stage .scene-title")).toMatch(/display: none/);
  });

  it("styles the scene kit's island-stage overlay: scroll from empty stage, the wish note in ink", () => {
    // createStepOverlay (packages/scenes procedural-kit) adds scene-overlay--stage.
    expect(declared(".scene-overlay--stage .scene-hit-layer")).toMatch(/touch-action: manipulation/);
    expect(declared(".scene-overlay--stage .scene-wish-slot .wish-write-meta")).toMatch(
      /color: var\(--ink-soft\)/,
    );
    // The older dark scenes build their own overlay and keep light text.
    expect(declared(".scene-overlay:not(.scene-overlay--stage)")).toMatch(/color: #f6f1e4/);
  });

  it.each([false, true])("lets taps through title, dots and hint (island stage: %s)", (stage) => {
    place(overlay(stage), ".scene-overlay");
    for (const label of [".scene-title", ".scene-step-dots", ".scene-hint"])
      expect(events(label), label).toBe("none");
    for (const control of [".scene-hit-layer", ".scene-bow-tap", ".scene-wish-slot"])
      expect(events(control), control).toBe("auto");
  });
});
