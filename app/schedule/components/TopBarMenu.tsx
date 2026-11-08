import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type JSX,
  type MouseEvent,
  type ReactNode,
} from "react";

// The panel's width in pixels (Tailwind w-80); narrower when the window is.
const PANEL_WIDTH = 320;
// Space kept between the panel and the window edges, and below the button.
const EDGE_GAP = 8;

// Mark a button (or a wrapper around a file input) with this attribute to close the
// menu once it is used: <button data-closes-menu ...>. Settings like colours or text
// fields leave it out, so the menu stays open while you edit them.
export const CLOSES_MENU = { "data-closes-menu": "" } as const;

type PanelPosition = { left: number; top: number; width: number; maxHeight: number };

// A top-bar button that opens a panel of settings below it (Project, Theme, ...).
// The panel closes on Escape, on a press outside it, when focus leaves it, and when an
// action marked with CLOSES_MENU is used.
export function TopBarMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  // Where the open panel sits on screen, or null while it is closed.
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const open = position !== null;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  function openPanel(): void {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    // The panel is `position: fixed`, so it is measured against the window. Fixed (not
    // absolute) because the top bar wraps on phones and a menu near the right edge
    // would otherwise hang off the screen.
    const rect = button.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE_GAP * 2);
    // Start under the button, but slide left if it would cross the right edge.
    const left = Math.max(
      EDGE_GAP,
      Math.min(rect.left, window.innerWidth - width - EDGE_GAP),
    );
    const top = rect.bottom + EDGE_GAP;
    // At most 70% of the window, and never past its bottom edge (the panel scrolls).
    const maxHeight = Math.min(
      window.innerHeight * 0.7,
      window.innerHeight - top - EDGE_GAP,
    );

    setPosition({ left, top, width, maxHeight });
  }

  function closePanel(returnFocus: boolean): void {
    setPosition(null);

    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }

  // Move focus into the panel when it opens, so keyboard users land on its first control.
  useEffect(() => {
    if (open) {
      panelRef.current
        ?.querySelector<HTMLElement>("button, input, select, textarea, [href]")
        ?.focus();
    }
  }, [open]);

  // Escape and presses outside, only while open.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") {
        return;
      }

      // Listening on window in the capture phase runs before every other key handler.
      // stopPropagation then keeps this Escape from also reaching the floating toolbar
      // (which would close the selected element's toolbar too).
      event.stopPropagation();
      event.preventDefault();
      setPosition(null);
      buttonRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      // Capture phase too: canvas elements stop their own pointer-down events, and a
      // press on one of them must still close the menu.
      if (target instanceof Node && !wrapperRef.current?.contains(target)) {
        setPosition(null);
      }
    }

    // Window size changes would leave the fixed panel in the wrong place.
    function handleResize(): void {
      setPosition(null);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  // Tabbing past the last control (or Shift+Tab before the button) closes the menu.
  // relatedTarget is where focus went; null means "nowhere in particular" (for example a
  // click on empty panel space), which is not a reason to close.
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const next = event.relatedTarget;

    if (open && next instanceof Node && !wrapperRef.current?.contains(next)) {
      closePanel(false);
    }
  }

  // Closes after an action marked with CLOSES_MENU. File inputs are the exception: they
  // close on change instead, because closing on click would remove the input before
  // the file picker could hand it the chosen file.
  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.closest("[data-closes-menu]")) {
      return;
    }

    // A click on a file input, or on the label around one (which opens the picker).
    const opensFilePicker =
      (target instanceof HTMLInputElement && target.type === "file") ||
      target.closest("label")?.querySelector('input[type="file"]');

    if (!opensFilePicker) {
      closePanel(true);
    }
  }

  function handleChange(event: ChangeEvent<HTMLDivElement>): void {
    const target = event.target;

    if (
      target instanceof HTMLInputElement &&
      target.type === "file" &&
      target.closest("[data-closes-menu]")
    ) {
      closePanel(true);
    }
  }

  return (
    <div ref={wrapperRef} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        // Only point at the panel while it exists.
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? closePanel(false) : openPanel())}
        className={[
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
          open
            ? "bg-violet-500/20 text-violet-200"
            : "text-slate-300 hover:bg-slate-800 hover:text-white",
        ].join(" ")}
      >
        {icon}
        {label}
      </button>

      {position && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          onClick={handleClick}
          onChange={handleChange}
          className="fixed z-[70] space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200 shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
