import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CACHE_BUDGET, parsePack, type Pack } from "@wbr/content";
import {
  createSceneLibrary,
  recommendScene,
  type CatalogEntry,
  type SceneManifest,
} from "@wbr/content/catalog";
import type { CacheOptions, CacheStats } from "@wbr/content/cache";
import { contentIO, useContent } from "./content";
import { useApp } from "./context";
import { localDay } from "@wbr/core";

export const builtInScenes: CatalogEntry[] = [
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "celtic-folk-spring",
    title: "泉边一念",
    engine: "celtic-folk-spring@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "theravada-water",
    title: "花水位一倾",
    engine: "theravada-water@1",
    revision: "bundled",
    manifestUrl: "",
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
export function SceneRecommendation() {
  const { entries } = useSceneLibrary(),
    { go } = useApp();
  const entry = recommendScene(entries, localDay());
  return (
    <section className="scene-discovery">
      <div>
        <span className="eyebrow">今日场景推荐</span>
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
export function SceneCatalog() {
  const { entries, library, stats, error, ready } = useSceneLibrary(),
    { go } = useApp();
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const visible = entries
    .filter((e) => e.title.includes(query))
    .slice(0, limit);
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
      {entries.filter((e) => e.title.includes(query)).length > limit && (
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
