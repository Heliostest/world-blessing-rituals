import { dailyCollectibleId, rituals } from "@wbr/core";
import { Icon } from "./art";
import { useApp } from "./context";
import { useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import {
  DAILY_SET_COPY,
  dailySceneSet,
  isWishScene,
} from "./scene-placement";

export const ritualTitle = {
  woodfish: "敲掉一点小烦恼",
  crane: "折一份小小的期待",
  lantern: "点亮一盏心愿灯",
};
export function Today({ day }: { day: string }) {
  const { state, go } = useApp();
  const { entries } = useSceneLibrary();
  const openScene = useOpenScene();
  const merit = state.ledger.reduce((n, l) => n + l.amount, 0);
  const set = dailySceneSet(entries, day);
  return (
    <div className="today-page">
      <header className="home-heading">
        <h1>今日功德</h1>
        <button className="merit-pill" onClick={() => go({ page: "history" })}>
          <Icon name="lotus" />
          <span>
            功德 <b>{merit}</b>
          </span>
          <Icon name="arrow" />
        </button>
      </header>
      <p className="lead">今天，也给自己一点好运。</p>
      {/* The one way left onto the 2D ritual page: a session begun there
          before rituals opened as scenes still settles where it started. */}
      {state.activeSession && (
        <button
          className="resume-banner"
          onClick={() => go({ page: "ritual" })}
        >
          <span>
            继续上次的{rituals[state.activeSession.ritual].short}
            <small>
              已完成 {state.activeSession.progress} /{" "}
              {rituals[state.activeSession.ritual].steps}
            </small>
          </span>
          <Icon name="arrow" />
        </button>
      )}
      {set.length > 0 && (
        <section className="daily-set" aria-label={DAILY_SET_COPY.heading}>
          <div className="section-heading">
            <h2>{DAILY_SET_COPY.heading}</h2>
            <button className="text-button" onClick={() => go({ page: "scenes" })}>
              {DAILY_SET_COPY.browse} <Icon name="arrow" />
            </button>
          </div>
          <p className="quiet daily-set-blurb">{DAILY_SET_COPY.sub}</p>
          <div className="daily-set-grid">
            {set.map((entry) => {
              const collected = state.collectibles.some(
                (c) => c.id === dailyCollectibleId(day, entry.id),
              );
              return (
                <button
                  key={entry.id}
                  className="daily-set-card"
                  data-scene={entry.id}
                  data-type={isWishScene(entry.id) ? "wish" : "blessing"}
                  onClick={() => openScene(entry, { daily: day })}
                >
                  <SceneBadge id={entry.id} />
                  <strong>{entry.title}</strong>
                  <small>
                    {collected
                      ? DAILY_SET_COPY.collected
                      : isWishScene(entry.id)
                        ? DAILY_SET_COPY.wishNote
                        : DAILY_SET_COPY.blessingNote}
                  </small>
                  {collected && (
                    <span className="collected-dot" aria-label="今天已收下">
                      <Icon name="check" />
                    </span>
                  )}
                  <Icon name="arrow" />
                </button>
              );
            })}
          </div>
        </section>
      )}
      <button className="wish-invitation" onClick={() => go({ page: "new" })}>
        <Icon name="wishes" />
        <span>小小心愿，也值得发光。</span>
        <span className="invitation-action">
          许个愿 <Icon name="arrow" />
        </span>
      </button>
    </div>
  );
}