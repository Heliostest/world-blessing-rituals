"use dom";
import { useEffect, useMemo } from "react";
import { BlessingApp } from "@wbr/app";
import {
  createNativeContentIO,
  type NativeContentBridge,
} from "@wbr/content/native-web";
import "@wbr/app/style.css";
export default function BlessingDom({
  readSave,
  writeSave,
  haptic,
  onCanGoBack,
  active,
  backRequest,
  readContentHistory,
  readSceneAsset,
  writeContentHistory,
  fetchSceneAsset,
  cancelSceneAsset,
  protectSceneAssets,
  releaseSceneAssets,
  maintainSceneCache,
  manifestUrl,
  catalogUrl,
  dom: _dom,
}: NativeContentBridge & {
  readSave(): Promise<string | null>;
  writeSave(raw: string): Promise<void>;
  haptic(): Promise<void>;
  onCanGoBack(value: boolean): Promise<void>;
  active: boolean;
  backRequest: number;
  manifestUrl: string;
  catalogUrl: string;
  dom?: import("expo/dom").DOMProps;
}) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') ?? document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);
  // DOM bridge proxies can change when native props update; keep a stable host.
  const actions = useMemo(() => ({ readSave, writeSave, haptic }), []);
  actions.readSave = readSave;
  actions.writeSave = writeSave;
  actions.haptic = haptic;
  const contentActions = useMemo(
    () => ({
      readContentHistory,
      readSceneAsset,
      writeContentHistory,
      fetchSceneAsset,
      cancelSceneAsset,
      protectSceneAssets,
      releaseSceneAssets,
      maintainSceneCache,
    }),
    [],
  );
  Object.assign(contentActions, {
    readContentHistory,
    readSceneAsset,
    writeContentHistory,
    fetchSceneAsset,
    cancelSceneAsset,
    protectSceneAssets,
    releaseSceneAssets,
    maintainSceneCache,
  });
  const contentIO = useMemo(
    () => createNativeContentIO(contentActions),
    [contentActions],
  );
  const host = useMemo(
    () => ({
      read: () => actions.readSave(),
      write: (raw: string) => actions.writeSave(raw),
      haptic: () => actions.haptic(),
    }),
    [actions],
  );
  return (
    <BlessingApp
      host={host}
      content={{
        io: contentIO,
        manifestUrl: manifestUrl || undefined,
        catalogUrl: catalogUrl || undefined,
      }}
      active={active}
      backRequest={backRequest}
      onCanGoBack={onCanGoBack}
    />
  );
}
