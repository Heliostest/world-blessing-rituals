export const rituals = {
  woodfish: {
    name: "敲一敲木鱼",
    short: "木鱼",
    object: "小木鱼",
    subtitle: "把纷纷扰扰，轻轻放下",
    steps: 12,
    prompts: ["轻敲木鱼，让心慢下来"],
  },
  crane: {
    name: "折一只纸鹤",
    short: "纸鹤",
    object: "千纸鹤",
    subtitle: "把小小的期待，折进翅膀里",
    steps: 4,
    prompts: [
      "摊开一张纸，留一点期待",
      "对折，把心事轻轻收好",
      "折出翅膀，让愿望有方向",
      "展开纸鹤，把祝福留给自己",
    ],
  },
  lantern: {
    name: "点一盏心愿灯",
    short: "心愿灯",
    object: "暖心灯",
    subtitle: "愿你的每一份期待，都有微光",
    steps: 3,
    prompts: ["安放一盏灯", "为心里的愿望点一束光", "让这份温暖，陪你慢慢向前"],
  },
} as const;
export type RitualId = keyof typeof rituals;
export type WishStatus = "active" | "realized" | "fulfilled";
export type WishCategory = "study" | "work" | "life";
export type ReturnMethod = "kindness" | "ritual";
export type Note = { id: string; text: string; at: string };
export type Wish = {
  id: string;
  title: string;
  intention: string;
  category?: WishCategory;
  returnMethod?: ReturnMethod;
  status: WishStatus;
  archived: boolean;
  createdAt: string;
  realizedAt?: string;
  fulfilledAt?: string;
  notes: Note[];
};
export type Session = {
  id: string;
  ritual: RitualId;
  progress: number;
  startedAt: string;
  wishId?: string;
  completedAt?: string;
};
export type Collectible = {
  id: string;
  kind: RitualId | "badge";
  title: string;
  at: string;
  wishId?: string;
};
export type State = {
  version: 1;
  wishes: Wish[];
  activeSession: Session | null;
  sessions: Session[];
  collectibles: Collectible[];
  ledger: { id: string; amount: number; at: string }[];
  settings: { sound: boolean; haptics: boolean; reducedMotion: boolean };
};
export type Action =
  | {
      type: "wish.create";
      id: string;
      title: string;
      intention: string;
      category?: WishCategory;
      returnMethod?: ReturnMethod;
      at: string;
    }
  | { type: "wish.note"; id: string; noteId: string; text: string; at: string }
  | { type: "wish.realize"; id: string; at: string }
  | {
      type: "wish.fulfill";
      method?: ReturnMethod;
      id: string;
      noteId: string;
      text: string;
      at: string;
    }
  | { type: "wish.archive"; id: string; archived: boolean }
  | {
      type: "ritual.start";
      id: string;
      ritual: RitualId;
      wishId?: string;
      at: string;
    }
  | { type: "ritual.step" }
  | { type: "ritual.finish"; id: string; at: string }
  | { type: "settings"; key: keyof State["settings"]; value: boolean };

export function createState(): State {
  return {
    version: 1,
    wishes: [],
    activeSession: null,
    sessions: [],
    collectibles: [],
    ledger: [],
    settings: { sound: true, haptics: true, reducedMotion: false },
  };
}
function text(value: string, max: number) {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`请填写 1–${max} 个字`);
  return clean;
}
function wishOf(s: State, id: string) {
  const w = s.wishes.find((w) => w.id === id);
  if (!w) throw new Error("没有找到这个心愿");
  return w;
}
function updateWish(s: State, w: Wish): State {
  return { ...s, wishes: s.wishes.map((old) => (old.id === w.id ? w : old)) };
}
export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "wish.create":
      if (s.wishes.some((w) => w.id === a.id)) return s;
      if (a.intention.length > 160)
        throw new Error("小约定请控制在 160 字以内");
      return {
        ...s,
        wishes: [
          {
            id: a.id,
            title: text(a.title, 60),
            intention: a.intention.trim(),
            category: a.category ?? "life",
            returnMethod: a.returnMethod ?? "kindness",
            createdAt: a.at,
            status: "active",
            archived: false,
            notes: [],
          },
          ...s.wishes,
        ],
      };
    case "wish.note": {
      const w = wishOf(s, a.id);
      if (w.archived) throw new Error("先把心愿重新拾起，再记一笔吧");
      if (w.notes.some((n) => n.id === a.noteId)) return s;
      return updateWish(s, {
        ...w,
        notes: [
          ...w.notes,
          { id: a.noteId, text: text(a.text, 500), at: a.at },
        ],
      });
    }
    case "wish.realize": {
      const w = wishOf(s, a.id);
      if (w.status !== "active" || w.archived)
        throw new Error("这个心愿目前不能标记实现");
      return updateWish(s, { ...w, status: "realized", realizedAt: a.at });
    }
    case "wish.fulfill": {
      const w = wishOf(s, a.id);
      if (w.status === "fulfilled") return s;
      if (w.status !== "realized" || w.archived)
        throw new Error("先确认心愿实现，再来还愿吧");
      const method = a.method ?? "kindness";
      if (method === "ritual" && !hasReturnRitual(s, w))
        throw new Error("先为这个已实现的心愿完成一个小仪式吧");
      const next = updateWish(s, {
        ...w,
        status: "fulfilled",
        fulfilledAt: a.at,
        returnMethod: method,
        notes: [
          ...w.notes,
          { id: a.noteId, text: text(a.text, 500), at: a.at },
        ],
      });
      return {
        ...next,
        collectibles: [
          ...s.collectibles,
          {
            id: `wish:${w.id}`,
            kind: "badge",
            title: "如愿纪念章",
            at: a.at,
            wishId: w.id,
          },
        ],
      };
    }
    case "wish.archive":
      return updateWish(s, { ...wishOf(s, a.id), archived: a.archived });
    case "ritual.start": {
      if (s.activeSession) throw new Error("还有一个小仪式等你继续");
      if (s.sessions.some((r) => r.id === a.id)) return s;
      if (a.wishId) {
        const w = wishOf(s, a.wishId);
        if (w.archived || w.status === "fulfilled")
          throw new Error("请选择进行中的心愿");
      }
      return {
        ...s,
        activeSession: {
          id: a.id,
          ritual: a.ritual,
          wishId: a.wishId,
          progress: 0,
          startedAt: a.at,
        },
      };
    }
    case "ritual.step": {
      if (!s.activeSession) return s;
      const r = s.activeSession;
      return {
        ...s,
        activeSession: {
          ...r,
          progress: Math.min(rituals[r.ritual].steps, r.progress + 1),
        },
      };
    }
    case "ritual.finish": {
      if (s.sessions.some((r) => r.id === a.id)) return s;
      const r = s.activeSession;
      if (!r || r.id !== a.id || r.progress < rituals[r.ritual].steps)
        throw new Error("先完成这个小仪式吧");
      let next = s;
      if (r.wishId) {
        const w = wishOf(s, r.wishId);
        next = updateWish(s, {
          ...w,
          notes: [
            ...w.notes,
            {
              id: `ritual:${r.id}`,
              text: `为这个心愿，${rituals[r.ritual].name}`,
              at: a.at,
            },
          ],
        });
      }
      return {
        ...next,
        activeSession: null,
        sessions: [...s.sessions, { ...r, completedAt: a.at }],
        ledger: [...s.ledger, { id: r.id, amount: 10, at: a.at }],
        collectibles: [
          ...s.collectibles,
          {
            id: `ritual:${r.id}`,
            kind: r.ritual,
            title: rituals[r.ritual].object,
            at: a.at,
            wishId: r.wishId,
          },
        ],
      };
    }
    case "settings":
      return { ...s, settings: { ...s.settings, [a.key]: a.value } };
  }
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function hasReturnRitual(state: State, wish: Wish): boolean {
  return Boolean(
    wish.realizedAt &&
      state.sessions.some(
        (s) =>
          s.wishId === wish.id &&
          s.completedAt &&
          s.startedAt >= wish.realizedAt!,
      ),
  );
}
export function dailyRitual(day: string): RitualId {
  return (Object.keys(rituals) as RitualId[])[
    Array.from(day).reduce((n, c) => n + c.charCodeAt(0), 0) % 3
  ];
}

// Validate before mounting the UI. Invalid saves stay untouched for recovery.
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v));
const id = (v: unknown) => str(v) && v.length > 0;
const optionalId = (v: unknown) => v === undefined || id(v);
const kind = (v: unknown): v is RitualId =>
  v === "woodfish" || v === "crane" || v === "lantern";
const list = (v: unknown, valid: (x: unknown) => boolean) =>
  Array.isArray(v) &&
  v.every(valid) &&
  new Set(v.map((x) => x.id)).size === v.length;
const session = (v: unknown) =>
  obj(v) &&
  id(v.id) &&
  kind(v.ritual) &&
  Number.isInteger(v.progress) &&
  Number(v.progress) >= 0 &&
  Number(v.progress) <= rituals[v.ritual].steps &&
  date(v.startedAt) &&
  optionalId(v.wishId);
export function restore(raw: string | null): State {
  if (raw === null) return createState();
  const v: unknown = JSON.parse(raw);
  const settings = obj(v) ? v.settings : null;
  const valid =
    obj(v) &&
    v.version === 1 &&
    obj(settings) &&
    ["sound", "haptics", "reducedMotion"].every(
      (k) => typeof settings[k] === "boolean",
    ) &&
    list(
      v.wishes,
      (w) =>
        obj(w) &&
        id(w.id) &&
        str(w.title) &&
        w.title.trim().length > 0 &&
        w.title.length <= 60 &&
        str(w.intention) &&
        (w.category === undefined ||
          ["study", "work", "life"].includes(String(w.category))) &&
        (w.returnMethod === undefined ||
          ["kindness", "ritual"].includes(String(w.returnMethod))) &&
        typeof w.archived === "boolean" &&
        ["active", "realized", "fulfilled"].includes(String(w.status)) &&
        date(w.createdAt) &&
        (w.status === "active" || date(w.realizedAt)) &&
        (w.status !== "fulfilled" || date(w.fulfilledAt)) &&
        list(w.notes, (n) => obj(n) && id(n.id) && str(n.text) && date(n.at)),
    ) &&
    (v.activeSession === null || session(v.activeSession)) &&
    list(
      v.sessions,
      (r) =>
        session(r) &&
        obj(r) &&
        date(r.completedAt) &&
        kind(r.ritual) &&
        r.progress === rituals[r.ritual].steps,
    ) &&
    list(
      v.collectibles,
      (c) =>
        obj(c) &&
        id(c.id) &&
        (kind(c.kind) || c.kind === "badge") &&
        str(c.title) &&
        date(c.at) &&
        optionalId(c.wishId),
    ) &&
    list(
      v.ledger,
      (l) =>
        obj(l) &&
        id(l.id) &&
        Number.isInteger(l.amount) &&
        Number(l.amount) > 0 &&
        date(l.at),
    );
  if (!valid) throw new Error("存档格式不受支持或已损坏，原数据已保留");
  const s = v as State;
  if (
    [
      ...s.sessions,
      ...(s.activeSession ? [s.activeSession] : []),
      ...s.collectibles,
    ].some((r) => r.wishId && !s.wishes.some((w) => w.id === r.wishId))
  )
    throw new Error("存档的心愿关联不完整，原数据已保留");
  return s;
}
