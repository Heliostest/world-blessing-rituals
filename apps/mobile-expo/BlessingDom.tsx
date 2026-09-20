"use dom";
import { useMemo } from "react";
import { BlessingApp } from "@wbr/app";
import "@wbr/app/style.css";
export default function BlessingDom({
  readSave,
  writeSave,
  haptic,
  onCanGoBack,
  active,
  backRequest,
  dom: _dom,
}: {
  readSave(): Promise<string | null>;
  writeSave(raw: string): Promise<void>;
  haptic(): Promise<void>;
  onCanGoBack(value: boolean): Promise<void>;
  active: boolean;
  backRequest: number;
  dom?: import("expo/dom").DOMProps;
}) {
  // DOM bridge proxies can change when native props update; keep a stable host.
  const actions = useMemo(() => ({ readSave, writeSave, haptic }), []);
  actions.readSave = readSave;
  actions.writeSave = writeSave;
  actions.haptic = haptic;
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
      active={active}
      backRequest={backRequest}
      onCanGoBack={onCanGoBack}
    />
  );
}
