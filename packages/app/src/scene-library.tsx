import { localizedTitle } from './localization';
import { translate as tr, formatNumber, getFormatLocale } from '@wbr/i18n';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, } from "react";
import { sceneProgress, type RitualId } from "@wbr/core";
import { CACHE_BUDGET, parsePack, type Pack } from "@wbr/content";
import { createSceneLibrary, type CatalogEntry, type SceneManifest, } from "@wbr/content/catalog";
import type { CacheOptions, CacheStats } from "@wbr/content/cache";
import { Icon } from "./art";
import { contentIO, useContent } from "./content";
import { useApp } from "./context";
import { SceneBadge } from "./scene-icons";
import { ritualSceneEntry, sceneSteps } from "./scene-placement";
import { PageHead } from "./page-heading";
import { isWishSceneUnlocked } from './vessels';
export { builtInScenes, type BuiltInSceneEntry } from '@wbr/core/daily-scenes';
import { builtInScenes, isSceneVisibleInApp } from '@wbr/core/daily-scenes';
export const supportsScene = (engine: string) => builtInScenes.some((e) => e.engine === engine);
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
        if (Object.keys(manifest.assets).some((k) => !["model", "sound"].includes(k)))
            throw Error("Unsupported woodfish dependency");
    }
    else {
        if (Object.keys(manifest.assets).some((k) => k !== "presentation") ||
            (manifest.assets.presentation &&
                (!manifest.assets.presentation.path.endsWith(".json") ||
                    manifest.assets.presentation.bytes > 8192)))
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
export function useSceneLibrary() {
    const value = useContext(Library);
    const entries = useMemo(() => value.entries.filter(isSceneVisibleInApp), [value.entries]);
    return { ...value, entries };
}
/**
 * Opens a core ritual as its 3D scene: 仪式时光's 再次体验 comes through here.
 * A scene keeps its progress, so a ritual whose scene is done starts over,
 * and a 还愿 visit always starts at 0: it is walked after the wish came true.
 */
export function useOpenRitual() {
    const { state, dispatch, go } = useApp(), { entries } = useSceneLibrary();
    return (ritual: RitualId, wishId?: string) => {
        if (!isSceneVisibleInApp({ id: ritual }))
            return;
        const offered = ritualSceneEntry(entries, ritual);
        const entry = offered && supportsScene(offered.engine)
            ? offered : ritualSceneEntry(builtInScenes, ritual)!;
        const record = state.sceneRecords.find((r) => r.id === entry.id);
        const progress = record ? sceneProgress(record) : 0;
        if (progress > 0 && (wishId || progress >= sceneSteps(entry)))
            dispatch({ type: "scene.progress", id: entry.id, progress: 0 });
        // 再次体验 is a replay — it never settles 今日's keepsake, even when the
        // scene comes up as the day's main walk (a 还愿 walk never does either).
        go({ page: "scene", id: entry.id, entry, wishId, replay: !wishId });
    };
}
/** What a walk is for. The daily set resumes a half-walked scene; each other
 * flag makes it a fresh scene (progress to 0). */
export type SceneVisit = {
    /** A direct wish-picker entry requires an already collected scene object. */
    wishPicker?: boolean;
    opening?: boolean;
    /** 今日's daily set: the local day the keepsake is collected for. */
    daily?: string;
    /** A wish-type keepsake being used: its collectible id. */
    vessel?: string;
    /** A walk for this realized wish (还愿). */
    wishId?: string;
    /** 小天地's 回看, or 仪式时光's 再次体验: a plain fresh replay. */
    replay?: boolean;
};
/**
 * Opens a scene for a walk. 今日's daily set resumes a half-walked scene,
 * like an unflagged entry (场景目录, 仪式时光): the walk is for today either
 * way, so leaving from the card and coming back loses no steps; a finished
 * scene still starts over. The other flags (a vessel use, a 还愿, a replay)
 * always start the scene over — except a vessel already spent, which reopens
 * on its waiting keep-or-discard choice instead of a new walk. No 2D
 * fallback here: these ids come from the live catalog.
 */
export function useOpenScene() {
    const { state, dispatch, go } = useApp();
    return (entry: CatalogEntry, visit?: SceneVisit) => {
        if (!isSceneVisibleInApp(entry))
            return;
        if (visit?.wishPicker && !isWishSceneUnlocked(state, entry.id))
            return;
        const record = state.sceneRecords.find((r) => r.id === entry.id);
        const progress = record ? sceneProgress(record) : 0;
        const spentVessel = !!visit?.vessel &&
            state.collectibles.some((c) => c.id === visit.vessel && !!c.spentAt);
        // A fresh vessel walk starts with a clean slate: a line held on an
        // earlier, unfinished walk of this vessel is let go.
        if (visit?.vessel && !spentVessel)
            dispatch({ type: "vessel.clear", id: visit.vessel });
        const fresh = !!visit && !visit.daily && !visit.opening && !spentVessel;
        const restart = !spentVessel && !visit?.opening && (fresh || progress >= sceneSteps(entry));
        // Cloth folds subdivide legacy integer checkpoints. A new wrapping visit
        // clears that subdivision even if no full checkpoint was reached yet.
        if (restart && entry.id === "korean-bojagi-wrap" && record?.variant !== undefined)
            dispatch({ type: "scene.variant", id: entry.id, variant: "bojagi-step-0" });
        // A spent vessel never resets: it reopens on its waiting choice, not on
        // a new walk — even when the record stands done.
        if (progress > 0 &&
            restart)
            dispatch({ type: "scene.progress", id: entry.id, progress: 0 });
        go({
            page: "scene",
            id: entry.id,
            entry,
            daily: visit?.daily,
            vessel: visit?.vessel,
            wishId: visit?.wishId,
            replay: visit?.replay,
            opening: visit?.opening,
        });
    };
}
export function SceneLibraryProvider({ children }: {
    children: ReactNode;
}) {
    const environment = useContent(), { active } = useApp();
    const io = contentIO(environment);
    const library = useMemo(() => createSceneLibrary({ io, supports: supportsScene, validate }), [io]);
    const [entries, setEntries] = useState(builtInScenes), [stats, setStats] = useState<CacheStats>();
    const [error, setError] = useState(""), [ready, setReady] = useState(false);
    async function maintain(options?: CacheOptions) {
        if (!io.cache)
            return;
        if (options?.budget)
            await io.writeHistory("cache-budget", options.budget);
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
                const budget = typeof stored === "number" &&
                    Number.isSafeInteger(stored) &&
                    stored >= 1 &&
                    stored <= 1024 * 1024 * 1024
                    ? stored
                    : CACHE_BUDGET;
                const next = await io.cache?.maintain({ budget });
                if (!disposed)
                    setStats(next);
            }
            catch {
                if (!disposed)
                    setError("\u8D44\u6E90\u7F13\u5B58\u6682\u4E0D\u53EF\u7528\uFF1B\u5185\u7F6E\u573A\u666F\u4ECD\u53EF\u6253\u5F00\u3002");
            }
            finally {
                if (!disposed)
                    setReady(true);
            }
        })();
        return () => {
            disposed = true;
        };
    }, [io]);
    useEffect(() => {
        if (!environment.catalogUrl)
            return;
        const controller = new AbortController();
        void library
            .catalog(new URL(environment.catalogUrl, window.location.href).href, controller.signal)
            .then((remote) => {
            if (!controller.signal.aborted)
                setEntries([
                    ...remote,
                    ...builtInScenes.filter((e) => !remote.some((r) => r.id === e.id)),
                ]);
        })
            .catch(() => {
            if (!controller.signal.aborted)
                setError("\u76EE\u5F55\u6682\u65F6\u65E0\u6CD5\u66F4\u65B0\uFF0C\u53EF\u4F7F\u7528\u5DF2\u6709\u573A\u666F\u548C\u5386\u53F2\u8BB0\u5F55\u3002");
        });
        return () => controller.abort();
    }, [library, environment.catalogUrl]);
    useEffect(() => {
        if (!ready)
            return;
        const check = () => {
            if (!document.hidden && active)
                void maintain().catch(() => { });
        };
        check();
        document.addEventListener("visibilitychange", check);
        return () => document.removeEventListener("visibilitychange", check);
    }, [io, active, ready]);
    return (<Library.Provider value={{ entries, library, stats, error: error ? tr(error) : '', ready, maintain }}>
      {children}
    </Library.Provider>);
}
/** 今日's scene recommendation. */
export const formatBytes = (bytes: number) => `${formatNumber(bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MiB`;
/** When a search in 场景目录 finds nothing. */
export const CATALOG_EMPTY_COPY = {
    title: "没有找到相符的场景",
    body: "换个字词试试，或清空搜索，看看全部场景。",
    clear: "清空搜索",
} as const;
/** 场景目录's search field. */
export const CATALOG_SEARCH_COPY = {
    label: "搜索场景",
    placeholder: "搜索场景名",
} as const;
/** The status chip on a 场景目录 row: where the scene's content comes from. */
export const SCENE_STATUS_COPY = {
    bundled: "内置",
    cached: "已缓存",
    download: "需下载",
    update: "需更新 App",
} as const;
export type SceneStatus = keyof typeof SCENE_STATUS_COPY;
/** A row's chip, from the library's cache status for a remote scene. */
export function sceneStatus(entry: CatalogEntry, cache?: string): SceneStatus {
    if (!supportsScene(entry.engine))
        return "update";
    if (!entry.manifestUrl || cache === "bundled")
        return "bundled";
    return cache === "cached" ? "cached" : "download";
}
/** A scene as a list row (场景目录, 仪式时光): its badge, its title over a
 * short line, and the go-to chevron of the settings rows. */
export function SceneCard({ id, title, disabled, onClick, children, }: {
    id: string;
    title: string;
    disabled?: boolean;
    onClick(): void;
    children: ReactNode;
}) {
    return (<button className="scene-card" data-scene={id} disabled={disabled} onClick={onClick}>
      <SceneBadge id={id}/>
      <strong lang={builtInScenes.some(entry => entry.id === id) ? undefined : "und"}>{title}</strong>
      {children}
      <Icon name="arrow"/>
    </button>);
}
export function SceneCatalog() {
    const { entries, library, stats, error, ready } = useSceneLibrary(), { go } = useApp();
    const openScene = useOpenScene();
    const [query, setQuery] = useState(""), [limit, setLimit] = useState(24);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const search = useRef<HTMLInputElement>(null);
    const searchLocale = getFormatLocale();
    const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(searchLocale);
    const searchQuery = normalizeSearch(query.trim());
    const matches = entries.filter((entry) => [localizedTitle(entry), entry.title, entry.id].some(value => normalizeSearch(value).includes(searchQuery)));
    const visible = matches.slice(0, limit);
    useEffect(() => {
        let disposed = false;
        const hashes = new Set(stats?.entries.map((e) => e.key));
        void Promise.all(visible.map(async (e) => [
            e.id,
            e.manifestUrl ? await library.status(e, hashes) : "bundled",
        ])).then((pairs) => {
            if (!disposed)
                setStatuses(Object.fromEntries(pairs));
        });
        return () => {
            disposed = true;
        };
    }, [entries, query, limit, stats, library, searchLocale]);
    return (<>
      <PageHead title={tr("\u573A\u666F\u76EE\u5F55")} eyebrow={tr("{p0} \u4E2A\u573A\u666F \u00B7 \u6309\u9700\u51C6\u5907", { p0: entries.length })}/>
      {error && <p role="status">{error}</p>}
      <label className="scene-search">
        <span className="sr-only">{tr(CATALOG_SEARCH_COPY.label)}</span>
        <Icon name="search"/>
        <input ref={search} type="search" placeholder={tr(CATALOG_SEARCH_COPY.placeholder)} value={query} onChange={(e) => {
            setQuery(e.target.value);
            setLimit(24);
        }}/>
      </label>
      <div className="scene-catalog">
        {visible.map((entry) => {
            const status = sceneStatus(entry, statuses[entry.id]);
            return (<SceneCard key={entry.id} id={entry.id} title={localizedTitle(entry)} disabled={!ready} onClick={() => openScene(entry)}>
              <span className="scene-status" data-status={status}>
                {tr(SCENE_STATUS_COPY[status])}
              </span>
            </SceneCard>);
        })}
      </div>
      {query.trim() !== "" && matches.length === 0 && (<div className="empty" role="status">
          <Icon name="leaf"/>
          <h3>{tr(CATALOG_EMPTY_COPY.title)}</h3>
          <p>{tr(CATALOG_EMPTY_COPY.body)}</p>
          <button className="button secondary" onClick={() => {
                setQuery("");
                search.current?.focus();
            }}>
            {tr(CATALOG_EMPTY_COPY.clear)}
          </button>
        </div>)}
      {matches.length > limit && (<button className="button secondary" onClick={() => setLimit((n) => n + 24)}>{tr("\u663E\u793A\u66F4\u591A")}</button>)}
      <button className="text-button" onClick={() => go({ page: "cache" })}>{tr("\u7BA1\u7406\u8D44\u6E90\u7F13\u5B58")}</button>
    </>);
}
export function CacheManager() {
    const { stats, maintain } = useSceneLibrary();
    const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
    const run = async (options?: CacheOptions) => {
        setBusy(true);
        setMessage("");
        try {
            await maintain(options);
            setMessage(options?.clear
                ? "\u5DF2\u6E05\u7406\u53EF\u5220\u9664\u8D44\u6E90\uFF0C\u5386\u53F2\u8BB0\u5F55\u548C\u8FDB\u5EA6\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u7F13\u5B58\u72B6\u6001\u5DF2\u66F4\u65B0\u3002");
        }
        catch {
            setMessage("\u6682\u65F6\u65E0\u6CD5\u7BA1\u7406\u7F13\u5B58\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        }
        finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        void run();
    }, []);
    return (<section className="cache-manager">
      <PageHead title={tr("\u8D44\u6E90\u7F13\u5B58")} eyebrow={tr("\u6240\u6709\u573A\u666F\u5171\u4EAB\u5BB9\u91CF\uFF1B\u6536\u85CF\u4E0D\u4F1A\u6C38\u4E45\u4FDD\u7559\u79BB\u7EBF\u8D44\u6E90\u3002")}/>
      <strong className="cache-usage">
        {formatBytes(stats?.bytes ?? 0)} /{" "}
        {formatBytes(stats?.budget ?? CACHE_BUDGET)}
      </strong>
      <p>{tr("\u4F7F\u7528\u4E2D")}{formatBytes(stats?.protectedBytes ?? 0)}{tr("\u00B7 \u4E0B\u8F7D\u9884\u7559")}{" "}
        {formatBytes(stats?.reservedBytes ?? 0)}
      </p>
      <label>{tr("\u7F13\u5B58\u4E0A\u9650")}<select aria-label={tr("\u7F13\u5B58\u4E0A\u9650")} disabled={busy} value={stats?.budget ?? CACHE_BUDGET} onChange={(e) => void run({ budget: Number(e.target.value) })}>
          {[64, 128, 256, 512].map((n) => (<option key={n} value={n * 1024 * 1024}>
              {n} MiB
            </option>))}
        </select>
      </label>
      {stats?.overBudget && (<p role="status">{tr("\u4F7F\u7528\u4E2D\u8D44\u6E90\u6682\u65F6\u8D85\u8FC7\u4E0A\u9650\uFF0C\u9000\u51FA\u573A\u666F\u540E\u4F1A\u81EA\u52A8\u6E05\u7406\u3002")}</p>)}
      <button className="button secondary" disabled={busy} onClick={() => void run({ clear: true })}>{tr("\u6E05\u7406\u53EF\u5220\u9664\u8D44\u6E90")}</button>
      <p role="status">{message ? tr(message) : ''}</p>
      <p className="quiet">{tr("\u518D\u6B21\u6253\u5F00\u5386\u53F2\u573A\u666F\u65F6\uFF0C\u7F3A\u5931\u7684\u8D44\u6E90\u4F1A\u91CD\u65B0\u4E0B\u8F7D\u3002\u7CFB\u7EDF\u4E5F\u53EF\u80FD\u56DE\u6536\u8D44\u6E90\u7F13\u5B58\u3002")}</p>
    </section>);
}
