import type { CatalogEntry } from "@wbr/content/catalog";
import { recommendScene } from "@wbr/content/catalog";

/** Scenes that belong on 今日 as blessing / daily practices (not wish flow). */
export const TODAY_SCENE_IDS = ["furin-wind-chime"] as const;

/** Scenes that belong on 心愿 as wish practices. */
export const WISH_SCENE_IDS = ["tanzaku-tanabata", "yeondeunghoe"] as const;

export type TodaySceneId = (typeof TODAY_SCENE_IDS)[number];
export type WishSceneId = (typeof WISH_SCENE_IDS)[number];

const wishSet = new Set<string>(WISH_SCENE_IDS);
const todaySet = new Set<string>(TODAY_SCENE_IDS);

export function isWishScene(id: string): boolean {
  return wishSet.has(id);
}

export function isTodayScene(id: string): boolean {
  return todaySet.has(id);
}

export function findSceneEntry(
  entries: CatalogEntry[],
  id: string,
): CatalogEntry | undefined {
  return entries.find((e) => e.id === id);
}

export function wishSceneEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return WISH_SCENE_IDS.map((id) => findSceneEntry(entries, id)).filter(
    (e): e is CatalogEntry => !!e,
  );
}

export function todaySceneEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return TODAY_SCENE_IDS.map((id) => findSceneEntry(entries, id)).filter(
    (e): e is CatalogEntry => !!e,
  );
}

/**
 * Daily recommendation on 今日: exclude wish-practice scenes so 心愿 content
 * does not surface as "今日场景推荐". Falls back to full list if the filtered
 * pool is empty.
 */
export function recommendTodayScene(
  entries: CatalogEntry[],
  day: string,
): CatalogEntry | undefined {
  const pool = entries.filter((e) => !isWishScene(e.id));
  return recommendScene(pool.length ? pool : entries, day);
}

export const FURIN_COPY = {
  tag: "今日小练习",
  title: "风铃一响",
  blurb: "轻拂听一声清凉（练习，非法效）。",
  action: "开始今日小练习",
} as const;

export const WISH_PRACTICE_COPY = {
  heading: "心愿小练习",
  blurb: "把期待轻轻挂上，或推一盏灯（练习，非法效）。",
  detailHeading: "为这个心愿做个小练习",
  detailBlurb: "练习小品，不产生法效。",
  tanzakuAction: "短册系竹 · 系一念",
  yeondeunghoeAction: "燃灯上浮 · 推一盏",
} as const;
