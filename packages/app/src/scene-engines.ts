import { createSceneRegistry, type SceneController } from "@wbr/scene-runtime";
import type { createContentClient } from "@wbr/content";

export type WoodfishContext = {
  sceneId?: string;
  content: ReturnType<typeof createContentClient>;
  decodeSound(bytes: ArrayBuffer): Promise<AudioBuffer>;
  onInstruction(text: string): void;
  impact(sound?: AudioBuffer): void;
};
export interface WoodfishController extends SceneController {
  strike(): void;
  movePointer(x: number, y: number, immediate?: boolean): void;
  stopFollowing(): void;
  inspect(view: string): void;
}
export const sceneEngines = createSceneRegistry({
  "woodfish@1": () =>
    import("./woodfish-scene").then((module) => module.woodfishEngine),
  "celtic-folk-spring@1": () => import("./procedural-scene").then(m => m.proceduralEngine("celtic-folk-spring")),
  "theravada-water@1": () => import("./procedural-scene").then(m => m.proceduralEngine("theravada-water")),
});
