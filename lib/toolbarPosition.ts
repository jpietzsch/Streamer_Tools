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

export type MorePanelLayout = {
  toolbarLeft: number;
  toolbarTop: number;
  panelLeft: number;
  panelTop: number;
  // The panel's height cap; the panel scrolls inside when its content is taller.
  panelMaxHeight: number;
};

// Places the toolbar plus its open "More" panel as one block.
// Preferred: on the side of the anchor with more room (the toolbar moves there too), so the
// block never covers the anchor. When neither side can fit the toolbar and a minimal panel
// (e.g. a zoomed-in card filling the view), it falls back to the normal clamped toolbar
// position and stacks the panel on whichever side of the toolbar has more room. Covering
// the anchor is then unavoidable, but everything stays inside the bounds.
export function computeMorePanelPosition(
  anchor: Box,
  bounds: Box,
  toolbar: { width: number; height: number },
  // panel.height is the panel's natural (uncapped) content height.
  panel: { width: number; height: number },
  maxPanelHeight: number,
  gap = 8,
  panelGap = 4,
  minPanelHeight = 64,
): MorePanelLayout {
  const base = computeToolbarPosition(anchor, bounds, toolbar, gap);
  // The usable vertical range, keeping `gap` margin at the top and bottom.
  const minTop = bounds.top + gap;
  const maxBottom = bounds.top + bounds.height - gap;

  // Where the toolbar would go on each side, and whether toolbar + minimal panel fit there.
  const aboveTop = anchor.top - gap - toolbar.height;
  const belowTop = anchor.top + anchor.height + gap;
  const fitsAbove = aboveTop - panelGap - minPanelHeight >= minTop;
  const fitsBelow =
    belowTop + toolbar.height + panelGap + minPanelHeight <= maxBottom;

  const roomAbove = anchor.top - bounds.top;
  const roomBelow = bounds.top + bounds.height - (anchor.top + anchor.height);
  const preferAbove = roomAbove >= roomBelow;

  // Pick the toolbar's top and the side the panel stacks on.
  let toolbarTop: number;
  let panelSide: "above" | "below";

  if (fitsAbove && (preferAbove || !fitsBelow)) {
    toolbarTop = aboveTop;
    panelSide = "above";
  } else if (fitsBelow) {
    toolbarTop = belowTop;
    panelSide = "below";
  } else {
    // Fallback: the regular, already clamped position; the panel takes the roomier side.
    toolbarTop = base.top;
    const spaceAbove = toolbarTop - panelGap - minTop;
    const spaceBelow = maxBottom - (toolbarTop + toolbar.height + panelGap);
    panelSide = spaceAbove >= spaceBelow ? "above" : "below";
  }

  // Safety net: the toolbar itself never leaves the bounds.
  toolbarTop = clamp(toolbarTop, minTop, maxBottom - toolbar.height);

  // How tall the panel may get on its side (at least minPanelHeight).
  const room =
    panelSide === "above"
      ? toolbarTop - panelGap - minTop
      : maxBottom - (toolbarTop + toolbar.height + panelGap);
  const panelMaxHeight = Math.max(
    minPanelHeight,
    Math.min(maxPanelHeight, room),
  );
  const panelHeight = Math.min(panel.height, panelMaxHeight);

  const desiredPanelTop =
    panelSide === "above"
      ? toolbarTop - panelGap - panelHeight
      : toolbarTop + toolbar.height + panelGap;
  // Only matters in tiny bounds where even minPanelHeight doesn't fit: keep it visible.
  const panelTop = clamp(desiredPanelTop, minTop, maxBottom - panelHeight);

  const panelLeft = clamp(
    base.left,
    bounds.left + gap,
    bounds.left + bounds.width - gap - panel.width,
  );

  return {
    toolbarLeft: base.left,
    toolbarTop,
    panelLeft,
    panelTop,
    panelMaxHeight,
  };
}
