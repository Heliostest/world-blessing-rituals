import { useState } from "react";
import { rituals } from "@wbr/core";
import { Art, Icon } from "./art";
import { formatDate, statusText, useApp } from "./context";

export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function Empty({
  title,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <Icon name="leaf" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="button secondary" onClick={onClick}>
          {action}
        </button>
      )}
    </div>
  );
}
export function Wishes() {
  const { state, go } = useApp();
  const [filter, setFilter] = useState("active");
  const wishes = state.wishes.filter((w) =>
    filter === "archived"
      ? w.archived
      : !w.archived &&
        (filter === "active"
          ? w.status !== "fulfilled"
          : w.status === "fulfilled"),
  );
  return (
    <>
      <PageHead eyebrow="把期待，交给慢慢来的日子" title="我的小心愿">
        <button
          className="round-button"
          aria-label="许个心愿"
          onClick={() => go({ page: "new" })}
        >
          <Icon name="plus" />
        </button>
      </PageHead>
      <div className="wish-hero">
        <Art kind="lantern" small />
        <div>
          <h2>愿望有光，日子有盼。</h2>
          <p>每一份认真期待，都值得被记住。</p>
        </div>
      </div>
      <div className="filter-row" role="group" aria-label="心愿筛选">
        {[
          ["active", "心愿灯"],
          ["fulfilled", "已如愿"],
          ["archived", "先放下"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            className={filter === id ? "selected" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {wishes.length ? (
        <div className="wish-list">
          {wishes.map((w) => (
            <button
              key={w.id}
              className="wish-card"
              onClick={() => go({ page: "wish", id: w.id })}
            >
              <Art
                kind={w.status === "fulfilled" ? "badge" : "lantern"}
                small
              />
              <span>
                <span className="tag soft">
                  {w.archived ? "暂时放下" : statusText[w.status]}
                </span>
                <strong>{w.title}</strong>
                <small>
                  {formatDate(w.createdAt)}点亮 · {w.notes.length} 条记录
                </small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "active" ? "为你的第一个心愿点亮一盏灯" : "这里还很安静"
          }
          body={
            filter === "active"
              ? "关于生活，关于自己。大大小小，都可以。"
              : "每个心愿都有自己的时间，不用着急。"
          }
          action={filter === "active" ? "许个心愿" : undefined}
          onClick={() => go({ page: "new" })}
        />
      )}
      <p className="privacy-note">
        <Icon name="lock" /> 心愿仅保存在这台设备上，只有你能看见。
      </p>
    </>
  );
}
export function World() {
  const { state, go } = useApp();
  return (
    <>
      <PageHead eyebrow="把每一份小美好，都留在这里" title="我的小天地">
        <span className="count-pill">{state.collectibles.length} 件珍藏</span>
      </PageHead>
      <div className="room">
        <div className="room-window">
          <span />
          <span />
        </div>
        <div className="room-caption">一隅安静，慢慢丰盛。</div>
        <div className="room-shelf">
          {state.collectibles.slice(-3).map((c) => (
            <button
              key={c.id}
              aria-label={`查看${c.title}`}
              onClick={() => go({ page: "collection", id: c.id })}
            >
              <Art kind={c.kind} small />
            </button>
          ))}
          {!state.collectibles.length && (
            <span className="empty-shelf">留个位置，给即将到来的美好</span>
          )}
        </div>
        <div className="room-floor" />
      </div>
      <div className="section-heading">
        <h2>时光里的小收藏</h2>
        <span>每一件，都有来处</span>
      </div>
      {state.collectibles.length ? (
        <div className="collection-grid">
          {[...state.collectibles].reverse().map((c) => (
            <button
              key={c.id}
              className="collection-card"
              onClick={() => go({ page: "collection", id: c.id })}
            >
              <Art kind={c.kind} small />
              <strong>{c.title}</strong>
              <small>{formatDate(c.at)}</small>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="小天地，等你慢慢填满"
          body="完成一个小仪式，把第一件收藏带回家。"
          action="去做个小仪式"
          onClick={() => go({ page: "today" })}
        />
      )}
    </>
  );
}
export function CollectionDetail({ id }: { id: string }) {
  const { state, go } = useApp();
  const item = state.collectibles.find((c) => c.id === id);
  if (!item)
    return <Empty title="这件收藏还没到家" body="先去完成一个小仪式吧。" />;
  const wish = state.wishes.find((w) => w.id === item.wishId);
  return (
    <>
      <PageHead eyebrow="属于你的独一份记忆" title={item.title} />
      <Art kind={item.kind} />
      <div className="form-card">
        <span className="tag">
          {item.kind === "badge" ? "还愿纪念" : "仪式收藏"}
        </span>
        <h2>{formatDate(item.at)}，留住一点美好。</h2>
        <p className="quiet">
          {item.kind === "badge"
            ? "曾经认真许下的愿望，如今成为了生活的一部分。"
            : `这件${item.title}，来自你为自己留下的一段安静时光。`}
        </p>
        {wish && (
          <button
            className="button secondary"
            onClick={() => go({ page: "wish", id: wish.id })}
          >
            看看关联的心愿 <Icon name="arrow" />
          </button>
        )}
      </div>
    </>
  );
}
export function Me() {
  const { state, dispatch, go } = useApp();
  const stats = [
    [state.ledger.reduce((n, l) => n + l.amount, 0), "积攒功德"],
    [state.sessions.length, "仪式时光"],
    [state.wishes.filter((w) => w.status === "fulfilled").length, "如愿心事"],
  ];
  return (
    <>
      <PageHead eyebrow="照顾好自己，也是一种小功德" title="慢慢变好的我" />
      <div className="profile">
        <div className="avatar">
          <Icon name="leaf" />
        </div>
        <h2>生活里的小小修行家</h2>
        <p>不必满分，今天也很可爱。</p>
      </div>
      <div className="stats">
        {stats.map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="settings-card">
        <button className="settings-row" onClick={() => go({ page: "scenes" })}><span>场景目录</span><Icon name="arrow" /></button>
        <button className="settings-row" onClick={() => go({ page: "cache" })}><span>资源缓存</span><Icon name="arrow" /></button>
        <button
          className="settings-row"
          onClick={() => go({ page: "history" })}
        >
          <span>我的仪式记录</span>
          <Icon name="arrow" />
        </button>
        {(
          [
            ["sound", "仪式声音", "给安静的时刻一点回响"],
            ["haptics", "轻触反馈", "每一步，都有温柔回应"],
            ["reducedMotion", "减少动态效果", "让画面更安静"],
          ] as const
        ).map(([key, title, sub]) => (
          <label className="settings-row" key={key}>
            <span>
              {title}
              <small>{sub}</small>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={state.settings[key]}
              onChange={(e) =>
                dispatch({ type: "settings", key, value: e.target.checked })
              }
            />
          </label>
        ))}
      </div>
      <div className="local-note">
        <Icon name="lock" />
        <div>
          <strong>你的记录，留在你身边</strong>
          <p>
            目前仅保存在本机，尚未开启云同步。清除浏览器数据或卸载 App
            会丢失记录。
          </p>
        </div>
      </div>
      <p className="footnote">
        赛博祈福 · 给生活一点温柔
        <br />
        功德是趣味记录，心愿由自己慢慢实现。
      </p>
    </>
  );
}
export function History() {
  const { state, go } = useApp();
  return (
    <>
      <PageHead eyebrow="你留给自己的每一分钟" title="仪式时光" />
      <div className="scene-catalog">{state.sceneRecords.map(record => <button className="scene-card" key={record.id} onClick={() => go({ page: "scene", id: record.id, entry: record })}>
        <strong>{record.title}{record.favorite ? " · 已收藏" : ""}</strong><small>已完成 {record.progress} 步 · 再次打开</small>
      </button>)}</div>
      {state.sessions.length ? (
        <ol className="timeline">
          {[...state.sessions].reverse().map((s) => (
            <li key={s.id}>
              <small>{formatDate(s.completedAt!)}</small>
              <h3>{rituals[s.ritual].name}</h3>
              <p>功德 +10 · 收藏了{rituals[s.ritual].object}</p>
              <button className="text-button" onClick={() => go({ page: "ritual", id: s.ritual })}>再次体验</button>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="故事才刚刚开始" body="完成的小仪式，会一一记在这里。" />
      )}
    </>
  );
}
