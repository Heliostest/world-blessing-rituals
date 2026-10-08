import type { ReactNode } from "react";
import { Icon } from "./art";
import { useApp } from "./context";

/**
 * 音效／震动 toggles shared by the ritual page and procedural scenes. 震动 is
 * left out where the host cannot vibrate (iOS browsers). `children` join the
 * same row (a scene's 收藏 chip), wrapping onto a centred line of their own
 * when the toggles fill it.
 */
export function FeedbackControls({ children }: { children?: ReactNode }) {
  const { state, dispatch, canHaptic } = useApp();
  return (
    <div className="feedback-controls">
      {(
        [
          ["sound", "音效"],
          ["haptics", "震动"],
        ] as const
      )
        .filter(([key]) => key !== "haptics" || canHaptic)
        .map(([key, label]) => (
          <label key={key}>
            <Icon name={key} />
            <span>{label}</span>
            <input
              className="switch"
              type="checkbox"
              checked={state.settings[key]}
              onChange={(e) =>
                dispatch({ type: "settings", key, value: e.target.checked })
              }
            />
          </label>
        ))}
      {children}
    </div>
  );
}
