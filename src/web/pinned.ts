// An opened row's head, pinned over a panel's scroll (Sidebar.tsx): while
// the row's head has gone up past the top of the scroll and what it shows is
// still there, a copy of its head is drawn above the scroll, outside it, and
// the scroll's top edge moves down under it, so the scroll itself cuts off
// what goes up under the head (not a clip that has to keep up with it). What
// the scroll shows doesn't move as that edge does: it's moved up inside the
// scroll by just as much (--pin-shift). Pushed up by the end of its row, as
// a head stuck to the top of the scroll would be (--pin-push), its edge
// following it; then it's gone, and the next row's head, opened, takes its
// place as it reaches the top.
//
// Which row it is (and how far it's pushed) is worked out on each scroll,
// and as rows open, shut and change size: reading where the opened rows
// (data-pin, their keys) are, and nothing more.

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/** The row whose head is pinned: its key, and whether it's the first and last in its list (where the rail stops). */
export interface Pin {
  key: string;
  first: boolean;
  last: boolean;
}

const same = (a: Pin | null, b: Pin | null) => a === b || (!!a && !!b && a.key === b.key && a.first === b.first && a.last === b.last);

/** A custom property on an element, set (or, with "", taken off) only when it changes. */
function put(el: HTMLElement, name: string, value: string) {
  if (el.style.getPropertyValue(name) === value) return;
  if (value) el.style.setProperty(name, value);
  else el.style.removeProperty(name);
}

/**
 * The row whose head is pinned above `body` (the scroll), in `slot` (just
 * above it, outside it), with what's in the scroll in `content`. Sets the
 * slot's height and how far what's in the scroll moves up (--pin-shift),
 * and how far the head's pushed up (--pin-push), on `panel`.
 */
export function usePinnedHead(
  panel: RefObject<HTMLElement | null>,
  slot: RefObject<HTMLElement | null>,
  body: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
): Pin | null {
  const [pin, setPin] = useState<Pin | null>(null);
  const shown = useRef<Pin | null>(null);
  useLayoutEffect(() => {
    const aside = panel.current;
    const box = slot.current;
    const el = body.current;
    const inner = content.current;
    if (!aside || !box || !el || !inner) return;
    const place = (sync: boolean) => {
      // Where the scroll's top is with nothing pinned (the slot's top: its own line, or the scroll's), and what scrolls starts under that line.
      const origin = box.getBoundingClientRect().top + 1;
      let found: { row: HTMLElement; full: number; end: number } | null = null;
      for (const row of el.querySelectorAll<HTMLElement>("[data-pin]")) {
        const r = row.getBoundingClientRect();
        // Its head gone up past the top, and its row (but its line under it) still showing.
        const end = r.bottom - 1 - origin;
        if (r.top - origin >= 0 || end <= 0) continue;
        const head = row.querySelector<HTMLElement>(":scope > .layer-head");
        if (head) found = { row, full: head.getBoundingClientRect().height, end };
      }
      const next: Pin | null = found
        ? { key: found.row.dataset.pin!, first: !found.row.previousElementSibling, last: !found.row.nextElementSibling }
        : null;
      if (!same(next, shown.current)) {
        shown.current = next;
        // Drawn now, in the same frame as the scroll's edge moves for it.
        if (sync) flushSync(() => setPin(next));
        else setPin(next);
      }
      // Pushed up by the end of its row: its head's full height, less what's left of the row.
      const push = found && found.end < found.full ? found.full - found.end : 0;
      put(aside, "--pin-push", push > 0 ? `${push}px` : "");
      // Its line above it, then its head (what's left of it); the scroll's own line under it is the head's.
      put(aside, "--pin-shift", found ? `${1 + found.full - push}px` : "");
      // As wide as what's in the scroll: its scrollbar's room kept on the right.
      put(aside, "--pin-gutter", found ? `${el.offsetWidth - el.clientWidth}px` : "");
    };
    const onScroll = () => place(true);
    el.addEventListener("scroll", onScroll, { passive: true });
    // Rows opening and shutting (and easing as they do), and the panel resizing.
    const sizes = new ResizeObserver(() => place(true));
    sizes.observe(el);
    sizes.observe(inner);
    const changes = new MutationObserver(() => place(true));
    changes.observe(inner, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-pin"] });
    place(false);
    return () => {
      el.removeEventListener("scroll", onScroll);
      sizes.disconnect();
      changes.disconnect();
      for (const name of ["--pin-push", "--pin-shift", "--pin-gutter"]) aside.style.removeProperty(name);
    };
  }, [panel, slot, body, content]);
  return pin;
}

// A wheel's lines and pages, in px.
const LINE_PX = 16;

/** How fast a flung scroll slows (ms to fall to about a third). */
const FLING_MS = 325;
/** A finger has to move this far (px) before it's a scroll, not a tap (as the sheet's). */
const SLOP_PX = 4;

/**
 * Wheel and finger scrolls starting on the pinned head (`slot`, outside the
 * scroll) scroll `body`, as they would have on the head in the list. A
 * finger's scroll is let be if something on the head took it first (the
 * sheet growing before what's in it scrolls: its own handlers on the head,
 * which call preventDefault), and flung on as it's let go.
 */
export function useForwardScroll(slot: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const box = slot.current;
    const el = body.current;
    if (!box || !el) return;
    let fling = 0;
    const stop = () => {
      if (fling) cancelAnimationFrame(fling);
      fling = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      stop();
      const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? el.clientHeight : 1;
      el.scrollTop += e.deltaY * unit;
      e.preventDefault();
    };
    let t: { y: number; lastY: number; lastT: number; speed: number; moved: boolean } | null = null;
    const start = (e: TouchEvent) => {
      stop();
      if (e.touches.length !== 1) {
        t = null;
        return;
      }
      const y = e.touches[0]!.clientY;
      t = { y, lastY: y, lastT: e.timeStamp, speed: 0, moved: false };
    };
    const move = (e: TouchEvent) => {
      if (!t) return;
      const y = e.touches[0]!.clientY;
      if (!t.moved) {
        if (Math.abs(y - t.y) <= SLOP_PX) return;
        t.moved = true;
      }
      // Taken by the sheet (on a phone: it grows first): not a scroll, this time.
      if (e.defaultPrevented) {
        t = null;
        return;
      }
      e.preventDefault();
      el.scrollTop += t.lastY - y;
      const dt = Math.max(1, e.timeStamp - t.lastT);
      t.speed = 0.6 * ((t.lastY - y) / dt) + 0.4 * t.speed;
      [t.lastY, t.lastT] = [y, e.timeStamp];
    };
    const end = (e: TouchEvent) => {
      const g = t;
      t = null;
      if (!g?.moved || e.timeStamp - g.lastT > 100) return;
      let speed = g.speed;
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        const before = el.scrollTop;
        el.scrollTop += speed * dt;
        speed *= Math.exp(-dt / FLING_MS);
        fling = Math.abs(speed) > 0.02 && el.scrollTop !== before ? requestAnimationFrame(step) : 0;
      };
      if (Math.abs(speed) > 0.1) fling = requestAnimationFrame(step);
    };
    box.addEventListener("wheel", wheel, { passive: false });
    // Bubbling, so what's on the head itself (the sheet's) has had its say.
    box.addEventListener("touchstart", start, { passive: true });
    box.addEventListener("touchmove", move, { passive: false });
    box.addEventListener("touchend", end);
    box.addEventListener("touchcancel", end);
    // A new scroll in the list itself stops a fling.
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("wheel", stop, { passive: true });
    return () => {
      stop();
      box.removeEventListener("wheel", wheel);
      box.removeEventListener("touchstart", start);
      box.removeEventListener("touchmove", move);
      box.removeEventListener("touchend", end);
      box.removeEventListener("touchcancel", end);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("wheel", stop);
    };
  }, [slot, body]);
}

/**
 * Nothing in the pinned head (`slot`) takes the keyboard: it's a copy of
 * the head in the list, which does. Whatever's in it, as it changes, is
 * kept out of the tab order (still a pointer's to press).
 */
export function useUntabbable(slot: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const box = slot.current;
    if (!box) return;
    const out = () => {
      for (const node of box.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")) {
        if (node.getAttribute("tabindex") !== "-1") node.setAttribute("tabindex", "-1");
      }
    };
    out();
    const changes = new MutationObserver(out);
    changes.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ["tabindex"] });
    return () => changes.disconnect();
  }, [slot]);
}
