import { rituals, type RitualId } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";

/**
 * Scenes that can come up on 今日's daily set as 祈福 (blessing) practices:
 * quiet listening, an entrance bow, a slow turn, a strike, a pour.
 */
export const BLESSING_SCENE_IDS = [
  "woodfish",
  "furin-wind-chime",
  "shinto-torii",
  "tibetan-wheel",
  "celtic-folk-spring",
  "theravada-water",
] as const;

/** Scenes that can come up on 今日's daily set as 许愿 (wish-making) practices. */
export const WISH_SCENE_IDS = [
  "tanzaku-tanabata",
  "yeondeunghoe",
  "crane",
  "lantern",
  "slavic-wreath",
] as const;

/**
 * Scenes shown on the night stage (a navy sky and a moon) instead of the day
 * stage. The stage element carries it as data-stage, and the scene is told
 * through its context, so its lights match the sky behind it.
 */
export const NIGHT_STAGE_SCENE_IDS = ["lantern", "yeondeunghoe"] as const;

export type BlessingSceneId = (typeof BLESSING_SCENE_IDS)[number];
export type WishSceneId = (typeof WISH_SCENE_IDS)[number];

const wishSet = new Set<string>(WISH_SCENE_IDS);
const nightSet = new Set<string>(NIGHT_STAGE_SCENE_IDS);

export function isWishScene(id: string): boolean {
  return wishSet.has(id);
}

/** The stage a scene is shown on. */
export function sceneStage(id: string): "day" | "night" {
  return nightSet.has(id) ? "night" : "day";
}

export function findSceneEntry(
  entries: CatalogEntry[],
  id: string,
): CatalogEntry | undefined {
  return entries.find((e) => e.id === id);
}

/** Checkpoints a scene reports: woodfish strikes, or the three steps of a procedural scene. */
export const sceneSteps = (entry: CatalogEntry) =>
  entry.engine === "woodfish@1" ? 12 : 3;

/**
 * The 3D scene a core ritual opens. Each ritual (woodfish, crane, lantern)
 * has one, under the ritual's own id.
 */
export function ritualSceneEntry(
  entries: CatalogEntry[],
  ritual: RitualId,
): CatalogEntry | undefined {
  return findSceneEntry(entries, ritual);
}

/** The core ritual a scene is walked as, by their shared id, if any. */
export function sceneRitual(id: string): RitualId | undefined {
  return Object.keys(rituals).includes(id) ? (id as RitualId) : undefined;
}

/** Copy for 今日's daily set. */
export const DAILY_SET_COPY = {
  heading: "今日随机仪式",
  sub: "每天三场 · 完成后收进小天地",
  blessingNote: "祈福 · 完成后收进小天地",
  wishNote: "许愿 · 完成后可拿去许愿",
  collected: "今天已收下",
  /** A scene whose collectible for today already exists, walked again. */
  browse: "浏览全部场景",
} as const;

/** The day's char-sum: one stable number a day, reused across both picks. */
const dayNumber = (day: string) =>
  Array.from(day).reduce((n, c) => n + c.charCodeAt(0), 0);

/**
 * 今日's daily set: two 祈福 scenes and one 许愿 scene, rotated by day, so
 * every day offers a random mix that stays put all day. Only scenes the
 * catalog can open come up; a day always yields the full set while the
 * bundled catalog is in place.
 */
export function dailySceneSet(
  entries: CatalogEntry[],
  day: string,
): CatalogEntry[] {
  const pool = (ids: readonly string[]) =>
    ids
      .map((id) => findSceneEntry(entries, id))
      .filter((e): e is CatalogEntry => !!e);
  const blessings = pool(BLESSING_SCENE_IDS);
  const wishes = pool(WISH_SCENE_IDS);
  if (!blessings.length && !wishes.length) return [];
  const n = dayNumber(day);
  // Rotate each pool by the day, then take the front: a stable, varied mix.
  const rotate = (list: CatalogEntry[]) => [
    ...list.slice(n % list.length),
    ...list.slice(0, n % list.length),
  ];
  return [
    ...rotate(blessings).slice(0, 2),
    ...rotate(wishes).slice(0, 1),
  ];
}