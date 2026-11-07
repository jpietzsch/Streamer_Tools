// One selection model for the Schedule Maker canvas.
// Only one thing can be selected at a time: a day, a sticker, a text box or a header part.

export type HeaderPart = "avatar" | "name" | "title" | "dates";

export type Selection =
  | { kind: "day"; index: number }
  | { kind: "sticker"; id: string }
  | { kind: "text"; id: string }
  | { kind: "header"; part: HeaderPart }
  | null;

// What currently exists on the canvas, used to check a stored selection is still valid.
export type SelectionState = {
  dayCount: number;
  stickerIds: string[];
  textBoxIds: string[];
  headerParts: HeaderPart[];
};

// Returns the selection unchanged when its target still exists, otherwise null.
// The page runs this during render, so a deleted or hidden element simply stops being selected.
export function clampSelection(
  selection: Selection,
  state: SelectionState,
): Selection {
  if (selection === null) return null;
  switch (selection.kind) {
    case "day":
      return selection.index >= 0 && selection.index < state.dayCount
        ? selection
        : null;
    case "sticker":
      return state.stickerIds.includes(selection.id) ? selection : null;
    case "text":
      return state.textBoxIds.includes(selection.id) ? selection : null;
    case "header":
      return state.headerParts.includes(selection.part) ? selection : null;
  }
}

// A stable string per selectable element. Canvas elements carry it as data-select-key,
// so later code can find the element in the DOM with a CSS attribute selector.
export function selectionKey(selection: NonNullable<Selection>): string {
  switch (selection.kind) {
    case "day":
      return `day-${selection.index}`;
    case "sticker":
      return `sticker-${selection.id}`;
    case "text":
      return `text-${selection.id}`;
    case "header":
      return `header-${selection.part}`;
  }
}
