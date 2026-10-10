import { dailyCollectibleId, rituals } from "@wbr/core";
import { Icon } from "./art";
import { useApp } from "./context";
import { DailyScenePreview } from "./daily-scene-preview";
import { useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import {
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  dailyCollectedPicks,
  dailyPrimaryScene,
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
  const primary = dailyPrimaryScene(entries, day);
  const picks = dailyCollectedPicks(entries, state.collectibles, day);
  const collected =
    !!primary &&
    state.collectibles.some((c) => c.id === dailyCollectibleId(day, primary.id));
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
      {primary && (
        <>
          <section className="daily-set" aria-label={DAILY_SET_COPY.heading}>
            <div className="section-heading">
              <h2>{DAILY_SET_COPY.heading}</h2>
            </div>
            <p className="quiet daily-set-blurb">{DAILY_SET_COPY.sub}</p>
            <button
              className="daily-set-card daily-set-primary"
              data-scene={primary.id}
              data-type={isWishScene(primary.id) ? "wish" : "blessing"}
              onClick={() => openScene(primary, { daily: day })}
            >
              {/* The day's scene, live above its row; the whole card opens
                  the walk. The picks below stay pictures: one canvas a page. */}
              <DailyScenePreview
                key={`${primary.id}:${primary.engine}`}
                entry={primary}
              />
              <SceneBadge id={primary.id} />
              <strong>{primary.title}</strong>
              <small>
                {collected
                  ? DAILY_SET_COPY.collected
                  : isWishScene(primary.id)
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
          </section>
          <section
            className="daily-set daily-collected"
            aria-label={DAILY_COLLECTED_COPY.heading}
          >
            <div className="section-heading">
              <h2>{DAILY_COLLECTED_COPY.heading}</h2>
            </div>
            {picks.length ? (
              <>
                <p className="quiet daily-set-blurb">
                  {picks.length === 3 && picks.some((e) => isWishScene(e.id))
                    ? DAILY_COLLECTED_COPY.sub
                    : DAILY_COLLECTED_COPY.partial}
                </p>
                <div className="daily-set-grid daily-collected-grid">
                  {/* A 回看: no daily flag, so the walk collects nothing new. */}
                  {picks.map((entry) => (
                    <button
                      key={entry.id}
                      className="daily-set-card"
                      data-scene={entry.id}
                      data-type={isWishScene(entry.id) ? "wish" : "blessing"}
                      onClick={() => openScene(entry, { replay: true })}
                    >
                      <SceneBadge id={entry.id} />
                      <strong>{entry.title}</strong>
                      <small>
                        {isWishScene(entry.id)
                          ? DAILY_COLLECTED_COPY.wishNote
                          : DAILY_COLLECTED_COPY.blessingNote}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="daily-collected-empty">
                <strong>{DAILY_COLLECTED_COPY.emptyTitle}</strong>
                <small>{DAILY_COLLECTED_COPY.emptyBody}</small>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}