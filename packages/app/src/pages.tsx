import { localizedTitle } from './localization';
import { translate as tr, message } from '@wbr/i18n';
import { LanguageSetting } from './language-setting';
import { useState } from "react";
import { rituals, type Collectible } from "@wbr/core";
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { Art, Icon } from "./art";
import { formatDate, statusText, useApp } from "./context";
import { ritualTitle } from "./home";
import { SceneCard, useOpenRitual, useOpenScene, useSceneLibrary, } from "./scene-library";
import { SceneArt, hasSceneIcon } from "./scene-icons";
import { PageHead } from "./page-heading";
import { WishRitualRack } from "./wish-ritual-rack";
export function Empty({ title, body, action, onClick, }: {
    title: string;
    body: string;
    action?: string;
    onClick?: () => void;
}) {
    return (<div className="empty">
      <Icon name="leaf"/>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (<button className="button secondary" onClick={onClick}>
          {action}
        </button>)}
    </div>);
}
export function Wishes() {
    const { state, go, arrival } = useApp();
    const [filter, setFilter] = useState("active");
    const wishes = state.wishes.filter(w => filter === "archived"
        ? w.archived
        : !w.archived && (filter === "active" ? w.status !== "fulfilled" : w.status === "fulfilled"));
    return (<div className="wishes-page">
      <PageHead title={tr("\u6211\u7684\u5FC3\u613F")}/>
      <WishRitualRack />
      <div className="filter-row" role="group" aria-label={tr("\u5FC3\u613F\u7B5B\u9009")}>
        {[["active", tr("\u8FDB\u884C\u4E2D")], ["fulfilled", tr("\u5DF2\u5982\u613F")], ["archived", tr("\u5148\u653E\u4E0B")]].map(([id, label]) => (<button key={id} aria-pressed={filter === id} className={filter === id ? "selected" : ""} onClick={() => setFilter(id)}>{label}</button>))}
      </div>
      {wishes.length ? (<div className="wish-list">
          {wishes.map(w => {
                const flying = arrival?.wishId === w.id && arrival.phase === "flying";
                const isNew = arrival?.wishId === w.id && arrival.phase === "landed";
                return <button key={w.id} className={`wish-card${isNew ? " reward-landed" : ""}`} data-wish-id={w.id} data-arriving={flying ? "" : undefined} onClick={() => go({ page: "wish", id: w.id })}>
              {w.sourceSceneId && hasSceneIcon(w.sourceSceneId) && <SceneArt id={w.sourceSceneId}/>}
              <span className="wish-card-copy">
                <span className="tag soft wish-row-status">{w.archived ? tr("\u6682\u65F6\u653E\u4E0B") : tr(statusText[w.status])}</span>
                <strong>{w.title}</strong>
                <small>{message('app.wish.created', { date: formatDate(w.createdAt) })}{message('app.wish.noteCount', { n: w.notes.length })}</small>
              </span>
              <Icon name="arrow"/>
              {isNew && <span className="new-mark">{tr("\u65B0")}</span>}
            </button>;
            })}
        </div>) : (<div className="wish-empty">
          <h2>{filter === "active" ? tr("\u8FD8\u6CA1\u6709\u8BB0\u4E0B\u5FC3\u613F") : filter === "fulfilled" ? tr("\u8FD8\u6CA1\u6709\u5982\u613F\u7684\u8BB0\u5F55") : tr("\u8FD8\u6CA1\u6709\u653E\u4E0B\u7684\u5FC3\u613F")}</h2>
          <p>{filter === "active" ? tr("\u5148\u5B8C\u6210\u4E00\u573A\u5C0F\u4EEA\u5F0F\uFF0C\u518D\u7559\u4E0B\u4E00\u53E5\u8BDD\u3002") : tr("\u6BCF\u4E2A\u5FC3\u613F\uFF0C\u90FD\u6709\u81EA\u5DF1\u7684\u65F6\u95F4\u3002")}</p>
        </div>)}
      <button className="button primary full pray-button" onClick={() => go({ page: "new" })}>{tr("\u53BB\u8BB8\u613F")}</button>
      <p className="privacy-note">{tr("\u5FC3\u613F\u4EC5\u4FDD\u5B58\u5728\u8FD9\u53F0\u8BBE\u5907\u4E0A\u3002")}</p>
    </div>);
}
/** Historical ritual kinds share their matching scene's current illustration. */
function CollectibleArt({ kind, sceneId, small, }: {
    kind: Collectible["kind"];
    sceneId?: string;
    small?: boolean;
}) {
    if (kind === "scene")
        return <SceneArt id={sceneId ?? ""}/>;
    if (kind === "badge")
        return <Art kind="badge" small={small}/>;
    return <SceneArt id={kind}/>;
}
export function World() {
    const { state, go, arrival } = useApp();
    // This room's landing states: the newest slot is hidden while its sticker
    // flies, then pops in with a 新 ring, and the count pill bumps.
    const slotState = (id: string) => arrival?.collectibleId === id
        ? arrival.phase === "flying"
            ? "flying"
            : "landed"
        : null;
    const bumped = arrival?.collectibleId && arrival.phase === "landed";
    return (<>
      <PageHead eyebrow={tr("\u628A\u6BCF\u4E00\u4EFD\u5C0F\u7F8E\u597D\uFF0C\u90FD\u7559\u5728\u8FD9\u91CC")} title={tr("\u6211\u7684\u5C0F\u5929\u5730")}>
        <span className={`count-pill${bumped ? " pill-bump" : ""}`} key={bumped ? arrival!.key : "count"}>
          {message('app.collection.count', { n: state.collectibles.length })}
        </span>
      </PageHead>
      <div className="room">
        <div className="room-window">
          <span />
          <span />
        </div>
        <div className="room-caption">{tr("\u4E00\u9685\u5B89\u9759\uFF0C\u6162\u6162\u4E30\u76DB\u3002")}</div>
        <div className="room-shelf">
          {state.collectibles.slice(-3).map((c) => {
            const slot = slotState(c.id);
            return (<button key={c.id} aria-label={tr("\u67E5\u770B{p0}", { p0: localizedTitle(c) })} data-collectible-id={c.id} data-arriving={slot === "flying" ? "" : undefined} className={slot === "landed" ? "reward-landed" : undefined} onClick={() => go({ page: "collection", id: c.id })}>
                <CollectibleArt kind={c.kind} sceneId={c.sceneId} small/>
                {slot === "landed" && (<>
                    <span className="new-mark">{tr("\u65B0")}</span>
                    <span className="reward-sparks" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </>)}
              </button>);
        })}
          {!state.collectibles.length && (<span className="empty-shelf">{tr("\u7559\u4E2A\u4F4D\u7F6E\uFF0C\u7ED9\u5373\u5C06\u5230\u6765\u7684\u7F8E\u597D")}</span>)}
        </div>
        <div className="room-floor"/>
      </div>
      <div className="settings-card">
        <button className="settings-row" onClick={() => go({ page: "history" })}>
          <span>{tr("\u4EEA\u5F0F\u65F6\u5149")}</span>
          <Icon name="arrow"/>
        </button>
      </div>
      <div className="section-heading">
        <h2>{tr("\u65F6\u5149\u91CC\u7684\u5C0F\u6536\u85CF")}</h2>
        <span>{tr("\u6BCF\u4E00\u4EF6\uFF0C\u90FD\u6709\u6765\u5904")}</span>
      </div>
      {state.collectibles.length ? (<div className="collection-grid">
          {[...state.collectibles].reverse().map((c) => {
                const slot = slotState(c.id);
                return (<button key={c.id} className={`collection-card${slot === "landed" ? " reward-landed" : ""}`} data-collectible-id={c.id} data-arriving={slot === "flying" ? "" : undefined} onClick={() => go({ page: "collection", id: c.id })}>
                <CollectibleArt kind={c.kind} sceneId={c.sceneId} small/>
                <strong>{localizedTitle(c)}</strong>
                <small>{formatDate(c.at)}</small>
              </button>);
            })}
        </div>) : (<Empty title={tr("\u5C0F\u5929\u5730\uFF0C\u7B49\u4F60\u6162\u6162\u586B\u6EE1")} body={tr("\u5B8C\u6210\u4E00\u4E2A\u5C0F\u4EEA\u5F0F\uFF0C\u628A\u7B2C\u4E00\u4EF6\u6536\u85CF\u5E26\u56DE\u5BB6\u3002")} action={tr("\u53BB\u505A\u4E2A\u5C0F\u4EEA\u5F0F")} onClick={() => go({ page: "today" })}/>)}
    </>);
}
export function CollectionDetail({ id }: {
    id: string;
}) {
    const { state, go } = useApp();
    const { entries } = useSceneLibrary();
    const openScene = useOpenScene();
    const item = state.collectibles.find((c) => c.id === id);
    if (!item)
        return <Empty title={tr("\u8FD9\u4EF6\u6536\u85CF\u8FD8\u6CA1\u5230\u5BB6")} body={tr("\u5148\u53BB\u5B8C\u6210\u4E00\u4E2A\u5C0F\u4EEA\u5F0F\u5427\u3002")}/>;
    const wish = state.wishes.find((w) => w.id === item.wishId);
    const sceneEntry = item.kind === "scene" && item.sceneId
        ? entries.find((e) => e.id === item.sceneId)
        : undefined;
    // A spent vessel remembers the wish it 还愿-ed for through its note.
    const spentFor = item.spentAt
        ? state.wishes.find((w) => w.notes.some((n) => n.id === `vessel:${item.id}`))
        : undefined;
    return (<>
      <PageHead eyebrow={tr("\u5C5E\u4E8E\u4F60\u7684\u72EC\u4E00\u4EFD\u8BB0\u5FC6")} title={localizedTitle(item)}/>
      <CollectibleArt kind={item.kind} sceneId={item.sceneId}/>
      <div className="form-card">
        <span className="tag">
          {item.kind === "badge"
            ? tr("\u8FD8\u613F\u7EAA\u5FF5") : item.kind === "scene"
            ? item.wishScene
                ? tr("\u8BB8\u613F\u5C0F\u7269") : tr("\u7948\u798F\u5C0F\u7269")
            : tr("\u4EEA\u5F0F\u6536\u85CF")}
        </span>
        <h2>{formatDate(item.at)}{tr("\uFF0C\u7559\u4F4F\u4E00\u70B9\u7F8E\u597D\u3002")}</h2>
        <p className="quiet">
          {item.kind === "badge"
            ? tr("\u66FE\u7ECF\u8BA4\u771F\u8BB8\u4E0B\u7684\u613F\u671B\uFF0C\u5982\u4ECA\u6210\u4E3A\u4E86\u751F\u6D3B\u7684\u4E00\u90E8\u5206\u3002") : item.kind === "scene"
            ? tr("\u8FD9\u679A\u5C0F\u7269\uFF0C\u6765\u81EA\u4F60\u5B8C\u6210\u7684\u300C{p0}\u300D\u4EEA\u5F0F\u3002", { p0: localizedTitle(item) }) : tr("\u8FD9\u4EF6{p0}\uFF0C\u6765\u81EA\u4F60\u4E3A\u81EA\u5DF1\u7559\u4E0B\u7684\u4E00\u6BB5\u5B89\u9759\u65F6\u5149\u3002", { p0: localizedTitle(item) })}
        </p>
        {item.kind === "scene" && item.wishScene && item.spentAt && (<p className="quiet vessel-spent-line">
            {spentFor ? tr("\u5DF2\u66FF\u300C{p0}\u300D\u8FD8\u8FC7\u613F", { p0: spentFor.title }) : tr("\u5DF2\u62FF\u53BB\u8BB8\u8FC7\u613F")}
          </p>)}
        {sceneEntry && (<button className="button secondary" onClick={() => openScene(sceneEntry, { replay: true })}>{tr("\u56DE\u770B\u8FD9\u573A\u4EEA\u5F0F")}<Icon name="arrow"/>
          </button>)}
        {wish && (<button className="button secondary" onClick={() => go({ page: "wish", id: wish.id })}>{tr("\u770B\u770B\u5173\u8054\u7684\u5FC3\u613F")}<Icon name="arrow"/>
          </button>)}
      </div>
    </>);
}
export function Me() {
    const { state, dispatch, go, canHaptic } = useApp();
    return (<>
      <PageHead title={tr("\u6211\u7684")}/>
      <div className="settings-card">
        <LanguageSetting />
        <button className="settings-row" onClick={() => go({ page: 'privacy' })}><span>{tr("\u9690\u79C1\u653F\u7B56")}</span><Icon name="arrow"/></button>
        <button className="settings-row" onClick={() => go({ page: 'support' })}><span>{tr("\u6280\u672F\u652F\u6301")}</span><Icon name="arrow"/></button>
        <button className="settings-row" onClick={() => go({ page: "scenes" })}><span>{tr("\u573A\u666F\u76EE\u5F55")}</span><Icon name="arrow"/></button>
        <button className="settings-row" onClick={() => go({ page: "cache" })}><span>{tr("\u8D44\u6E90\u7F13\u5B58")}</span><Icon name="arrow"/></button>
        {([
            ["sound", tr("\u4EEA\u5F0F\u58F0\u97F3"), tr("\u7ED9\u5B89\u9759\u7684\u65F6\u523B\u4E00\u70B9\u56DE\u54CD")],
            ["haptics", tr("\u8F7B\u89E6\u53CD\u9988"), tr("\u6BCF\u4E00\u6B65\uFF0C\u90FD\u6709\u6E29\u67D4\u56DE\u5E94")],
            ["reducedMotion", tr("\u51CF\u5C11\u52A8\u6001\u6548\u679C"), tr("\u8BA9\u753B\u9762\u66F4\u5B89\u9759")],
        ] as const)
            // No 轻触反馈 where the host cannot vibrate (iOS browsers).
            .filter(([key]) => key !== "haptics" || canHaptic)
            .map(([key, title, sub]) => (<label className="settings-row" key={key}>
              <span>
                {title}
                <small>{sub}</small>
              </span>
              <input type="checkbox" className="switch" checked={state.settings[key]} onChange={(e) => dispatch({ type: "settings", key, value: e.target.checked })}/>
            </label>))}
      </div>
    </>);
}
/**
 * 仪式时光's line for a ritual walked as its scene: it left a note on its
 * wish, without an extra keepsake.
 */
export const HISTORY_SCENE_LINE = "场景体验";
export function History() {
    const { state } = useApp();
    const openRitual = useOpenRitual();
    const openScene = useOpenScene();
    const records = state.sceneRecords.filter(isSceneVisibleInApp);
    return (<>
      <PageHead eyebrow={tr("\u4F60\u7559\u7ED9\u81EA\u5DF1\u7684\u6BCF\u4E00\u5206\u949F")} title={tr("\u4EEA\u5F0F\u65F6\u5149")}/>
      <div className="scene-catalog">
        {records.map((record) => (<SceneCard key={record.id} id={record.id} title={`${localizedTitle(record)}${record.favorite ? tr(" \u00B7 \u5DF2\u6536\u85CF") : ""}`} onClick={() => openScene(record)}>
            <small>{message('app.history.progress', { n: record.progress })}</small>
          </SceneCard>))}
      </div>
      {state.sessions.length ? (<ol className="timeline">
          {[...state.sessions].reverse().map((s) => {
                const collected = state.collectibles.some(c => c.id === `ritual:${s.id}`);
                const wish = state.wishes.find((w) => w.id === s.wishId);
                return (<li key={s.id}>
                <small>{formatDate(s.completedAt!)}</small>
                {/* The title the ritual has everywhere else, not the core
                            name, which a 3D scene in the list above may share. */}
                <h3>{tr(ritualTitle[s.ritual])}</h3>
                <p>
                  {collected
                        ? tr("\u6536\u85CF\u4E86{p0}", { p0: tr(rituals[s.ritual].object) }) : wish
                        ? tr("{p0} \u00B7 \u4E3A\u300C{p1}\u300D\u8BB0\u4E86\u4E00\u7B14", { p0: tr(HISTORY_SCENE_LINE), p1: wish.title }) : tr(HISTORY_SCENE_LINE)}
                </p>
                {isSceneVisibleInApp({ id: s.ritual }) && <button className="text-button" onClick={() => openRitual(s.ritual)}>{tr("\u518D\u6B21\u4F53\u9A8C")}</button>}
              </li>);
            })}
        </ol>) : records.length ? null : (<Empty title={state.sceneRecords.length ? tr("\u6682\u65E0\u53EF\u56DE\u770B\u7684\u573A\u666F") : tr("\u6545\u4E8B\u624D\u521A\u521A\u5F00\u59CB")} body={tr("\u5B8C\u6210\u7684\u5C0F\u4EEA\u5F0F\uFF0C\u4F1A\u4E00\u4E00\u8BB0\u5728\u8FD9\u91CC\u3002")}/>)}
    </>);
}
