import { describe, expect, it } from "vitest";
import { dailyRitual } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { builtInScenes } from "./scene-library";
import { hasSceneIcon } from "./scene-icons";
import {
  NIGHT_STAGE_SCENE_IDS,
  TODAY_PRACTICE_COPY,
  TODAY_SCENE_IDS,
  WISH_PRACTICE_COPY,
  WISH_SCENE_IDS,
  featuredTodayPractice,
  isTodayScene,
  isWishScene,
  recommendTodayScene,
  sceneStage,
  todayPracticeCopy,
  wishPracticeAction,
  wishSceneEntries,
  todaySceneEntries,
} from "./scene-placement";

const bundled = (id: string, title: string): CatalogEntry => ({
  id,
  title,
  engine: `${id}@1`,
  revision: "bundled",
  manifestUrl: "",
});

const entries: CatalogEntry[] = [
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "tanzaku-tanabata",
    title: "短册系竹",
    engine: "tanzaku-tanabata@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "yeondeunghoe",
    title: "燃灯上浮",
    engine: "yeondeunghoe@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "furin-wind-chime",
    title: "风铃一响",
    engine: "furin-wind-chime@1",
    revision: "bundled",
    manifestUrl: "",
  },
  bundled("shinto-torii", "庭前一礼"),
  bundled("tibetan-wheel", "廊前轻转"),
  bundled("crane", "折一只纸鹤"),
  bundled("lantern", "月下一灯"),
  bundled("slavic-wreath", "火边花环"),
];

describe("scene placement", () => {
  it("splits today vs wish scene ids", () => {
    expect([...TODAY_SCENE_IDS]).toEqual([
      "furin-wind-chime",
      "shinto-torii",
      "tibetan-wheel",
    ]);
    expect([...WISH_SCENE_IDS]).toEqual([
      "tanzaku-tanabata",
      "yeondeunghoe",
      "crane",
      "lantern",
      "slavic-wreath",
    ]);
    expect(isTodayScene("furin-wind-chime")).toBe(true);
    expect(isTodayScene("shinto-torii")).toBe(true);
    expect(isWishScene("tanzaku-tanabata")).toBe(true);
    expect(isWishScene("slavic-wreath")).toBe(true);
    expect(isWishScene("furin-wind-chime")).toBe(false);
  });

  it("places every placed scene on exactly one surface, and all are bundled", () => {
    for (const id of TODAY_SCENE_IDS) expect(isWishScene(id)).toBe(false);
    const bundledIds = builtInScenes.map((e) => e.id);
    for (const id of [...TODAY_SCENE_IDS, ...WISH_SCENE_IDS]) {
      expect(bundledIds).toContain(id);
    }
  });

  it("shows the lantern scenes on the night stage, every other scene by day", () => {
    expect([...NIGHT_STAGE_SCENE_IDS]).toEqual(["lantern", "yeondeunghoe"]);
    for (const id of NIGHT_STAGE_SCENE_IDS) expect(sceneStage(id)).toBe("night");
    for (const id of [...TODAY_SCENE_IDS, "crane", "tanzaku-tanabata", "woodfish"])
      expect(sceneStage(id), id).toBe("day");
  });

  it("gives every placed scene a drawn icon, keyed by its id", () => {
    for (const id of [...TODAY_SCENE_IDS, ...WISH_SCENE_IDS])
      expect(hasSceneIcon(id), id).toBe(true);
    expect(hasSceneIcon("no-such-scene")).toBe(false);
  });

  it("lists catalog entries for each surface", () => {
    expect(todaySceneEntries(entries).map((e) => e.id)).toEqual([
      ...TODAY_SCENE_IDS,
    ]);
    expect(wishSceneEntries(entries).map((e) => e.id)).toEqual([
      ...WISH_SCENE_IDS,
    ]);
  });

  it("gives each surface's scenes their own safe copy", () => {
    for (const id of TODAY_SCENE_IDS) {
      const copy = todayPracticeCopy(id)!;
      // Icons are drawn and keyed by scene id, never carried in the copy.
      expect(copy).not.toHaveProperty("glyph");
      expect(() => assertSafeCopy(copy.blurb)).not.toThrow();
    }
    expect(todayPracticeCopy("crane")).toBeUndefined();
    for (const entry of wishSceneEntries(entries)) {
      // The 心愿 card and detail tile show the title already: the verb only.
      const verb = wishPracticeAction(entry);
      expect(verb).not.toContain(entry.title);
      expect(() => assertSafeCopy(verb)).not.toThrow();
    }
    expect(wishSceneEntries(entries).map((e) => wishPracticeAction(e))).toEqual([
      "系一念",
      "推一盏",
      "折一念",
      "点一盏",
      "放一环",
    ]);
    expect(wishPracticeAction(entries[0])).toBe(WISH_PRACTICE_COPY.otherAction);
    for (const text of [
      TODAY_PRACTICE_COPY.tag,
      TODAY_PRACTICE_COPY.action,
      WISH_PRACTICE_COPY.blurb,
      WISH_PRACTICE_COPY.otherAction,
    ]) {
      expect(() => assertSafeCopy(text)).not.toThrow();
    }
  });

  it("features a different 今日 practice across days, never a wish scene", () => {
    const seen = new Set<string>();
    for (let i = 1; i <= 28; i++) {
      const pick = featuredTodayPractice(entries, `2026-10-${String(i).padStart(2, "0")}`);
      expect(pick && isTodayScene(pick.id)).toBe(true);
      seen.add(pick!.id);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(featuredTodayPractice([entries[0]], "2026-10-01")).toBeUndefined();
  });

  it("never recommends a wish scene on 今日", () => {
    for (let i = 0; i < 32; i++) {
      const day = `2026-09-${String((i % 28) + 1).padStart(2, "0")}`;
      const pick = recommendTodayScene(entries, day);
      expect(pick).toBeDefined();
      expect(isWishScene(pick!.id)).toBe(false);
    }
  });

  it("dedupes 今日 recommendation from featured practice and daily ritual", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-10-${String(i).padStart(2, "0")}`;
      const featured = featuredTodayPractice(entries, day);
      const ritual = dailyRitual(day);
      const pick = recommendTodayScene(entries, day);
      expect(pick).toBeDefined();
      expect(isWishScene(pick!.id)).toBe(false);
      if (featured) expect(pick!.id).not.toBe(featured.id);
      expect(pick!.id).not.toBe(ritual);
    }
  });
});
