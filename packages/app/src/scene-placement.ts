import {
  dailyCollectibleId,
  rituals,
  type Collectible,
  type RitualId,
} from "@wbr/core";
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

/** Copy for 今日's daily set: the day's one main walk. */
export const DAILY_SET_COPY = {
  heading: "今日随机仪式",
  sub: "每天一场 · 完成后收进小天地",
  blessingNote: "祈福 · 完成后收进小天地",
  wishNote: "许愿 · 完成后可拿去许愿",
  collected: "今天已收下",
} as const;

/**
 * Copy for 今日's picks from 小天地: scenes already collected, walked again as
 * a 回看. `sub` heads the full mix (three, one of them 许愿); `partial` any
 * other row (fewer kinds kept, or no 许愿 yet); `emptyTitle` / `emptyBody`
 * stand in for the row while there is none.
 */
export const DAILY_COLLECTED_COPY = {
  heading: "小天地里再走走",
  sub: "从收过的小物里挑了三场，其中一场许愿。再走一遍，不会重复收下。",
  partial: "小天地里的小物还不齐，先挑这几场。再走一遍，不会重复收下。",
  blessingNote: "祈福 · 回看",
  wishNote: "许愿 · 回看",
  emptyTitle: "这里还空着",
  emptyBody: "每天收下的小物，第二天起会来这里，陪你再走一遍。",
} as const;

/** The day's char-sum: one stable number a day, reused across every pick. */
const dayNumber = (day: string) =>
  Array.from(day).reduce((n, c) => n + c.charCodeAt(0), 0);

/** `list` rotated by the day: a varied order that stays put all day. */
const rotate = <T>(list: readonly T[], day: string) => {
  const n = dayNumber(day) % Math.max(list.length, 1);
  return [...list.slice(n), ...list.slice(0, n)];
};

/** Both pools, taking turns (祈福, 许愿, 祈福…) down the day's rotation. */
const PRIMARY_ORDER = BLESSING_SCENE_IDS.flatMap((id, i) =>
  i < WISH_SCENE_IDS.length ? [id, WISH_SCENE_IDS[i]] : [id],
);

/**
 * 今日's main walk: one placed scene a day, rotated by the day, so it stays
 * put all day and the next day mostly brings the other type. Only scenes the
 * catalog can open come up.
 */
export function dailyPrimaryScene(
  entries: CatalogEntry[],
  day: string,
): CatalogEntry | undefined {
  const pool = PRIMARY_ORDER.map((id) => findSceneEntry(entries, id)).filter(
    (e): e is CatalogEntry => !!e,
  );
  return rotate(pool, day)[0];
}

/**
 * 今日's picks from 小天地: up to three scenes the user already keeps (scene
 * keepsakes the catalog can open), one card per scene, rotated by the day:
 * exactly one 许愿 whenever 小天地 holds one, 祈福 for the rest. Short pools
 * show fewer cards, never a made-up one: no 许愿 kept, up to three 祈福; too
 * few 祈福, fewer cards (a second 许愿 never fills in); nothing kept, none.
 * Keepsakes collected today join tomorrow, so the picks stay put all day.
 */
export function dailyCollectedPicks(
  entries: CatalogEntry[],
  collectibles: Collectible[],
  day: string,
): CatalogEntry[] {
  const ids = new Set<string>();
  for (const c of collectibles)
    if (c.kind === "scene" && c.sceneId && c.id !== dailyCollectibleId(day, c.sceneId))
      ids.add(c.sceneId);
  // Sorted by id, so neither save nor catalog order moves the day's picks.
  const kept = [...ids]
    .sort()
    .map((id) => findSceneEntry(entries, id))
    .filter((e): e is CatalogEntry => !!e);
  const wish = rotate(kept.filter((e) => isWishScene(e.id)), day).slice(0, 1);
  const blessings = rotate(
    kept.filter((e) => !isWishScene(e.id)),
    day,
  ).slice(0, 3 - wish.length);
  return [...blessings, ...wish];
}
