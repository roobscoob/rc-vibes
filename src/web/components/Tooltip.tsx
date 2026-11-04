// The glass card that floats beside something to say what it is: over the
// map, a light's id and what it's showing (RoomMap's LightTooltip) or what a
// box being dragged would select; elsewhere, whatever it's given. Placed at
// a point (CSS px, in its container, or on the screen with `fixed`), on one
// side of it. It never takes the pointer.

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "right" | "left" | "above" | "below";

// Each side, as a shift from the point: the card's middle beside it, or over it.
const SHIFT: Record<TooltipSide, string> = {
  right: "translateY(-50%)",
  left: "translate(-100%, -50%)",
  above: "translate(-50%, -100%)",
  below: "translateX(-50%)",
};

interface Props {
  x: number;
  y: number;
  side: TooltipSide;
  /** On the screen (over everything, in the page's body), not in its container. */
  fixed?: boolean;
  className?: string;
  children: ReactNode;
}

// How near the screen's edge a card on the screen may come.
const EDGE = 8;

export function Tooltip({ x, y, side, fixed = false, className, children }: Props) {
  // On the screen, a card by something near its edge is slid back along it, onto the screen.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!fixed || !el) return;
    el.style.translate = "";
    const r = el.getBoundingClientRect();
    const dx = Math.max(EDGE - r.left, Math.min(0, innerWidth - EDGE - r.right));
    el.style.translate = dx ? `${dx}px 0` : "";
  });
  const card = (
    <div ref={ref} className={["tooltip", fixed && "fixed", className].filter(Boolean).join(" ")} style={{ left: x, top: y, transform: SHIFT[side] }} role="tooltip">
      {children}
    </div>
  );
  return fixed ? createPortal(card, document.body) : card;
}
