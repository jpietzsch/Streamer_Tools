import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  computeMorePanelPosition,
  computeToolbarPosition,
  type Box,
} from "../../../lib/toolbarPosition";

// Below 640px (Tailwind's `sm` breakpoint) the toolbar docks to the bottom of the screen.
const DOCKED_QUERY = "(max-width: 639px)";
// Space between the anchor, the toolbar and the "More" panel, in pixels.
const GAP = 8;
const PANEL_GAP = 4;
// The panel never gets shorter than this, even when there is hardly any room.
const MIN_PANEL_HEIGHT = 64;
// Everything a keyboard user can Tab to inside the toolbar.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FloatingToolbarProps = {
  // The data-select-key of the selected canvas element the toolbar belongs to.
  anchorKey: string;
  // The preview area. The anchor is searched for inside it and it is the toolbar's bounds.
  containerRef: RefObject<HTMLElement | null>;
  // Accessible name of the toolbar, e.g. "Sticker cat.png".
  label: string;
  // Extra settings shown in the "More" panel. No "More" button when left out.
  more?: ReactNode;
  // Called when Escape closes the toolbar (the page then clears the selection).
  onClose: () => void;
  children: ReactNode;
};

// What every element toolbar (Day, Sticker, ...) passes straight through to FloatingToolbar.
export type ToolbarFrameProps = Pick<
  FloatingToolbarProps,
  "anchorKey" | "containerRef" | "label" | "onClose"
>;

// useSyncExternalStore reads the media query without a setState-in-effect.
function subscribeToDocked(onChange: () => void): () => void {
  const query = window.matchMedia(DOCKED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getDockedSnapshot(): boolean {
  return window.matchMedia(DOCKED_QUERY).matches;
}

// On the server there is no viewport; assume the floating (desktop) layout.
function getDockedServerSnapshot(): boolean {
  return false;
}

// The canvas element the toolbar is attached to, or null if it isn't rendered.
function findAnchor(
  container: HTMLElement | null,
  anchorKey: string,
): HTMLElement | null {
  // CSS.escape keeps ids with odd characters from breaking the selector.
  return (
    container?.querySelector<HTMLElement>(
      `[data-select-key="${CSS.escape(anchorKey)}"]`,
    ) ?? null
  );
}

// Positions the toolbar (and the open "More" panel) by writing their styles directly.
// Writing to the DOM instead of calling setState means re-measuring never causes another
// render, and the lint rule against setState inside effects stays happy.
function placeToolbar(
  container: HTMLElement | null,
  toolbar: HTMLElement | null,
  panel: HTMLElement | null,
  anchorKey: string,
): void {
  const anchorElement = findAnchor(container, anchorKey);
  // offsetParent is the positioned ancestor the toolbar's `left`/`top` are relative to.
  const offsetParent = toolbar?.offsetParent;

  if (!container || !toolbar || !anchorElement || !offsetParent) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const parentRect = offsetParent.getBoundingClientRect();
  const anchorRect = anchorElement.getBoundingClientRect();

  // Work in the container's coordinate space: its top-left corner is (0, 0).
  const bounds: Box = {
    left: 0,
    top: 0,
    width: containerRect.width,
    height: containerRect.height,
  };
  const anchor: Box = {
    left: anchorRect.left - containerRect.left,
    top: anchorRect.top - containerRect.top,
    width: anchorRect.width,
    height: anchorRect.height,
  };
  // offsetWidth/offsetHeight ignore transforms, so this is the toolbar's real size.
  const toolbarSize = {
    width: toolbar.offsetWidth,
    height: toolbar.offsetHeight,
  };

  // Converts container-space coordinates into the offset parent's space for style.left/top.
  const offsetX = containerRect.left - parentRect.left;
  const offsetY = containerRect.top - parentRect.top;

  if (!panel) {
    const position = computeToolbarPosition(anchor, bounds, toolbarSize, GAP);
    toolbar.style.left = `${position.left + offsetX}px`;
    toolbar.style.top = `${position.top + offsetY}px`;
    return;
  }

  // The panel's natural content height: scrollHeight ignores the current max-height cap,
  // and offsetHeight - clientHeight adds the border back on.
  const panelSize = {
    width: panel.offsetWidth,
    height: panel.scrollHeight + (panel.offsetHeight - panel.clientHeight),
  };
  // Never taller than 60% of the viewport (the function also caps it to the free room).
  const layout = computeMorePanelPosition(
    anchor,
    bounds,
    toolbarSize,
    panelSize,
    window.innerHeight * 0.6,
    GAP,
    PANEL_GAP,
    MIN_PANEL_HEIGHT,
  );

  toolbar.style.left = `${layout.toolbarLeft + offsetX}px`;
  toolbar.style.top = `${layout.toolbarTop + offsetY}px`;
  panel.style.maxHeight = `${layout.panelMaxHeight}px`;
  panel.style.left = `${layout.panelLeft + offsetX}px`;
  panel.style.top = `${layout.panelTop + offsetY}px`;
}

// The floating toolbar shown above (or below) the selected canvas element.
// Render it OUTSIDE the scaled canvas, next to the preview area inside a positioned
// (`relative`) ancestor, so it stays at normal size and never ends up in an exported PNG.
// Not inside the preview area itself: its wheel listener would zoom the canvas instead of
// scrolling the "More" panel.
// Give it key={anchorKey} so the "More" panel closes when the selection changes.
export function FloatingToolbar({
  anchorKey,
  containerRef,
  label,
  more,
  onClose,
  children,
}: FloatingToolbarProps): JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false);
  const docked = useSyncExternalStore(
    subscribeToDocked,
    getDockedSnapshot,
    getDockedServerSnapshot,
  );

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  // The latest onClose, so the key listener below doesn't re-subscribe on every render.
  const onCloseRef = useRef(onClose);
  const panelId = useId();

  const showPanel = more !== undefined && moreOpen;

  // No dependency list on purpose: re-measure after every render, because the page
  // re-renders on every drag step, zoom and pan, and the anchor may have moved.
  useLayoutEffect(() => {
    onCloseRef.current = onClose;

    if (docked) {
      // React never touches the styles placeToolbar wrote, so after switching from
      // floating to docked (window made narrow) they must be cleared by hand.
      for (const element of [toolbarRef.current, panelRef.current]) {
        element?.style.removeProperty("left");
        element?.style.removeProperty("top");
        element?.style.removeProperty("max-height");
      }
    } else {
      placeToolbar(
        containerRef.current,
        toolbarRef.current,
        panelRef.current,
        anchorKey,
      );
    }
  });

  // Things that move the anchor without a React render of this component.
  useEffect(() => {
    const container = containerRef.current;

    if (docked || !container) {
      return;
    }

    function handleChange(): void {
      placeToolbar(
        containerRef.current,
        toolbarRef.current,
        panelRef.current,
        anchorKey,
      );
    }

    window.addEventListener("resize", handleChange);
    container.addEventListener("transitionend", handleChange);
    container.addEventListener("scroll", handleChange);

    return () => {
      window.removeEventListener("resize", handleChange);
      container.removeEventListener("transitionend", handleChange);
      container.removeEventListener("scroll", handleChange);
    };
  }, [anchorKey, containerRef, docked]);

  // Escape and Tab handling. One document listener covers focus in the toolbar, in the
  // panel, on the anchor itself, or nowhere (after clicking a sticker, focus stays on body).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const toolbar = toolbarRef.current;
      const panel = panelRef.current;
      const anchor = findAnchor(containerRef.current, anchorKey);
      const inToolbar = toolbar?.contains(target) ?? false;
      const inPanel = panel?.contains(target) ?? false;
      const onAnchor = target === anchor;

      if (event.key === "Escape") {
        if (!inToolbar && !inPanel && !onAnchor && target !== document.body) {
          // Escape in some other input (like a top-bar menu) is not ours.
          return;
        }

        event.preventDefault();

        if (moreOpen) {
          // First Escape: only close "More", and keep focus on its button.
          setMoreOpen(false);
          moreButtonRef.current?.focus();
          return;
        }

        // Second Escape: hand focus back to the canvas element, then close.
        anchor?.focus();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab" && toolbar) {
        const focusables = Array.from(
          toolbar.querySelectorAll<HTMLElement>(FOCUSABLE),
        );
        const first = focusables[0];
        // The open "More" panel comes after the toolbar, so its last control is the end.
        const last = Array.from(
          (panel ?? toolbar).querySelectorAll<HTMLElement>(FOCUSABLE),
        ).at(-1);

        if (onAnchor && !event.shiftKey && first) {
          // The toolbar lives elsewhere in the DOM, so jump into it by hand.
          event.preventDefault();
          first.focus();
        } else if (target === first && event.shiftKey && anchor) {
          // And Shift+Tab from its first control goes back to the anchor.
          event.preventDefault();
          anchor.focus();
        } else if (target === last && !event.shiftKey && anchor) {
          // Tab past the end continues on the canvas with the element after the anchor,
          // as if the toolbar sat right behind it. Without this, focus would fall off the
          // end of the page. The last element has no next one, so the browser takes over.
          const canvasElements = Array.from(
            containerRef.current?.querySelectorAll<HTMLElement>(
              "[data-select-key]",
            ) ?? [],
          );
          const next = canvasElements[canvasElements.indexOf(anchor) + 1];

          if (next) {
            event.preventDefault();
            next.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorKey, containerRef, moreOpen]);

  // Keeps a press inside the toolbar from reaching the canvas (no pan, no deselect,
  // no sticker drag).
  function stopPointer(event: ReactPointerEvent<HTMLElement>): void {
    event.stopPropagation();
  }

  const toolbar = (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={label}
      onPointerDown={stopPointer}
      className={[
        "flex items-center gap-2 border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200",
        docked
          ? "w-full overflow-x-auto border-t"
          : // w-max keeps it on one line; max-w stops it growing wider than the preview,
            // and flex-wrap moves the controls onto a second line when it hits that cap.
            "pointer-events-auto absolute z-50 w-max max-w-[calc(100%-16px)] flex-wrap rounded-xl border shadow-lg",
      ].join(" ")}
    >
      {children}

      {more !== undefined && (
        <button
          ref={moreButtonRef}
          type="button"
          aria-expanded={moreOpen}
          // Only point at the panel while it exists; a missing id confuses screen readers.
          aria-controls={moreOpen ? panelId : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          className={[
            "shrink-0 rounded-lg px-2 py-1 text-xs font-bold transition",
            moreOpen
              ? "bg-violet-500/20 text-violet-200"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
          ].join(" ")}
        >
          More
        </button>
      )}
    </div>
  );

  const panel = showPanel ? (
    <div
      ref={panelRef}
      id={panelId}
      role="group"
      aria-label={`More settings for ${label}`}
      onPointerDown={stopPointer}
      className={[
        // max-h-[60vh] is the hard cap; when floating, placeToolbar may lower it further.
        "max-h-[60vh] overflow-y-auto border-slate-700 bg-slate-900 p-3 text-sm text-slate-200",
        docked
          ? "w-full border-t"
          : "pointer-events-auto absolute z-50 w-72 max-w-[calc(100%-16px)] rounded-xl border shadow-lg",
      ].join(" ")}
    >
      {more}
    </div>
  ) : null;

  // The same wrapper in both modes, so React keeps the same toolbar DOM node when the
  // window crosses 640px (a different tree would make React reuse nodes with stale styles).
  // Docked: flex-col-reverse shows the panel above the toolbar while keeping the toolbar
  // first in the DOM, so Tab still goes toolbar -> panel.
  // Floating: `contents` makes the wrapper box disappear, so the absolutely positioned
  // toolbar and panel are placed relative to the page's positioned preview section.
  return (
    <div
      className={
        docked
          ? "fixed inset-x-0 bottom-0 z-50 flex flex-col-reverse shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.6)]"
          : "contents"
      }
    >
      {toolbar}
      {panel}
    </div>
  );
}
