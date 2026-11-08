import { useState } from "react";
import {
  parseHexColorDraft,
  type ShadowDirection,
} from "../../../lib/template";

export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400"
      />
    </label>
  );
}

export function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400"
      />
    </label>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400"
      />
    </label>
  );
}

export function ToggleInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm">
      <span className="font-semibold text-slate-300">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-violet-500"
      />
    </label>
  );
}

export function FileInput({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>

      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onChange(file);
          }

          event.target.value = "";
        }}
        className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500 file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
      />
    </label>
  );
}

// The free-text "#rrggbb" box next to a colour picker. What you type is kept as a local
// draft and only sent on (onChange) once it is a complete colour, so a half-typed "#0"
// can never reach the canvas or an exported template (which would then fail to import).
// Leaving the field with an unfinished draft simply shows the current colour again.
function HexField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  // null = not typing right now, so show the real value (it may change from outside,
  // e.g. the colour picker or a template import, and must show up here straight away).
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      value={draft ?? value}
      aria-label={`${label} hex code`}
      // Hex codes are not words; stop the browser from "fixing" them.
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => {
        setDraft(event.target.value);

        const color = parseHexColorDraft(event.target.value);

        if (color) {
          onChange(color);
        }
      }}
      onBlur={() => setDraft(null)}
      className={className}
    />
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-slate-400">{label}</span>

      <div className="flex items-center gap-2">
        <HexField
          label={label}
          value={value}
          onChange={onChange}
          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none transition focus:border-violet-400"
        />

        {/* The native picker always gives a valid lowercase "#rrggbb". */}
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-lg border border-slate-700 bg-slate-900"
        />
      </div>
    </div>
  );
}

export function RangeInput({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-400">
        <span>{label}</span>

        <span>
          {value}
          {suffix}
        </span>
      </div>

      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-violet-500"
      />
    </label>
  );
}

export function SmallButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-xl border px-3 py-2 text-sm font-bold transition",
        active
          ? "border-violet-400 bg-violet-500/20 text-violet-200"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Compact controls for the floating toolbar row. The big controls above stack a label
// over a full-width input, which is far too tall for a one-line toolbar, so these put a
// short label next to a small input instead. Same colours, so the look stays the same.
// ---------------------------------------------------------------------------

const TOOLBAR_INPUT_CLASS =
  "rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none transition focus:border-violet-400";

export function ToolbarInput({
  label,
  value,
  onChange,
  type = "text",
  widthClass = "w-36",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // "time" and "date" give the browser's native time and date pickers.
  type?: "text" | "time" | "date";
  widthClass?: string;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${TOOLBAR_INPUT_CLASS} ${widthClass}`}
      />
    </label>
  );
}

export function ToolbarTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>

      {/* Two rows so a multi-line text box stays editable without a huge toolbar. */}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className={`${TOOLBAR_INPUT_CLASS} w-44 resize-none leading-4`}
      />
    </label>
  );
}

export function ToolbarRange({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>

      {/* A slider instead of a number box: typing "12" into a number box would pass
          through "1" first, which is below most minimums. */}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-20 accent-violet-500"
      />

      {/* Fixed width so the toolbar doesn't jitter while the number changes. */}
      <span className="w-10 text-[11px] tabular-nums text-slate-300">
        {value}
        {suffix}
      </span>
    </label>
  );
}

export function ToolbarColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>

      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-8 cursor-pointer rounded-md border border-slate-700 bg-slate-950"
      />

      {/* For typing or pasting an exact colour; same draft rule as ColorInput. */}
      <HexField
        label={label}
        value={value}
        onChange={onChange}
        className={`${TOOLBAR_INPUT_CLASS} w-[4.75rem]`}
      />
    </div>
  );
}

export function ToolbarButton({
  label,
  onClick,
  pressed,
  danger = false,
  children,
}: {
  // Accessible name and tooltip. Needed because the visible content may be just "B".
  label: string;
  onClick: () => void;
  // Leave out for plain actions; pass true/false for on/off buttons (adds aria-pressed).
  pressed?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={[
        "shrink-0 rounded-lg border px-2 py-1 text-xs font-bold transition",
        danger
          ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          : pressed
            ? "border-violet-400 bg-violet-500/20 text-violet-200"
            : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// A button that opens the file picker. The real <input type="file"> sits hidden inside
// the label, so clicking the label opens the picker.
export function ToolbarFileButton({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File) => void;
}) {
  return (
    <label className="shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-bold text-slate-300 transition hover:bg-slate-800 focus-within:border-violet-400">
      {label}

      <input
        type="file"
        accept="image/*"
        // sr-only (not display:none) keeps the input reachable with the keyboard.
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onChange(file);
          }

          // Clearing it lets the same file be picked again later.
          event.target.value = "";
        }}
      />
    </label>
  );
}

// A thin vertical line between groups of toolbar controls.
export function ToolbarDivider() {
  return <span aria-hidden="true" className="h-5 w-px shrink-0 bg-slate-700" />;
}

// ---------------------------------------------------------------------------
// Groups shared by several "More" panels.
// ---------------------------------------------------------------------------

export type LayerAction = "front" | "back" | "forward" | "backward";

const LAYER_LABELS: Record<LayerAction, string> = {
  front: "Bring to front",
  back: "Send to back",
  forward: "Forward",
  backward: "Backward",
};

export function LayerButtons({
  actions,
  onMove,
  hint,
}: {
  // Which buttons to show, in order (the sticker toolbar row already has front/back).
  actions: LayerAction[];
  onMove: (action: LayerAction) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-400">Layering</p>

      {hint && <p className="text-xs leading-5 text-slate-400">{hint}</p>}

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <SmallButton key={action} active={false} onClick={() => onMove(action)}>
            {LAYER_LABELS[action]}
          </SmallButton>
        ))}
      </div>
    </div>
  );
}

const SHADOW_DIRECTIONS: ShadowDirection[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export function ShadowDirectionPicker({
  value,
  onChange,
}: {
  value: ShadowDirection;
  onChange: (direction: ShadowDirection) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-400">Shadow direction</p>

      <div className="grid grid-cols-2 gap-2">
        {SHADOW_DIRECTIONS.map((direction) => (
          <SmallButton
            key={direction}
            active={value === direction}
            onClick={() => onChange(direction)}
          >
            {/* "bottom-right" becomes "bottom right" */}
            {direction.replace("-", " ")}
          </SmallButton>
        ))}
      </div>
    </div>
  );
}
