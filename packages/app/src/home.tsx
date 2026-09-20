import { useState } from "react";
import { dailyRitual, localDay, rituals, type RitualId } from "@wbr/core";
import { Art, Icon } from "./art";
import { useApp } from "./context";

export const ritualTitle = {
  woodfish: "敲掉一点小烦恼",
  crane: "折一份小小的期待",
  lantern: "点亮一盏心愿灯",
};
export function Today() {
  const { state, go } = useApp();
  const [day] = useState(() => localDay());
  const id = dailyRitual(day);
  const merit = state.ledger.reduce((n, l) => n + l.amount, 0);
  const collected = new Set(state.collectibles.map((c) => c.kind));
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
      <section className="daily-card">
        <span className="tag">今日随机仪式</span>
        <Art
          kind={id}
          variant={
            id === "woodfish" ? "home" : id === "lantern" ? "wish" : "default"
          }
        />
        <div className="daily-copy">
          <h2>{ritualTitle[id]}</h2>
          <p>
            {id === "woodfish" ? "30 秒，轻松一下。" : rituals[id].subtitle}
          </p>
          <button
            className="button primary"
            onClick={() => go({ page: "ritual", id })}
          >
            开始今日仪式
          </button>
        </div>
      </section>
      <section className="achievement-card">
        <div className="section-heading">
          <h2>我的小小成就</h2>
          <button className="text-button" onClick={() => go({ page: "world" })}>
            已收集 <b>{state.collectibles.length}</b> 个小物{" "}
            <Icon name="arrow" />
          </button>
        </div>
        <div className="ritual-grid">
          {(["crane", "woodfish", "lantern"] as RitualId[]).map((kind) => (
            <button
              className="ritual-tile"
              key={kind}
              onClick={() => go({ page: "ritual", id: kind })}
            >
              <Art kind={kind} small />
              <strong>
                {kind === "lantern"
                  ? "小灯笼"
                  : kind === "woodfish"
                    ? "木鱼"
                    : rituals[kind].object}
              </strong>
              {collected.has(kind) && (
                <span className="collected-dot" aria-label="已收藏">
                  <Icon name="check" />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
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
