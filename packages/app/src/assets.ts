declare const process: { env: { EXPO_BASE_URL?: string } };
/** Expo embeds public resources next to its DOM HTML; Vite serves them at /. */
export function assetUrl(file: string) {
  const base = process.env.EXPO_BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${file.replace(/^\/+/, "")}`;
}
export const fontStyles = `@font-face{font-family:'Blessing Sans';src:url('${assetUrl("fonts/noto-sans-sc.woff2")}') format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}`;
