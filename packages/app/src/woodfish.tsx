import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Art } from "./art";
import type { createWoodfishScene } from "./woodfish-scene";
import { isTap } from "./woodfish-input";

export function Woodfish({
  pulse,
  active,
  reducedMotion,
  view,
  disabled,
  onStrike,
  onImpact,
}: {
  pulse: number;
  active: boolean;
  reducedMotion: boolean;
  view: string;
  disabled: boolean;
  onStrike(): boolean;
  onImpact(): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createWoodfishScene> | null>(null);
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
    function failed() {
      if (disposed) return;
      scene.current?.dispose();
      scene.current = null;
      setStatus("fallback");
    }
    import("./woodfish-scene")
      .then(({ createWoodfishScene }) => {
        if (disposed || !host.current) return;
        try {
          scene.current = createWoodfishScene(host.current, {
            ...latest.current,
            ready: () => {
              if (!disposed) setStatus("ready");
            },
            failed,
            impact: () => latest.current.onImpact(),
          });
        } catch {
          failed();
        }
      })
      .catch(failed);
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
      scene.current?.stopFollowing();
    }
  }, [active, disabled]);
  useEffect(
    () => scene.current?.setReducedMotion(reducedMotion),
    [reducedMotion],
  );
  useEffect(() => scene.current?.inspect(view), [view, status]);
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
    scene.current?.movePointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
      event.pointerType !== "mouse",
    );
  }
  function cancelPointer(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    suppressClick.current = true;
    scene.current?.stopFollowing();
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
        if (g.type !== "mouse") scene.current?.stopFollowing();
      }}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={cancelPointer}
      onPointerLeave={() => {
        if (!gesture.current) scene.current?.stopFollowing();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        gesture.current = null;
        suppressClick.current = true;
        scene.current?.stopFollowing();
      }}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.button !== 0 || (event.detail !== 0 && suppressClick.current))
          return;
        if (!onStrike()) return;
        if (status === "ready" && scene.current) scene.current.strike();
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
      </span>
    </button>
  );
}
