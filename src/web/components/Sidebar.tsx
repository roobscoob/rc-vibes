// The panels beside the map, both made of the same parts: the layers' along
// the left (ShadersPanel.tsx), the selection's along the right
// (SelectionPanel.tsx). A Sidebar is the glass column: a head (its title and
// what's done to all of it, on the right) over a body that scrolls. Inside,
// a SidebarSection is a titled part of what's open (a title, a subtitle, and
// what's done to it on the right), and Fields (Field.tsx) are its rows: one
// layout, one spacing, left and right.

import { forwardRef, useImperativeHandle, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { usePinnedHead, useForwardScroll, useUntabbable, type Pin } from "../pinned.ts";

interface SidebarProps {
  side: "left" | "right";
  /** What it's called, for screen readers. */
  label: string;
  /** Its title, big, in the head (with whatever's after it, an asterisk). */
  head: ReactNode;
  /** What's done to all of it, on the head's right (icon buttons). */
  actions?: ReactNode;
  /** Its own extra classes (the selection's sheet's states, on a phone). */
  className?: string;
  style?: HTMLAttributes<HTMLElement>["style"];
  /** The head: before its title, a grabber (a button, for the keyboard), and what takes a drag (the sheet's). */
  headRef?: RefObject<HTMLDivElement | null>;
  headProps?: HTMLAttributes<HTMLDivElement>;
  grabber?: ButtonHTMLAttributes<HTMLButtonElement>;
  bodyRef?: RefObject<HTMLDivElement | null>;
  /**
   * An opened row's head, pinned above the body (pinned.ts), as the row
   * (`data-pin`, its key) draws it in the list: its <li>, without what it
   * opens to.
   */
  pinned?: (pin: Pin) => ReactNode;
  /** What holds the pinned head, for what takes a finger's drag on it (the sheet's). */
  pinRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/** A glass column over the map's edge: its head, then its body, scrolling. */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { side, label, head, actions, className, style, headRef, headProps, grabber, bodyRef, pinned, pinRef, children },
  ref,
) {
  const aside = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => aside.current!, []);
  const ownBody = useRef<HTMLDivElement>(null);
  const body = bodyRef ?? ownBody;
  const ownPinHead = useRef<HTMLDivElement>(null);
  const pinHead = pinRef ?? ownPinHead;
  const slot = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pin = usePinnedHead(aside, slot, body, content);
  useForwardScroll(slot, body);
  useUntabbable(slot);
  return (
    <aside ref={aside} className={["sidebar", side, className].filter(Boolean).join(" ")} aria-label={label} style={style}>
      <div className="sidebar-head" ref={headRef} {...headProps}>
        {grabber && <button className="sidebar-grabber" {...grabber} />}
        <h2 className="sidebar-title">{head}</h2>
        {actions}
      </div>
      {/* A copy of the head in the list, which is the one for the keyboard and screen readers. */}
      <div className="sidebar-pin" ref={slot} aria-hidden="true">
        <div className="sidebar-pin-head" ref={pinHead}>
          {pin && pinned && (
            <ol className={["layers", pin.first && "first", pin.last && "last"].filter(Boolean).join(" ")}>{pinned(pin)}</ol>
          )}
        </div>
      </div>
      <div className="sidebar-body" ref={body}>
        <div className="sidebar-content" ref={content}>
          {children}
        </div>
      </div>
    </aside>
  );
});

interface SectionProps {
  /** Its title: small, in capitals, as a field's name is. */
  title: string;
  /** Under the title, if anything. */
  subtitle?: ReactNode;
  /** On the title's right: a value, or what's done to it. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A titled part of what a row opens to: its fields, spaced as fields are. */
export function SidebarSection({ title, subtitle, actions, children }: SectionProps) {
  return (
    <section className="sidebar-section">
      <div className="field-head">
        <span className="label">{title}</span>
        {typeof actions === "string" ? <span className="mono">{actions}</span> : actions}
      </div>
      {subtitle && <p className="sidebar-subtitle">{subtitle}</p>}
      {children !== undefined && <div className="fields">{children}</div>}
    </section>
  );
}

/** What a row opens to, under it: its sections or fields, each 20px apart. */
export function SidebarDetails({ children }: { children: ReactNode }) {
  return <div className="layer-details fields">{children}</div>;
}
