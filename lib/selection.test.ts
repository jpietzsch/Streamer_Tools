import { test } from "node:test";
import assert from "node:assert/strict";
import { clampSelection, selectionKey } from "./selection.ts";
import type { HeaderPart } from "./selection.ts";

// A small editor state used by every clamp test; tests override what they need.
function state(
  overrides: {
    dayCount?: number;
    stickerIds?: string[];
    textBoxIds?: string[];
    headerParts?: HeaderPart[];
  } = {},
) {
  return {
    dayCount: 7,
    stickerIds: ["s1"],
    textBoxIds: ["t1"],
    headerParts: ["avatar", "name", "title", "dates"] as HeaderPart[],
    ...overrides,
  };
}

test("keeps a day index that is still inside the schedule", () => {
  assert.deepEqual(
    clampSelection({ kind: "day", index: 6 }, state({ dayCount: 7 })),
    {
      kind: "day",
      index: 6,
    },
  );
});

test("drops a day index once the schedule is shorter", () => {
  assert.equal(
    clampSelection({ kind: "day", index: 6 }, state({ dayCount: 6 })),
    null,
  );
});

test("drops a sticker whose id no longer exists", () => {
  assert.equal(clampSelection({ kind: "sticker", id: "gone" }, state()), null);
});

test("keeps a sticker whose id exists", () => {
  assert.deepEqual(clampSelection({ kind: "sticker", id: "s1" }, state()), {
    kind: "sticker",
    id: "s1",
  });
});

test("drops a text box whose id no longer exists", () => {
  assert.equal(clampSelection({ kind: "text", id: "gone" }, state()), null);
});

test("drops a header part that is not rendered", () => {
  assert.equal(
    clampSelection(
      { kind: "header", part: "avatar" },
      state({ headerParts: ["name"] }),
    ),
    null,
  );
});

test("null stays null", () => {
  assert.equal(clampSelection(null, state()), null);
});

test("selectionKey for a day", () => {
  assert.equal(selectionKey({ kind: "day", index: 3 }), "day-3");
});

test("selectionKey for a sticker", () => {
  assert.equal(selectionKey({ kind: "sticker", id: "abc" }), "sticker-abc");
});

test("selectionKey for a text box", () => {
  assert.equal(selectionKey({ kind: "text", id: "abc" }), "text-abc");
});

test("selectionKey for a header part", () => {
  assert.equal(selectionKey({ kind: "header", part: "name" }), "header-name");
});
