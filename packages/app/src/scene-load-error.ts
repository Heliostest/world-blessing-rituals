/** Han characters: our own messages, written for people, not for logs. */
const HAN = /\p{Script=Han}/u;

export const SCENE_LOAD_ERROR_COPY = {
  offline: "网络好像断开了。连上网络后点「重试打开」；仍打不开时，刷新页面再试。",
  graphics: "画面暂时没能显示出来。点「重试打开」，或刷新页面再试。",
  upgrade: "此场景需要更新 App 后打开。",
  other:
    "场景资源没能准备好，可能是网络不稳。点「重试打开」；仍打不开时，刷新页面再试。",
} as const;

/**
 * What to say when a scene would not open: always Chinese, with a way on.
 * Our own errors already read that way; a browser's or the content layer's
 * English message (often with a long URL) is kept only as `detail`.
 */
export function describeSceneLoadError(
  message: string,
  online = typeof navigator === "undefined" || navigator.onLine !== false,
): { reason: string; detail?: string } {
  if (HAN.test(message)) return { reason: message };
  const detail = message.trim() || undefined;
  const reason = !online
    ? SCENE_LOAD_ERROR_COPY.offline
    : /context lost/i.test(message)
      ? SCENE_LOAD_ERROR_COPY.graphics
      : /upgrade the app/i.test(message)
        ? SCENE_LOAD_ERROR_COPY.upgrade
        : SCENE_LOAD_ERROR_COPY.other;
  return { reason, detail };
}
