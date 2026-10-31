// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dailyCollectibleId, type Collectible, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { WishRitualPicker } from "./wish-ritual-picker";

const AT = "2026-10-07T08:00:00.000Z";
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => mounted.splice(0).forEach(ui => ui.unmount()));

function keepsake(sceneId: string, options: { spent?: boolean; wishScene?: boolean } = {}): Collectible {
  return {
    id: dailyCollectibleId("2026-10-06", sceneId), kind: "scene", sceneId,
    title: builtInScenes.find(entry => entry.id === sceneId)!.title, at: AT,
    wishScene: options.wishScene ?? true,
    ...(options.spent ? { spentAt: AT } : {}),
  };
}
function open(state: State = createState()) {
  const go = vi.fn(), dispatch = vi.fn((_action: unknown) => true);
  const ui = renderUI(createElement(Context.Provider,
    { value: { state, go, dispatch } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider,
      { value: { entries: builtInScenes } as never }, createElement(WishRitualPicker))));
  mounted.push(ui);
  const direct = (id: string) => ui.host.querySelector<HTMLButtonElement>(`.wish-scene-choice[data-scene="${id}"]`)!;
  return { ...ui, go, dispatch, direct };
}

describe("collected scenes unlock the new-wish ritual picker", () => {
  it("keeps uncollected scenes visible and disabled, with a heading and collection explanation", () => {
    const ui = open(), cards = [...ui.host.querySelectorAll<HTMLButtonElement>(".wish-scene-choice")];
    expect(cards).toHaveLength(18);
    const section = cards[0]!.closest("section")!;
    const heading = section.querySelector("h2");
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe("在今日收下对应小物后解锁");
    expect(section.textContent).toContain("今日");
    expect(section.textContent).toContain("解锁");
    for (const card of cards) {
      expect(card.querySelector("strong")?.textContent).toBeTruthy();
      expect(card.disabled, card.dataset.scene).toBe(true);
      clickOn(card);
    }
    expect(ui.go).not.toHaveBeenCalled();
    expect(ui.dispatch).not.toHaveBeenCalled();
  });

  it("unlocks only the matching collected scene, even when its legacy wish flag is false", () => {
    const state = createState();
    state.collectibles.push(keepsake("tanzaku-tanabata", { wishScene: false }));
    const before = JSON.stringify(state), ui = open(state);
    expect(ui.direct("tanzaku-tanabata").disabled).toBe(false);
    expect(ui.direct("crane").disabled).toBe(true);
    clickOn(ui.direct("crane"));
    expect(ui.go).not.toHaveBeenCalled();
    clickOn(ui.direct("tanzaku-tanabata"));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: "tanzaku-tanabata", vessel: undefined }));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("does not unlock a scene from a badge with the same scene id", () => {
    const state = createState();
    state.collectibles.push({ id: "badge", kind: "badge", title: "如愿", sceneId: "tanzaku-tanabata", at: AT });
    const ui = open(state);
    expect(ui.direct("tanzaku-tanabata").disabled).toBe(true);
    clickOn(ui.direct("tanzaku-tanabata"));
    expect(ui.go).not.toHaveBeenCalled();
  });

  it("does not treat a completed or favorited scene record as a collected object", () => {
    const state = createState(), entry = builtInScenes.find(entry => entry.id === "tanzaku-tanabata")!;
    state.sceneRecords.push({ id: entry.id, title: entry.title, engine: entry.engine,
      revision: entry.revision, manifestUrl: entry.manifestUrl, progress: 3, favorite: true, lastOpened: AT });
    const before = JSON.stringify(state), ui = open(state);
    expect(ui.direct(entry.id).disabled).toBe(true);
    clickOn(ui.direct(entry.id));
    expect(ui.go).not.toHaveBeenCalled();
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps a spent scene unlocked for a direct visit without spending the keepsake again", () => {
    const state = createState(), owned = keepsake("tanzaku-tanabata", { spent: true });
    state.collectibles.push(owned);
    const before = JSON.stringify(state), ui = open(state);
    expect(ui.host.querySelector(`.vessel-card[data-scene="${owned.sceneId}"]`)).toBeNull();
    expect(ui.direct(owned.sceneId!).disabled).toBe(false);
    clickOn(ui.direct(owned.sceneId!));
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: owned.sceneId, vessel: undefined }));
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("retains the exact unspent vessel route instead of duplicating it as a direct scene", () => {
    const state = createState(), owned = keepsake("tanzaku-tanabata");
    state.collectibles.push(owned);
    const before = JSON.stringify(state), ui = open(state);
    const card = ui.host.querySelector<HTMLButtonElement>('.vessel-card[data-scene="tanzaku-tanabata"]')!;
    expect(card.disabled).toBe(false);
    expect(ui.direct("tanzaku-tanabata")).toBeNull();
    clickOn(card);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: "tanzaku-tanabata", vessel: owned.id }));
    expect(ui.dispatch.mock.calls.some(([action]) => ["collectible.spend", "wish.create"].includes((action as { type: string }).type))).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("retains a spent legacy vessel's pending choice even when its category is no longer offered", () => {
    const state = createState(), owned = keepsake("furin-wind-chime", { spent: true });
    state.collectibles.push(owned);
    state.vesselDrafts = { [owned.id]: { line: "愿家人平安", at: AT } };
    const before = JSON.stringify(state), ui = open(state);
    const card = ui.host.querySelector<HTMLButtonElement>('.vessel-card[data-scene="furin-wind-chime"]')!;
    expect(card.disabled).toBe(false);
    clickOn(card);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", vessel: owned.id }));
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
});
