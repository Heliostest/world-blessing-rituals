import { useState } from "react";
import { localDay, rituals, type RitualId } from "@wbr/core";
import { Art, Icon } from "./art";
import { now, uid, useApp } from "./context";
import { Empty } from "./pages";
import { ritualTitle } from "./home";

function FeedbackControls() {
  const { state, dispatch } = useApp();
  return (
    <div className="feedback-controls">
      {(
        [
          ["sound", "音效"],
          ["haptics", "震动"],
        ] as const
      ).map(([key, label]) => (
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
export function Ritual({
  id,
  wishId: linkedWishId,
}: {
  id?: string;
  wishId?: string;
}) {
  const { state, dispatch, go, feedback, active } = useApp();
  const [wishId, setWishId] = useState(linkedWishId ?? "");
  const [pulse, setPulse] = useState(0);
  const r = state.activeSession;
  const kind: RitualId =
    r?.ritual ?? (id === "crane" || id === "lantern" ? id : "woodfish");
  const meta = rituals[kind];
  const progress = r?.progress ?? 0;
  const ready = progress >= meta.steps;
  function start() {
    return dispatch({
      type: "ritual.start",
      id: uid(),
      ritual: kind,
      wishId: wishId || undefined,
      at: now(),
    });
  }
  function step() {
    if (!active || ready) return;
    if (!r && !start()) return;
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
    <div className={`ritual-page ritual-${kind}`}>
      <div className="ritual-goal">
        今日目标{" "}
        <strong>
          {progress} / {meta.steps}
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="仪式进度"
        aria-valuemin={0}
        aria-valuemax={meta.steps}
        aria-valuenow={progress}
      >
        <span style={{ width: `${(progress / meta.steps) * 100}%` }} />
      </div>
      <div className="ritual-stage">
        <div className="ritual-feedback" key={pulse}>
          <strong>
            {ready ? "小美好 +1" : pulse ? "安心 +1" : "留一点好心情"}
          </strong>
          <span>{pulse ? "烦恼 -1" : "烦恼，轻轻放下"}</span>
        </div>
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
            <Art
              kind={kind}
              variant={
                kind === "woodfish"
                  ? "play"
                  : kind === "lantern"
                    ? "wish"
                    : "default"
              }
            />
          </span>
        </button>
      </div>
      <div className="ritual-counter">{String(progress).padStart(3, "0")}</div>
      <p className="tap-instruction">
        {ready
          ? "这一刻，已经很好。"
          : kind === "woodfish"
            ? "点击木鱼，咚一下。"
            : meta.prompts[Math.min(progress, meta.prompts.length - 1)]}
      </p>
      {ready ? (
        <button className="button primary full" onClick={finish}>
          完成仪式 · 收下小美好
        </button>
      ) : (
        !r && (
          <div className="ritual-link">
            <label htmlFor="ritual-wish">
              为一个心愿留一分钟 <small>选填</small>
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
          </div>
        )
      )}
      <FeedbackControls />
      <p className="ritual-footer">
        <span />
        慢慢{kind === "woodfish" ? "敲" : "来"}，也可以。
        <span />
      </p>
    </div>
  );
}
export function Complete({ id }: { id: string }) {
  const { state, go } = useApp();
  const [shareText, setShareText] = useState("");
  const [copied, setCopied] = useState(false);
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
  const earned = state.ledger.find((l) => l.id === r.id)?.amount ?? 0;
  const day = localDay(new Date(r.completedAt!));
  const today = state.sessions
    .filter((s) => localDay(new Date(s.completedAt!)) === day)
    .reduce((n, s) => n + s.progress, 0);
  const days = new Set(
    state.sessions.map((s) => localDay(new Date(s.completedAt!))),
  );
  let streak = 0;
  const cursor = new Date(day + "T12:00:00");
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const wish = state.wishes.find(
    (w) => w.id === r.wishId && w.status === "realized" && !w.archived,
  );
  async function share() {
    const text = `今天${ritualTitle[r!.ritual]}，功德 +${earned}。把小仪式过成好心情。`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "今日功德", text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    setShareText(text);
    setCopied(false);
  }
  return (
    <div className="completion">
      <h1>今日仪式完成</h1>
      <p className="page-subtitle">今天的好心情，已到账。</p>
      <div className="celebration">
        <div className="reward-number">
          功德 <strong>+{earned}</strong>
        </div>
        <Art
          kind={r.ritual}
          variant={
            r.ritual === "woodfish"
              ? "complete"
              : r.ritual === "lantern"
                ? "fulfill"
                : "default"
          }
        />
        {r.ritual !== "woodfish" && (
          <span className="title-badge">
            {r.ritual === "crane" ? "小小心愿收藏家" : "温暖微光守护者"}
          </span>
        )}
      </div>
      <div className="completion-stats">
        <div>
          <span>今日互动</span>
          <strong>
            {today}
            <small> 次</small>
          </strong>
        </div>
        <div>
          <span>已连续</span>
          <strong>
            {streak}
            <small> 天</small>
          </strong>
        </div>
      </div>
      <button
        className="button primary full"
        onClick={() =>
          go(wish ? { page: "fulfill", id: wish.id } : { page: "world" })
        }
      >
        {wish ? "继续还愿 · 留下这份心情" : "收下这份好心情"}
      </button>
      <button className="button outline full" onClick={() => void share()}>
        <Icon name="share" />
        分享今日功德
      </button>
      {shareText && (
        <div className="share-panel">
          <label htmlFor="share-copy">分享这份好心情</label>
          <textarea id="share-copy" value={shareText} readOnly rows={3} />
          <button
            className="small-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
              } catch {
                document
                  .querySelector<HTMLTextAreaElement>("#share-copy")
                  ?.select();
              }
            }}
          >
            {copied ? "已复制" : "复制文案"}
          </button>
        </div>
      )}
      <p className="leaf-footer">
        <Icon name="leaf" />
        明天还有一个小惊喜。
        <Icon name="leaf" />
      </p>
    </div>
  );
}
