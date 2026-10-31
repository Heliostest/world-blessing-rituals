import { localizedTitle } from './localization';
import { useEffect, useId, useRef, useState } from 'react';
import { translate as tr, message } from '@wbr/i18n';
import { dailyCollectibleId, rituals, openingExclusions } from "@wbr/core";
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { Icon } from "./art";
import { useApp } from "./context";
import { DailyScenePreview } from "./daily-scene-preview";
import { useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import { PageHead } from "./page-heading";
import { DAILY_COLLECTED_COPY, DAILY_SET_COPY, dailyCollectedPicks, dailyPrimaryScene, isWishScene, } from "./scene-placement";
export const ritualTitle = {
    woodfish: "敲掉一点小烦恼",
    crane: "折一份小小的期待",
    lantern: "点亮一盏心愿灯",
};
function DailyCollectedInfo({ copy }: { copy: string }) {
    const [open, setOpen] = useState(false);
    const shell = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    useEffect(() => {
        if (!open) return;
        const close = () => {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
        };
        const outside = (event: Event) => {
            if (event.target instanceof Node && !shell.current?.contains(event.target)) close();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            close();
        };
        document.addEventListener('click', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('click', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);
    return <div className="daily-collected-info" ref={shell}>
      <button type="button" className="daily-collected-info-button" ref={trigger}
        aria-label={tr(DAILY_COLLECTED_COPY.heading)} aria-expanded={open} aria-controls={panelId}
        aria-describedby={open ? panelId : undefined} onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true"><svg viewBox="0 0 12 16" focusable="false"><circle cx="6" cy="3" r="1"/><path d="M5 6h2v8H5z"/></svg></span>
      </button>
      {open && <p className="daily-collected-info-panel" id={panelId} role="note">{tr(copy)}</p>}
    </div>;
}
export function Today({ day }: {
    day: string;
}) {
    const { state, go } = useApp();
    const { entries } = useSceneLibrary();
    const openScene = useOpenScene();
    const primary = dailyPrimaryScene(entries, day, openingExclusions(state.opening, day));
    const picks = dailyCollectedPicks(entries, state.collectibles, day);
    const collected = !!primary &&
        state.collectibles.some((c) => c.id === dailyCollectibleId(day, primary.id));
    return (<div className="today-page">
      <PageHead title={tr("\u4ECA\u65E5\u4EEA\u5F0F")} eyebrow={tr("\u4ECA\u5929\uFF0C\u4E5F\u7ED9\u81EA\u5DF1\u4E00\u70B9\u597D\u8FD0\u3002")}/>
      {/* Old sessions retain their settlement ID and resume with 3D interaction. */}
      {state.activeSession && isSceneVisibleInApp({ id: state.activeSession.ritual }) && (<button className="resume-banner" onClick={() => go({ page: "ritual" })}>
          <span>{message('app.home.resume', { ritual: tr(rituals[state.activeSession.ritual].short) })}
            <small>{message('app.home.progress', { done: state.activeSession.progress, total: rituals[state.activeSession.ritual].steps })}</small>
          </span>
          <Icon name="arrow"/>
        </button>)}
      {primary && (<>
          <section className="daily-set" aria-label={tr("\u4ECA\u65E5\u4EEA\u5F0F\u5361\u7247")}>
            <button className="daily-set-card daily-set-primary" data-scene={primary.id} data-type={isWishScene(primary.id) ? "wish" : "blessing"} onClick={() => openScene(primary, { daily: day })}>
              {/* The day's scene, live above its row; the whole card opens
              the walk. The picks below stay pictures: one canvas a page. */}
              <DailyScenePreview key={`${primary.id}:${primary.engine}`} entry={primary}/>
              <SceneBadge id={primary.id}/>
              <strong>{localizedTitle(primary)}</strong>
              <small>
                {collected
                ? tr(DAILY_SET_COPY.collected) : isWishScene(primary.id)
                ? tr(DAILY_SET_COPY.wishNote) : tr(DAILY_SET_COPY.blessingNote)}
              </small>
              {collected && (<span className="collected-dot" aria-label={tr("\u4ECA\u5929\u5DF2\u6536\u4E0B")}>
                  <Icon name="check"/>
                </span>)}
              <Icon name="arrow"/>
            </button>
          </section>
          <section className="daily-set daily-collected" aria-label={tr(DAILY_COLLECTED_COPY.heading)}>
            <div className="section-heading">
              <h2>{tr(DAILY_COLLECTED_COPY.heading)}</h2>
              {picks.length > 0 && <DailyCollectedInfo copy={picks.length === 3 && picks.some(e => isWishScene(e.id))
                ? DAILY_COLLECTED_COPY.sub : DAILY_COLLECTED_COPY.partial}/>}
            </div>
            {picks.length ? (<>
                <div className="daily-set-grid daily-collected-grid">
                  {/* A 回看: no daily flag, so the walk collects nothing new. */}
                  {picks.map((entry) => (<button key={entry.id} className="daily-set-card" data-scene={entry.id} data-type={isWishScene(entry.id) ? "wish" : "blessing"} onClick={() => openScene(entry, { replay: true })}>
                      <SceneBadge id={entry.id}/>
                      <strong>{localizedTitle(entry)}</strong>
                      <small>
                        {isWishScene(entry.id)
                        ? tr(DAILY_COLLECTED_COPY.wishNote) : tr(DAILY_COLLECTED_COPY.blessingNote)}
                      </small>
                    </button>))}
                </div>
              </>) : (<div className="daily-collected-empty">
                <strong>{tr(DAILY_COLLECTED_COPY.emptyTitle)}</strong>
                <small>{tr(DAILY_COLLECTED_COPY.emptyBody)}</small>
              </div>)}
          </section>
        </>)}
    </div>);
}
