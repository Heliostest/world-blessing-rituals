import { createContext, useContext } from "react";
import type { Action, State, ReturnMethod } from "@wbr/core";
export type FulfillmentDraft = { method: ReturnMethod; text: string };
export type Route = {
  page:
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
};
export type AppContext = {
  state: State;
  go(route: Route): void;
  dispatch(a: Action): boolean;
  back(): void;
  feedback(): void;
  active: boolean;
  fulfillmentDrafts: Record<string, FulfillmentDraft>;
  setFulfillmentDraft(id: string, draft?: FulfillmentDraft): void;
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
