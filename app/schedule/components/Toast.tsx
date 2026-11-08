import { useEffect, useRef, type JSX } from "react";

export type ToastMessage = {
  type: "success" | "error" | "info";
  text: string;
};

// How long a success or info message stays before it fades by itself.
const AUTO_DISMISS_MS = 4000;

const TYPE_CLASSES: Record<ToastMessage["type"], string> = {
  success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-200",
  error: "border-red-500/40 bg-red-950/90 text-red-200",
  info: "border-blue-500/40 bg-blue-950/90 text-blue-200",
};

// The one place the editor reports results: template export/import, PNG export and
// Discord copies. Render it inside a `relative` box right under the top bar.
// Success and info messages close after 4 s; errors stay until dismissed, so they
// can't be missed.
export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}): JSX.Element | null {
  // The latest onDismiss. The page passes a new function on every render (and it renders
  // on every drag step), which would otherwise restart the timer again and again.
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!message || message.type === "error") {
      return;
    }

    // A new message object (even with the same text) restarts the countdown.
    const timer = window.setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div
      // "alert" interrupts a screen reader right away; "status" waits politely.
      role={message.type === "error" ? "alert" : "status"}
      className={[
        "pointer-events-auto absolute left-1/2 top-3 z-[60] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-start gap-3 rounded-2xl border px-4 py-2 shadow-lg backdrop-blur",
        TYPE_CLASSES[message.type],
      ].join(" ")}
    >
      <p className="text-xs font-semibold leading-5">{message.text}</p>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-sm font-bold opacity-70 hover:opacity-100"
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  );
}
