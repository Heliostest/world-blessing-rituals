import { useState, type FormEvent } from "react";
import {
  hasReturnRitual,
  type ReturnMethod,
  type WishCategory,
} from "@wbr/core";
import { Art, Icon } from "./art";
import { formatDate, now, uid, useApp } from "./context";
import { Empty } from "./pages";

function ReturnChoices({
  value,
  onChange,
  expanded = false,
}: {
  value: ReturnMethod;
  onChange(value: ReturnMethod): void;
  expanded?: boolean;
}) {
  return (
    <fieldset className={`return-choices${expanded ? " expanded" : ""}`}>
      <legend className="sr-only">选择还愿方式</legend>
      {(["kindness", "ritual"] as const).map((method) => (
        <label
          className={`choice-row${value === method ? " chosen" : ""}`}
          key={method}
        >
          <Icon name={method === "kindness" ? "heart" : "leaf"} />
          <span>
            <strong>
              {method === "kindness" ? "做一件小善事" : "完成一个小仪式"}
            </strong>
            {expanded && (
              <small>
                {method === "kindness"
                  ? "帮助别人，或表达一次感谢"
                  : "折一只纸鹤，留住这份心情"}
              </small>
            )}
          </span>
          <input
            type="radio"
            name="return-method"
            value={method}
            checked={value === method}
            onChange={() => onChange(method)}
          />
        </label>
      ))}
    </fieldset>
  );
}
export function NewWish() {
  const { go, dispatch } = useApp();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WishCategory>("work");
  const [method, setMethod] = useState<ReturnMethod>("kindness");
  function submit(e: FormEvent) {
    e.preventDefault();
    const id = uid();
    if (
      dispatch({
        type: "wish.create",
        id,
        title,
        intention: "",
        category,
        returnMethod: method,
        at: now(),
      })
    )
      go({ page: "wish", id });
  }
  return (
    <div className="new-wish-page">
      <p className="page-subtitle">把期待，轻轻放在这里。</p>
      <Art kind="lantern" variant="wish" />
      <form onSubmit={submit}>
        <section className="form-card">
          <div className="field-heading">
            <label htmlFor="wish-title">我的心愿</label>
            <span>{title.length} / 60</span>
          </div>
          <textarea
            id="wish-title"
            placeholder="希望这次面试顺利"
            rows={2}
            maxLength={60}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <fieldset className="category-chips">
            <legend className="sr-only">心愿分类</legend>
            {(
              [
                ["study", "学业"],
                ["work", "工作"],
                ["life", "生活"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={category === key ? "selected" : ""}>
                <input
                  type="radio"
                  name="category"
                  checked={category === key}
                  onChange={() => setCategory(key)}
                />
                <Icon name={key === "life" ? "leaf" : key} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </section>
        <section className="form-card return-plan">
          <h2>实现后，我想…</h2>
          <ReturnChoices value={method} onChange={setMethod} />
          <p className="quiet centered">不设期限，慢慢来。</p>
          <div className="private-row">
            <Icon name="lock" />
            <span>仅自己可见</span>
          </div>
        </section>
        <button
          className="button primary full"
          type="submit"
          disabled={!title.trim()}
        >
          点亮心愿灯
        </button>
      </form>
    </div>
  );
}
export function WishDetail({ id }: { id: string }) {
  const { state, go, dispatch } = useApp();
  const wish = state.wishes.find((w) => w.id === id);
  const [showAll, setShowAll] = useState(false);
  if (!wish)
    return (
      <Empty
        title="这盏心愿灯暂时不在这里"
        body="回到心愿页看看吧。"
        action="我的心愿"
        onClick={() => go({ page: "wishes" })}
      />
    );
  const latest = [...wish.notes].reverse();
  const method = wish.returnMethod ?? "kindness";
  return (
    <div className="wish-detail-page">
      <span
        className={`status-pill${wish.status === "fulfilled" ? " fulfilled" : ""}`}
      >
        <Icon name={wish.status === "active" ? "clock" : "check"} />
        {wish.archived
          ? "心愿休息中"
          : wish.status === "active"
            ? "心愿进行中"
            : wish.status === "realized"
              ? "心愿已实现"
              : "心愿已如愿"}
      </span>
      <Art
        kind={wish.status === "fulfilled" ? "badge" : "lantern"}
        variant={wish.status === "fulfilled" ? "default" : "wish-detail"}
      />
      <h1 className="wish-title">{wish.title}</h1>
      <p className="wish-meta">
        <Icon name="lock" />
        {formatDate(wish.createdAt)}许下 · 仅自己可见
      </p>
      {wish.intention.trim() && (
        <section className="form-card effort-card">
          <h2>和自己做个小约定</h2>
          <div className="note-preview">
            <Icon name="leaf" />
            <div>
              <p>{wish.intention}</p>
            </div>
          </div>
        </section>
      )}
      <section className="form-card effort-card">
        <div className="field-heading">
          <h2>我也在为它努力</h2>
          {!wish.archived && (
            <button
              className="small-button"
              onClick={() => go({ page: "note", id })}
            >
              <Icon name="edit" />
              记一笔
            </button>
          )}
        </div>
        {latest.length ? (
          (showAll ? latest : latest.slice(0, 1)).map((n) => (
            <article className="note-preview" key={n.id}>
              <Icon name="leaf" />
              <div>
                <p>{n.text}</p>
                <time>
                  {formatDate(n.at)}{" "}
                  {new Date(n.at).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </article>
          ))
        ) : (
          <p className="quiet empty-note">每一小步，都在靠近更好的自己。</p>
        )}
        {latest.length > 1 && (
          <button className="text-button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "收起记录" : `查看全部 ${latest.length} 条记录`}
          </button>
        )}
      </section>
      <div className={`return-summary method-${method}`}>
        <Icon name={method === "kindness" ? "heart" : "leaf"} />
        <span>
          <strong>
            {wish.status === "fulfilled" ? "已还愿：" : "实现后："}
          </strong>
          {method === "kindness" ? "做一件小善事" : "完成一个小仪式"}
        </span>
      </div>
      {!wish.archived && wish.status === "active" && (
        <button
          className="button primary full"
          onClick={() => {
            if (dispatch({ type: "wish.realize", id, at: now() }))
              go({ page: "fulfill", id });
          }}
        >
          我的心愿实现了
        </button>
      )}
      {!wish.archived && wish.status === "realized" && (
        <button
          className="button primary full"
          onClick={() => go({ page: "fulfill", id })}
        >
          来还个愿
        </button>
      )}
      {wish.status === "fulfilled" ? (
        <button
          className="button primary full"
          onClick={() => go({ page: "collection", id: `wish:${id}` })}
        >
          看看我的「如愿」纪念章
        </button>
      ) : (
        <button
          className="text-button archive-button"
          onClick={() =>
            dispatch({ type: "wish.archive", id, archived: !wish.archived })
          }
        >
          {wish.archived ? "重新拾起这个心愿" : "让这个心愿先休息。"}
        </button>
      )}
    </div>
  );
}
export function WishNote({ id }: { id: string }) {
  const { dispatch, go, state } = useApp();
  const [text, setText] = useState("");
  const wish = state.wishes.find((w) => w.id === id);
  if (!wish) return <Empty title="没找到这个心愿" body="回到心愿页看看吧。" />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dispatch({ type: "wish.note", id, noteId: uid(), text, at: now() }))
          go({ page: "wish", id });
      }}
      className="note-page"
    >
      <Art kind="crane" />
      <h1>每一步，都值得记住。</h1>
      <p className="page-subtitle">关于「{wish.title}」</p>
      <section className="form-card">
        <div className="field-heading">
          <label htmlFor="wish-note">我也在为它努力</label>
          <span>{text.length} / 500</span>
        </div>
        <textarea
          id="wish-note"
          required
          maxLength={500}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今天认真准备了自我介绍…"
        />
      </section>
      <button
        type="submit"
        className="button primary full"
        disabled={!text.trim()}
      >
        记下这一小步
      </button>
    </form>
  );
}
export function FulfillWish({ id }: { id: string }) {
  const { state, go, dispatch, fulfillmentDrafts, setFulfillmentDraft } =
    useApp();
  const wish = state.wishes.find((w) => w.id === id);
  const draft = fulfillmentDrafts[id] ?? {
    method: wish?.returnMethod ?? "kindness",
    text: "",
  };
  const { method, text } = draft;
  const setMethod = (method: ReturnMethod) =>
    setFulfillmentDraft(id, { ...draft, method });
  const setText = (text: string) => setFulfillmentDraft(id, { ...draft, text });
  if (!wish || wish.archived || wish.status !== "realized")
    return (
      <Empty
        title={
          wish?.status === "fulfilled"
            ? "这份美好，已经记住了。"
            : "先确认心愿实现，再来还愿。"
        }
        body="愿每一份认真，都有回应。"
        action="回到心愿"
        onClick={() => go({ page: "wish", id })}
      />
    );
  const completed = hasReturnRitual(state, wish);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      dispatch({
        type: "wish.fulfill",
        id,
        noteId: uid(),
        text,
        method,
        at: now(),
      })
    ) {
      setFulfillmentDraft(id);
      go({ page: "collection", id: `wish:${id}` });
    }
  }
  return (
    <div className="fulfill-page">
      <h1>好消息，值得被记住。</h1>
      <p className="page-subtitle">谢谢自己的努力，也谢谢遇到的善意。</p>
      <Art kind="lantern" variant="fulfill" />
      <form onSubmit={submit}>
        <section className="form-card fulfillment-card">
          <h2>这次，我想这样还愿</h2>
          <ReturnChoices value={method} onChange={setMethod} expanded />
          {method === "ritual" && (
            <div className="linked-ritual">
              {completed ? (
                <p>
                  <Icon name="check" />
                  已为这个心愿完成小仪式
                </p>
              ) : (
                <>
                  <p>折一只纸鹤，留下这份心情。</p>
                  <button
                    type="button"
                    className="button secondary full"
                    onClick={() =>
                      go({ page: "ritual", id: "crane", wishId: id })
                    }
                  >
                    {state.activeSession
                      ? "继续未完成的仪式"
                      : "去完成还愿小仪式"}
                  </button>
                </>
              )}
            </div>
          )}
          <div className="return-note">
            <div className="field-heading">
              <label htmlFor="return-note">
                {method === "kindness" ? "我做了什么…" : "此刻，我想说…"}
              </label>
              <span>{text.length} / 60</span>
            </div>
            <textarea
              id="return-note"
              rows={2}
              maxLength={60}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                method === "kindness"
                  ? "请帮助过我的朋友喝了一杯咖啡。"
                  : "谢谢一直认真努力的自己。"
              }
            />
          </div>
          <div className="badge-preview">
            <Art kind="badge" small />
            <div>
              <strong>获得一枚「如愿」纪念章</strong>
              <p>愿这份美好，继续传递下去。</p>
            </div>
          </div>
        </section>
        <button
          className="button primary full"
          type="submit"
          disabled={!text.trim() || (method === "ritual" && !completed)}
        >
          完成还愿
        </button>
      </form>
      <p className="leaf-footer">
        <Icon name="leaf" />
        把好事记下来。
        <Icon name="leaf" />
      </p>
    </div>
  );
}
