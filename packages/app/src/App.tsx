import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createStore, type Host } from "@wbr/runtime";
import { rituals } from "@wbr/core";
import { Context, type Route, type FulfillmentDraft } from "./context";
import { Icon } from "./art";
import { CollectionDetail, History, Me, Wishes, World } from "./pages";
import { Today, ritualTitle } from "./home";
import { NewWish, WishDetail, WishNote, FulfillWish } from "./wishes";
import { fontStyles } from "./assets";
import { Complete, Ritual } from "./ritual";
import { LegalInformation } from './legal';
import { ContentContext, type ContentEnvironment } from "./content";
import { InvalidContentError } from "@wbr/content";
import { SceneLibraryProvider, SceneCatalog, CacheManager } from "./scene-library";
import { SceneExperience } from "./scene-experience";
import { followSystemReducedMotion, initialSettings } from "./reduced-motion";
import { useLocalDay } from "./local-day";
import { RewardFlightLayer } from "./reward-flight-layer";
import {
  ARRIVAL_LINGER_MS,
  rectOf,
  shouldReduceMotion,
  type RewardFlight,
  type RewardArrival,
} from "./reward-flight";

export function BlessingApp({
  host,
  active = true,
  backRequest = 0,
  onCanGoBack,
  content,
}: {
  host: Host;
  active?: boolean;
  backRequest?: number;
  onCanGoBack?: (value: boolean) => void;
  content?: ContentEnvironment;
}) {
  const store = useMemo(() => createStore(host, initialSettings), [host]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [routes, setRoutes] = useState<Route[]>([{ page: "today" }]);
  const [error, setError] = useState("");
  const [fulfillmentDrafts, setFulfillmentDrafts] = useState<
    Record<string, FulfillmentDraft>
  >({});
  // One reward's trip home, and what shows once it lands. The flight lives
  // outside <main>, so the per-route remount never interrupts it.
  const [flight, setFlight] = useState<RewardFlight | null>(null);
  const [arrival, setArrival] = useState<RewardArrival | null>(null);
  const [announcement, setAnnouncement] = useState<{
    text: string;
    n: number;
  } | null>(null);
  const flightRef = useRef<RewardFlight | null>(null);
  // The navigation a reward arrives on skips page-in: the ghost carries it.
  const skipNextPageIn = useRef(false);
  const skippedRoute = useRef<string | null>(null);
  // The woodfish scene's idle signal, handed to the Ritual page.
  const woodfishIdle = useRef<(() => Promise<void>) | null>(null);
  // 今日 is rebuilt only when the date changes, so focus and scroll survive.
  const day = useLocalDay(active);
  const audio = useRef<AudioContext | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const route = routes[routes.length - 1];
  const state = snapshot.state;
  const roots = ["today", "wishes", "world", "me"];
  const canBack = routes.length > 1 || route.page !== "today";
  function go(next: Route) {
    setError("");
    setRoutes((old) => {
      if (roots.includes(next.page)) return [next];
      const existing = old.findIndex(
        (r) => r.page === next.page && r.id === next.id,
      );
      // Back to a page already open: what was above it goes, and the new
      // route stands in for the old one, so a 还愿 wishId is not dropped.
      if (existing >= 0) return [...old.slice(0, existing), next];
      if (
        (old.at(-1)?.page === "new" && next.page === "wish") ||
        next.page === "complete"
      )
        return [...old.slice(0, -1), next];
      return [...old, next];
    });
    // A new page opens at the top: phones scroll the window, the desktop
    // device frame scrolls the shell itself.
    shell.current?.scrollTo?.(0, 0);
    window.scrollTo?.(0, 0);
  }
  function back() {
    setError("");
    setRoutes((old) =>
      old.length > 1 ? old.slice(0, -1) : [{ page: "today" }],
    );
  }
  function launchReward(next: RewardFlight) {
    flightRef.current = next;
    skipNextPageIn.current = true;
    setArrival({
      key: Date.now(),
      collectibleId: next.collectibleId,
      wishId: next.wishId,
      tab: next.tab,
      phase: "flying",
    });
    setFlight(next);
  }
  const announce = useCallback((status: string) => {
    setAnnouncement((old) => ({ text: status, n: (old?.n ?? 0) + 1 }));
  }, []);
  const onRewardLand = useCallback(() => {
    const landed = flightRef.current;
    setFlight(null);
    setArrival((a) => (a ? { ...a, phase: "landed" } : a));
    if (landed) announce(landed.announce);
  }, [announce]);
  // The 新 mark, tab badge and hop linger a moment, then rest.
  useEffect(() => {
    if (!arrival || arrival.phase !== "landed") return;
    const timer = window.setTimeout(() => setArrival(null), ARRIVAL_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [arrival]);
  // ✕ on the reward card (and Android back, below): the data is already
  // settled, so nothing is lost — the sticker still flies, into the 小天地
  // tab, and 今日 opens with its +1.
  function closeComplete() {
    const session = state?.sessions.find((s) => s.id === route.id);
    if (session)
      launchReward({
        kind: session.ritual,
        from: rectOf(document.querySelector("[data-reward-sticker]")),
        tab: "world",
        announce: `${rituals[session.ritual].object}已放进小天地`,
      });
    go({ page: "today" });
  }
  useEffect(() => {
    void store.load();
  }, [store]);
  useEffect(() => followSystemReducedMotion(store), [store]);
  useEffect(() => {
    onCanGoBack?.(canBack);
  }, [canBack, onCanGoBack]);
  const lastBack = useRef(backRequest);
  useEffect(() => {
    if (lastBack.current !== backRequest) {
      lastBack.current = backRequest;
      // On the reward card, Android back leaves like ✕ does, not like a
      // stack pop: the exits agree, and the sticker still flies to the tab.
      if (route.page === "complete") closeComplete();
      else back();
    }
  }, [backRequest, route.page]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        void store.flush();
        void audio.current?.suspend();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      const status = store.getSnapshot().status;
      if (status === "saving" || status === "save-error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", beforeUnload);
      void audio.current?.close();
      audio.current = null;
    };
  }, [store]);
  useEffect(() => {
    if (!active) {
      void store.flush();
      void audio.current?.suspend();
    }
  }, [active, store]);
  function prepareFeedback() {
    if (!store.getSnapshot().state?.settings.sound) return;
    try {
      const ctx = (audio.current ??= new AudioContext());
      void ctx.resume().catch(() => {});
    } catch {
      /* Hosts may disallow audio. */
    }
  }
  async function decodeSound(bytes: ArrayBuffer) {
    const ctx = (audio.current ??= new AudioContext());
    const sound = await ctx.decodeAudioData(bytes.slice(0));
    if (sound.duration > 3 || sound.numberOfChannels > 2)
      throw new InvalidContentError("Scene sound exceeds budget");
    return sound;
  }
  function haptic() {
    if (store.getSnapshot().state?.settings.haptics)
      void host.haptic?.().catch(() => {});
  }
  function feedback(sound?: AudioBuffer) {
    haptic();
    if (!state?.settings.sound) return;
    try {
      const ctx = (audio.current ??= new AudioContext());
      void ctx.resume().catch(() => {});
      if (sound) {
        const source = ctx.createBufferSource();
        source.buffer = sound;
        source.connect(ctx.destination);
        source.onended = () => source.disconnect();
        source.start();
        return;
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(420, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        180,
        ctx.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      /* Sound is optional if the host disallows Web Audio. */
    }
  }
  if (!state)
    return (
      <div className="bless-app">
        <style>{fontStyles}</style>
        <div className="loading-screen">
          <Icon name="leaf" />
          <p className="eyebrow">一日一念 · 赛博祈福</p>
          <h1>
            {snapshot.status === "load-error"
              ? "先把回忆找回来。"
              : "为今天，留一点温柔。"}
          </h1>
          <p>{snapshot.error ?? "正在展开你的小天地…"}</p>
          {snapshot.status === "load-error" && (
            <button
              className="button primary"
              onClick={() => void store.load()}
            >
              重新读取
            </button>
          )}
        </div>
      </div>
    );
  const section =
    route.page === "wish" || route.page === "new"
      ? "wishes"
      : route.page === "collection"
        ? "world"
        : route.page === "history"
          ? "me"
          : roots.includes(route.page)
            ? route.page
            : "today";
  // The ribbon names a page that has no title of its own: none on 完成页, nor
  // on pages whose h1 already says it (场景目录, 资源缓存, 仪式时光). On the
  // others it is a category word above the page's own heading.
  const ribbon = (
    {
      new: "许个小心愿",
      wish: "我的心愿",
      fulfill: "来还个愿",
      note: "记一笔",
      collection: "我的小收藏",
      scene: "场景体验",
      ritual:
        ritualTitle[
          state.activeSession?.ritual ??
            (route.id === "crane"
              ? "crane"
              : route.id === "lantern"
                ? "lantern"
                : "woodfish")
        ],
    } as Record<string, string>
  )[route.page];
  // Latch the skipped page-in onto the route it was launched for, so the
  // inline style stays for that <main>'s lifetime (removing it later would
  // restart the animation) and only the next visit to another route, or an
  // unlatched return to this one, gets its page-in back.
  const routeKey = route.page + (route.id ?? "");
  if (skippedRoute.current && skippedRoute.current !== routeKey)
    skippedRoute.current = null;
  if (skipNextPageIn.current) {
    skippedRoute.current = routeKey;
    skipNextPageIn.current = false;
  }
  const skipPageIn = skippedRoute.current === routeKey;
  // What shows at landing: a hop on the tab the reward belongs to, and a
  // butter +1 on 心愿 (a note) or, when nothing landed in the room itself,
  // on 小天地 (the ✕ / back flight).
  const landed = arrival?.phase === "landed";
  const hopTab =
    !landed
      ? null
      : arrival!.collectibleId || arrival!.tab !== "wishes"
        ? "world"
        : "wishes";
  const tabBadge = (id: string) => {
    if (!landed) return "";
    if (id === "wishes") return arrival!.wishId ? "+1" : "";
    return !arrival!.collectibleId && id === (arrival!.tab ?? "world")
      ? "+1"
      : "";
  };
  const page =
    route.page === 'privacy' || route.page === 'support' ? <LegalInformation kind={route.page} /> :
    route.page === "scenes" ? <SceneCatalog /> : route.page === "cache" ? <CacheManager /> : route.page === "scene" ? <SceneExperience entry={route.entry ?? state.sceneRecords.find(r => r.id === route.id)} wishId={route.wishId} daily={route.daily} vessel={route.vessel} /> : route.page === "today" ? (
      <Today key={day} day={day} />
    ) : route.page === "wishes" ? (
      <Wishes />
    ) : route.page === "world" ? (
      <World />
    ) : route.page === "me" ? (
      <Me />
    ) : route.page === "new" ? (
      <NewWish />
    ) : route.page === "wish" ? (
      <WishDetail key={route.id} id={route.id!} />
    ) : route.page === "fulfill" ? (
      <FulfillWish key={route.id} id={route.id!} />
    ) : route.page === "note" ? (
      <WishNote key={route.id} id={route.id!} />
    ) : route.page === "ritual" ? (
      <Ritual
        id={route.id}
        wishId={route.wishId}
        whenIdleRef={woodfishIdle}
      />
    ) : route.page === "complete" ? (
      <Complete id={route.id!} />
    ) : route.page === "collection" ? (
      <CollectionDetail id={route.id!} />
    ) : (
      <History />
    );
  return (
    <ContentContext.Provider value={content ?? {}}>
      <Context.Provider
        value={{
          state,
          go,
          back,
          active,
          feedback,
          haptic,
          canHaptic: typeof host.haptic === "function",
          decodeSound,
          prepareFeedback,
          fulfillmentDrafts,
          setFulfillmentDraft: (id, draft) =>
            setFulfillmentDrafts((old) => {
              const next = { ...old };
              if (draft) next[id] = draft;
              else delete next[id];
              return next;
            }),
          dispatch: (action) => {
            try {
              const before = store.getSnapshot().state;
              store.dispatch(action);
              setError("");
              return store.getSnapshot().state !== before;
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "这一步暂时没有完成，请再试一次",
              );
              return false;
            }
          },
          launchReward,
          arrival,
          announce,
        }}
      >
        <SceneLibraryProvider><div
          className={`bless-app${state.settings.reducedMotion ? " reduce-motion" : ""}`}
        >
          <style>{fontStyles}</style>
          <div className="desktop-note">
            <span className="brand-mark">念</span>
            <strong>一日一念</strong>
            <p>
              把小小的仪式，
              <br />
              过成温柔的日常。
            </p>
            <span>CYBER BLESS · A LITTLE EVERY DAY</span>
          </div>
          <div className="app-shell" data-page={route.page} ref={shell}>
            {!roots.includes(route.page) && (
              <header
                className={`app-topbar${route.page === "complete" ? " completion-topbar" : ""}`}
              >
                <button
                  className="back-button"
                  aria-label={route.page === "complete" ? "关闭完成页" : "返回"}
                  onClick={
                    route.page === "complete"
                      ? closeComplete
                      : back
                  }
                >
                  <Icon name={route.page === "complete" ? "close" : "back"} />
                </button>
                {ribbon && <h2>{ribbon}</h2>}
              </header>
            )}
            <span
              className={
                snapshot.status === "saved" ? "sr-only" : "save-status"
              }
              role="status"
            >
              {snapshot.status === "saving"
                ? "正在保存…"
                : snapshot.status === "save-error"
                  ? "尚未保存"
                  : "本机珍藏"}
            </span>
            {snapshot.status === "save-error" && (
              <div className="error-banner" role="alert">
                <span>{snapshot.error}</span>
                <button onClick={() => store.retry()}>重试保存</button>
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button onClick={() => setError("")}>知道了</button>
              </div>
            )}
            <main
              className="app-content"
              key={route.page + (route.id ?? "")}
              style={skipPageIn ? { animation: "none" } : undefined}
            >
              {page}
            </main>
            {flight && (
              <RewardFlightLayer
                flight={flight}
                reducedMotion={shouldReduceMotion(
                  state.settings.reducedMotion,
                )}
                onLand={onRewardLand}
              />
            )}
            {roots.includes(route.page) && (
              <nav className="bottom-nav" aria-label="主导航">
                {[
                  ["today", "今日"],
                  ["wishes", "心愿"],
                  ["world", "小天地"],
                  ["me", "我的"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    data-tab={id}
                    aria-current={section === id ? "page" : undefined}
                    className={hopTab === id ? "tab-hop" : undefined}
                    onClick={() => go({ page: id as Route["page"] })}
                  >
                    <Icon name={id} />
                    <span>{label}</span>
                    <i>{tabBadge(id)}</i>
                  </button>
                ))}
              </nav>
            )}
            {/* The App's one polite voice: settle beats and landings. */}
            <p className="sr-only" role="status">
              {announcement && (
                <span key={announcement.n}>{announcement.text}</span>
              )}
            </p>
          </div>
        </div></SceneLibraryProvider>
      </Context.Provider>
    </ContentContext.Provider>
  );
}
