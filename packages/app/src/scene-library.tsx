import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CACHE_BUDGET, parsePack, type Pack } from "@wbr/content";
import {
  createSceneLibrary,
  type CatalogEntry,
  type SceneManifest,
} from "@wbr/content/catalog";
import type { CacheOptions, CacheStats } from "@wbr/content/cache";
import { Icon } from "./art";
import { contentIO, useContent } from "./content";
import { useApp } from "./context";
import { recommendTodayScene } from "./scene-placement";

export type BuiltInSceneEntry = CatalogEntry & {
  /** 一段 80–120 汉字：起源 + 历史脉络 + 基本意涵；练习／致敬语气。缺省 → 隐藏折叠块。 */
  narrative?: string;
  /** 指向 content/traditions/<slug>.md（单文件，非目录）；仅元数据，本期 app 不加载。产品原创场景（crane、lantern）省略。 */
  traditionSlug?: string;
};
export const builtInScenes: BuiltInSceneEntry[] = [
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "chinese-buddhism",
    narrative:
      "木鱼是东亚佛教课诵与集众时常见的响器，圆型腹空，轻敲以应诵经节拍，禅寺中常与磬相配。鱼形无睑，常被理解为精勤醒觉，并与寺院晨昏的日常节律相连。本页只作静心练习与文化致敬，非宗教仪轨。",
  },
  {
    id: "celtic-folk-spring",
    title: "泉边一念",
    engine: "celtic-folk-spring@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "celtic-folk",
  },
  {
    id: "theravada-water",
    title: "花水位一倾",
    engine: "theravada-water@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "theravada-buddhism",
  },
  {
    id: "tanzaku-tanabata",
    title: "短册系竹",
    engine: "tanzaku-tanabata@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "日本七夕时，人们把愿望写在色纸短册上，系于笹竹；仙台七夕的七种装饰中，短册多寄托学业与书艺精进之愿。它与绘马同属书写悬挂的祈愿习惯，却是七月星祭的岁时语境。本页只作许愿练习与致敬，非宗教仪轨。",
  },
  {
    id: "yeondeunghoe",
    title: "燃灯上浮",
    engine: "yeondeunghoe@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "won-buddhism",
    narrative:
      "韩国燃灯会是佛诞前后点亮莲灯的节庆，二〇二〇年列入联合国教科文组织人类非物质文化遗产代表作名录。灯火象征光明与共同祝愿，如今也延伸为公众可自制莲灯参与的开放春日共庆。本页只作许愿练习与致敬，非宗教仪轨。",
  },
  {
    id: "furin-wind-chime",
    title: "风铃一响",
    engine: "furin-wind-chime@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "风铃是日本夏日常见的风物与工艺：江户玻璃或南部铁器的铃身下系纸短册，风过轻响，带来听觉上的清凉感。常述由古时悬于檐角的风铎演变而来，渐成民俗美学。本页只作静听练习与致敬，非宗教仪轨。",
  },
  {
    id: "shinto-torii",
    title: "庭前一礼",
    engine: "shinto-torii@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "在日本神社，鸟居标示日常空间与神圣空间的边界，入内前的轻轻一礼表达敬意。不同神社的参拜礼节并不完全相同。这里以庭前停步、低头与安静致意为灵感，是一段产品改编的致敬练习，不替代真实参拜，也不代表任何神社。",
  },
  {
    id: "tibetan-wheel",
    title: "廊前轻转",
    engine: "tibetan-wheel@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "tibetan-buddhism",
    narrative:
      "转经筒见于藏传佛教的日常实践，转动与祈愿、诵念相联系。这里以廊前固定式转筒为灵感，邀请你用一次轻缓的触碰，让筒身沿顺时针方向转动。本体验为产品改编的致敬练习，保留安静的节奏，不代替修持，也不以转数计量任何成效。",
  },
  {
    id: "slavic-wreath",
    title: "火边花环",
    engine: "slavic-wreath@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "slavic-folk",
    narrative:
      "乌克兰与波兰部分地区的仲夏习俗中，可以见到花环、歌唱、火光与水上放环，各地做法与节期有所不同。这里借这些公开的民俗意象，让一圈花叶载着祝愿缓缓漂远。本体验为产品改编的致敬练习，不代表所有斯拉夫传统，也不以花环预测命运。",
  },
  // Product-original practices: no traditionSlug, so no tradition is implied.
  // They share ids with the 2D crane/lantern rituals but live on the scene route.
  {
    id: "crane",
    title: "折一只纸鹤",
    engine: "crane@1",
    revision: "bundled",
    manifestUrl: "",
    narrative:
      "纸鹤承载着手作与祝愿，也在战后的广岛成为和平的象征。这里以一张纸的折痕与展开为灵感，邀请你缓缓折出一只鹤，留下想送给自己或他人的话。本体验为产品改编的练习，不代表特定宗教仪式，也不承诺心愿必然实现。",
  },
  {
    id: "lantern",
    title: "点一盏心愿灯",
    engine: "lantern@1",
    revision: "bundled",
    manifestUrl: "",
    narrative:
      "一盏柔和的灯，可以为一句祝愿留出安静的位置。这里借鉴纸灯笼的竹骨与透光纸面，将点亮、写愿与悬挂组成一段缓慢的体验。本场景为产品原创的练习，不对应某项真实供灯仪式；灯留在眼前，陪你记住此刻的心意。",
  },
];
export const supportsScene = (engine: string) =>
  builtInScenes.some((e) => e.engine === engine);
export function woodfishPack(manifest: SceneManifest): Pack {
  return parsePack({
    ...manifest.config,
    schemaVersion: 1,
    sceneId: "woodfish",
    revision: manifest.revision,
    engine: "woodfish@1",
    model: manifest.assets.model,
    ...(manifest.assets.sound ? { sound: manifest.assets.sound } : {}),
  });
}
function validate(manifest: SceneManifest) {
  if (manifest.engine === "woodfish@1") {
    woodfishPack(manifest);
    if (
      Object.keys(manifest.assets).some((k) => !["model", "sound"].includes(k))
    )
      throw Error("Unsupported woodfish dependency");
  } else {
    if (
      Object.keys(manifest.assets).some((k) => k !== "presentation") ||
      (manifest.assets.presentation &&
        (!manifest.assets.presentation.path.endsWith(".json") ||
          manifest.assets.presentation.bytes > 8192))
    )
      throw Error("Unsupported scene dependency");
    if (Object.keys(manifest.config).length)
      throw Error("Unsupported scene configuration");
  }
}
type LibraryContext = {
  entries: CatalogEntry[];
  library: ReturnType<typeof createSceneLibrary>;
  stats?: CacheStats;
  error: string;
  ready: boolean;
  maintain(options?: CacheOptions): Promise<CacheStats | undefined>;
};
const Library = createContext<LibraryContext>(null!);
/** What `SceneLibraryProvider` provides; tests stand in their own. */
export { Library as SceneLibraryContext };
export const useSceneLibrary = () => useContext(Library);
export function SceneLibraryProvider({ children }: { children: ReactNode }) {
  const environment = useContent(),
    { active } = useApp();
  const io = contentIO(environment);
  const library = useMemo(
    () => createSceneLibrary({ io, supports: supportsScene, validate }),
    [io],
  );
  const [entries, setEntries] = useState(builtInScenes),
    [stats, setStats] = useState<CacheStats>();
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  async function maintain(options?: CacheOptions) {
    if (!io.cache) return;
    if (options?.budget) await io.writeHistory("cache-budget", options.budget);
    const next = await io.cache.maintain(options);
    setStats(next);
    return next;
  }
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const stored = await io
          .readHistory("cache-budget")
          .catch(() => undefined);
        const budget =
          typeof stored === "number" &&
          Number.isSafeInteger(stored) &&
          stored >= 1 &&
          stored <= 1024 * 1024 * 1024
            ? stored
            : CACHE_BUDGET;
        const next = await io.cache?.maintain({ budget });
        if (!disposed) setStats(next);
      } catch {
        if (!disposed) setError("资源缓存暂不可用；内置场景仍可打开。");
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [io]);
  useEffect(() => {
    if (!environment.catalogUrl) return;
    const controller = new AbortController();
    void library
      .catalog(
        new URL(environment.catalogUrl, window.location.href).href,
        controller.signal,
      )
      .then((remote) => {
        if (!controller.signal.aborted)
          setEntries([
            ...remote,
            ...builtInScenes.filter((e) => !remote.some((r) => r.id === e.id)),
          ]);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("目录暂时无法更新，可使用已有场景和历史记录。");
      });
    return () => controller.abort();
  }, [library, environment.catalogUrl]);
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      if (!document.hidden && active) void maintain().catch(() => {});
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [io, active, ready]);
  return (
    <Library.Provider
      value={{ entries, library, stats, error, ready, maintain }}
    >
      {children}
    </Library.Provider>
  );
}
export function SceneRecommendation({ day }: { day: string }) {
  const { entries } = useSceneLibrary(),
    { go } = useApp();
  const entry = recommendTodayScene(entries, day);
  return (
    <section className="scene-discovery">
      <div>
        <span className="tag tag-sage">今日场景推荐</span>
        <h2>{entry?.title}</h2>
        <p>点开时准备内容，记录会一直留在本机。</p>
      </div>
      {entry && (
        <button
          className="button secondary"
          onClick={() => go({ page: "scene", id: entry.id, entry })}
        >
          体验推荐场景
        </button>
      )}
      <button className="text-button" onClick={() => go({ page: "scenes" })}>
        浏览场景目录
      </button>
    </section>
  );
}
export const formatBytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
/** When a search in 场景目录 finds nothing. */
export const CATALOG_EMPTY_COPY = {
  title: "没有找到相符的场景",
  body: "换个字词试试，或清空搜索，看看全部场景。",
  clear: "清空搜索",
} as const;
export function SceneCatalog() {
  const { entries, library, stats, error, ready } = useSceneLibrary(),
    { go } = useApp();
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const search = useRef<HTMLInputElement>(null);
  const matches = entries.filter((e) => e.title.includes(query.trim()));
  const visible = matches.slice(0, limit);
  useEffect(() => {
    let disposed = false;
    const hashes = new Set(stats?.entries.map((e) => e.key));
    void Promise.all(
      visible.map(async (e) => [
        e.id,
        e.manifestUrl ? await library.status(e, hashes) : "bundled",
      ]),
    ).then((pairs) => {
      if (!disposed) setStatuses(Object.fromEntries(pairs));
    });
    return () => {
      disposed = true;
    };
  }, [entries, query, limit, stats, library]);
  return (
    <>
      <header className="page-heading">
        <h1>场景目录</h1>
        <p>{entries.length} 个场景 · 按需准备</p>
      </header>
      {error && <p role="status">{error}</p>}
      <label className="scene-search">
        搜索场景
        <input
          ref={search}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
          }}
        />
      </label>
      <div className="scene-catalog">
        {visible.map((entry) => (
          <button
            disabled={!ready}
            className="scene-card"
            key={entry.id}
            onClick={() => go({ page: "scene", id: entry.id, entry })}
          >
            <strong>{entry.title}</strong>
            <small>
              {!supportsScene(entry.engine)
                ? "需要更新 App"
                : ((
                    {
                      bundled: "内置内容",
                      cached: "已缓存 · 打开时校验",
                      missing: "资源已清理 · 点开重新下载",
                      unknown: "点开下载",
                    } as Record<string, string>
                  )[statuses[entry.id]] ?? "点开下载")}
            </small>
          </button>
        ))}
      </div>
      {query.trim() !== "" && matches.length === 0 && (
        <div className="empty" role="status">
          <Icon name="leaf" />
          <h3>{CATALOG_EMPTY_COPY.title}</h3>
          <p>{CATALOG_EMPTY_COPY.body}</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              search.current?.focus();
            }}
          >
            {CATALOG_EMPTY_COPY.clear}
          </button>
        </div>
      )}
      {matches.length > limit && (
        <button
          className="button secondary"
          onClick={() => setLimit((n) => n + 24)}
        >
          显示更多
        </button>
      )}
      <button className="text-button" onClick={() => go({ page: "cache" })}>
        管理资源缓存
      </button>
    </>
  );
}
export function CacheManager() {
  const { stats, maintain } = useSceneLibrary();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (options?: CacheOptions) => {
    setBusy(true);
    setMessage("");
    try {
      await maintain(options);
      setMessage(
        options?.clear
          ? "已清理可删除资源，历史记录和进度保持不变。"
          : "缓存状态已更新。",
      );
    } catch {
      setMessage("暂时无法管理缓存，请重试。");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run();
  }, []);
  return (
    <section className="cache-manager">
      <h1>资源缓存</h1>
      <p>所有场景共享容量；收藏不会永久保留离线资源。</p>
      <strong className="cache-usage">
        {formatBytes(stats?.bytes ?? 0)} /{" "}
        {formatBytes(stats?.budget ?? CACHE_BUDGET)}
      </strong>
      <p>
        使用中 {formatBytes(stats?.protectedBytes ?? 0)} · 下载预留{" "}
        {formatBytes(stats?.reservedBytes ?? 0)}
      </p>
      <label>
        缓存上限
        <select
          aria-label="缓存上限"
          disabled={busy}
          value={stats?.budget ?? CACHE_BUDGET}
          onChange={(e) => void run({ budget: Number(e.target.value) })}
        >
          {[64, 128, 256, 512].map((n) => (
            <option key={n} value={n * 1024 * 1024}>
              {n} MiB
            </option>
          ))}
        </select>
      </label>
      {stats?.overBudget && (
        <p role="status">使用中资源暂时超过上限，退出场景后会自动清理。</p>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void run({ clear: true })}
      >
        清理可删除资源
      </button>
      <p role="status">{message}</p>
      <p className="quiet">
        再次打开历史场景时，缺失的资源会重新下载。系统也可能回收资源缓存。
      </p>
    </section>
  );
}
