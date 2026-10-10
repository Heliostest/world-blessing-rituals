import { describe, expect, it } from "vitest";
import {
  dailyCollectibleId,
  rituals,
  type Collectible,
  type RitualId,
} from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { builtInScenes, supportsScene } from "./scene-library";
import { hasSceneIcon } from "./scene-icons";
import {
  BLESSING_SCENE_IDS,
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  NIGHT_STAGE_SCENE_IDS,
  WISH_SCENE_IDS,
  dailyCollectedPicks,
  dailyPrimaryScene,
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

const days = Array.from(
  { length: 28 },
  (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
);
const ids = (list: CatalogEntry[]) => list.map((e) => e.id);
const placed: string[] = [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS];

/** The keepsake a daily walk of `sceneId` left on `day`. */
const keepsake = (sceneId: string, day = "2026-09-30"): Collectible => ({
  id: dailyCollectibleId(day, sceneId),
  kind: "scene",
  title: entries.find((e) => e.id === sceneId)?.title ?? sceneId,
  at: `${day}T08:00:00.000Z`,
  sceneId,
  ...(isWishScene(sceneId) ? { wishScene: true } : {}),
});

describe("今日's main walk", () => {
  it("is one placed scene a day, the same all day", () => {
    for (const day of days) {
      const primary = dailyPrimaryScene(entries, day)!;
      expect(placed, day).toContain(primary.id);
      expect(dailyPrimaryScene(entries, day)).toBe(primary);
    }
  });

  it("changes across days, the types mostly taking turns", () => {
    const seen = days.map((day) => dailyPrimaryScene(entries, day)!.id);
    expect(new Set(seen).size).toBeGreaterThan(5);
    const turns = seen
      .slice(1)
      .filter((id, i) => isWishScene(id) !== isWishScene(seen[i])).length;
    expect(turns).toBeGreaterThan(seen.length / 2);
  });

  it("skips scenes the catalog cannot open, without failing the day", () => {
    const partial = entries.filter((e) => e.id !== "woodfish");
    for (const day of days)
      expect(dailyPrimaryScene(partial, day)!.id).not.toBe("woodfish");
    expect(dailyPrimaryScene([entries[1]], "2026-10-01")!.id).toBe(
      "tanzaku-tanabata",
    );
    expect(dailyPrimaryScene([], "2026-10-01")).toBeUndefined();
  });
});

describe("今日's picks from 小天地", () => {
  const all = placed.map((id) => keepsake(id));

  it("offers three kept scenes a day: exactly one 许愿, two 祈福", () => {
    for (const day of days) {
      const picks = dailyCollectedPicks(entries, all, day);
      expect(picks, day).toHaveLength(3);
      expect(picks.filter((e) => isWishScene(e.id)), day).toHaveLength(1);
      expect(new Set(ids(picks)).size).toBe(3);
    }
  });

  it("stays put all day, in any save order, and changes across days", () => {
    const day = "2026-10-11";
    const picks = ids(dailyCollectedPicks(entries, all, day));
    expect(ids(dailyCollectedPicks(entries, [...all].reverse(), day))).toEqual(
      picks,
    );
    // Collecting the day's walk leaves the picks as they were.
    const walked = [...all, keepsake(dailyPrimaryScene(entries, day)!.id, day)];
    expect(ids(dailyCollectedPicks(entries, walked, day))).toEqual(picks);
    const seen = new Set(
      days.flatMap((d) => ids(dailyCollectedPicks(entries, all, d))),
    );
    expect(seen.size).toBeGreaterThan(3);
  });

  it("leaves a keepsake collected today for tomorrow", () => {
    const today = [keepsake("crane", "2026-10-11"), keepsake("woodfish", "2026-10-11")];
    expect(dailyCollectedPicks(entries, today, "2026-10-11")).toEqual([]);
    expect(ids(dailyCollectedPicks(entries, today, "2026-10-12"))).toEqual([
      "woodfish",
      "crane",
    ]);
  });

  it("shows fewer cards for a short pool, never a second 许愿 or a made-up one", () => {
    for (const day of days) {
      expect(dailyCollectedPicks(entries, [], day)).toEqual([]);
      // Only 许愿 kept: the one 许愿 card.
      const wishes = dailyCollectedPicks(
        entries,
        WISH_SCENE_IDS.map((id) => keepsake(id)),
        day,
      );
      expect(wishes).toHaveLength(1);
      expect(isWishScene(wishes[0].id)).toBe(true);
      // One 祈福 kept beside the 许愿: two cards.
      const short = dailyCollectedPicks(
        entries,
        [keepsake("crane"), keepsake("lantern"), keepsake("woodfish")],
        day,
      );
      expect(short).toHaveLength(2);
      expect(short[0].id).toBe("woodfish");
      expect(["crane", "lantern"]).toContain(short[1].id);
      // No 许愿 kept yet: up to three 祈福.
      const blessings = dailyCollectedPicks(
        entries,
        BLESSING_SCENE_IDS.map((id) => keepsake(id)),
        day,
      );
      expect(blessings).toHaveLength(3);
      expect(blessings.some((e) => isWishScene(e.id))).toBe(false);
      expect(
        dailyCollectedPicks(entries, [keepsake("woodfish"), keepsake("shinto-torii")], day),
      ).toHaveLength(2);
    }
  });

  it("gives a scene kept on several days one card", () => {
    const repeats = ["2026-09-28", "2026-09-29", "2026-09-30"].flatMap((d) => [
      keepsake("woodfish", d),
      keepsake("crane", d),
    ]);
    for (const day of days)
      expect(ids(dailyCollectedPicks(entries, repeats, day))).toEqual([
        "woodfish",
        "crane",
      ]);
  });

  it("picks only scene keepsakes the catalog can open, spent ones too", () => {
    const mixed: Collectible[] = [
      { ...keepsake("crane"), spentAt: "2026-10-01T08:00:00.000Z" },
      { ...keepsake("lantern"), id: "lost", sceneId: "no-such-scene" },
      { id: "b1", kind: "badge", title: "还愿纪念", at: "2026-10-01T08:00:00.000Z" },
      { id: "c1", kind: "crane", title: "纸鹤", at: "2026-10-01T08:00:00.000Z" },
    ];
    expect(ids(dailyCollectedPicks(entries, mixed, "2026-10-11"))).toEqual([
      "crane",
    ]);
    expect(dailyCollectedPicks([], all, "2026-10-11")).toEqual([]);
  });
});

describe("今日's copy", () => {
  it("keeps it safe", () => {
    for (const text of [
      ...Object.values(DAILY_SET_COPY),
      ...Object.values(DAILY_COLLECTED_COPY),
    ]) {
      expect(() => assertSafeCopy(text)).not.toThrow();
    }
  });
});
