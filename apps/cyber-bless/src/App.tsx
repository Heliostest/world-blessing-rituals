import { lazy, Suspense } from "react";
import { BlessingApp } from "@wbr/app";
import { browserHost } from "@wbr/runtime";
import "@wbr/app/style.css";
import { DebugOverlay, debugEnabled } from "./DebugOverlay";

const host = browserHost();
const DevApp = lazy(() => import("./DevApp"));

export function App() {
  if (window.location.pathname.startsWith("/dev"))
    return (
      <>
        <Suspense fallback={<p>正在打开开发工具…</p>}>
          <DevApp />
        </Suspense>
        {debugEnabled && <DebugOverlay />}
      </>
    );
  return (
    <>
      <BlessingApp
        host={host}
        content={{
          manifestUrl:
            import.meta.env.VITE_SCENE_MANIFEST_URL ||
            (import.meta.env.DEV ? "/scene-content/woodfish.json" : undefined),
        }}
      />
      {debugEnabled && <DebugOverlay />}
    </>
  );
}
