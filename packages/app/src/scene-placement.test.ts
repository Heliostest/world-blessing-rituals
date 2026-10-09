import { describe, expect, it } from "vitest";
import { rituals, type RitualId } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { builtInScenes, supportsScene } from "./scene-library";
import { hasSceneIcon } from "./scene-icons";
import {
  BLESSING_SCENE_IDS,
  DAILY_SET_COPY,
  NIGHT_STAGE_SCENE_IDS,
  WISH_SCENE_IDS,
  dailySceneSet,
  isWishScene,
  ritualSceneEntry,
  sceneRitual,
  sceneStage,
  sceneSteps,
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
  bundled("celtic-folk-spring", "泉边一念"),
  bundled("theravada-water", "花水位一倾"),
  bundled("crane", "折一只纸鹤"),
  bundled("lantern", "月下一灯"),
  bundled("slavic-wreath", "火边花环"),
];

describe("scene placement", () => {
  it("splits blessing vs wish scene ids", () => {
    expect([...BLESSING_SCENE_IDS]).toEqual([
      "woodfish",
      "furin-wind-chime",
      "shinto-torii",
      "tibetan-wheel",
      "celtic-folk-spring",
      "theravada-water",
    ]);
    expect([...WISH_SCENE_IDS]).toEqual([
      "tanzaku-tanabata",
      "yeondeunghoe",
      "crane",
      "lantern",
      "slavic-wreath",
    ]);
    expect(isWishScene("tanzaku-tanabata")).toBe(true);
    expect(isWishScene("slavic-wreath")).toBe(true);
    expect(isWishScene("furin-wind-chime")).toBe(false);
  });

  it("places every placed scene on exactly one surface, and all are bundled", () => {
    for (const id of BLESSING_SCENE_IDS) expect(isWishScene(id)).toBe(false);
    const bundledIds = builtInScenes.map((e) => e.id);
    for (const id of [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS]) {
      expect(bundledIds).toContain(id);
    }
  });

  it("opens every core ritual as the bundled scene of the same id", () => {
    for (const ritual of Object.keys(rituals) as RitualId[]) {
      const entry = ritualSceneEntry(builtInScenes, ritual)!;
      expect(entry.id, ritual).toBe(ritual);
      expect(supportsScene(entry.engine), ritual).toBe(true);
      expect(sceneRitual(entry.id)).toBe(ritual);
    }
    expect(ritualSceneEntry([], "crane")).toBeUndefined();
    for (const id of ["tanzaku-tanabata", "toString", ""])
      expect(sceneRitual(id), id).toBeUndefined();
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "woodfish")!)).toBe(12);
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "crane")!)).toBe(3);
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "lantern")!)).toBe(3);
  });

  it("shows the lantern scenes on the night stage, every other scene by day", () => {
    expect([...NIGHT_STAGE_SCENE_IDS]).toEqual(["lantern", "yeondeunghoe"]);
    for (const id of NIGHT_STAGE_SCENE_IDS) expect(sceneStage(id)).toBe("night");
    for (const id of [
      ...BLESSING_SCENE_IDS,
      "crane",
      "tanzaku-tanabata",
      "slavic-wreath",
    ])
      expect(sceneStage(id), id).toBe("day");
  });

  it("gives every placed scene a drawn icon, keyed by its id", () => {
    for (const id of [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS])
      expect(hasSceneIcon(id), id).toBe(true);
    expect(hasSceneIcon("no-such-scene")).toBe(false);
  });
});

describe("今日's daily set", () => {
  it("offers two 祈福 scenes and one 许愿 scene each day", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-10-${String(i).padStart(2, "0")}`;
      const set = dailySceneSet(entries, day);
      expect(set).toHaveLength(3);
      expect(set.filter((e) => isWishScene(e.id))).toHaveLength(1);
      for (const entry of set)
        expect(
          BLESSING_SCENE_IDS.includes(entry.id as never) ||
            WISH_SCENE_IDS.includes(entry.id as never),
          `${day} ${entry.id}`,
        ).toBe(true);
    }
  });

  it("stays put all day, and changes across days", () => {
    const a = dailySceneSet(entries, "2026-10-01");
    expect(dailySceneSet(entries, "2026-10-01").map((e) => e.id)).toEqual(
      a.map((e) => e.id),
    );
    const seen = new Set<string>();
    for (let i = 1; i <= 28; i++)
      for (const e of dailySceneSet(entries, `2026-10-${String(i).padStart(2, "0")}`))
        seen.add(e.id);
    expect(seen.size).toBeGreaterThan(3);
  });

  it("skips scenes the catalog cannot open, without failing the day", () => {
    const partial = entries.filter((e) => e.id !== "woodfish");
    for (let i = 1; i <= 14; i++) {
      const set = dailySceneSet(partial, `2026-10-${String(i).padStart(2, "0")}`);
      expect(set.map((e) => e.id)).not.toContain("woodfish");
      expect(set.filter((e) => isWishScene(e.id))).toHaveLength(1);
    }
    expect(dailySceneSet([entries[1]], "2026-10-01").map((e) => e.id)).toEqual([
      "tanzaku-tanabata",
    ]);
    expect(dailySceneSet([], "2026-10-01")).toEqual([]);
  });

  it("keeps its copy safe", () => {
    for (const text of [
      DAILY_SET_COPY.heading,
      DAILY_SET_COPY.sub,
      DAILY_SET_COPY.blessingNote,
      DAILY_SET_COPY.wishNote,
      DAILY_SET_COPY.collected,
      DAILY_SET_COPY.browse,
    ]) {
      expect(() => assertSafeCopy(text)).not.toThrow();
    }
  });
});