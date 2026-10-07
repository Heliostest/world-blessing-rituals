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
import { WISH_WRITE_COPY } from "@wbr/gestures";
import type { WoodfishContext } from "./scene-engines";
import { sceneEngines } from "./scene-engines";
import { now, uid, useApp } from "./context";
import { supportsScene, useSceneLibrary, woodfishPack } from "./scene-library";
import { Woodfish } from "./woodfish";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { FeedbackControls } from "./feedback-controls";
import { describeSceneLoadError } from "./scene-load-error";
import { sceneWish } from "./scene-wish";
import { sceneStage } from "./scene-placement";

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
/** Checkpoints a scene reports: woodfish strikes, or the three steps of a procedural scene. */
const sceneSteps = (entry: CatalogEntry) => (entry.engine === "woodfish@1" ? 12 : 3);
function LoadedScene({
  entry,
  lease,
  failed,
}: {
  entry: CatalogEntry;
  lease?: SceneLease;
  failed(error?: unknown): void;
}) {
  const { state, dispatch, active, feedback, prepareFeedback, go } = useApp();
  const record = state.sceneRecords.find((r) => r.id === entry.id);
  const progress = record?.progress ?? 0;
  const steps = sceneSteps(entry);
  const [instruction, setInstruction] = useState("轻敲木鱼，让心慢下来");
  /** The wish this visit kept from the scene's wish box, if any. */
  const [keptWish, setKeptWish] = useState<string>();
  const checkpoint = (n: number) =>
    dispatch({ type: "scene.progress", id: entry.id, progress: n });
  // Each line is a new 心愿, also when the scene was opened from a wish.
  const saveWish = (text: string) => {
    const wish = sceneWish(text, entry.id, uid(), now());
    if (wish && dispatch(wish)) setKeptWish(wish.id);
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
          <p id="woodfish-instruction">{instruction}</p>
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
      {entry.engine !== "woodfish@1" && <FeedbackControls />}
      <button
        className="text-button"
        onClick={() =>
          dispatch({
            type: "scene.favorite",
            id: entry.id,
            favorite: !record?.favorite,
          })
        }
      >
        {record?.favorite ? "取消收藏" : "收藏场景"}
      </button>
      {progress >= steps && (
        <p>这次体验已经完成，记录已留下。</p>
      )}
    </>
  );
}
export function SceneExperience({ entry }: { entry?: CatalogEntry }) {
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
          <p>{loaded.caption}</p>
          <LoadedScene
            key={attempt}
            entry={entry}
            lease={loaded.lease}
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
