// What a screen reader hears while a layer's moved by keyboard in the layers
// panel (ShadersPanel.tsx): the layer by its name, and where it is among the
// ones that move, as the panel lists them (by position, top of the panel
// first), rather than dnd-kit's own, which says the layers' internal keys.

import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from "@dnd-kit/core";

export const reorderInstructions: ScreenReaderInstructions = {
  draggable: "To move this layer, press Space, then the up and down arrows. Space again drops it; Escape puts it back.",
};

/** The announcements for moving layers listed in this order (their keys), by their names. */
export function reorderAnnouncements(listed: readonly string[], nameOf: (key: string) => string): Announcements {
  const name = (id: UniqueIdentifier) => nameOf(String(id));
  const at = (id: UniqueIdentifier) => `position ${listed.indexOf(String(id)) + 1} of ${listed.length}`;
  return {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}, at ${at(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} is at ${at(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over && over.id !== active.id ? `Dropped ${name(active.id)} at ${at(over.id)}.` : `Dropped ${name(active.id)}, still at ${at(active.id)}.`,
    onDragCancel: ({ active }) => `Put ${name(active.id)} back, at ${at(active.id)}.`,
  };
}
