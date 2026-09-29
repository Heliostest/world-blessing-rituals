import { builtInScenes } from "./scene-library";

export function RitualNarrativeBlurb({ sceneId }: { sceneId: string }) {
  const narrative = builtInScenes.find((e) => e.id === sceneId)?.narrative?.trim();
  if (!narrative) return null;
  return (
    <details className="ritual-narrative">
      <summary>了解此仪式</summary>
      <p>{narrative}</p>
    </details>
  );
}
