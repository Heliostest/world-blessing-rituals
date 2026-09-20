import { describe, expect, it } from "vitest";
import { createState, reduce, restore, dailyRitual } from "./index";

const at = "2026-09-20T08:00:00.000Z";
const add = {
  type: "wish.create",
  id: "w1",
  title: "完成自己的小作品",
  intention: "每天留一点时间",
  at,
} as const;

describe("personal ritual loop", () => {
  it("persists wish category and planned return method, while accepting older saves", () => {
    const s = reduce(createState(), {
      ...add,
      category: "work",
      returnMethod: "ritual",
    });
    expect(restore(JSON.stringify(s)).wishes[0]).toMatchObject({
      category: "work",
      returnMethod: "ritual",
    });
    expect(
      restore(JSON.stringify(reduce(createState(), add))).wishes,
    ).toHaveLength(1);
  });
  it("requires a completed linked ritual after realization for ritual-based fulfillment", () => {
    let s = reduce(reduce(createState(), add), {
      type: "wish.realize",
      id: "w1",
      at,
    });
    const done = {
      type: "wish.fulfill",
      id: "w1",
      noteId: "thanks",
      text: "折好纸鹤，谢谢自己",
      method: "ritual",
      at,
    } as const;
    expect(() => reduce(s, done)).toThrow();
    s = reduce(s, {
      type: "ritual.start",
      id: "r-return",
      ritual: "crane",
      wishId: "w1",
      at,
    });
    for (let i = 0; i < 4; i++) s = reduce(s, { type: "ritual.step" });
    s = reduce(s, { type: "ritual.finish", id: "r-return", at });
    s = reduce(s, done);
    expect(s.wishes[0].returnMethod).toBe("ritual");
    expect(s.collectibles.filter((c) => c.kind === "badge")).toHaveLength(1);
    expect(reduce(s, done)).toBe(s);
  });
  it("creates a private wish, records progress and fulfills it exactly once", () => {
    let s = reduce(createState(), add);
    s = reduce(s, {
      type: "wish.note",
      id: "w1",
      noteId: "n1",
      text: "今天完成了一页",
      at,
    });
    expect(s.wishes[0].notes).toHaveLength(1);
    s = reduce(s, { type: "wish.realize", id: "w1", at });
    const done = {
      type: "wish.fulfill",
      id: "w1",
      noteId: "n2",
      text: "谢谢一直努力的自己",
      at,
    } as const;
    s = reduce(s, done);
    expect(s.wishes[0].status).toBe("fulfilled");
    expect(s.collectibles).toHaveLength(1);
    expect(reduce(s, done)).toBe(s);
    expect(s.ledger).toHaveLength(0);
  });
  it("rejects invalid transitions and blank wishes", () => {
    expect(() => reduce(createState(), { ...add, title: " " })).toThrow();
    expect(() =>
      reduce(reduce(createState(), add), {
        type: "wish.fulfill",
        id: "w1",
        noteId: "n",
        text: "谢谢",
        at,
      }),
    ).toThrow();
  });
  it("archives without losing realized status", () => {
    let s = reduce(reduce(createState(), add), {
      type: "wish.realize",
      id: "w1",
      at,
    });
    s = reduce(s, { type: "wish.archive", id: "w1", archived: true });
    expect(s.wishes[0].archived).toBe(true);
    s = reduce(s, { type: "wish.archive", id: "w1", archived: false });
    expect(s.wishes[0].status).toBe("realized");
  });
  it("resumes a session and settles only a completed session once", () => {
    let s = reduce(createState(), {
      type: "ritual.start",
      id: "r1",
      ritual: "lantern",
      at,
    });
    expect(() => reduce(s, { type: "ritual.finish", id: "r1", at })).toThrow();
    s = reduce(s, { type: "ritual.step" });
    s = restore(JSON.stringify(s));
    s = reduce(s, { type: "ritual.step" });
    s = reduce(s, { type: "ritual.step" });
    const finish = { type: "ritual.finish", id: "r1", at } as const;
    s = reduce(s, finish);
    expect(s.sessions).toHaveLength(1);
    expect(s.collectibles).toHaveLength(1);
    expect(s.ledger[0].amount).toBe(10);
    expect(reduce(s, finish)).toBe(s);
  });
  it("does not silently replace an unfinished session", () => {
    const s = reduce(createState(), {
      type: "ritual.start",
      id: "r1",
      ritual: "crane",
      at,
    });
    expect(() =>
      reduce(s, { type: "ritual.start", id: "r2", ritual: "woodfish", at }),
    ).toThrow();
  });
  it("rejects corrupt or newer saves while empty storage gets a fresh state", () => {
    expect(restore(null)).toEqual(createState());
    expect(() => restore("{bad")).toThrow();
    expect(() =>
      restore(JSON.stringify({ ...createState(), version: 20 })),
    ).toThrow();
    expect(() =>
      restore(JSON.stringify({ ...createState(), wishes: [{ id: "bad" }] })),
    ).toThrow();
  });
  it("uses a stable daily recommendation", () => {
    expect(dailyRitual("2026-09-20")).toBe(dailyRitual("2026-09-20"));
  });
});
