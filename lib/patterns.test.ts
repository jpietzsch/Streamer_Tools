import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PATTERN,
  PATTERN_OPTIONS,
  isBackgroundPattern,
  patternLayerStyle,
  resolvePatternColor,
} from "./patterns.ts";
import type { BackgroundPattern, PatternType } from "./patterns.ts";

test("isBackgroundPattern accepts valid patterns", () => {
  assert.ok(isBackgroundPattern(DEFAULT_PATTERN));
  assert.ok(isBackgroundPattern({ type: "hearts", color: "#ff00aa", size: 25, opacity: 0 }));
  assert.ok(isBackgroundPattern({ type: "glow", color: "theme", size: 400, opacity: 100 }));
});

test("isBackgroundPattern rejects invalid values", () => {
  const bad: unknown[] = [
    { ...DEFAULT_PATTERN, type: "retro" },
    { ...DEFAULT_PATTERN, color: "red" },
    { ...DEFAULT_PATTERN, color: "#fff" },
    { ...DEFAULT_PATTERN, size: 24 },
    { ...DEFAULT_PATTERN, size: 401 },
    { ...DEFAULT_PATTERN, opacity: -1 },
    { ...DEFAULT_PATTERN, opacity: 101 },
    { type: "dots", color: "theme", size: 100 },
    null,
  ];
  for (const value of bad) assert.equal(isBackgroundPattern(value), false);
});

test("resolvePatternColor uses theme text or the custom hex", () => {
  assert.equal(resolvePatternColor({ ...DEFAULT_PATTERN, color: "theme" }, "#020617"), "#020617");
  assert.equal(resolvePatternColor({ ...DEFAULT_PATTERN, color: "#ff00aa" }, "#020617"), "#ff00aa");
});

const STYLED: PatternType[] = [
  "grid", "stripes", "checker", "waves", "zigzag", "hearts", "sparkles", "grain", "glow",
];

test("patternLayerStyle returns null for none and dots", () => {
  assert.equal(patternLayerStyle({ ...DEFAULT_PATTERN, type: "none" }, "#020617"), null);
  assert.equal(patternLayerStyle({ ...DEFAULT_PATTERN, type: "dots" }, "#020617"), null);
});

test("patternLayerStyle gives every other type a local, coloured image", () => {
  for (const type of STYLED) {
    const style = patternLayerStyle({ ...DEFAULT_PATTERN, type, color: "#12ab34" }, "#020617");
    assert.ok(style, type);
    assert.ok(style.backgroundImage.length > 0, type);
    // Colour appears raw (gradients) or URL-encoded (SVG data URIs); grain is monochrome noise.
    if (type !== "grain") {
      assert.match(style.backgroundImage, /#12ab34|%2312ab34/i, type);
    }
    // No remote URLs: html-to-image must be able to export the layer. The SVG xmlns
    // attribute is a namespace id, not a fetched URL, so remove it before checking.
    const withoutNamespace = style.backgroundImage.replace(
      encodeURIComponent("http://www.w3.org/2000/svg"),
      "",
    );
    assert.doesNotMatch(withoutNamespace, /http/, type);
  }
});

test("patternLayerStyle falls back to the theme colour", () => {
  const style = patternLayerStyle({ ...DEFAULT_PATTERN, type: "grid" }, "#020617");
  assert.match(style!.backgroundImage, /#020617/);
});

test("doubling size doubles the tile size", () => {
  const tile = (size: number): number => {
    const p: BackgroundPattern = { ...DEFAULT_PATTERN, type: "grid", size };
    return parseFloat(patternLayerStyle(p, "#020617")!.backgroundSize);
  };
  assert.equal(tile(200), tile(100) * 2);
});

test("PATTERN_OPTIONS lists 11 patterns without retro", () => {
  assert.equal(PATTERN_OPTIONS.length, 11);
  assert.ok(!PATTERN_OPTIONS.some((o) => (o.type as string) === "retro"));
  assert.equal(PATTERN_OPTIONS[0].type, "none");
  assert.equal(PATTERN_OPTIONS[10].label, "Glow blobs");
});
