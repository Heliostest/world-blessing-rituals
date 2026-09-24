import { describe, expect, it } from "vitest";
import { createState, reduce, restore } from "./index";

const entry = {
  id: "spring",
  title: "Spring",
  engine: "spring@1",
  revision: "v1",
  manifestUrl: "https://cdn.test/spring-v1.json",
};
describe("durable scene records", () => {
  it("preserves progress and favorites across repeat opens and a save restore", () => {
    let state = reduce(createState(), {
      type: "scene.visit",
      entry,
      at: "2026-09-24T00:00:00Z",
    });
    state = reduce(state, {
      type: "scene.progress",
      id: entry.id,
      progress: 2,
    });
    state = reduce(state, {
      type: "scene.favorite",
      id: entry.id,
      favorite: true,
    });
    state = restore(JSON.stringify(state));
    state = reduce(state, {
      type: "scene.visit",
      entry,
      at: "2026-09-25T00:00:00Z",
    });
    expect(state.sceneRecords).toHaveLength(1);
    expect(state.sceneRecords[0]).toMatchObject({
      progress: 2,
      favorite: true,
      revision: "v1",
    });
    expect(state.ledger).toEqual([]);
  });
  it("migrates previous saves without scene records and rejects corrupt progress", () => {
    const old = createState();
    delete (old as any).sceneRecords;
    expect(restore(JSON.stringify(old)).sceneRecords).toEqual([]);
    const state = reduce(createState(), {
      type: "scene.visit",
      entry,
      at: "2026-09-24T00:00:00Z",
    });
    expect(() =>
      reduce(state, { type: "scene.progress", id: entry.id, progress: -1 }),
    ).toThrow();
    state.sceneRecords[0].progress = NaN;
    expect(() => restore(JSON.stringify(state))).toThrow();
  });
});
