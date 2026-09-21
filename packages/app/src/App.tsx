import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createStore, type Host } from "@wbr/runtime";
import { Context, type Route, type FulfillmentDraft } from "./context";
import { Icon } from "./art";
import { CollectionDetail, History, Me, Wishes, World } from "./pages";
import { Today, ritualTitle } from "./home";
import { NewWish, WishDetail, WishNote, FulfillWish } from "./wishes";
import { fontStyles } from "./assets";
import { Complete, Ritual } from "./ritual";
import { ContentContext, type ContentEnvironment } from "./content";
import { InvalidContentError } from "@wbr/content";

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
  const store = useMemo(() => createStore(host), [host]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [routes, setRoutes] = useState<Route[]>([{ page: "today" }]);
  const [error, setError] = useState("");
  const [fulfillmentDrafts, setFulfillmentDrafts] = useState<
    Record<string, FulfillmentDraft>
  >({});
  const [dateKey, setDateKey] = useState(0);
  const audio = useRef<AudioContext | null>(null);
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
      if (existing >= 0) return old.slice(0, existing + 1);
      if (
        (old.at(-1)?.page === "new" && next.page === "wish") ||
        next.page === "complete"
      )
        return [...old.slice(0, -1), next];
      return [...old, next];
    });
    window.scrollTo?.(0, 0);
  }
  function back() {
    setError("");
    setRoutes((old) =>
      old.length > 1 ? old.slice(0, -1) : [{ page: "today" }],
    );
  }
  useEffect(() => {
    void store.load();
  }, [store]);
  useEffect(() => {
    onCanGoBack?.(canBack);
  }, [canBack, onCanGoBack]);
  const lastBack = useRef(backRequest);
  useEffect(() => {
    if (lastBack.current !== backRequest) {
      lastBack.current = backRequest;
      back();
    }
  }, [backRequest]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        void store.flush();
        void audio.current?.suspend();
      } else setDateKey((k) => k + 1);
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
    const timer = window.setInterval(() => setDateKey((k) => k + 1), 60000);
    return () => {
      clearInterval(timer);
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
    } else setDateKey((k) => k + 1);
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
  function feedback(sound?: AudioBuffer) {
    if (state?.settings.haptics) void host.haptic?.().catch(() => {});
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
  const page =
    route.page === "today" ? (
      <Today key={dateKey} />
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
      <Ritual id={route.id} wishId={route.wishId} />
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
        }}
      >
        <div
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
          <div className="app-shell" data-page={route.page}>
            {!roots.includes(route.page) && (
              <header
                className={`app-topbar${route.page === "complete" ? " completion-topbar" : ""}`}
              >
                <button
                  className="back-button"
                  aria-label={route.page === "complete" ? "关闭完成页" : "返回"}
                  onClick={
                    route.page === "complete"
                      ? () => go({ page: "today" })
                      : back
                  }
                >
                  <Icon name={route.page === "complete" ? "close" : "back"} />
                </button>
                <h2>
                  {
                    (
                      {
                        new: "许个小心愿",
                        wish: "我的心愿",
                        fulfill: "来还个愿",
                        note: "记一笔",
                        collection: "我的小收藏",
                        history: "仪式时光",
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
                    )[route.page]
                  }
                </h2>
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
            <main className="app-content" key={route.page + (route.id ?? "")}>
              {page}
            </main>
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
                    aria-current={section === id ? "page" : undefined}
                    onClick={() => go({ page: id as Route["page"] })}
                  >
                    <Icon name={id} />
                    <span>{label}</span>
                    <i />
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </Context.Provider>
    </ContentContext.Provider>
  );
}
