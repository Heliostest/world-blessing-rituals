import { useState } from "react";
import { rituals, type RitualId } from "@wbr/core";
import { Art, Icon } from "./art";
import { now, uid, useApp } from "./context";
import { Empty, PageHead } from "./pages";

export function Ritual({ id }: { id?: string }) {
  const { state, dispatch, go, feedback, active } = useApp();
  const [wishId, setWishId] = useState("");
  const [pulse, setPulse] = useState(0);
  const r = state.activeSession;
  const kind: RitualId =
    r?.ritual ?? (id && id in rituals ? (id as RitualId) : "woodfish");
  const meta = rituals[kind];
  const progress = r?.progress ?? 0;
  const ready = progress >= meta.steps;
  function step() {
    if (!active || !r || ready) return;
    if (dispatch({ type: "ritual.step" })) {
      setPulse((n) => n + 1);
      feedback();
    }
  }
  function finish() {
    if (r && dispatch({ type: "ritual.finish", id: r.id, at: now() })) {
      feedback();
      go({ page: "complete", id: r.id });
    }
  }
  return (
    <div className="ritual-page">
      <PageHead eyebrow="留一分钟，给当下的自己" title={meta.name} />
      <p className="lead">{meta.subtitle}</p>
      <div className="ritual-stage">
        <div className="ritual-orbit" />
        {r ? (
          <button
            className="ritual-object"
            aria-label={
              ready
                ? "仪式步骤已完成"
                : kind === "woodfish"
                  ? "轻敲木鱼"
                  : "完成当前步骤"
            }
            onClick={step}
            disabled={ready || !active}
          >
            <span key={pulse} className={pulse ? "object-bounce" : ""}>
              <Art kind={kind} />
            </span>
          </button>
        ) : (
          <Art kind={kind} />
        )}
        {pulse > 0 && (
          <span className="floating-word" key={pulse}>
            烦恼 −1
          </span>
        )}
      </div>
      <div className="ritual-instructions">
        <span className="tag soft">
          {r ? `${progress} / ${meta.steps}` : "一个属于你的小仪式"}
        </span>
        <h2>
          {ready
            ? "这一刻，已经很好。"
            : meta.prompts[Math.min(progress, meta.prompts.length - 1)]}
        </h2>
        <p>
          {r
            ? ready
              ? "把这份小美好，带回你的小天地。"
              : kind === "woodfish"
                ? "轻点木鱼，按自己的节奏来。"
                : "轻点画面，继续这份小仪式。"
            : "不需要准备，带着此刻的自己就好。"}
        </p>
      </div>
      {r ? (
        <>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="仪式进度"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={meta.steps}
          >
            <span style={{ width: `${(progress / meta.steps) * 100}%` }} />
          </div>
          {ready && (
            <button className="button primary full" onClick={finish}>
              收下这份小美好 <Icon name="check" />
            </button>
          )}
          <p className="footnote">随时可以离开，回来继续就好。</p>
        </>
      ) : (
        <div className="ritual-start">
          <label htmlFor="ritual-wish">
            把这一刻送给 <small>选填</small>
          </label>
          <select
            id="ritual-wish"
            value={wishId}
            onChange={(e) => setWishId(e.target.value)}
          >
            <option value="">此刻的自己</option>
            {state.wishes
              .filter((w) => !w.archived && w.status !== "fulfilled")
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
          </select>
          <button
            className="button primary full"
            onClick={() =>
              dispatch({
                type: "ritual.start",
                id: uid(),
                ritual: kind,
                wishId: wishId || undefined,
                at: now(),
              })
            }
          >
            准备好了，开始吧
          </button>
          <p className="footnote">
            当前为静态步骤体验，后续可接入完整手势场景。
          </p>
        </div>
      )}
    </div>
  );
}
export function Complete({ id }: { id: string }) {
  const { state, go } = useApp();
  const r = state.sessions.find((s) => s.id === id);
  if (!r)
    return (
      <Empty
        title="回到今天，继续收集美好"
        body="已完成的仪式都在「我的」里。"
        action="回到今日"
        onClick={() => go({ page: "today" })}
      />
    );
  return (
    <div className="completion">
      <span className="tag">今日份的小美好，已收好</span>
      <Art kind={r.ritual} />
      <h1>
        烦恼轻一点，
        <br />
        美好多一点。
      </h1>
      <p>谢谢你，为自己留下这一刻。</p>
      <div className="reward-card">
        <span>
          ✧ 功德 <strong>+10</strong>
        </span>
        <span>
          获得 <strong>{rituals[r.ritual].object}</strong>
        </span>
      </div>
      <button
        className="button primary full"
        onClick={() => go({ page: "collection", id: `ritual:${r.id}` })}
      >
        把收藏带回小天地 <Icon name="arrow" />
      </button>
      <button className="text-button" onClick={() => go({ page: "today" })}>
        回到今日
      </button>
    </div>
  );
}
