// Background patterns for the schedule editor. Pure logic only: this file turns a
// pattern setting into CSS properties. Opacity is NOT part of the style; the layer
// that uses it applies `opacity` itself.
// Everything is a CSS gradient or an inline SVG data URI (never an http URL),
// so html-to-image can export it to PNG.

export type PatternType =
  | "none" | "dots" | "grid" | "stripes" | "checker" | "waves"
  | "zigzag" | "hearts" | "sparkles" | "grain" | "glow";

export type BackgroundPattern = {
  type: PatternType;
  color: "theme" | string; // "theme" = use the theme's text colour, otherwise #rrggbb
  size: number; // percent of the base tile, 25 to 400
  opacity: number; // 0 to 100
};

export const PATTERN_OPTIONS: Array<{ type: PatternType; label: string }> = [
  { type: "none", label: "None" },
  { type: "dots", label: "Dots" },
  { type: "grid", label: "Grid" },
  { type: "stripes", label: "Stripes" },
  { type: "checker", label: "Checker" },
  { type: "waves", label: "Waves" },
  { type: "zigzag", label: "Zigzag" },
  { type: "hearts", label: "Hearts" },
  { type: "sparkles", label: "Sparkles" },
  { type: "grain", label: "Grain" },
  { type: "glow", label: "Glow blobs" },
];

export const DEFAULT_PATTERN: BackgroundPattern = {
  type: "dots",
  color: "theme",
  size: 100,
  opacity: 20,
};

const TYPES: string[] = PATTERN_OPTIONS.map((o) => o.type);

// Type guard: checks data (for example from localStorage) really is a BackgroundPattern.
export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" && TYPES.includes(v.type) &&
    typeof v.color === "string" && (v.color === "theme" || /^#[0-9a-fA-F]{6}$/.test(v.color)) &&
    typeof v.size === "number" && v.size >= 25 && v.size <= 400 &&
    typeof v.opacity === "number" && v.opacity >= 0 && v.opacity <= 100
  );
}

export function resolvePatternColor(pattern: BackgroundPattern, themeText: string): string {
  return pattern.color === "theme" ? themeText : pattern.color;
}

// Scales a base pixel length by the size percentage; rounded to keep the CSS short.
function px(base: number, size: number): string {
  return `${Math.round(base * size) / 100}px`;
}

// Wraps an SVG string into a CSS url(). encodeURIComponent turns "#" into "%23",
// which is required inside data URIs.
function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const HEART_PATH = "M12 21 C4 14 2 10 2 7.5 A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 22 7.5 C22 10 20 14 12 21 Z";
const SPARKLE_PATH = "M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z";

// A 40x40 tile with one icon, offset so tiling looks evenly spaced.
function iconTile(path: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path transform="translate(10 10) scale(0.8)" d="${path}" fill="${color}"/></svg>`;
}

// "#rrggbb" -> [r, g, b] as 0..1 numbers (what SVG colour matrices use). Falls back to white.
function hexToUnit(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

// 160x160 noise tile. feColorMatrix paints every pixel in the colour and takes its
// alpha from the noise's red channel (alpha = 1.6 * R - 0.5), so only the brighter
// noise specks show up.
function grainTile(color: string): string {
  const [r, g, b] = hexToUnit(color).map((n) => n.toFixed(3));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 1.6 0 0 0 -0.5"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`;
}

// CSS for one absolutely positioned pattern layer, or null when there is nothing
// to draw ("none") or the dedicated dots component handles it ("dots").
export function patternLayerStyle(
  pattern: BackgroundPattern,
  themeText: string,
): Record<string, string> | null {
  const c = resolvePatternColor(pattern, themeText);
  const s = pattern.size;

  switch (pattern.type) {
    case "none":
    case "dots":
      return null;
    case "grid":
      return {
        backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
        backgroundSize: `${px(22, s)} ${px(22, s)}`,
      };
    case "stripes":
      // Diagonal bands: 10px colour, 10px gap at 100%.
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${c} 0 ${px(10, s)}, transparent ${px(10, s)} ${px(20, s)})`,
        backgroundSize: "auto",
      };
    case "checker":
      return {
        backgroundImage: `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0)`,
        backgroundSize: `${px(28, s)} ${px(28, s)}`,
      };
    case "waves":
      return {
        backgroundImage: `radial-gradient(circle at 50% 100%, transparent ${px(9, s)}, ${c} ${px(10, s)} ${px(12, s)}, transparent ${px(13, s)})`,
        backgroundSize: `${px(26, s)} ${px(14, s)}`,
      };
    case "zigzag":
      // A real zigzag line: a 24x12 SVG tile whose line starts and ends at the same
      // height, so the tiles join into one continuous zigzag.
      return {
        backgroundImage: svgUrl(
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12"><path d="M0 9 L6 3 L12 9 L18 3 L24 9" fill="none" stroke="${c}" stroke-width="1.5"/></svg>`,
        ),
        backgroundSize: `${px(24, s)} ${px(12, s)}`,
      };
    case "hearts":
      return {
        backgroundImage: svgUrl(iconTile(HEART_PATH, c)),
        backgroundSize: `${px(40, s)} ${px(40, s)}`,
      };
    case "sparkles":
      return {
        backgroundImage: svgUrl(iconTile(SPARKLE_PATH, c)),
        backgroundSize: `${px(40, s)} ${px(40, s)}`,
      };
    case "grain":
      // Fractal noise from an SVG filter, tinted with the pattern colour. Random noise
      // reads as subtle grain; regular dot grids looked like a mesh. The tile is
      // stitched so the repeat has no visible seam. color-interpolation-filters="sRGB" makes the
      // filter use the colour as written; the default (linearRGB) made mid-tones too light.
      return {
        backgroundImage: svgUrl(grainTile(c)),
        backgroundSize: `${px(160, s)} ${px(160, s)}`,
      };
    case "glow":
      // Two big soft blobs. "closest-side" ends each blob exactly at the nearest tile
      // edge, so the blobs never get cut off (that made visible seams between tiles).
      return {
        backgroundImage: `radial-gradient(circle closest-side at 33% 35%, ${c}, transparent), radial-gradient(circle closest-side at 72% 70%, ${c}, transparent)`,
        backgroundSize: `${px(400, s)} ${px(400, s)}`,
      };
  }
}
