import { WISH_INTENTION_MAX, WISH_TITLE_MAX, type Action } from "@wbr/core";

/**
 * A line written in a scene's wish box, as a new 心愿: never added to an
 * existing wish, even when the scene was opened from one. The line is the
 * title, as on 许个心愿; should it outrun the title, the whole line is kept
 * as the wish's intention too. Category 生活. A blank line keeps nothing.
 */
export function sceneWish(
  text: string,
  sceneId: string,
  id: string,
  at: string,
): Extract<Action, { type: "wish.create" }> | undefined {
  const line = text.trim();
  if (!line) return undefined;
  const title = line.slice(0, WISH_TITLE_MAX).trim();
  return {
    type: "wish.create",
    id,
    title,
    intention: title === line ? "" : line.slice(0, WISH_INTENTION_MAX),
    category: "life",
    sourceSceneId: sceneId,
    at,
  };
}
