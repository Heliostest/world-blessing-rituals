import { useEffect, useRef } from "react";
import { Art, Icon } from "./art";
import { SceneArt } from "./scene-icons";
import {
  flightKeyframes,
  rectOf,
  resolveTarget,
  type RewardFlight,
} from "./reward-flight";

/**
 * The flying sticker itself: a fixed, aria-hidden layer above the dock that
 * outlives `<main>`'s per-route remount. It runs one FLIP trip with the Web
 * Animations API and reports the landing exactly once — never through
 * animationend, which the reduced-motion kill switch silences, but through
 * the WAAPI finished promise with a timer cap. A tap anywhere finishes the
 * trip early (the data is already settled; the flight is only garnish).
 */
export function RewardFlightLayer({
  flight,
  reducedMotion,
  onLand,
}: {
  flight: RewardFlight;
  reducedMotion: boolean;
  onLand(): void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ghostOuter = outer.current,
      ghostInner = inner.current;
    if (!ghostOuter || !ghostInner) return;
    let done = false,
      capTimer = 0,
      raf = 0,
      leafAnimations: Animation[] = [];
    /** One leaf note to 心愿, after the item itself has landed. */
    const flyLeaf = (fromX: number, fromY: number) => {
      const tab = document.querySelector('[data-tab="wishes"]');
      if (
        !flight.wishId ||
        !tab ||
        typeof ghostOuter.animate !== "function"
      ) {
        finish();
        return;
      }
      ghostOuter.className = "reward-ghost reward-ghost--leaf";
      ghostInner.style.transform = "";
      const to = rectOf(tab);
      const plan = flightKeyframes(
        { x: fromX, y: fromY, width: 28, height: 28 },
        { x: to.x, y: to.y, width: 28, height: 28 },
      );
      try {
        leafAnimations = [
          ghostOuter.animate(plan.outer, {
            duration: 450,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }),
          ghostInner.animate(plan.inner, {
            duration: 450,
            easing: "cubic-bezier(0.3, -0.7, 0.7, 1)",
            fill: "forwards",
          }),
        ];
      } catch {
        finish();
        return;
      }
      void Promise.all(leafAnimations.map((a) => a.finished))
        .then(finish)
        .catch(finish);
      capTimer = window.setTimeout(finish, 1200);
    };
    function finish() {
      if (done) return;
      done = true;
      window.clearTimeout(capTimer);
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", finish, true);
      onLand();
    }
    document.addEventListener("pointerdown", finish, true);
    const target = resolveTarget(flight);
    // Nothing to animate — reduced motion, a WebView without Web
    // Animations, no sticker to fly from, or no home to fly to (the
    // shelf→tab fallback also found nothing): reveal the item at once.
    if (
      reducedMotion ||
      typeof ghostOuter.animate !== "function" ||
      !flight.from.width ||
      !flight.from.height ||
      !target.el
    ) {
      finish();
      return () => finish();
    }
    // First: the ghost sits exactly on the measured sticker. The new page
    // is already rendered — launchReward() is called right before go().
    const from = flight.from;
    ghostOuter.style.left = `${from.x}px`;
    ghostOuter.style.top = `${from.y}px`;
    ghostOuter.style.width = `${from.width}px`;
    ghostOuter.style.height = `${from.height}px`;
    ghostOuter.style.visibility = "visible";
    // Last: one frame later, the live target rect (the dock is sticky on
    // desktop; the slot has just mounted).
    raf = requestAnimationFrame(() => {
      if (done) return;
      const to = rectOf(target.el);
      const plan = flightKeyframes(from, to);
      let animations: Animation[];
      try {
        animations = [
          ghostOuter.animate(plan.outer, {
            duration: plan.duration,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards",
          }),
          ghostInner.animate(plan.inner, {
            duration: plan.duration,
            easing: "cubic-bezier(0.3, -0.7, 0.7, 1)",
            fill: "forwards",
          }),
        ];
      } catch {
        finish();
        return;
      }
      const landed = () => {
        if (done) return;
        const bounds = ghostOuter.getBoundingClientRect();
        flyLeaf(
          bounds.left || to.x + to.width / 2,
          bounds.top || to.y + to.height / 2,
        );
      };
      void Promise.all(animations.map((a) => a.finished))
        .then(landed)
        .catch(landed);
      capTimer = window.setTimeout(landed, plan.duration + 700);
    });
    return () => finish();
  }, [flight, reducedMotion, onLand]);
  return (
    <div className="reward-flight-layer" aria-hidden="true">
      <div
        className={`reward-ghost${flight.kind === "leaf" ? " reward-ghost--leaf" : ""}`}
        ref={outer}
      >
        <div className="reward-ghost-arc" ref={inner}>
          {flight.kind === "leaf" ? (
            <Icon name="leaf" />
          ) : flight.kind === "scene" ? (
            <SceneArt id={flight.sceneId!} />
          ) : (
            <Art kind={flight.kind} small />
          )}
        </div>
      </div>
    </div>
  );
}
