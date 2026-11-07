"use client";

import { useState } from "react";
import {
  PATTERN_OPTIONS,
  patternLayerStyle,
  resolvePatternColor,
  type BackgroundPattern,
} from "../../../lib/patterns";
import { ColorInput, RangeInput, ToggleInput } from "./controls";

// Draws the background pattern across the whole inner canvas.
// It is used by the preview and the PNG export, so both look the same.
export function PatternLayer({
  pattern,
  themeText,
}: {
  pattern: BackgroundPattern;
  themeText: string;
}) {
  if (pattern.type === "none") return null;

  // Opacity lives here, not in patternLayerStyle (see lib/patterns.ts).
  const opacity = pattern.opacity / 100;

  if (pattern.type === "dots") {
    // Same markup as the old DotPattern: at size 100 that is a 12x6 grid with 6px marks.
    // A smaller/larger size changes how many dots fit and how big they are.
    const columns = Math.max(1, Math.round((12 * 100) / pattern.size));
    const rows = Math.max(1, Math.round((6 * 100) / pattern.size));
    const mark = (6 * pattern.size) / 100;
    const color = resolvePatternColor(pattern, themeText);

    return (
      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          opacity,
        }}
      >
        {Array.from({ length: columns * rows }).map((_, index) => (
          <span
            key={index}
            className="m-auto rounded-full"
            style={{ width: mark, height: mark, background: color }}
          />
        ))}
      </div>
    );
  }

  const style = patternLayerStyle(pattern, themeText);
  if (!style) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ ...style, opacity }}
    />
  );
}

// The pattern picker for the sidebar: swatch grid, colour, size and strength.
export function PatternControls({
  pattern,
  onChange,
}: {
  pattern: BackgroundPattern;
  onChange: (next: BackgroundPattern) => void;
}) {
  // Remembers the last custom colour so "Match theme" off -> on -> off keeps it.
  const [customColor, setCustomColor] = useState(
    pattern.color === "theme" ? "#ffffff" : pattern.color,
  );
  const matchTheme = pattern.color === "theme";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {PATTERN_OPTIONS.map((option) => {
          const active = pattern.type === option.type;

          return (
            <button
              key={option.type}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...pattern, type: option.type })}
              className={[
                "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-bold transition",
                active
                  ? "border-violet-400 bg-violet-500/20 text-violet-200"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800",
              ].join(" ")}
            >
              {/* Mini preview on a dark tile; scaled-down size so the motif is visible. */}
              <span className="relative block h-10 w-full overflow-hidden rounded-lg bg-slate-800">
                <SwatchPreview type={option.type} />
              </span>
              {option.label}
            </button>
          );
        })}
      </div>

      {pattern.type !== "none" && (
        <>
          <ToggleInput
            label="Match theme"
            checked={matchTheme}
            onChange={(checked) =>
              onChange({ ...pattern, color: checked ? "theme" : customColor })
            }
          />

          {!matchTheme && (
            <ColorInput
              label="Pattern color"
              value={pattern.color}
              onChange={(value) => {
                setCustomColor(value);
                onChange({ ...pattern, color: value });
              }}
            />
          )}

          <RangeInput
            label="Pattern size"
            value={pattern.size}
            min={25}
            max={400}
            suffix="%"
            onChange={(value) => onChange({ ...pattern, size: value })}
          />

          <RangeInput
            label="Pattern strength"
            value={pattern.opacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => onChange({ ...pattern, opacity: value })}
          />
        </>
      )}
    </div>
  );
}

// Small fixed preview for one swatch. Reuses the real pattern CSS so swatch == result.
function SwatchPreview({ type }: { type: BackgroundPattern["type"] }) {
  if (type === "none") {
    return (
      <span className="absolute inset-0 flex items-center justify-center text-slate-500">
        ∅
      </span>
    );
  }

  // Dots has no CSS style (it is a grid of spans), so fake it with a radial gradient.
  const style =
    type === "dots"
      ? {
          backgroundImage: "radial-gradient(#cbd5e1 2px, transparent 2px)",
          backgroundSize: "10px 10px",
        }
      : patternLayerStyle(
          { type, color: "#cbd5e1", size: type === "glow" ? 25 : 60, opacity: 100 },
          "#cbd5e1",
        );

  return <span className="absolute inset-0 opacity-80" style={style ?? undefined} />;
}
