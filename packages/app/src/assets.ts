declare const process: { env: { EXPO_BASE_URL?: string } };
/** Expo embeds public resources next to its DOM HTML; Vite serves them at /. */
export function assetUrl(file: string) {
  const base = process.env.EXPO_BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${file.replace(/^\/+/, "")}`;
}
const face = (family: string, file: string, weight: string, extra = "") =>
  `@font-face{font-family:'${family}';src:url('${assetUrl(`fonts/${file}`)}') format('woff2');font-weight:${weight};font-style:normal;font-display:swap;${extra}}`;
/** Blessing Sans (Noto Sans SC) covers CJK. Nunito's latin subset, first in
 * --font-round, makes digits and Latin rounded on every device; its
 * unicode-range lets CJK fall through to the rounded system faces. */
export const fontStyles =
  face("Blessing Sans", "noto-sans-sc.woff2", "100 900") +
  [500, 700, 900]
    .map((weight) =>
      face("Nunito", `nunito-latin-${weight}-normal.woff2`, `${weight}`, "unicode-range:U+0000-00FF;"),
    )
    .join("");
