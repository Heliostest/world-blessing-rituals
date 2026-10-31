// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dailyCollectibleId, type State } from "@wbr/core";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { NewWish } from "./wishes";
import { usableVessels } from "./vessels";

const AT = "2026-10-07T08:00:00.000Z";
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => mounted.splice(0).forEach(ui => ui.unmount()));
function open(state: State = createState()) {
  const go = vi.fn(), dispatch = vi.fn((_action: unknown) => true);
  const ui = renderUI(createElement(Context.Provider,
    { value: { state, go, dispatch } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider,
      { value: { entries: builtInScenes } as never }, createElement(NewWish))));
  mounted.push(ui);
  return { ...ui, go, dispatch };
}
function vessel(state: State, sceneId: string, spent = false) {
  const id = dailyCollectibleId("2026-10-06", sceneId);
  state.collectibles.push({ id, kind: "scene", sceneId, title: sceneId,
    wishScene: true, at: AT, ...(spent ? { spentAt: AT } : {}) });
  return id;
}
describe("start a wish through a real ritual", () => {
  it("shows eligible scenes to a first-time visitor but requires a collected object before starting", () => {
    const ui = open();
    expect(ui.host.querySelector("form, textarea, input")).toBeNull();
    expect(ui.host.querySelectorAll(".wish-scene-choice")).toHaveLength(18);
    const card = ui.host.querySelector<HTMLButtonElement>('.wish-practice-card[data-scene="tanzaku-tanabata"]');
    expect(card).not.toBeNull();
    expect(card!.disabled).toBe(true);
    clickOn(card!);
    expect(ui.go).not.toHaveBeenCalled();
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(ui.host.querySelector("form, textarea, input")).toBeNull();
  });
  it("does not offer hidden scenes, non-writing wishes or gratitude as new wishes", () => {
    const ui = open();
    for (const id of ["lantern", "alasita-miniature-house", "lam-tsuen-wishing-tree", "phuang-malai", "omikuji", "shinto-torii", "bonfim-ribbon"])
      expect(ui.host.querySelector(`[data-scene="${id}"]`), id).toBeNull();
  });
  it("uses the same primary category for held new-wish and return-wish choices", () => {
    const state = createState();
    for (const id of ["furin-wind-chime", "pucara-rooftop-bulls", "japanese-kadomatsu", "shichigosan-chitose-ame", "phuang-malai"])
      vessel(state, id);
    const prayer = vessel(state, "crane");
    const before = JSON.stringify(state);
    const ui = open(state);
    expect([...ui.host.querySelectorAll(".vessel-card")].map(card => card.getAttribute("data-scene"))).toEqual(["crane"]);
    expect(usableVessels(state, builtInScenes).map(item => item.id)).toEqual([prayer]);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("prefers an existing keepsake without duplicating its scene as a free start", () => {
    const state = createState(), id = vessel(state, "tanzaku-tanabata");
    const ui = open(state);
    const cards = ui.host.querySelectorAll('.wish-practice-card[data-scene="tanzaku-tanabata"]');
    expect(cards).toHaveLength(1);
    clickOn(cards[0]);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", id: "tanzaku-tanabata", vessel: id }));
  });
  it("keeps a spent legacy vessel's pending choice accessible even after its category is filtered", () => {
    const state = createState(), id = vessel(state, "furin-wind-chime", true);
    state.vesselDrafts = { [id]: { line: "愿家人平安", at: AT } };
    const ui = open(state);
    const card = ui.host.querySelector('.vessel-card[data-scene="furin-wind-chime"]');
    expect(card).not.toBeNull();
    clickOn(card!);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: "scene", vessel: id }));
    expect(ui.dispatch).not.toHaveBeenCalled();
    expect(state.vesselDrafts[id].line).toBe("愿家人平安");
  });
});
