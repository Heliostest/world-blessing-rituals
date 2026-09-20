import { useState, type FormEvent } from "react";
import { dailyRitual, localDay, rituals, type RitualId } from "@wbr/core";
import { Art, Icon } from "./art";
import { formatDate, now, statusText, uid, useApp } from "./context";

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
export function Today() {
  const { state, go } = useApp();
  const [day] = useState(() => localDay());
  const ritual = dailyRitual(day);
  const merit = state.ledger.reduce((n, l) => n + l.amount, 0);
  const wish = state.wishes.find(
    (w) => !w.archived && w.status !== "fulfilled",
  );
  return (
    <>
      <PageHead
        eyebrow={`${formatDate(day + "T12:00:00")} · 给自己一分钟`}
        title="今天，也要好好过。"
      >
        <span className="merit-pill">
          ✧ {merit}
          <small>功德</small>
        </span>
      </PageHead>
      <p className="lead">攒一点小美好，等一个好消息。</p>
      {state.activeSession && (
        <button
          className="resume-banner"
          onClick={() => go({ page: "ritual" })}
        >
          <span>
            还有一份小美好，等你继续
            <br />
            <small>
              {rituals[state.activeSession.ritual].name} · 已完成{" "}
              {state.activeSession.progress}/
              {rituals[state.activeSession.ritual].steps}
            </small>
          </span>
          <Icon name="arrow" />
        </button>
      )}
      <section className="daily-card">
        <div className="card-kicker">
          <span className="tag">今日小仪式</span>
          <span>慢一点，也很好</span>
        </div>
        <Art kind={ritual} />
        <div className="daily-copy">
          <p className="eyebrow">A LITTLE MOMENT FOR YOU</p>
          <h2>{rituals[ritual].name}</h2>
          <p>{rituals[ritual].subtitle}</p>
          <button
            className="button primary"
            onClick={() => go({ page: "ritual", id: ritual })}
          >
            开始今日仪式 <Icon name="arrow" />
          </button>
          <small>完成收集一件小物 · 功德 +10</small>
        </div>
      </section>
      <div className="section-heading">
        <h2>也可以，随心一点</h2>
        <span>选一个喜欢的</span>
      </div>
      <div className="ritual-grid">
        {(Object.keys(rituals) as RitualId[]).map((id) => (
          <button
            className="ritual-tile"
            key={id}
            onClick={() => go({ page: "ritual", id })}
          >
            <Art kind={id} small />
            <strong>{rituals[id].short}</strong>
            <small>
              {id === "woodfish"
                ? "敲掉一点烦恼"
                : id === "crane"
                  ? "折好一份期待"
                  : "留住一束微光"}
            </small>
          </button>
        ))}
      </div>
      <button
        className="wish-invitation"
        onClick={() =>
          go(wish ? { page: "wish", id: wish.id } : { page: "new" })
        }
      >
        <span className="mini-icon">
          <Icon name="wishes" />
        </span>
        <span>
          <strong>{wish ? wish.title : "心里有个小小的愿望？"}</strong>
          <small>
            {wish
              ? "去看看，或为它记下一点进展"
              : "写下来，让期待有个安放的地方"}
          </small>
        </span>
        <Icon name="arrow" />
      </button>
      <p className="footnote">不赶进度，不怕错过。今天来，就很好。</p>
    </>
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
export function NewWish() {
  const { go, dispatch } = useApp();
  const [title, setTitle] = useState("");
  const [intention, setIntention] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const id = uid();
    if (dispatch({ type: "wish.create", id, title, intention, at: now() }))
      go({ page: "wish", id });
  }
  return (
    <>
      <PageHead eyebrow="一盏灯，一个小小的期待" title="许一个心愿" />
      <Art kind="lantern" />
      <form className="form-card" onSubmit={submit}>
        <label htmlFor="wish-title">你希望什么慢慢发生？</label>
        <textarea
          id="wish-title"
          placeholder="希望我能勇敢一点，完成一直想做的事…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          required
          rows={3}
        />
        <span className="input-count">{title.length} / 60</span>
        <label htmlFor="wish-intention">
          和自己做个小约定 <small>选填</small>
        </label>
        <textarea
          id="wish-intention"
          placeholder="为了这个心愿，我愿意…"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          maxLength={160}
          rows={2}
        />
        <p className="quiet">愿望没有截止日期，按自己的节奏就好。</p>
        <button
          className="button primary"
          disabled={!title.trim()}
          type="submit"
        >
          点亮我的心愿灯 <Icon name="wishes" />
        </button>
      </form>
      <p className="privacy-note">
        <Icon name="lock" /> 这一份心事，只属于你。
      </p>
    </>
  );
}
export function WishDetail({ id }: { id: string }) {
  const { state, dispatch, go } = useApp();
  const wish = state.wishes.find((w) => w.id === id);
  const [note, setNote] = useState("");
  if (!wish)
    return (
      <Empty
        title="没找到这盏心愿灯"
        body="回到心愿页看看吧。"
        action="我的心愿"
        onClick={() => go({ page: "wishes" })}
      />
    );
  const fulfill = wish.status === "realized";
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      dispatch({
        type: fulfill ? "wish.fulfill" : "wish.note",
        id,
        noteId: uid(),
        text: note,
        at: now(),
      })
    )
      setNote("");
  }
  return (
    <>
      <PageHead
        eyebrow={`${formatDate(wish.createdAt)} · 点亮的心愿`}
        title={wish.archived ? "暂时放下，也没关系。" : statusText[wish.status]}
      />
      <div className="wish-detail-hero">
        <Art kind={wish.status === "fulfilled" ? "badge" : "lantern"} />
        <h2>{wish.title}</h2>
        {wish.intention && <p>「{wish.intention}」</p>}
      </div>
      {!wish.archived && wish.status !== "fulfilled" && (
        <form className="form-card" onSubmit={submit}>
          <h3>{fulfill ? "为如愿，留一份纪念" : "今天，为心愿记一笔"}</h3>
          <p className="quiet">
            {fulfill
              ? "记录一件小善事，或写下你的感谢。完成后收获如愿纪念章。"
              : "一小步努力，或一句此刻的心情，都算数。"}
          </p>
          <label className="sr-only" htmlFor="wish-note">
            {fulfill ? "还愿记录" : "心愿进展"}
          </label>
          <textarea
            id="wish-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              fulfill ? "我想感谢… / 今天我做了一件小小的好事…" : "今天的我…"
            }
            required
          />
          <button
            className="button primary"
            type="submit"
            disabled={!note.trim()}
          >
            {fulfill ? "完成还愿 · 收藏纪念章" : "记下这一刻"}
          </button>
        </form>
      )}
      {!wish.archived && wish.status === "active" && (
        <button
          className="button secondary full"
          onClick={() => dispatch({ type: "wish.realize", id, at: now() })}
        >
          <Icon name="check" /> 我的心愿实现了
        </button>
      )}
      {wish.status === "fulfilled" && (
        <div className="success-note">
          <Icon name="check" />
          <div>
            <strong>这份美好，已经珍藏。</strong>
            <p>如愿纪念章已放入你的小天地。</p>
          </div>
          <button className="text-button" onClick={() => go({ page: "world" })}>
            去看看
          </button>
        </div>
      )}
      <div className="section-heading">
        <h2>心愿的足迹</h2>
        <span>{wish.notes.length + 1} 个瞬间</span>
      </div>
      <ol className="timeline">
        {[...wish.notes].reverse().map((n) => (
          <li key={n.id}>
            <small>{formatDate(n.at)}</small>
            <p>{n.text}</p>
          </li>
        ))}
        <li>
          <small>{formatDate(wish.createdAt)}</small>
          <p>点亮了一盏心愿灯，故事从这里开始。</p>
        </li>
      </ol>
      {wish.status !== "fulfilled" && (
        <button
          className="text-button archive-button"
          onClick={() =>
            dispatch({ type: "wish.archive", id, archived: !wish.archived })
          }
        >
          {wish.archived ? "重新拾起这个心愿" : "先放下这个心愿"}
        </button>
      )}
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
  const { state } = useApp();
  return (
    <>
      <PageHead eyebrow="你留给自己的每一分钟" title="仪式时光" />
      {state.sessions.length ? (
        <ol className="timeline">
          {[...state.sessions].reverse().map((s) => (
            <li key={s.id}>
              <small>{formatDate(s.completedAt!)}</small>
              <h3>{rituals[s.ritual].name}</h3>
              <p>功德 +10 · 收藏了{rituals[s.ritual].object}</p>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="故事才刚刚开始" body="完成的小仪式，会一一记在这里。" />
      )}
    </>
  );
}
