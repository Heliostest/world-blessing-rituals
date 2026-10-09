import { describe, expect, it } from "vitest";
import {
  createState,
  reduce,
  restore,
  dailyRitual,
  hasReturnRitual,
} from "./index";

const at = "2026-09-20T08:00:00.000Z";
const add = {
  type: "wish.create",
  id: "w1",
  title: "完成自己的小作品",
  intention: "每天留一点时间",
  at,
} as const;

describe("personal ritual loop", () => {
  it("accepts a burst of strikes atomically, caps progress and settles once", () => {
    let s = createState();
    for (let i = 0; i < 40; i++) {
      s = reduce(s, {
        type: "ritual.strike",
        id: `tap-${i}`,
        ritual: "woodfish",
        at,
      });
    }
    expect(s.activeSession).toMatchObject({ id: "tap-0", progress: 12 });
    expect(reduce(s, { type: "ritual.step" })).toBe(s);
    const ready = restore(JSON.stringify(s));
    const done = { type: "ritual.finish", id: "tap-0", at } as const;
    const complete = reduce(ready, done);
    expect(reduce(complete, done)).toBe(complete);
    expect(complete.ledger).toHaveLength(1);
    expect(complete.ledger[0].amount).toBe(10);
    expect(complete.collectibles).toHaveLength(1);
  });
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
  it("keeps the scene a wish was written in through a save, beside wishes made without one", () => {
    const first = reduce(createState(), add);
    const s = reduce(first, {
      ...add,
      id: "w2",
      title: "希望家人平安",
      intention: "",
      sourceSceneId: "crane",
    });
    // A new wish, beside the first one, which stays as it was.
    expect(s.wishes).toHaveLength(2);
    expect(s.wishes[1]).toEqual(first.wishes[0]);
    const restored = restore(JSON.stringify(s));
    expect(restored.wishes[0]).toMatchObject({
      id: "w2",
      sourceSceneId: "crane",
      category: "life",
    });
    expect("sourceSceneId" in restored.wishes[1]).toBe(false);
    expect(() =>
      reduce(s, { ...add, id: "w3", sourceSceneId: "" }),
    ).toThrow();
    const bad = JSON.parse(JSON.stringify(s));
    bad.wishes[0].sourceSceneId = 7;
    expect(() => restore(JSON.stringify(bad))).toThrow();
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
  it("starts a fresh save with the given settings, but keeps a saved choice", () => {
    expect(createState({ reducedMotion: true }).settings).toEqual({
      sound: true,
      haptics: true,
      reducedMotion: true,
    });
    expect(restore(null, { reducedMotion: true }).settings.reducedMotion).toBe(
      true,
    );
    const saved = JSON.stringify(createState());
    expect(restore(saved, { reducedMotion: true }).settings.reducedMotion).toBe(
      false,
    );
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

describe("a ritual walked as its scene (ritual.scene)", () => {
  const later = "2026-09-21T08:00:00.000Z";
  const realized = () =>
    reduce(reduce(createState(), add), { type: "wish.realize", id: "w1", at });
  const walked = {
    type: "ritual.scene",
    id: "scene-visit",
    ritual: "crane",
    wishId: "w1",
    startedAt: at,
    at: later,
  } as const;

  it("records one completed session and a wish note, never merit or a collectible", () => {
    const s = reduce(realized(), walked);
    expect(s.sessions).toEqual([
      {
        id: "scene-visit",
        ritual: "crane",
        progress: 4,
        startedAt: at,
        wishId: "w1",
        completedAt: later,
      },
    ]);
    expect(s.wishes[0].notes).toEqual([
      { id: "ritual:scene-visit", text: "为这个心愿，折一只纸鹤", at: later },
    ]);
    expect(s.ledger).toEqual([]);
    expect(s.collectibles).toEqual([]);
    // Once per visit, and the save it makes restores.
    expect(reduce(s, walked)).toBe(s);
    expect(restore(JSON.stringify(s))).toEqual(s);
  });

  it("counts as the return ritual, so the wish can be fulfilled by ritual", () => {
    let s = reduce(realized(), walked);
    expect(hasReturnRitual(s, s.wishes[0])).toBe(true);
    s = reduce(s, {
      type: "wish.fulfill",
      id: "w1",
      noteId: "thanks",
      text: "谢谢自己",
      method: "ritual",
      at: later,
    });
    expect(s.wishes[0]).toMatchObject({ status: "fulfilled", returnMethod: "ritual" });
    // The 如愿 badge is the only keepsake.
    expect(s.collectibles.map((c) => c.kind)).toEqual(["badge"]);
    expect(s.ledger).toEqual([]);
  });

  it("leaves a 2D session in progress alone, which still settles later", () => {
    let s = reduce(realized(), {
      type: "ritual.start",
      id: "r2d",
      ritual: "woodfish",
      at,
    });
    s = reduce(s, walked);
    expect(s.activeSession).toMatchObject({ id: "r2d", ritual: "woodfish" });
    for (let i = 0; i < 12; i++) s = reduce(s, { type: "ritual.step" });
    s = reduce(s, { type: "ritual.finish", id: "r2d", at: later });
    expect(s.sessions.map((r) => r.id)).toEqual(["scene-visit", "r2d"]);
    expect(s.ledger.map((l) => l.id)).toEqual(["r2d"]);
  });

  it("does not count a scene walked before the wish came true", () => {
    // Linked to the wish while it was still active: a note, but no 还愿.
    let s = reduce(reduce(createState(), add), {
      ...walked,
      startedAt: "2026-09-19T08:00:00.000Z",
    });
    s = reduce(s, { type: "wish.realize", id: "w1", at });
    expect(hasReturnRitual(s, s.wishes[0])).toBe(false);
  });

  it("rejects a record for an archived, fulfilled or missing wish, or an unknown ritual", () => {
    const archived = reduce(realized(), {
      type: "wish.archive",
      id: "w1",
      archived: true,
    });
    expect(() => reduce(archived, walked)).toThrow();
    const fulfilled = reduce(realized(), {
      type: "wish.fulfill",
      id: "w1",
      noteId: "n",
      text: "谢谢",
      at,
    });
    expect(() => reduce(fulfilled, walked)).toThrow();
    expect(() => reduce(realized(), { ...walked, wishId: "nope" })).toThrow();
    expect(() =>
      reduce(realized(), { ...walked, ritual: "torii" as never }),
    ).toThrow();
    expect(() => reduce(realized(), { ...walked, at: "soon" })).toThrow();
    expect(() => reduce(realized(), { ...walked, id: "" })).toThrow();
    // Nor the id of the 2D session in progress, whose finish it would block.
    const open = reduce(realized(), {
      type: "ritual.start",
      id: "scene-visit",
      ritual: "woodfish",
      at,
    });
    expect(() => reduce(open, walked)).toThrow();
  });
});
