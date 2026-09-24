import * as Gestures from "@wbr/gestures";
import * as Shared from "@wbr/shared";
import { loadScene } from "@wbr/scenes";
import type { SceneController, SceneEngine } from "@wbr/scene-runtime";
export type ProceduralContext = {
  progress: number;
  checkpoint(progress: number): void;
  sceneId: string;
};

/** Adapts two independent interaction implementations to the shared lifecycle. */
export async function proceduralEngine(
  id: string,
): Promise<SceneEngine<ProceduralContext, SceneController>> {
  const module = await loadScene(id);
  return {
    create(host, context, options) {
      const canvas = document.createElement("canvas"),
        overlay = document.createElement("div");
      canvas.className = "scene-canvas";
      overlay.className = "scene-overlay-host";
      host.replaceChildren(canvas, overlay);
      let active = options.active,
        reduced = options.reducedMotion,
        disposed = false,
        frame = 0;
      const instance = module.create({
        canvas,
        overlay,
        gestures: Gestures,
        shared: Shared,
        initialProgress: context.progress,
        onProgress: context.checkpoint,
        sceneId: context.sceneId,
        isActive: () => active && !disposed,
        isReducedMotion: () => reduced,
      });
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        canvas.removeEventListener("webglcontextlost", lost);
        instance.dispose();
        host.replaceChildren();
      };
      const lost = (event: Event) => {
        event.preventDefault();
        options.failed(Error("Graphics context lost"));
      };
      canvas.addEventListener("webglcontextlost", lost);
      let last = performance.now();
      function tick(now: number) {
        frame = 0;
        if (disposed || !active) return;
        try {
          instance.update(Math.min((now - last) / 1000, 0.05));
          last = now;
        } catch (error) {
          options.failed(error);
          return;
        }
        frame = requestAnimationFrame(tick);
      }
      function setActive(value: boolean) {
        active = value;
        overlay.inert = !value;
        cancelAnimationFrame(frame);
        frame = 0;
        if (value && !disposed) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      }
      try {
        instance.start();
        instance.update(0);
        setActive(active);
        options.ready();
      } catch (error) {
        dispose();
        throw error;
      }
      return {
        dispose,
        setActive,
        setReducedMotion(value) {
          reduced = value;
        },
      };
    },
  };
}
