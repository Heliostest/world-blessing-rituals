import type { CatalogEntry } from "@wbr/content/catalog";
import { recommendScene } from "@wbr/content/catalog";

/**
 * Scenes that belong on 今日 as daily homage / quiet practices (not wish flow):
 * listening, an entrance bow, a clockwise turn.
 */
export const TODAY_SCENE_IDS = [
  "furin-wind-chime",
  "shinto-torii",
  "tibetan-wheel",
] as const;

/** Scenes that belong on 心愿 as wish practices (each can carry a written wish). */
export const WISH_SCENE_IDS = [
  "tanzaku-tanabata",
  "yeondeunghoe",
  "crane",
  "lantern",
  "slavic-wreath",
] as const;

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

/** Today's featured practice card: one of the 今日 scenes, rotated by day. */
export function featuredTodayPractice(
  entries: CatalogEntry[],
  day: string,
): CatalogEntry | undefined {
  return recommendScene(todaySceneEntries(entries), day);
}

export const TODAY_PRACTICE_COPY = {
  tag: "今日小练习",
  action: "开始今日小练习",
  scenes: {
    "furin-wind-chime": {
      blurb: "轻拂听一声清凉（练习，非法效）。",
      glyph: "🎐",
    },
    "shinto-torii": {
      blurb: "在鸟居前停步，轻轻一礼（致敬练习，不替代真实参拜）。",
      glyph: "⛩️",
    },
    "tibetan-wheel": {
      blurb: "顺时针轻推转筒，静看它慢下来（练习，非法效）。",
      glyph: "↻",
    },
  } satisfies Record<TodaySceneId, { blurb: string; glyph: string }>,
} as const;

export function todayPracticeCopy(id: string) {
  return isTodayScene(id)
    ? TODAY_PRACTICE_COPY.scenes[id as TodaySceneId]
    : undefined;
}

export const WISH_PRACTICE_COPY = {
  heading: "心愿小练习",
  blurb: "把期待挂上竹枝、折进纸鹤、点进灯里，或随花环漂远（练习，非法效）。",
  detailHeading: "为这个心愿做个小练习",
  detailBlurb: "练习小品，不产生法效。",
  actions: {
    "tanzaku-tanabata": "短册系竹 · 系一念",
    yeondeunghoe: "燃灯上浮 · 推一盏",
    crane: "折一只纸鹤 · 折一念",
    lantern: "点一盏心愿灯 · 点一盏",
    "slavic-wreath": "火边花环 · 放一环",
  } satisfies Record<WishSceneId, string>,
} as const;

/** Button label for a wish practice; falls back to the catalog title. */
export function wishPracticeAction(entry: CatalogEntry): string {
  return isWishScene(entry.id)
    ? WISH_PRACTICE_COPY.actions[entry.id as WishSceneId]
    : entry.title;
}
