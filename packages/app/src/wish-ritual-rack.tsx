import { localizedTitle } from './localization';
import { translate as tr, message } from '@wbr/i18n';
import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { sceneIntention } from "@wbr/core";
import { formatDate, useApp } from "./context";
import { supportsScene, useOpenScene, useSceneLibrary } from "./scene-library";
import { WishObjectPreview, type WishObjectPreviewHandle } from "./wish-object-preview";
import { wishObjectFeedback } from "./wish-object-feedback";
import { isWishCollectionScene } from "./vessels";
import { Icon } from "./art";

/** Each collected copy stays separate; touching the display never spends it. */
export function WishRitualRack() {
    const { state, go, prepareFeedback, feedback } = useApp();
    const { entries } = useSceneLibrary();
    const openScene = useOpenScene();
    const rackId = useId(), hintId = useId();
    const strip = useRef<HTMLDivElement>(null);
    const previews = useRef(new Map<string, WishObjectPreviewHandle>());
    const drag = useRef<{ id: number; x: number; y: number; left: number } | null>(null);
    const suppressClick = useRef(false);
    const [edges, setEdges] = useState({ start: true, end: false });
    const [hintVisible, setHintVisible] = useState(false);
    const items = [...state.collectibles].reverse().flatMap(item => {
        if (item.kind !== "scene" || !item.sceneId) return [];
        const entry = entries.find(entry => entry.id === item.sceneId);
        if (!entry) return [];
        if (!isWishCollectionScene(entry.id)) return [];
        const status = !item.wishScene ? "kept" as const : item.spentAt
            ? state.vesselDrafts?.[item.id] ? "pending" as const : "used" as const
            : "unused" as const;
        return [{ item, entry, status }];
    }).sort((a, b) => {
        const rank = { pending: 0, unused: 1, used: 2, kept: 3 };
        return rank[a.status] - rank[b.status];
    });
    useEffect(() => {
        setHintVisible(false);
        if (!items.length) return;
        let timer: number | undefined, alive = true, focused = document.hasFocus();
        const cancel = () => {
            window.clearTimeout(timer);
            timer = undefined;
        };
        const restart = () => {
            cancel();
            setHintVisible(false);
            if (!focused || document.hidden) return;
            timer = window.setTimeout(() => {
                if (alive && focused && !document.hidden) setHintVisible(true);
            }, 3000);
        };
        const blur = () => { focused = false; restart(); };
        const focus = () => { focused = true; restart(); };
        const events = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'keydown', 'input', 'wheel', 'scroll'];
        for (const event of events) document.addEventListener(event, restart, { capture: true, passive: true });
        document.addEventListener('visibilitychange', restart);
        window.addEventListener('blur', blur);
        window.addEventListener('focus', focus);
        restart();
        return () => {
            alive = false;
            cancel();
            for (const event of events) document.removeEventListener(event, restart, true);
            document.removeEventListener('visibilitychange', restart);
            window.removeEventListener('blur', blur);
            window.removeEventListener('focus', focus);
        };
    }, [items.length]);
    const reducedMotion = state.settings.reducedMotion ||
        (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    useEffect(() => {
        if (reducedMotion) strip.current?.querySelectorAll<HTMLElement>(".wish-rack-charm")
            .forEach(charm => charm.getAnimations?.().forEach(animation => animation.cancel()));
    }, [reducedMotion]);
    function updateEdges() {
        const row = strip.current;
        if (!row?.clientWidth) return;
        const start = row.scrollLeft <= 1, end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
        setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    }
    useLayoutEffect(() => {
        const row = strip.current;
        if (!row) return;
        updateEdges();
        const observer = typeof ResizeObserver === "function" ? new ResizeObserver(updateEdges) : undefined;
        observer?.observe(row);
        return () => observer?.disconnect();
    }, [items.length]);
    function browse(direction: number) {
        const row = strip.current;
        row?.scrollBy({ left: direction * row.clientWidth * .9, behavior: reducedMotion ? "instant" : "smooth" });
    }
    function endDrag(event: PointerEvent<HTMLDivElement>) {
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.classList.remove("is-dragging");
        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!items.length) return null;
    const unused = items.filter(({ status }) => status === "unused").length;
    return <section className="wish-ritual-rack" aria-label={tr("祈愿仪式")}>
      <header className="wish-rack-heading">
        <h2>{tr("祈愿仪式")}</h2>
        <span className="wish-rack-count">{message('app.vessels.unused.count', { n: unused })}</span>
        {items.length > 3 && <span className="wish-rack-navigation">
          <button type="button" aria-label={tr("向前浏览小物")} aria-controls={rackId} disabled={edges.start} onClick={() => browse(-1)}><Icon name="back"/></button>
          <button type="button" aria-label={tr("向后浏览小物")} aria-controls={rackId} disabled={edges.end} onClick={() => browse(1)}><Icon name="arrow"/></button>
        </span>}
      </header>
      <p className="wish-rack-hint" id={hintId} data-visible={hintVisible} aria-hidden={!hintVisible}
        data-reduced-motion={reducedMotion ? 'true' : undefined}>{tr("点按小物，听听回应")}</p>
      <div id={rackId} ref={strip} className="wish-rack-row" onScroll={updateEdges}
        onPointerDown={event => {
            if (event.button !== 0) return;
            suppressClick.current = false;
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft };
        }} onPointerMove={event => {
            const start = drag.current;
            if (!start || start.id !== event.pointerId) return;
            if (event.pointerType === "mouse" && event.buttons === 0) {
                endDrag(event);
                return;
            }
            const distance = event.clientX - start.x;
            // Touch scrolling stays native. Both touch and mouse drags suppress the trailing click.
            if (Math.abs(distance) > 8 && Math.abs(distance) > Math.abs(event.clientY - start.y))
                suppressClick.current = true;
            if (event.pointerType === "mouse" && suppressClick.current) {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                event.currentTarget.classList.add("is-dragging");
                event.currentTarget.scrollLeft = start.left - distance;
            }
        }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onClickCapture={event => {
            if (suppressClick.current && event.detail !== 0) {
                event.preventDefault();
                event.stopPropagation();
            }
        }} onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".wish-rack-item")];
            const slot = (event.target as HTMLElement).closest(".wish-rack-slot");
            const index = buttons.findIndex(button => button.closest(".wish-rack-slot") === slot);
            if (index < 0) return;
            event.preventDefault();
            buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))]?.focus();
        }}>
        {items.map(({ item, entry, status }) => {
            const label = status === "kept" ? tr("已完成") : status === "pending" ? tr("接着刚才") : status === "unused" ? tr("未用") : tr("已用");
            const canOpen = supportsScene(entry.engine) &&
                (status === "pending" || (status === "unused" && sceneIntention(entry.id)?.optionalWish));
            return <article className="wish-rack-slot" key={item.id} data-rack-status={status}>
              <button type="button" className="wish-rack-item" data-scene={entry.id} data-collectible-id={item.id} data-rack-status={status}
                aria-label={localizedTitle(entry)} aria-describedby={hintVisible ? hintId : undefined} onClick={event => {
                    prepareFeedback();
                    const response = wishObjectFeedback(entry.id);
                    feedback(response.sound);
                    const charm = event.currentTarget.querySelector<HTMLElement>(".wish-rack-charm");
                    if (!reducedMotion && !previews.current.get(item.id)?.tap() && charm?.animate) {
                        charm.getAnimations().forEach(animation => animation.cancel());
                        charm.animate(response.motion, response.timing);
                    }
                }}>
                <span className="wish-rack-charm" aria-hidden="true">
                  <WishObjectPreview entry={entry} variant={state.sceneRecords.find(record => record.id === entry.id)?.variant}
                    ref={preview => { if (preview) previews.current.set(item.id, preview); else previews.current.delete(item.id); }}/>
                </span>
              </button>
              <button type="button" className="wish-rack-open" aria-label={tr("{p0}，{p1}，{p2}收下，{p3}", { p0: localizedTitle(entry), p1: label, p2: formatDate(item.at), p3: canOpen ? tr("进入仪式") : tr("查看收藏") })}
                onClick={() => canOpen ? openScene(entry, { vessel: item.id }) : go({ page: "collection", id: item.id })}>
                <strong>{localizedTitle(entry)}</strong>
                <span className="wish-rack-status">{label}<Icon name="arrow"/></span>
              </button>
            </article>;
        })}
      </div>
    </section>;
}
