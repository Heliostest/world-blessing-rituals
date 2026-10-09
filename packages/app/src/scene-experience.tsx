import { useEffect, useMemo, useRef, useState } from "react";
import {
  mountScene,
  type SceneSession,
  type SceneController,
} from "@wbr/scene-runtime";
import type {
  CatalogEntry,
  SceneLease,
  SceneProgress,
} from "@wbr/content/catalog";
import { hasReturnRitual } from "@wbr/core";
import { WISH_WRITE_COPY } from "@wbr/gestures";
import type { WoodfishContext } from "./scene-engines";
import { sceneEngines } from "./scene-engines";
import { Icon } from "./art";
import { now, uid, useApp } from "./context";
import { supportsScene, useSceneLibrary, woodfishPack } from "./scene-library";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { FeedbackControls } from "./feedback-controls";
import { describeSceneLoadError } from "./scene-load-error";
import { sceneWish } from "./scene-wish";
import { sceneRitual, sceneStage, sceneSteps } from "./scene-placement";
import { rectOf } from "./reward-flight";

function ProceduralScene({
  entry,
  progress,
  checkpoint,
  saveWish,
  failed,
}: {
  entry: CatalogEntry;
  progress: number;
  checkpoint(n: number): void;
  saveWish(text: string): void;
  failed(error?: unknown): void;
}) {
  const host = useRef<HTMLDivElement>(null),
    session = useRef<SceneSession<SceneController>>(null);
  const { active, state, prepareFeedback, haptic } = useApp();
  const callbacks = { checkpoint, saveWish, failed, prepareFeedback, haptic };
  const latest = useRef({ ...callbacks, state });
  latest.current = { ...callbacks, state };
  const stage = sceneStage(entry.id);
  useEffect(() => {
    session.current = mountScene({
      host: host.current!,
      active,
      reducedMotion: state.settings.reducedMotion,
      context: {
        progress,
        checkpoint: (n: number) => latest.current.checkpoint(n),
        sceneId: entry.id,
        prepareFeedback: () => latest.current.prepareFeedback(),
        haptic: () => latest.current.haptic(),
        isSoundEnabled: () => latest.current.state.settings.sound,
        saveWish: (text: string) => latest.current.saveWish(text),
        stage,
      },
      load: () =>
        sceneEngines.load(
          entry.engine as
            | "celtic-folk-spring@1"
            | "theravada-water@1"
            | "tanzaku-tanabata@1"
            | "yeondeunghoe@1"
            | "furin-wind-chime@1",
        ),
      ready: () => {
        if (host.current) host.current.dataset.ready = "true";
      },
      failed: (error) => latest.current.failed(error),
    });
    return () => {
      session.current?.dispose();
      session.current = null;
    };
  }, []);
  useEffect(() => session.current?.setActive(active), [active]);
  useEffect(
    () => session.current?.setReducedMotion(state.settings.reducedMotion),
    [state.settings.reducedMotion],
  );
  // data-scene and data-stage are styling hooks; the scene lights for the stage too.
  return (
    <div
      className="library-scene-stage"
      data-scene={entry.id}
      data-stage={stage}
      ref={host}
    />
  );
}
/** The scene page's favourite toggle. */
export const SCENE_FAVORITE_LABEL = "收藏";
/**
 * 收藏 as a heart toggle chip beside the 音效／震动 toggles. Its state is the
 * filled heart and aria-pressed, so its name stays the same either way.
 */
export function FavoriteChip({ id, favorite }: { id: string; favorite: boolean }) {
  const { dispatch } = useApp();
  return (
    <button
      type="button"
      className="favorite-chip"
      aria-pressed={favorite}
      onClick={() => dispatch({ type: "scene.favorite", id, favorite: !favorite })}
    >
      <Icon name="heart" />
      {SCENE_FAVORITE_LABEL}
    </button>
  );
}
/** The closing line and the two exits shown when a scene's steps are done. */
export const SCENE_DONE_COPY = "这次体验已经完成，记录已留下。";
export const SCENE_DONE_WISH_CTA = "去心愿看看";
export const SCENE_DONE_CTA = "完成";
/** A 还愿 visit's closing line, and its one exit, back to 来还个愿. */
export const SCENE_RETURN_DONE_COPY = "还愿小仪式已完成，也为这个心愿记了一笔。";
export const SCENE_RETURN_CTA = "继续还愿 · 留下这份心情";
function LoadedScene({
  entry,
  lease,
  wishId,
  failed,
}: {
  entry: CatalogEntry;
  lease?: SceneLease;
  /** On a 还愿 visit: the realized wish the ritual is walked for. */
  wishId?: string;
  failed(error?: unknown): void;
}) {
  const {
    state,
    dispatch,
    active,
    feedback,
    prepareFeedback,
    go,
    launchReward,
    back,
  } = useApp();
  const record = state.sceneRecords.find((r) => r.id === entry.id);
  const progress = record?.progress ?? 0;
  const steps = sceneSteps(entry);
  const [instruction, setInstruction] = useState("轻敲木鱼，让心慢下来");
  /** The wish this visit kept from the scene's wish box, if any. */
  const [keptWish, setKeptWish] = useState<string>();
  const doneCta = useRef<HTMLButtonElement>(null);
  // A 还愿 visit: a ritual's scene, for a wish still waiting on its 还愿.
  const ritual = sceneRitual(entry.id);
  const returnWish = ritual
    ? state.wishes.find(
        (w) => w.id === wishId && w.status === "realized" && !w.archived,
      )
    : undefined;
  // One record per visit, however often the last step reports.
  const [visit] = useState(() => ({ id: uid(), startedAt: now() }));
  const checkpoint = (n: number) => {
    dispatch({ type: "scene.progress", id: entry.id, progress: n });
    // The last step of a 还愿 visit counts for the wish: a session and a
    // note on it, never merit or a collectible (the scene red line).
    if (ritual && returnWish && n >= steps)
      dispatch({
        type: "ritual.scene",
        id: visit.id,
        ritual,
        wishId: returnWish.id,
        startedAt: visit.startedAt,
        at: now(),
      });
  };
  /** The wish to go on fulfilling, once this ritual counts for it. */
  const returnedFor =
    returnWish && hasReturnRitual(state, returnWish) ? returnWish.id : undefined;
  const favoriteChip = (
    <FavoriteChip id={entry.id} favorite={!!record?.favorite} />
  );
  // Each line is a new 心愿, also when the scene was opened from a wish.
  const saveWish = (text: string) => {
    const wish = sceneWish(text, entry.id, uid(), now());
    if (wish && dispatch(wish)) setKeptWish(wish.id);
  };
  // One exit at done: back to 来还个愿 on a 还愿 visit, else to the kept
  // wish, with the slip flying into its new card, or simply back. No merit
  // and no collectible ever: the scene's red line.
  const goSeeWish = () => {
    launchReward({
      kind: "leaf",
      from: rectOf(doneCta.current),
      wishId: keptWish,
      tab: "wishes",
      announce: WISH_WRITE_COPY.saved,
    });
    go({ page: "wishes" });
  };
  const client = useMemo<WoodfishContext["content"] | undefined>(
    () =>
      lease && entry.engine === "woodfish@1"
        ? {
            prepareUpdate: async () => {},
            async load(initialize, options = {}) {
              const pack = woodfishPack(lease.manifest);
              const model = await lease.read("model", options.signal);
              const sound = pack.sound
                ? await lease.read("sound", options.signal)
                : undefined;
              return {
                pack,
                value: await initialize(pack, model, sound),
                confirm: async () => {},
              };
            },
          }
        : undefined,
    [lease],
  );
  return (
    <>
      {returnWish && (
        <p className="scene-caption">这一次，为「{returnWish.title}」还愿。</p>
      )}
      <p className="scene-progress" role="status">
        已完成 {progress} / {steps}
      </p>
      {entry.engine === "woodfish@1" ? (
        <>
          <Woodfish
            sceneId={entry.id}
            contentClient={client}
            pulse={progress}
            active={active}
            reducedMotion={state.settings.reducedMotion}
            view="front"
            disabled={progress >= steps}
            onStrike={() => {
              prepareFeedback();
              checkpoint(Math.min(steps, progress + 1));
              return true;
            }}
            onImpact={feedback}
            onInstruction={setInstruction}
            onFailure={lease ? failed : undefined}
          />
          <p id="woodfish-instruction" className="scene-instruction">
            {instruction}
          </p>
        </>
      ) : (
        <ProceduralScene
          entry={entry}
          progress={progress}
          checkpoint={checkpoint}
          saveWish={saveWish}
          failed={failed}
        />
      )}
      {progress >= steps && (
        <div className="scene-done-row">
          <p className="scene-done">
            {returnedFor ? SCENE_RETURN_DONE_COPY : SCENE_DONE_COPY}
          </p>
          {returnedFor ? (
            // No flight: the note is on the wish already, and the ritual
            // shows as done on 来还个愿.
            <button
              type="button"
              className="button primary"
              onClick={() => go({ page: "fulfill", id: returnedFor })}
            >
              {SCENE_RETURN_CTA}
            </button>
          ) : keptWish ? (
            <button
              type="button"
              className="button primary"
              ref={doneCta}
              onClick={goSeeWish}
            >
              {SCENE_DONE_WISH_CTA}
            </button>
          ) : (
            <button type="button" className="button secondary" onClick={back}>
              {SCENE_DONE_CTA}
            </button>
          )}
        </div>
      )}
      {entry.engine !== "woodfish@1" && (
        // Present from the start (empty), so the confirmation is announced.
        <p className="scene-wish-saved" role="status">
          {keptWish && (
            <>
              {WISH_WRITE_COPY.saved}
              <button
                className="text-button"
                onClick={() => go({ page: "wish", id: keptWish })}
              >
                去看看
              </button>
            </>
          )}
        </p>
      )}
      {entry.engine !== "woodfish@1" ? (
        <FeedbackControls>{favoriteChip}</FeedbackControls>
      ) : (
        <div className="feedback-controls">{favoriteChip}</div>
      )}
    </>
  );
}
export function SceneExperience({
  entry,
  wishId,
}: {
  entry?: CatalogEntry;
  /** Set when the scene is walked as a 还愿 ritual for this wish. */
  wishId?: string;
}) {
  const { library, ready } = useSceneLibrary(),
    { dispatch, back } = useApp();
  const [attempt, setAttempt] = useState(0),
    [progress, setProgress] = useState<SceneProgress>();
  const [loaded, setLoaded] = useState<{
    lease?: SceneLease;
    caption?: string;
  }>();
  const [error, setError] = useState("");
  const cancel = useRef<AbortController>(null);
  const fail = (error?: unknown) => {
    cancel.current?.abort();
    setLoaded(undefined);
    setError(
      error instanceof Error && error.message ? error.message : "场景画面暂不可用",
    );
  };
  useEffect(() => {
    if (!ready || !entry) return;
    const controller = new AbortController();
    cancel.current = controller;
    let lease: SceneLease | undefined;
    setLoaded(undefined);
    setError("");
    setProgress(undefined);
    void (async () => {
      if (!supportsScene(entry.engine))
        throw Error("此场景需要更新 App 后打开");
      // Record the intent before network work; a failed download never erases history.
      if (!dispatch({ type: "scene.visit", entry, at: now() }))
        throw Error("场景记录无法更新");
      if (entry.manifestUrl)
        lease = await library.open(entry, {
          signal: controller.signal,
          onProgress: setProgress,
        });
      let caption: string | undefined;
      if (lease?.manifest.assets.presentation) {
        const value = JSON.parse(
          new TextDecoder().decode(
            await lease.read("presentation", controller.signal),
          ),
        );
        if (
          !value ||
          typeof value.caption !== "string" ||
          value.caption.length > 300
        )
          throw Error("场景文案配置无效");
        caption = value.caption;
      }
      if (!controller.signal.aborted) setLoaded({ lease, caption });
    })().catch((e) => {
      if (!controller.signal.aborted) {
        void lease?.release();
        setError(e instanceof Error && e.message ? e.message : "下载失败");
      }
    });
    return () => {
      controller.abort();
      void lease?.release();
    };
  }, [entry, library, ready, attempt]);
  if (!entry) return <p role="alert">场景信息缺失，请返回目录重试。</p>;
  const failure = error ? describeSceneLoadError(error) : undefined;
  return (
    <section className="scene-experience">
      <h1>{entry.title}</h1>
      <RitualNarrativeBlurb sceneId={entry.id} />
      {failure ? (
        <div className="scene-load-error" role="alert">
          <p>暂时无法打开。记录和进度已保留。</p>
          <p>{failure.reason}</p>
          {failure.detail && (
            <details>
              <summary>查看技术细节</summary>
              <code>{failure.detail}</code>
            </details>
          )}
          <button
            className="button primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            重试打开
          </button>
        </div>
      ) : loaded ? (
        <>
          {loaded.caption && <p className="scene-caption">{loaded.caption}</p>}
          <LoadedScene
            key={attempt}
            entry={entry}
            lease={loaded.lease}
            wishId={wishId}
            failed={fail}
          />
        </>
      ) : (
        <div className="scene-download" role="status">
          <p>
            {progress?.phase === "downloading"
              ? "正在下载并校验场景资源…"
              : "正在准备场景…"}
          </p>
          {progress && progress.totalBytes > 0 && (
            <progress
              value={progress.completedBytes}
              max={progress.totalBytes}
            />
          )}
          <button
            className="button secondary"
            onClick={() => {
              cancel.current?.abort();
              back();
            }}
          >
            取消并返回
          </button>
        </div>
      )}
    </section>
  );
}
