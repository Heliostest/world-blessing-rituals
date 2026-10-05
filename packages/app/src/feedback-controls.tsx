import { Icon } from "./art";
import { useApp } from "./context";

/**
 * 音效／震动 toggles shared by the ritual page and procedural scenes. 震动 is
 * left out where the host cannot vibrate (iOS browsers).
 */
export function FeedbackControls() {
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
    </div>
  );
}
