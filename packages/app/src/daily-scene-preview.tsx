import { useEffect, useRef, useState } from "react";
import {
  mountScene,
  type SceneController,
  type SceneEngine,
  type SceneSession,
} from "@wbr/scene-runtime";
import type { CatalogEntry } from "@wbr/content/catalog";
import { useContent, woodfishContent } from "./content";
import { useApp } from "./context";
import type { ProceduralContext } from "./procedural-scene";
import { sceneEngines, type WoodfishContext } from "./scene-engines";
import { SceneIcon } from "./scene-icons";
import { sceneStage } from "./scene-placement";

type EngineId = Parameters<typeof sceneEngines.load>[0];
type PreviewContext = ProceduralContext | WoodfishContext;
/** Mounting (the scene's icon on its sky), drawing, or gone (the plain card). */
export type PreviewStatus = "loading" | "ready" | "failed";

/** Whether this device can draw the 3D scenes at all: three.js needs WebGL2. */
export const canPreviewScenes = () =>
  typeof WebGL2RenderingContext !== "undefined";

/**
 * The woodfish's content as a preview reads it: the model the scene page
 * would load, but no sound to decode, no update fetched in the background
 * and no candidate confirmed. Only a real walk moves the content along.
 */
export function previewContent(
  content: WoodfishContext["content"],
): WoodfishContext["content"] {
  return {
    prepareUpdate: async () => {},
    async load(initialize, options) {
      const lease = await content.load(
        (pack, model) => initialize(pack, model),
        options,
      );
      return { ...lease, confirm: async () => {} };
    },
  };
}

/**
 * 今日's main walk, live: the day's scene mounted read-only on a small island
 * stage. It stands at the first step and keeps nothing: no progress, no
 * visit, no wish, no sound. Its HUD stays on the scene page, and the stage is
 * inert, so a tap falls through to the card, which opens the walk. It draws
 * only while the App is active and the stage is on screen. Without WebGL2,
 * or once the scene fails, it is gone and the card is the plain row again.
 */
export function DailyScenePreview({ entry }: { entry: CatalogEntry }) {
  const frame = useRef<HTMLSpanElement>(null),
    host = useRef<HTMLDivElement>(null),
    session = useRef<SceneSession<SceneController>>(null);
  const { active, state } = useApp();
  const environment = useContent();
  const reducedMotion = state.settings.reducedMotion;
  const [status, setStatus] = useState<PreviewStatus>(() =>
    canPreviewScenes() ? "loading" : "failed",
  );
  const [onScreen, setOnScreen] = useState(true);
  const running = active && onScreen;
  const stage = sceneStage(entry.id);
  useEffect(() => {
    if (!host.current) return;
    const context: PreviewContext =
      entry.engine === "woodfish@1"
        ? {
            sceneId: entry.id,
            content: previewContent(woodfishContent(environment)),
            // Never called: previewContent hands the engine no sound.
            decodeSound: () => Promise.reject(Error("A preview has no sound")),
            onInstruction: () => {},
            impact: () => {},
          }
        : {
            progress: 0,
            checkpoint: () => {},
            sceneId: entry.id,
            isSoundEnabled: () => false,
            stage,
          };
    session.current = mountScene<PreviewContext, SceneController>({
      host: host.current,
      active: running,
      reducedMotion,
      context,
      load: () =>
        sceneEngines.load(entry.engine as EngineId) as Promise<
          SceneEngine<PreviewContext, SceneController>
        >,
      ready: () => setStatus("ready"),
      failed: () => setStatus("failed"),
    });
    return () => {
      session.current?.dispose();
      session.current = null;
    };
  }, []);
  useEffect(() => session.current?.setActive(running), [running]);
  useEffect(
    () => session.current?.setReducedMotion(reducedMotion),
    [reducedMotion],
  );
  // Scrolled off (down to the picks on a short screen): no frames drawn.
  useEffect(() => {
    if (!frame.current || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((seen) =>
      setOnScreen(seen[seen.length - 1].isIntersecting),
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  if (status === "failed") return null;
  return (
    <span
      className="daily-set-preview"
      data-status={status}
      ref={frame}
      inert
      aria-hidden="true"
    >
      {/* data-scene and data-stage paint the scene page's sky for it. */}
      <div
        className="library-scene-stage daily-set-preview-stage"
        data-scene={entry.id}
        data-stage={stage}
        ref={host}
      />
      <span className="daily-set-preview-icon">
        <SceneIcon id={entry.id} />
      </span>
    </span>
  );
}
