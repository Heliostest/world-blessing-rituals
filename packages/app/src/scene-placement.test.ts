import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@wbr/content/catalog";
import {
  TODAY_SCENE_IDS,
  WISH_SCENE_IDS,
  isTodayScene,
  isWishScene,
  recommendTodayScene,
  wishSceneEntries,
  todaySceneEntries,
} from "./scene-placement";

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
];

describe("scene placement", () => {
  it("splits today vs wish scene ids", () => {
    expect([...TODAY_SCENE_IDS]).toEqual(["furin-wind-chime"]);
    expect([...WISH_SCENE_IDS]).toEqual(["tanzaku-tanabata", "yeondeunghoe"]);
    expect(isTodayScene("furin-wind-chime")).toBe(true);
    expect(isWishScene("tanzaku-tanabata")).toBe(true);
    expect(isWishScene("furin-wind-chime")).toBe(false);
  });

  it("lists catalog entries for each surface", () => {
    expect(todaySceneEntries(entries).map((e) => e.id)).toEqual([
      "furin-wind-chime",
    ]);
    expect(wishSceneEntries(entries).map((e) => e.id)).toEqual([
      "tanzaku-tanabata",
      "yeondeunghoe",
    ]);
  });

  it("never recommends a wish scene on 今日", () => {
    for (let i = 0; i < 32; i++) {
      const day = `2026-09-${String((i % 28) + 1).padStart(2, "0")}`;
      const pick = recommendTodayScene(entries, day);
      expect(pick).toBeDefined();
      expect(isWishScene(pick!.id)).toBe(false);
    }
  });
});
