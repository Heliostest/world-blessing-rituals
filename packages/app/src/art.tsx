import { useState, type CSSProperties, type ReactNode } from "react";
import type { RitualId } from "@wbr/core";
import { assetUrl } from "./assets";
type Crop = {
  sheet: "wishes" | "rituals";
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ArtVariant =
  | "default"
  | "home"
  | "play"
  | "complete"
  | "wish"
  | "wish-detail"
  | "fulfill";
// Non-destructive crops from the two supplied 1536 × 1024 references. No redraw.
const crops: Record<string, Crop> = {
  woodfish: { sheet: "rituals", x: 255, y: 760, width: 88, height: 74 },
  crane: { sheet: "rituals", x: 143, y: 755, width: 91, height: 77 },
  lantern: { sheet: "rituals", x: 384, y: 755, width: 76, height: 79 },
  badge: { sheet: "wishes", x: 1062, y: 759, width: 90, height: 89 },
  home: { sheet: "rituals", x: 130, y: 264, width: 353, height: 267 },
  play: { sheet: "rituals", x: 578, y: 382, width: 390, height: 273 },
  complete: { sheet: "rituals", x: 1060, y: 369, width: 361, height: 236 },
  wish: { sheet: "wishes", x: 139, y: 218, width: 345, height: 193 },
  "wish-detail": { sheet: "wishes", x: 600, y: 225, width: 360, height: 285 },
  fulfill: { sheet: "wishes", x: 1070, y: 285, width: 337, height: 173 },
};
export function Art({
  kind,
  small = false,
  variant = "default",
}: {
  kind: RitualId | "badge";
  small?: boolean;
  variant?: ArtVariant;
}) {
  const [failed, setFailed] = useState(false);
  const crop = crops[variant !== "default" ? variant : kind];
  const style = {
    "--crop-ratio": `${crop.width} / ${crop.height}`,
    "--image-width": `${(1536 / crop.width) * 100}%`,
    "--image-height": `${(1024 / crop.height) * 100}%`,
    "--image-left": `${(-crop.x / crop.width) * 100}%`,
    "--image-top": `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;
  return (
    <div
      className={`art art-${kind} art-variant-${variant}${small ? " art-small" : ""}`}
      aria-hidden="true"
      style={style}
    >
      {failed ? (
        <span className="asset-fallback">
          {kind === "badge"
            ? "如愿"
            : kind === "woodfish"
              ? "木鱼"
              : kind === "crane"
                ? "纸鹤"
                : "心愿灯"}
        </span>
      ) : (
        <span className="reference-crop">
          <img
            src={assetUrl(`reference-ui/${crop.sheet}.png`)}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
          />
        </span>
      )}
    </div>
  );
}
export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    today: (
      <>
        <path d="m3 10 9-7 9 7v10H3z" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
    wishes: (
      <>
        <path d="M8 5h8l2 3v10H6V8zM8 5V3h8v2M8 21h8M12 9v6" />
        <path d="M10 12h4" />
      </>
    ),
    world: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />
    ),
    me: (
      <>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2z" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    lock: (
      <>
        <rect x="6" y="10" width="12" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    leaf: (
      <path d="M12 22V6M12 15C3 15 3 7 3 7s10 0 9 8ZM12 11c9 0 9-9 9-9s-10 0-9 9Z" />
    ),
    heart: (
      <path d="M12 21S2 14 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 6-10 13-10 13Z" />
    ),
    work: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V3h8v4M3 12h18M10 10v5h4v-5" />
      </>
    ),
    study: <path d="m2 9 10-5 10 5-10 5zM6 12v6q6 4 12 0v-6M22 9v8" />,
    edit: <path d="m5 16-1 5 5-1L21 8l-4-4zM15 6l4 4" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 3" />
      </>
    ),
    sound: <path d="M3 9h4l5-5v16l-5-5H3zM16 8q5 4 0 8M19 4q9 8 0 16" />,
    haptics: (
      <>
        <rect x="8" y="3" width="8" height="18" rx="2" />
        <path d="M4 7v10M20 7v10" />
      </>
    ),
    share: (
      <>
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="5" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m9 10 6-4M9 14l6 4" />
      </>
    ),
    lotus: (
      <path d="M12 19C4 16 7 8 12 3c5 5 8 13 0 16ZM12 19C3 19 2 13 3 8c6 2 9 6 9 11ZM12 19c9 0 10-6 9-11-6 2-9 6-9 11Z" />
    ),
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
