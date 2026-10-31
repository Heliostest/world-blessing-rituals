import type { Collectible, State } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { isWishScene } from "./scene-placement";

/** The same two-category grouping used by Today's scene catalog. */
export function isWishCollectionScene(sceneId: string): boolean {
  return isWishScene(sceneId);
}

/** Collection unlocks the matching picker ritual; spending a copy keeps it unlocked. */
export function isWishSceneUnlocked(state: Pick<State, 'collectibles'>, sceneId: string): boolean {
  return isWishCollectionScene(sceneId) && state.collectibles.some(
    item => item.kind === 'scene' && item.sceneId === sceneId,
  );
}

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
        isWishCollectionScene(c.sceneId) &&
        entries.some((e) => e.id === c.sceneId),
    )
    .reverse();
}

/**
 * A 许愿 walk interrupted after its keepsake was spent: the line it held (or
 * the empty choice) still waits in `vesselDrafts`. These stay in the 祈愿
 * picker until the keep-or-discard choice is made, so the spent keepsake
 * never takes the phrase with it. 还愿 asks for unspent keepsakes only.
 */
export function pendingVessels(
  state: State,
  entries: CatalogEntry[],
): Collectible[] {
  return state.collectibles.filter(
    (c) =>
      c.kind === "scene" &&
      !!c.wishScene &&
      !!c.spentAt &&
      !!c.sceneId &&
      !!state.vesselDrafts?.[c.id] &&
      entries.some((e) => e.id === c.sceneId),
  );
}

/**
 * 心愿's 祈愿: the button at the page's foot opens a picker of the 许愿小物
 * gathered from 今日, each spent on a new wish.
 */
export const VESSEL_COPY = {
  pray: "祈愿",
  heading: "许愿小物",
  blurb: "今日仪式里收来的许愿小物，可以拿去许个愿。",
  use: "拿去许愿",
  pending: "回到刚才的选择",
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
