import { createContext, useContext } from "react";
import { createContentClient, type ContentIO } from "@wbr/content";
import { bundledWoodfish } from "@wbr/content/bundled";
import { createWebContentIO } from "@wbr/content/web";
import { assetUrl } from "./assets";
import { validateWoodfishGLB } from "@wbr/content/glb";

export type ContentEnvironment = { io?: ContentIO; manifestUrl?: string; catalogUrl?: string };
export const ContentContext = createContext<ContentEnvironment>({});
export const useContent = () => useContext(ContentContext);
let browserIO: ContentIO | undefined;
export const contentIO = (environment: ContentEnvironment) => environment.io ?? (browserIO ??= createWebContentIO());
const clients = new WeakMap<
  ContentIO,
  Map<string, ReturnType<typeof createContentClient>>
>();
export function woodfishContent(environment: ContentEnvironment) {
  const io = contentIO(environment);
  const base = new URL(assetUrl(""), window.location.href).href;
  const url = environment.manifestUrl
    ? new URL(environment.manifestUrl, window.location.href).href
    : undefined;
  const key = JSON.stringify([base, url]);
  let scoped = clients.get(io);
  if (!scoped) {
    scoped = new Map();
    clients.set(io, scoped);
  }
  let client = scoped.get(key);
  if (!client) {
    client = createContentClient({
      io,
      bundled: bundledWoodfish,
      bundledBase: base,
      manifestUrl: url,
      validatePrepared: (pack, bytes) =>
        validateWoodfishGLB(bytes, pack.bindings),
    });
    scoped.set(key, client);
  }
  return client;
}
