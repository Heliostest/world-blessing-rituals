import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Art } from "./art";
import { mountScene, type SceneSession } from "@wbr/scene-runtime";
import {
  sceneEngines,
  type WoodfishController,
  type WoodfishContext,
} from "./scene-engines";
import { isTap } from "./woodfish-input";
import { useContent, woodfishContent } from "./content";
import { useApp } from "./context";

export function Woodfish({
  pulse,
  active,
  reducedMotion,
  view,
  disabled,
  onStrike,
  onImpact,
  onInstruction,
}: {
  pulse: number;
  active: boolean;
  reducedMotion: boolean;
  view: string;
  disabled: boolean;
  onStrike(): boolean;
  onImpact(sound?: AudioBuffer): void;
  onInstruction(text: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneSession<WoodfishController> | null>(null);
  const environment = useContent();
  const { decodeSound } = useApp();
  const latest = useRef({ active, reducedMotion, onImpact });
  latest.current = { active, reducedMotion, onImpact };
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    distance: number;
    at: number;
    type: string;
    cancelled: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  useEffect(() => {
    let disposed = false;
    if (!host.current) return;
    scene.current = mountScene<WoodfishContext, WoodfishController>({
      host: host.current,
      load: () => sceneEngines.load("woodfish@1"),
      context: {
        content: woodfishContent(environment),
        decodeSound,
        onInstruction,
        impact: (sound) => latest.current.onImpact(sound),
      },
      active: latest.current.active,
      reducedMotion: latest.current.reducedMotion,
      ready: () => {
        if (!disposed) setStatus("ready");
      },
      failed: () => {
        if (!disposed) setStatus("fallback");
      },
    });
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => scene.current?.setActive(active), [active]);
  useEffect(() => {
    if (!active || disabled) {
      gesture.current = null;
      suppressClick.current = true;
      scene.current?.controller?.stopFollowing();
    }
  }, [active, disabled]);
  useEffect(
    () => scene.current?.setReducedMotion(reducedMotion),
    [reducedMotion],
  );
  useEffect(() => scene.current?.controller?.inspect(view), [view, status]);
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || !active) return;
    const g = gesture.current;
    if (g && g.id === event.pointerId)
      g.distance = Math.max(
        g.distance,
        Math.hypot(event.clientX - g.x, event.clientY - g.y),
      );
    if (event.pointerType !== "mouse" && (!g || g.id !== event.pointerId))
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current?.controller?.movePointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
      event.pointerType !== "mouse",
    );
  }
  function cancelPointer(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    suppressClick.current = true;
    scene.current?.controller?.stopFollowing();
  }
  return (
    <button
      className="ritual-object woodfish-object"
      aria-label={disabled ? "仪式步骤已完成" : "轻敲木鱼"}
      disabled={disabled || !active}
      aria-describedby="woodfish-instruction"
      onPointerDown={(event) => {
        if (!event.isPrimary) {
          if (gesture.current) gesture.current.cancelled = true;
          return;
        }
        if (disabled || !active || event.button !== 0 || gesture.current)
          return;
        suppressClick.current = false;
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          distance: 0,
          at: performance.now(),
          type: event.pointerType,
          cancelled: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={move}
      onPointerUp={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        g.distance = Math.max(
          g.distance,
          Math.hypot(event.clientX - g.x, event.clientY - g.y),
        );
        suppressClick.current = !isTap({
          distance: g.distance,
          elapsed: g.type === "mouse" ? 0 : performance.now() - g.at,
          cancelled: g.cancelled,
        });
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (g.type !== "mouse") scene.current?.controller?.stopFollowing();
      }}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={cancelPointer}
      onPointerLeave={() => {
        if (!gesture.current) scene.current?.controller?.stopFollowing();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        gesture.current = null;
        suppressClick.current = true;
        scene.current?.controller?.stopFollowing();
      }}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.button !== 0 || (event.detail !== 0 && suppressClick.current))
          return;
        if (!onStrike()) return;
        if (status === "ready" && scene.current?.controller)
          scene.current.controller.strike();
        else onImpact();
      }}
    >
      <span className="woodfish-visual" data-renderer={status}>
        <span
          key={status === "ready" ? "static" : pulse}
          className={`woodfish-fallback ${pulse && status !== "ready" ? "object-bounce" : ""}`}
          aria-hidden="true"
        >
          <Art kind="woodfish" variant="play" />
        </span>
        <div ref={host} className="woodfish-canvas" aria-hidden="true" />
        {status === "fallback" && (
          <span className="woodfish-status">轻量模式 · 依然可以轻敲</span>
        )}
        {status === "loading" && (
          <span className="woodfish-status">正在布置小天地…</span>
        )}
      </span>
    </button>
  );
}
