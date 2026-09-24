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
import type { WoodfishContext } from "./scene-engines";
import { sceneEngines } from "./scene-engines";
import { now, useApp } from "./context";
import { supportsScene, useSceneLibrary, woodfishPack } from "./scene-library";
import { Woodfish } from "./woodfish";

function ProceduralScene({
  entry,
  progress,
  checkpoint,
  failed,
}: {
  entry: CatalogEntry;
  progress: number;
  checkpoint(n: number): void;
  failed(error?: unknown): void;
}) {
  const host = useRef<HTMLDivElement>(null),
    session = useRef<SceneSession<SceneController>>(null);
  const { active, state } = useApp();
  const latest = useRef({ checkpoint, failed });
  latest.current = { checkpoint, failed };
  useEffect(() => {
    session.current = mountScene({
      host: host.current!,
      active,
      reducedMotion: state.settings.reducedMotion,
      context: {
        progress,
        checkpoint: (n: number) => latest.current.checkpoint(n),
        sceneId: entry.id,
      },
      load: () =>
        sceneEngines.load(
          entry.engine as "celtic-folk-spring@1" | "theravada-water@1",
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
  return <div className="library-scene-stage" ref={host} />;
}
function LoadedScene({
  entry,
  lease,
  failed,
}: {
  entry: CatalogEntry;
  lease?: SceneLease;
  failed(error?: unknown): void;
}) {
  const { state, dispatch, active, feedback, prepareFeedback } = useApp();
  const record = state.sceneRecords.find((r) => r.id === entry.id);
  const progress = record?.progress ?? 0;
  const [instruction, setInstruction] = useState("轻敲木鱼，让心慢下来");
  const checkpoint = (n: number) =>
    dispatch({ type: "scene.progress", id: entry.id, progress: n });
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
        已完成 {progress} / {entry.engine === "woodfish@1" ? 12 : 3}
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
            disabled={progress >= 12}
            onStrike={() => {
              prepareFeedback();
              checkpoint(Math.min(12, progress + 1));
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
          failed={failed}
        />
      )}
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
      {progress >= (entry.engine === "woodfish@1" ? 12 : 3) && (
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
    setError(error instanceof Error ? error.message : "场景画面暂不可用");
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
        setError(e instanceof Error ? e.message : "下载失败");
      }
    });
    return () => {
      controller.abort();
      void lease?.release();
    };
  }, [entry, library, ready, attempt]);
  if (!entry) return <p role="alert">场景信息缺失，请返回目录重试。</p>;
  return (
    <section className="scene-experience">
      <h1>{entry.title}</h1>
      {error ? (
        <div className="scene-load-error" role="alert">
          <p>暂时无法打开。记录和进度已保留。</p>
          <details>
            <summary>查看原因</summary>
            {error}
          </details>
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
