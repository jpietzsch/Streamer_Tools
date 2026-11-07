// Pure positioning for the floating editor toolbar. No DOM access, so it can be unit tested.
// All boxes share one coordinate space (the preview area's client rect).

export type Box = { left: number; top: number; width: number; height: number };

// Keeps a value inside [min, max]. If min > max (the box is too small), min wins,
// so the toolbar never ends up above the bounds' top-left margin.
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function computeToolbarPosition(
  anchor: Box,
  bounds: Box,
  toolbar: { width: number; height: number },
  gap = 8,
): { left: number; top: number; placement: "above" | "below" } {
  // Centre the toolbar horizontally on the anchor.
  const centredLeft = anchor.left + anchor.width / 2 - toolbar.width / 2;

  // Try above first: `gap` pixels over the anchor's top edge.
  const aboveTop = anchor.top - gap - toolbar.height;
  // Flip below when "above" would cross the top of the bounds (plus the margin).
  const placement: "above" | "below" =
    aboveTop < bounds.top + gap ? "below" : "above";
  // Below sits `gap` pixels under the anchor's bottom edge.
  const desiredTop =
    placement === "above" ? aboveTop : anchor.top + anchor.height + gap;

  // Clamp left so the toolbar keeps `gap` margin from both side edges of the bounds.
  const left = clamp(
    centredLeft,
    bounds.left + gap,
    bounds.left + bounds.width - gap - toolbar.width,
  );
  // Clamp top so the toolbar stays between the top and bottom margins
  // (this is what keeps a very tall anchor from pushing it off the bottom).
  const top = clamp(
    desiredTop,
    bounds.top + gap,
    bounds.top + bounds.height - gap - toolbar.height,
  );

  return { left, top, placement };
}
