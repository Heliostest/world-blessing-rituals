import { useState, useSyncExternalStore } from "react";
import { debugStyles, styleOptions } from "@wbr/scene-runtime/debug-styles";
import "./debug-overlay.css";

export const debugEnabled = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

if (debugEnabled) {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* Preview works without storage. */ }
  debugStyles.enable(storage);
}

export function DebugOverlay() {
  const scenes = useSyncExternalStore(debugStyles.subscribe, debugStyles.getSnapshot);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const scene = scenes.find((item) => item.id === selectedId) ?? scenes[0];
  const selected = scene?.override ?? scene?.defaultStyle;
  const actualLabel = styleOptions.find((style) => style.id === scene?.actual)?.label;

  return (
    <aside className="debug-overlay" aria-label="场景 Shader 调试">
      <button className="debug-overlay-toggle" type="button" aria-expanded={open}
        aria-controls="debug-overlay-panel" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">◈</span> SHADER LAB <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <section id="debug-overlay-panel" className="debug-overlay-panel">
          <header><span>实时风格预览</span><small>THREE.JS</small></header>
          {scene ? <>
            <label className="debug-overlay-label" htmlFor="debug-scene">当前场景</label>
            <select id="debug-scene" value={scene.id} onChange={(event) => setSelectedId(event.target.value)}>
              {scenes.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{item.label}</option>)}
            </select>
            <div className="debug-overlay-presets" role="group" aria-label="Shader 风格">
              {styleOptions.map((style, index) => (
                <button key={style.id} type="button" aria-pressed={selected === style.id}
                  onClick={() => debugStyles.select(scene.id, style.id)}>
                  <span className={`debug-overlay-swatch debug-overlay-swatch-${style.id}`} aria-hidden="true" />
                  <span><strong>{style.label}</strong><small>{style.detail}</small></span>
                  <em>0{index + 1}</em>
                </button>
              ))}
            </div>
            <p className="debug-overlay-status" role="status">
              {scene.actual !== selected ? `Shader 未生效，已回退至${actualLabel}` : `正在使用${actualLabel}`}
              <small>{scene.override === null ? "跟随内容默认值" : "本机调试覆盖 · 已即时应用"}</small>
            </p>
            <button className="debug-overlay-reset" type="button" disabled={scene.override === null}
              onClick={() => debugStyles.select(scene.id, null)}>恢复内容默认</button>
          </> : <p className="debug-overlay-empty">进入一个 Three.js 场景后，即可实时切换风格。</p>}
          <footer>按场景保存在此浏览器，仅在调试模式生效。</footer>
        </section>
      )}
    </aside>
  );
}
