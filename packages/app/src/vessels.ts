import type { Collectible, State } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";

/**
 * A wish-type keepsake (a 许愿小物): collected from 今日's daily set, spent
 * in 心愿 on a wish. A spent one stays in 小天地 for 回看, but is never
 * spent twice: one wish per vessel, a new one each day.
 */
export function usableVessels(
  state: State,
  entries: CatalogEntry[],
): Collectible[] {
  return [...state.collectibles]
    .filter(
      (c) =>
        c.kind === "scene" &&
        !!c.wishScene &&
        !c.spentAt &&
        !!c.sceneId &&
        entries.some((e) => e.id === c.sceneId),
    )
    .reverse();
}

/** 心愿's 许愿小物 shelf: keepsakes gathered from 今日, spent on a wish. */
export const VESSEL_COPY = {
  heading: "许愿小物",
  blurb: "今日仪式里收来的许愿小物，可以拿去许个愿。",
  use: "拿去许愿",
  emptyTitle: "还没有许愿小物",
  emptyBody: "在今日完成一场许愿仪式，就会收进一个小物。",
  emptyAction: "去今日看看",
} as const;

/** The vessel rows on 来还个愿. */
export const FULFILL_VESSEL_COPY = {
  pick: "挑一个许愿小物，替这个心愿还愿：",
  use: "拿它还愿",
  none: "还没有许愿小物。在今日完成一场许愿仪式，就会收进一个。",
  noneAction: "去今日看看",
} as const;