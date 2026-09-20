import { useState } from "react";
import type { RitualId } from "@wbr/core";

// Original conversation images are not available in the thread attachment API.
// Replace null with bundled asset URLs after the user supplies the two references.
export const artwork: Record<RitualId | "badge", string | null> = {
  woodfish: null,
  crane: null,
  lantern: null,
  badge: null,
};
export function Art({
  kind,
  small = false,
}: {
  kind: keyof typeof artwork;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = artwork[kind];
  return (
    <div
      className={`art art-${kind}${small ? " art-small" : ""}`}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <>
          <span className="art-halo" />
          {kind === "woodfish" && (
            <>
              <span className="woodfish-body">
                <i />
              </span>
              <span className="woodfish-stick" />
            </>
          )}
          {kind === "crane" && (
            <span className="paper-crane">
              <i className="wing-left" />
              <i className="wing-right" />
              <i className="crane-neck" />
              <i className="crane-tail" />
            </span>
          )}
          {kind === "lantern" && (
            <span className="lantern">
              <i className="lantern-handle" />
              <i className="lantern-light" />
              <i className="lantern-foot" />
            </span>
          )}
          {kind === "badge" && <span className="wish-badge">如愿</span>}
          <span className="art-shadow" />
        </>
      )}
    </div>
  );
}
export function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    today: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    wishes: (
      <>
        <path d="M8 5h8l2 3v10H6V8zM8 5V3h8v2M8 21h8M12 9v6" />
        <path d="M10 12h4" />
      </>
    ),
    world: (
      <>
        <path d="M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7" />
        <path d="M10 8h4" />
      </>
    ),
    me: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C7 2 2 7 5 15s15 4 15-12ZM5 20 15 9" />
      </>
    ),
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.leaf}
    </svg>
  );
}
