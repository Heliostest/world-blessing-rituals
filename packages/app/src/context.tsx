import { createContext, useContext } from "react";
import type { Action, State, ReturnMethod } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import type { RewardFlight, RewardArrival } from "./reward-flight";
export type FulfillmentDraft = { method: ReturnMethod; text: string };
export type Route = {
  page:
    | "scenes" | "scene" | "cache" | "privacy" | "support"
    | "today"
    | "wishes"
    | "world"
    | "me"
    | "new"
    | "wish"
    | "fulfill"
    | "note"
    | "ritual"
    | "complete"
    | "collection"
    | "history";
  id?: string;
  wishId?: string;
  entry?: CatalogEntry;
  /** A walk of 今日's daily set: the local day, so the keepsake lands once. */
  daily?: string;
  /** A wish-type keepsake being used (许愿 or 还愿): its collectible id. */
  vessel?: string;
};
export type AppContext = {
  state: State;
  go(route: Route): void;
  dispatch(a: Action): boolean;
  back(): void;
  feedback(sound?: AudioBuffer): void;
  /** Haptic tick only; respects the 震动 toggle. */
  haptic(): void;
  /** Whether the host can vibrate at all (not in iOS browsers); else no 震动 toggle. */
  canHaptic: boolean;
  decodeSound(bytes: ArrayBuffer): Promise<AudioBuffer>;
  prepareFeedback(): void;
  active: boolean;
  fulfillmentDrafts: Record<string, FulfillmentDraft>;
  setFulfillmentDraft(id: string, draft?: FulfillmentDraft): void;
  /** Starts one reward's trip home; the next navigation skips page-in. */
  launchReward(flight: RewardFlight): void;
  /** The reward on its way (flying) or just landed (新 mark, tab badge). */
  arrival: RewardArrival | null;
  /** Speaks once through the App's single polite live region. */
  announce(status: string): void;
};
export const Context = createContext<AppContext>(null!);
export const useApp = () => useContext(Context);
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const now = () => new Date().toISOString();
export const formatDate = (at: string) =>
  new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(
    new Date(at),
  );
export const statusText = {
  active: "慢慢发生",
  realized: "已经实现",
  fulfilled: "已还愿",
};
