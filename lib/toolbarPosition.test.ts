import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMorePanelPosition,
  computeToolbarPosition,
} from "./toolbarPosition.ts";
import type { Box } from "./toolbarPosition.ts";

// Every case uses the same bounds and toolbar size from the brief.
const BOUNDS: Box = { left: 0, top: 0, width: 1000, height: 600 };
const TOOLBAR = { width: 300, height: 40 };

test("centres above the anchor when there is room", () => {
  const anchor: Box = { left: 400, top: 300, width: 200, height: 100 };
  assert.deepEqual(computeToolbarPosition(anchor, BOUNDS, TOOLBAR), {
    left: 350,
    top: 252,
    placement: "above",
  });
});

test("flips below the anchor when above would cross the top bound", () => {
  const anchor: Box = { left: 400, top: 10, width: 200, height: 100 };
  assert.deepEqual(computeToolbarPosition(anchor, BOUNDS, TOOLBAR), {
    left: 350,
    top: 118,
    placement: "below",
  });
});

test("clamps left into the right edge with gap margin", () => {
  const anchor: Box = { left: 900, top: 300, width: 100, height: 50 };
  const result = computeToolbarPosition(anchor, BOUNDS, TOOLBAR);
  assert.equal(result.left, 692);
  assert.equal(result.placement, "above");
});

test("clamps left into the left edge with gap margin", () => {
  const anchor: Box = { left: 0, top: 300, width: 50, height: 50 };
  const result = computeToolbarPosition(anchor, BOUNDS, TOOLBAR);
  assert.equal(result.left, 8);
  assert.equal(result.placement, "above");
});

test("an anchor taller than the bounds goes below and stays inside the bottom", () => {
  const anchor: Box = { left: 400, top: -50, width: 200, height: 800 };
  const result = computeToolbarPosition(anchor, BOUNDS, TOOLBAR);
  assert.equal(result.placement, "below");
  assert.ok(result.top + TOOLBAR.height <= BOUNDS.height - 8);
  assert.ok(result.top >= BOUNDS.top + 8);
});

// "More" panel placement. Toolbar 300×40, panel 288 wide, gap 8, panel gap 4, min 64.
const PANEL = { width: 288, height: 200 };
const SMALL_BOUNDS: Box = { left: 0, top: 0, width: 1000, height: 500 };

// True when a vertical span [top, top + height] lies inside the bounds' gap margins.
function insideBounds(top: number, height: number, bounds: Box): boolean {
  return (
    top >= bounds.top + 8 && top + height <= bounds.top + bounds.height - 8
  );
}

test("More: stacks toolbar and panel above the anchor when there is room", () => {
  const anchor: Box = { left: 400, top: 400, width: 200, height: 100 };
  const result = computeMorePanelPosition(anchor, BOUNDS, TOOLBAR, PANEL, 1000);
  assert.equal(result.toolbarTop, 352);
  assert.equal(result.panelTop, 352 - 4 - 200);
  assert.equal(result.panelMaxHeight, 352 - 4 - 8);
});

test("More: moves to the roomier side below the anchor when it fits", () => {
  const anchor: Box = { left: 400, top: 100, width: 200, height: 50 };
  const result = computeMorePanelPosition(anchor, BOUNDS, TOOLBAR, PANEL, 1000);
  assert.equal(result.toolbarTop, 158);
  assert.equal(result.panelTop, 158 + 40 + 4);
});

test("More: a zoomed-in anchor bigger than the view keeps everything on screen (A)", () => {
  const anchor: Box = { left: 300, top: -200, width: 400, height: 900 };
  const result = computeMorePanelPosition(
    anchor,
    SMALL_BOUNDS,
    TOOLBAR,
    PANEL,
    1000,
  );
  assert.ok(insideBounds(result.toolbarTop, TOOLBAR.height, SMALL_BOUNDS));
  assert.ok(
    insideBounds(
      result.panelTop,
      Math.min(PANEL.height, result.panelMaxHeight),
      SMALL_BOUNDS,
    ),
  );
  // The panel doesn't overlap the toolbar.
  assert.ok(
    result.panelTop + Math.min(PANEL.height, result.panelMaxHeight) <=
      result.toolbarTop,
  );
});

test("More: little room on both sides falls back inside the bounds (B)", () => {
  const anchor: Box = { left: 300, top: 50, width: 400, height: 410 };
  const result = computeMorePanelPosition(
    anchor,
    SMALL_BOUNDS,
    TOOLBAR,
    PANEL,
    1000,
  );
  assert.ok(insideBounds(result.toolbarTop, TOOLBAR.height, SMALL_BOUNDS));
  assert.ok(
    insideBounds(
      result.panelTop,
      Math.min(PANEL.height, result.panelMaxHeight),
      SMALL_BOUNDS,
    ),
  );
});

test("More: the panel height is capped by the max (60vh) and by the room", () => {
  const anchor: Box = { left: 400, top: 500, width: 200, height: 50 };
  const tall = { width: 288, height: 5000 };
  const capped = computeMorePanelPosition(anchor, BOUNDS, TOOLBAR, tall, 300);
  assert.equal(capped.panelMaxHeight, 300);
  const byRoom = computeMorePanelPosition(anchor, BOUNDS, TOOLBAR, tall, 1000);
  assert.equal(byRoom.panelMaxHeight, 452 - 4 - 8);
  assert.equal(byRoom.panelTop, 8);
});
