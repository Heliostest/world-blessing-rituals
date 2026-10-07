import type { ReactNode } from "react";

/**
 * Drawn scene icons, keyed by scene id, so a scene looks the same on 今日 and
 * 心愿. Flat cel fills with one shade band, then the ink line on top, in the
 * ink colour the 3D scenes' toon pass draws (0x584235). No emoji or Unicode
 * symbols: they render differently on every platform.
 */
const INK = "#584235";

/** A cel part: a flat fill, its shade/highlight shapes, then its ink line. */
function Part({
  d,
  fill,
  evenodd = false,
  children,
}: {
  d: string;
  fill: string;
  evenodd?: boolean;
  children?: ReactNode;
}) {
  const rule = evenodd ? "evenodd" : undefined;
  return (
    <>
      <path d={d} fill={fill} fillRule={rule} />
      {children}
      <path d={d} fill="none" stroke={INK} strokeWidth={2.2} />
    </>
  );
}

/** An inked stroke with a coloured core (cords, twigs, ribbons). */
function Cord({ d, color, width = 2 }: { d: string; color: string; width?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 2.2} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} />
    </>
  );
}

const sceneIcons: Record<string, ReactNode> = {
  // 风铃一响: a glass bell with a painted bloom and its paper strip.
  "furin-wind-chime": (
    <>
      <path d="M24 2.5v7" stroke={INK} strokeWidth={2} />
      <path d="M24 25.5v6.5" stroke={INK} strokeWidth={1.8} />
      <Part d="M13 25.5C13 15.5 17.8 9 24 9s11 6.5 11 16.5Z" fill="#d9f2fc">
        <path d="M28.2 10.5c3.9 2.6 6.5 7.6 6.8 15h-4.8c-.1-6.4-.7-11.1-2-15Z" fill="#a9dcf3" />
        <path d="M17.4 21c.2-3.8 1.9-6.9 4.3-8.4" fill="none" stroke="#fff" strokeWidth={2.2} />
        <circle cx="21.6" cy="20.2" r="2" fill="#ff8f86" />
        <circle cx="26.8" cy="17.4" r="1.5" fill="#ffb08f" />
      </Part>
      <Part d="M19.6 32h8.8v12.4a1.6 1.6 0 0 1-1.6 1.6h-5.6a1.6 1.6 0 0 1-1.6-1.6Z" fill="#ffd3dd">
        <path d="M25.8 32h2.6v12.6a1.4 1.4 0 0 1-1.4 1.4h-1.2Z" fill="#f7adc0" />
      </Part>
    </>
  ),
  // 庭前一礼: a vermilion torii.
  "shinto-torii": (
    <>
      <Part d="M12.5 15h5v28h-5Z" fill="#ef5b3f">
        <path d="M15.6 15h1.9v28h-1.9Z" fill="#c9442d" />
      </Part>
      <Part d="M30.5 15h5v28h-5Z" fill="#ef5b3f">
        <path d="M33.6 15h1.9v28h-1.9Z" fill="#c9442d" />
      </Part>
      <Part d="M8 22h32v4.4H8Z" fill="#ef5b3f">
        <path d="M8 24.8h32v1.6H8Z" fill="#c9442d" />
      </Part>
      <Part d="M3.5 10Q24 5 44.5 10l-1.3 5.4Q24 11 4.8 15.4Z" fill="#ef5b3f">
        <path d="M3.5 10Q24 5 44.5 10l-.5 2.3Q24 7.6 4 12.3Z" fill="#5a3a26" />
        <path d="M4.5 14Q24 9.8 43.5 14l-.3 1.4Q24 11 4.8 15.4Z" fill="#c9442d" />
      </Part>
      <Part d="M11.8 39.4h6.4v4.4h-6.4Z" fill="#5a3a26" />
      <Part d="M29.8 39.4h6.4v4.4h-6.4Z" fill="#5a3a26" />
    </>
  ),
  // 廊前轻转: a prayer drum turning on its axle in a wooden frame.
  "tibetan-wheel": (
    <>
      <path d="M24 8v32" stroke={INK} strokeWidth={2.4} />
      <Part d="M9 4h30a1.5 1.5 0 0 1 1.5 1.5v1.8A1.5 1.5 0 0 1 39 8.8H9a1.5 1.5 0 0 1-1.5-1.5V5.5A1.5 1.5 0 0 1 9 4Z" fill="#c98f5a" />
      <Part d="M9 39.4h30a1.5 1.5 0 0 1 1.5 1.5v1.8a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-1.8A1.5 1.5 0 0 1 9 39.4Z" fill="#c98f5a" />
      <Part d="M12.5 15v18a11.5 3.2 0 0 0 23 0V15Z" fill="#e8604f">
        <path d="M12.5 15a11.5 3.2 0 0 0 23 0v3.6a11.5 3.2 0 0 1-23 0Z" fill="#f6c453" />
        <path d="M12.5 29.4a11.5 3.2 0 0 0 23 0V33a11.5 3.2 0 0 1-23 0Z" fill="#f6c453" />
        <circle cx="17.6" cy="24.6" r="1.6" fill="#f6c453" />
        <circle cx="24" cy="25.4" r="1.6" fill="#f6c453" />
        <circle cx="30.4" cy="24.6" r="1.6" fill="#f6c453" />
        <path d="M30.8 17.7v17.6a11.5 3.2 0 0 0 4.7-2.3V15a11.5 3.2 0 0 1-4.7 2.7Z" fill="#7a2a1a33" />
        <path d="M15.6 21v7" stroke="#ffffffb3" strokeWidth={1.8} />
      </Part>
      <Part d="M12.5 15a11.5 3.2 0 0 1 23 0a11.5 3.2 0 0 1-23 0Z" fill="#ffd97a" />
    </>
  ),
  // 短册系竹: a paper strip tied to a bamboo twig.
  "tanzaku-tanabata": (
    <>
      <Part d="M10.5 5a2.5 2.5 0 0 1 5 0v40.5h-5Z" fill="#8fd17a">
        <path d="M13.8 2.5h1.7v43h-1.7Z" fill="#5aa548" />
      </Part>
      <path d="M10.5 16.5h5M10.5 29.5h5M10.5 41h5" stroke={INK} strokeWidth={1.6} />
      <Cord d="M15 13.5Q28 8 42 9.5" color="#5aa548" />
      <Part d="M33 9.8C35 5.2 39.4 3 44.5 3.6C42.6 8.2 38.2 10.4 33 9.8Z" fill="#8fd17a" />
      <Part d="M15.5 21.5c4-2.6 9-2.4 12 0c-4 2.8-8.9 2.6-12 0Z" fill="#b6e5a6" />
      <g transform="rotate(5 30 11)">
        <path d="M30 11v5.5" stroke={INK} strokeWidth={1.6} />
        <Part d="M25.5 16.5h9V41a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5Z" fill="#ffc4d3">
          <path d="M31.8 16.5h2.7V41a1.5 1.5 0 0 1-1.5 1.5h-1.2Z" fill="#ff9fb8" />
          <path d="M29.2 21.5v9M29.2 33.5v3.5" stroke="#c96a84" strokeWidth={1.4} />
        </Part>
      </g>
    </>
  ),
  // 燃灯上浮: a lotus lantern lit from within, drifting up.
  yeondeunghoe: (
    <>
      <circle cx="24" cy="20" r="17" fill="#ffe9a6" opacity={0.55} />
      <Part d="M24 5.5C29 10.5 30 18 24 25C18 18 19 10.5 24 5.5Z" fill="#ffc4d3">
        <path d="M24 7.6C28 12 28.8 18.4 24 24.2Z" fill="#ff9fb8" />
      </Part>
      <Part d="M24 27C16.5 26.5 10 21 9 13C16.5 14 22 19 24 27Z" fill="#ffc4d3" />
      <Part d="M24 27C31.5 26.5 38 21 39 13C31.5 14 26 19 24 27Z" fill="#ff9fb8" />
      <ellipse cx="24" cy="20.8" rx="3.2" ry="4" fill="#ffe28a" stroke={INK} strokeWidth={1.6} />
      <Part d="M10.5 33.5C14.5 30.8 33.5 30.8 37.5 33.5C33.5 37.8 14.5 37.8 10.5 33.5Z" fill="#8fd17a">
        <path d="M24 31.6C30 31.6 34.6 32.3 37.4 33.6C35.6 35.6 31 36.8 25 37Z" fill="#5aa548" />
      </Part>
      <Part d="M12.5 23C13.5 30 18.5 33.4 24 33.4S34.5 30 35.5 23C31.5 26.2 27.8 27.4 24 27.4S16.5 26.2 12.5 23Z" fill="#ffc4d3">
        <path d="M24 27.4C27.8 27.4 31.5 26.2 35.5 23C34.5 30 29.5 33.4 24 33.4Z" fill="#ff9fb8" />
        <path d="M24 28.4v4" stroke="#e2769a" strokeWidth={1.4} />
      </Part>
      <path d="M17 40.5v3M24 39.5v5M31 40.5v3" stroke="#e0aa25" strokeWidth={2.2} />
    </>
  ),
  // 折一只纸鹤: a sakura-paper crane, head to the left.
  crane: (
    <>
      <Part d="M24 25.5L32.5 3.5L33 27Z" fill="#ff9fb8" />
      <Part d="M29 30L45 15.5L42.6 14.4L27 27Z" fill="#ffc4d3" />
      <Part d="M20 29L6.5 17L9 15.6L23 26.5Z" fill="#ffc4d3" />
      <Part d="M6.4 17.2L9.2 15.4L3.4 22Z" fill="#ffc4d3" />
      <Part d="M12.5 31L24 23.5L35.5 31L24 36.5Z" fill="#ffc4d3">
        <path d="M12.5 31h23L24 36.5Z" fill="#ff9fb8" />
      </Part>
      <Part d="M17.5 29.5L14.5 4.5L31 27Z" fill="#ffc4d3">
        <path d="M17.5 29.5L16 17L31 27Z" fill="#ffb3c7" />
      </Part>
    </>
  ),
  // 点一盏心愿灯: a lit paper lantern with its wish plaque.
  lantern: (
    <>
      <path d="M24 2v6" stroke="#c8453a" strokeWidth={2} />
      <Part d="M17 11.5C11.5 15 11.5 29 17 32.5h14c5.5-3.5 5.5-17.5 0-21Z" fill="#ffc46b">
        <path d="M28.6 11.5H31c5.5 3.5 5.5 17.5 0 21h-2.4c4-3.5 4-17.5 0-21Z" fill="#f2a145" />
        <path d="M13.4 17.2Q24 19 34.6 17.2M12.8 22Q24 23.8 35.2 22M13.4 26.8Q24 28.6 34.6 26.8" fill="none" stroke="#d9893a" strokeWidth={1.2} />
        <ellipse cx="19.8" cy="19.2" rx="2.4" ry="4" fill="#fff3cf" />
      </Part>
      <Part d="M16 7.5h16a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1-1.2 1.2H16a1.2 1.2 0 0 1-1.2-1.2V8.7A1.2 1.2 0 0 1 16 7.5Z" fill="#5a3a26" />
      <Part d="M16 31.5h16a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1-1.2 1.2H16a1.2 1.2 0 0 1-1.2-1.2v-2.6a1.2 1.2 0 0 1 1.2-1.2Z" fill="#5a3a26" />
      <path d="M24 36.5V39" stroke="#c8453a" strokeWidth={1.6} />
      <Part d="M20.5 39h7v6.4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z" fill="#e8c89a" />
    </>
  ),
  // 火边花环: a flower wreath round a candle, ribbons trailing.
  "slavic-wreath": (
    <>
      <Cord d="M21 34c-.6 4.4-4.4 4.6-5.2 9.4M27 34c.6 4.4 4.4 4.6 5.2 9.4" color="#ff7a6b" />
      <Part d="M24 5.5a16 16 0 1 0 0 32a16 16 0 1 0 0-32ZM24 13a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17Z" fill="#8fd17a" evenodd>
        <circle cx="24" cy="21.5" r="12.2" fill="none" stroke="#5aa548" strokeWidth={3} strokeDasharray="2.4 3.4" />
      </Part>
      {(
        [
          [24, 9.3, "#ff7a6b"],
          [34.6, 15.4, "#ffd966"],
          [34.6, 27.6, "#8fd0f5"],
          [24, 33.7, "#fffdf7"],
          [13.4, 27.6, "#ff9fb8"],
          [13.4, 15.4, "#ffd966"],
        ] as const
      ).map(([cx, cy, color]) => (
        <g key={`${cx},${cy}`}>
          <circle cx={cx} cy={cy} r={2.9} fill={color} stroke={INK} strokeWidth={1.4} />
          <circle cx={cx} cy={cy} r={1} fill="#e0aa25" />
        </g>
      ))}
      <Part d="M22.2 19h3.6v8h-3.6Z" fill="#fff3cf" />
      <path d="M24 12.6c1.7 1.7 2 3.6 0 5.2c-2-1.6-1.7-3.5 0-5.2Z" fill="#ffb347" stroke={INK} strokeWidth={1.2} />
    </>
  ),
};

/** Whether a scene has its own drawn icon. */
export function hasSceneIcon(id: string): boolean {
  return id in sceneIcons;
}

/** The scene's drawn icon (decorative), or nothing for a scene without one. */
export function SceneIcon({ id }: { id: string }) {
  const art = sceneIcons[id];
  if (!art) return null;
  return (
    <svg
      className="scene-icon"
      viewBox="0 0 48 48"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {art}
    </svg>
  );
}

/** A scene icon in the same 76px item slot as the small illustration crops. */
export function SceneArt({ id }: { id: string }) {
  return (
    <div className="art art-small scene-art" data-scene={id} aria-hidden="true">
      <SceneIcon id={id} />
    </div>
  );
}
