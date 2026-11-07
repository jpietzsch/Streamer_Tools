import { test } from "node:test";
import assert from "node:assert/strict";
import { computeToolbarPosition } from "./toolbarPosition.ts";
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
