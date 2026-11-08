"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DateTime } from "luxon";
import { toPng } from "html-to-image";
import {
  createDiscordTimestamp,
  getBrowserTimezone,
  type DiscordTimestampStyle,
} from "../../lib/discordTimestamp";
import { DEFAULT_PATTERN, type BackgroundPattern } from "../../lib/patterns";
import { PatternControls, PatternLayer } from "./components/PatternLayer";
import { DayToolbar } from "./components/toolbars/DayToolbar";
import { HeaderToolbar } from "./components/toolbars/HeaderToolbar";
import { StickerToolbar } from "./components/toolbars/StickerToolbar";
import { TextBoxToolbar } from "./components/toolbars/TextBoxToolbar";
import { Toast, type ToastMessage } from "./components/Toast";
import { CLOSES_MENU, TopBarMenu } from "./components/TopBarMenu";
import {
  ColorInput,
  DateInput,
  FileInput,
  RangeInput,
  SecondaryButton,
  SelectInput,
  SmallButton,
  TextInput,
  ToggleInput,
  type LayerAction,
} from "./components/controls";
import {
  ASPECT_RATIOS,
  MAX_SCHEDULE_DAYS,
  MAX_TEMPLATE_SIZE_BYTES,
  TEMPLATE_VERSION,
  parseTemplate,
  type AspectRatioId,
  type DayItem,
  type HeaderStyle,
  type ScheduleLayout,
  type ScheduleTemplate,
  type ShadowDirection,
  type Sticker,
  type TextBox,
  type Theme,
} from "../../lib/template";
import {
  clampSelection,
  selectionKey,
  type HeaderPart,
  type Selection,
} from "../../lib/selection";

type DragState = {
  stickerId: string;
  offsetX: number;
  offsetY: number;
};

type ResizeDragState = {
  stickerId: string;
  centerX: number;
  centerY: number;
  startDistance: number;
  startSize: number;
};

type RotateDragState = {
  stickerId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  startRotation: number;
};

type PanDragState = {
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

type TextDragState = {
  textBoxId: string;
  offsetX: number;
  offsetY: number;
};

type TextResizeDragState = {
  textBoxId: string;
  centerX: number;
  centerY: number;
  startDistance: number;
  startWidth: number;
};

type TextRotateDragState = {
  textBoxId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  startRotation: number;
};

const STICKER_MIN_SIZE = 40;
const STICKER_MAX_SIZE = 400;

const TEXT_BOX_MIN_WIDTH = 60;
const TEXT_BOX_MAX_WIDTH = 1800;

function normalizeRotation(degrees: number): number {
  let normalized = degrees % 360;

  if (normalized > 180) {
    normalized -= 360;
  }

  if (normalized < -180) {
    normalized += 360;
  }

  return normalized;
}

// Small icons for the top-bar menus. currentColor makes them follow the button's text.
function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}

const MENU_ICONS = {
  project: (
    <MenuIcon>
      <path d="M4 5a1 1 0 0 1 1-1h9l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
      <path d="M14 4v5a1 1 0 0 0 1 1h5" />
    </MenuIcon>
  ),
  theme: (
    <MenuIcon>
      <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.582 9 8 0 2.21-1.79 3-3.5 3H15a2 2 0 0 0-1.4 3.4c.4.4.4 1-.1 1.3-.5.3-1 .8-1.5 1.3-.3.3 0 1 0 1z" />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </MenuIcon>
  ),
  background: (
    <MenuIcon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L4 19" />
    </MenuIcon>
  ),
  add: (
    <MenuIcon>
      <path d="M12 5v14M5 12h14" />
    </MenuIcon>
  ),
  discord: (
    <MenuIcon>
      <path d="M4 12a8 8 0 1 1 8 8 8.4 8.4 0 0 1-3.5-.8L4 20l1-4.2A7.9 7.9 0 0 1 4 12z" />
    </MenuIcon>
  ),
  template: (
    <MenuIcon>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </MenuIcon>
  ),
};

const DISCORD_STYLE_OPTIONS: Array<{
  value: DiscordTimestampStyle;
  label: string;
}> = [
  { value: "F", label: "Full date with weekday" },
  { value: "f", label: "Full date" },
  { value: "R", label: "Relative countdown" },
  { value: "t", label: "Short time" },
  { value: "T", label: "Time with seconds" },
  { value: "D", label: "Long date" },
  { value: "d", label: "Short date" },
];

const MIN_ZOOM_LEVEL = 0.25;
const MAX_ZOOM_LEVEL = 4;

type ExportQuality = 0.5 | 1 | 2;

const EXPORT_QUALITY_OPTIONS: Array<{ value: ExportQuality; label: string }> = [
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
];

const DAY_DEFAULT_Z_INDEX = 10;
const STICKER_DEFAULT_Z_INDEX = 20;
const TEXT_BOX_DEFAULT_Z_INDEX = 30;
const HEADER_Z_INDEX = 1000;

// The violet outline drawn around the selected canvas element (never in exported PNGs).
const SELECTED_OUTLINE =
  "outline outline-2 outline-offset-4 outline-violet-400";

// Everything a canvas element needs to be focusable and selectable (see selectableProps).
type SelectableProps = {
  role: "button";
  tabIndex: number;
  "aria-label": string;
  "aria-pressed": boolean;
  "data-select-key": string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
};

// Screen-reader and toolbar names for the header parts.
const HEADER_PART_LABELS: Record<HeaderPart, string> = {
  avatar: "Avatar",
  name: "Streamer name",
  title: "Schedule title",
  dates: "Date range",
};

// Turns a stored day label like "WED" into "Wed" for screen-reader labels.
function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

const defaultDayStyle = {
  widthWeight: 1,
  widthLocked: false,
  lockedWidthPercent: 14.285,

  height: 100,
  rotation: 0,
  borderRadius: 24,
  borderWidth: 4,
  borderColor: "#000000",
  shadowOffset: 12,
  shadowDirection: "bottom-right" as ShadowDirection,
  zIndex: DAY_DEFAULT_Z_INDEX,

  dayFontSize: 18,
  titleFontSize: 30,
  timeFontSize: 20,
  noteFontSize: 18,
};

const defaultStickerStyle = {
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#000000",
  shadowOffset: 0,
  shadowDirection: "bottom-right" as ShadowDirection,
};

function getShadowOffsetXY(
  offset: number,
  direction: ShadowDirection,
): { x: number; y: number } {
  return {
    x: direction.endsWith("right") ? offset : -offset,
    y: direction.startsWith("bottom") ? offset : -offset,
  };
}

const defaultHeaderStyle: HeaderStyle = {
  avatarSize: 112,
  avatarGap: 24,
  eyebrowFontSize: 14,
  titleFontSize: 48,
  dateFontSize: 20,
  textGap: 12,
};

const initialTheme: Theme = {
  backgroundA: "#06b6d4",
  backgroundB: "#0e7490",
  cardActive: "#cffafe",
  cardRest: "#0891b2",
  text: "#020617",
};

function createDefaultDayItem(label: string): DayItem {
  return {
    day: label,
    title: "",
    time: "",
    note: "",
    active: false,
    ...defaultDayStyle,
  };
}

const DEFAULT_SCHEDULE_LENGTH = 7;

const initialSchedule: DayItem[] = Array.from(
  { length: DEFAULT_SCHEDULE_LENGTH },
  (_, index) => createDefaultDayItem(`Day ${index + 1}`),
);

function getSupportedTimezones(): string[] {
  try {
    const intlWithSupportedValues = Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    };

    const supported =
      intlWithSupportedValues.supportedValuesOf?.("timeZone") ?? [];

    if (supported.length > 0) {
      return supported;
    }
  } catch {
    // Older browsers may not support Intl.supportedValuesOf.
  }

  return [
    "UTC",
    "Europe/Berlin",
    "Europe/London",
    "Europe/Paris",
    "Europe/Rome",
    "Europe/Madrid",
    "Europe/Amsterdam",
    "Europe/Warsaw",
    "Europe/Helsinki",
    "Europe/Athens",
    "Europe/Istanbul",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Pacific/Auckland",
  ];
}

function getDateForDay(scheduleStartDate: string, dayIndex: number): string {
  if (!scheduleStartDate) {
    return "";
  }

  const start = DateTime.fromISO(scheduleStartDate);

  if (!start.isValid) {
    return "";
  }

  return start.plus({ days: dayIndex }).toISODate() ?? "";
}

function formatCalculatedDate(date: string): string {
  if (!date) {
    return "";
  }

  const parsed = DateTime.fromISO(date);

  if (!parsed.isValid) {
    return "";
  }

  return parsed.toFormat("cccc, LLL d, yyyy");
}

function formatDateRangeLabel(
  scheduleStartDate: string,
  scheduleEndDate: string,
): string {
  if (!scheduleStartDate || !scheduleEndDate) {
    return "";
  }

  const start = DateTime.fromISO(scheduleStartDate);
  const end = DateTime.fromISO(scheduleEndDate);

  if (!start.isValid || !end.isValid) {
    return "";
  }

  if (start.toISODate() === end.toISODate()) {
    return start.toFormat("LLL d, yyyy");
  }

  if (start.year !== end.year) {
    return `${start.toFormat("LLL d, yyyy")} – ${end.toFormat("LLL d, yyyy")}`;
  }

  if (start.month !== end.month) {
    return `${start.toFormat("LLL d")} – ${end.toFormat("LLL d, yyyy")}`;
  }

  return `${start.toFormat("LLL d")} – ${end.toFormat("d, yyyy")}`;
}

function getScheduleDayCount(
  scheduleStartDate: string,
  scheduleEndDate: string,
): number {
  if (!scheduleStartDate || !scheduleEndDate) {
    return 0;
  }

  const start = DateTime.fromISO(scheduleStartDate);
  const end = DateTime.fromISO(scheduleEndDate);

  if (!start.isValid || !end.isValid) {
    return 0;
  }

  const dayCount = Math.round(end.diff(start, "days").days) + 1;

  return dayCount;
}

function createTemplateFilename(
  displayName: string,
  scheduleStartDate: string,
): string {
  const safeName = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const datePart =
    scheduleStartDate || DateTime.now().toISODate() || "template";
  const namePart = safeName || "stream-schedule";

  return `${namePart}-${datePart}.stream-template.json`;
}

function createPngFilename(
  displayName: string,
  scheduleStartDate: string,
): string {
  const safeName = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const datePart =
    scheduleStartDate || DateTime.now().toISODate() || "schedule";

  const namePart = safeName || "stream-schedule";

  return `${namePart}-${datePart}.png`;
}

export default function SchedulePage() {
  const [displayName, setDisplayName] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");

  const [aspectRatioId, setAspectRatioId] = useState<AspectRatioId>("16:9");
  const [scheduleLayout, setScheduleLayout] = useState<ScheduleLayout>("cards");

  const [detectedTimezone] = useState(getBrowserTimezone);
  const [overrideTimezoneEnabled, setOverrideTimezoneEnabled] = useState(false);
  const [overrideTimezone, setOverrideTimezone] = useState(getBrowserTimezone);

  const [discordStyle, setDiscordStyle] = useState<DiscordTimestampStyle>("F");

  const [schedule, setSchedule] = useState(initialSchedule);
  // The one thing selected on the canvas (or null). This is the raw stored value; use
  // activeSelection below, which drops it once the selected element no longer exists.
  const [selection, setSelection] = useState<Selection>(null);
  const [theme, setTheme] = useState(initialTheme);

  const [backgroundPattern, setBackgroundPattern] =
    useState<BackgroundPattern>(DEFAULT_PATTERN);

  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(45);
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const [backgroundFit, setBackgroundFit] = useState<"cover" | "contain">(
    "cover",
  );

  const [headerStyle, setHeaderStyle] =
    useState<HeaderStyle>(defaultHeaderStyle);

  const [stickers, setStickers] = useState<Sticker[]>([]);

  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);

  // The one message shown in the toast: template, PNG export and Discord copy results.
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [isImportingTemplate, setIsImportingTemplate] = useState(false);

  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportQuality, setExportQuality] = useState<ExportQuality>(1);

  const [fitScale, setFitScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const resizeDragStateRef = useRef<ResizeDragState | null>(null);
  const rotateDragStateRef = useRef<RotateDragState | null>(null);
  const panDragRef = useRef<PanDragState | null>(null);
  const textDragStateRef = useRef<TextDragState | null>(null);
  const textResizeDragStateRef = useRef<TextResizeDragState | null>(null);
  const textRotateDragStateRef = useRef<TextRotateDragState | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  const canvasWidth = ASPECT_RATIOS[aspectRatioId].width;
  const canvasHeight = ASPECT_RATIOS[aspectRatioId].height;
  const gridColumns = ASPECT_RATIOS[aspectRatioId].gridColumns;
  const isGridLayout = gridColumns > 0;

  const scheduleDayCountRaw = getScheduleDayCount(
    scheduleStartDate,
    scheduleEndDate,
  );

  const effectiveTimezone = overrideTimezoneEnabled
    ? overrideTimezone
    : detectedTimezone;

  const calculatedDateRangeLabel = formatDateRangeLabel(
    scheduleStartDate,
    scheduleEndDate,
  );

  const timezoneOptions = useMemo(() => {
    const supportedTimezones = getSupportedTimezones();

    if (overrideTimezone && !supportedTimezones.includes(overrideTimezone)) {
      return [overrideTimezone, ...supportedTimezones];
    }

    return supportedTimezones;
  }, [overrideTimezone]);

  // The header parts that are on the canvas right now. Each one only renders when it
  // has content, so a part that disappears can no longer stay selected.
  // One exception: a text part stays while it is selected, even when emptied. Otherwise
  // deleting the last letter in its toolbar would remove the part and close the toolbar
  // you are typing in. It then shows a faint placeholder instead (never in the PNG).
  // This reads the raw `selection`, because activeSelection is computed from this list.
  const editingPart = selection?.kind === "header" ? selection.part : null;
  const headerParts: HeaderPart[] = [
    ...(avatarImage ? (["avatar"] as const) : []),
    ...(displayName.trim() || editingPart === "name"
      ? (["name"] as const)
      : []),
    ...(scheduleTitle.trim() || editingPart === "title"
      ? (["title"] as const)
      : []),
    ...(calculatedDateRangeLabel || editingPart === "dates"
      ? (["dates"] as const)
      : []),
  ];

  const showHeader = headerParts.length > 0;

  // Checked during render instead of in an effect: if the selected day, sticker, text box
  // or header part was removed, this is simply null and nothing needs to be reset.
  const activeSelection = clampSelection(selection, {
    dayCount: schedule.length,
    stickerIds: stickers.map((sticker) => sticker.id),
    textBoxIds: textBoxes.map((textBox) => textBox.id),
    headerParts,
  });

  // If clamping dropped the selection, clear the stored one too. Otherwise it would come
  // back by itself when the element reappears (shorten the date range so the selected
  // day disappears, lengthen it again → the day was selected again, toolbar and all).
  // Setting state during render is React's supported way to adjust state from props/state;
  // React re-renders straight away before painting, so no effect is needed.
  if (selection !== null && activeSelection === null) {
    setSelection(null);
  }

  // The selected day, for the day helpers, the Day toolbar and the Discord tab.
  const selectedIndex =
    activeSelection?.kind === "day" ? activeSelection.index : null;
  const selectedDay = selectedIndex === null ? null : schedule[selectedIndex];
  const selectedDayDate =
    selectedIndex === null
      ? ""
      : getDateForDay(scheduleStartDate, selectedIndex);

  // A short warning for the Dates toolbar when the picked range is unusable.
  const dateRangeWarning =
    scheduleStartDate && scheduleEndDate && scheduleDayCountRaw < 1
      ? "End date is before the start date"
      : scheduleDayCountRaw > MAX_SCHEDULE_DAYS
        ? `Capped at ${MAX_SCHEDULE_DAYS} days`
        : "";

  // True when this element is the selected one. Always false while exporting, so the
  // violet outline never ends up in the PNG.
  function isSelected(target: NonNullable<Selection>): boolean {
    return (
      !isExportingPng &&
      activeSelection !== null &&
      selectionKey(activeSelection) === selectionKey(target)
    );
  }

  // Selects an element; its floating toolbar then opens next to it.
  function selectElement(target: NonNullable<Selection>): void {
    if (isExportingPng) {
      return;
    }

    setSelection(target);
  }

  // The human-readable name of a canvas element. Used as its aria-label and as the
  // floating toolbar's label, so both always say the same thing.
  function selectionLabel(target: NonNullable<Selection>): string {
    switch (target.kind) {
      case "day": {
        const day = schedule[target.index]?.day ?? "";
        // Card layouts call each day a card; the list layout calls it a row.
        return `${dayLabel(day)} ${scheduleLayout === "cards" ? "card" : "row"}`;
      }
      case "sticker": {
        const sticker = stickers.find((item) => item.id === target.id);
        return `Sticker ${sticker?.name ?? ""}`;
      }
      case "text": {
        const textBox = textBoxes.find((item) => item.id === target.id);
        return `Text box ${textBox?.text.trim() || "(empty)"}`;
      }
      case "header":
        return HEADER_PART_LABELS[target.part];
    }
  }

  // Props that make a canvas element focusable and selectable by pointer or keyboard.
  // data-select-key lets later code find the element's on-screen box by its selection.
  function selectableProps(target: NonNullable<Selection>): SelectableProps {
    return {
      role: "button",
      tabIndex: 0,
      "aria-label": selectionLabel(target),
      "aria-pressed": isSelected(target),
      "data-select-key": selectionKey(target),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        // Stop here so the canvas below doesn't start a pan or clear the selection.
        event.stopPropagation();
        selectElement(target);
      },
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
        // Only react to keys pressed on this element itself, not on a child handle.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          // Space would otherwise scroll the page.
          event.preventDefault();
          selectElement(target);
        }
      },
    };
  }

  // selectableProps plus the class list (with the outline when selected) for a header
  // part, so each part names its selection target only once.
  function headerPartProps(
    part: HeaderPart,
    className: string,
  ): SelectableProps & { className: string } {
    const target = { kind: "header", part } as const;

    return {
      ...selectableProps(target),
      className: [className, isSelected(target) ? SELECTED_OUTLINE : ""].join(
        " ",
      ),
    };
  }

  // The text of a header part, or a faint placeholder while an emptied part is being
  // edited (see headerParts). Never shown in an exported PNG, see headerPartVisible.
  function headerText(value: string, placeholder: string): React.ReactNode {
    return value.trim() ? (
      value
    ) : (
      <span className="italic opacity-40">{placeholder}</span>
    );
  }

  // Whether to draw a header text part: it has content, or it is selected (placeholder)
  // and we are not exporting.
  function headerPartVisible(part: HeaderPart, hasContent: boolean): boolean {
    return headerParts.includes(part) && (hasContent || !isExportingPng);
  }

  useEffect(() => {
    if (!scheduleStartDate || !scheduleEndDate) {
      return;
    }

    const rawDayCount = getScheduleDayCount(scheduleStartDate, scheduleEndDate);

    if (rawDayCount < 1) {
      return;
    }

    const dayCount = Math.min(MAX_SCHEDULE_DAYS, rawDayCount);
    const start = DateTime.fromISO(scheduleStartDate);

    setSchedule((current) =>
      Array.from({ length: dayCount }, (_, index) => {
        const label = start.isValid
          ? start.plus({ days: index }).toFormat("ccc").toUpperCase()
          : `Day ${index + 1}`;

        const existing = current[index];

        return existing
          ? { ...existing, day: label }
          : createDefaultDayItem(label);
      }),
    );
    // No selection reset needed here: activeSelection drops a day that no longer exists.
  }, [scheduleStartDate, scheduleEndDate]);

  // Changes one field of the day at dayIndex.
  function updateDay<K extends keyof DayItem>(
    dayIndex: number,
    field: K,
    value: DayItem[K],
  ) {
    setSchedule((current) =>
      current.map((item, index) =>
        index === dayIndex ? { ...item, [field]: value } : item,
      ),
    );
  }

  // The day helpers below edit the selected day and do nothing when no day is selected.

  function getGlobalZIndexBounds(): { min: number; max: number } {
    const allZIndexes = [
      ...schedule.map((day) => day.zIndex),
      ...stickers.map((sticker) => sticker.zIndex),
      ...textBoxes.map((textBox) => textBox.zIndex),
    ];

    if (allZIndexes.length === 0) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...allZIndexes),
      max: Math.max(...allZIndexes),
    };
  }

  function moveDay(action: LayerAction) {
    if (selectedIndex === null) {
      return;
    }

    const { min, max } = getGlobalZIndexBounds();

    setSchedule((current) =>
      current.map((item, index) => {
        if (index !== selectedIndex) {
          return item;
        }

        if (action === "front") {
          return { ...item, zIndex: max + 1 };
        }

        if (action === "back") {
          return { ...item, zIndex: min - 1 };
        }

        if (action === "forward") {
          return { ...item, zIndex: item.zIndex + 1 };
        }

        return { ...item, zIndex: item.zIndex - 1 };
      }),
    );
  }

  function updateHeaderStyle<K extends keyof HeaderStyle>(
    field: K,
    value: HeaderStyle[K],
  ) {
    setHeaderStyle((current) => ({ ...current, [field]: value }));
  }

  async function waitForNextPaint() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  async function exportScheduleAsPng() {
    const canvas = previewRef.current;

    if (!canvas || isExportingPng) {
      return;
    }

    const outputWidth = Math.round(canvasWidth * exportQuality);
    const outputHeight = Math.round(canvasHeight * exportQuality);

    setIsExportingPng(true);
    setToast({
      type: "info",
      text: `Preparing ${outputWidth} × ${outputHeight} PNG…`,
    });

    try {
      await document.fonts.ready;
      await waitForNextPaint();

      const dataUrl = await toPng(canvas, {
        width: canvasWidth,
        height: canvasHeight,
        pixelRatio: exportQuality,
        cacheBust: true,

        style: {
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: "none",
          transformOrigin: "top left",
          backgroundColor: "transparent",
        },
      });

      const downloadLink = document.createElement("a");

      downloadLink.download = createPngFilename(displayName, scheduleStartDate);

      downloadLink.href = dataUrl;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      setToast({
        type: "success",
        text: `Schedule exported at ${outputWidth} × ${outputHeight}.`,
      });
    } catch (error) {
      console.error("PNG export failed:", error);

      setToast({
        type: "error",
        text: "The PNG could not be generated. Try removing unusually large images and export again.",
      });
    } finally {
      setIsExportingPng(false);
    }
  }

  function calculateDayWidths(items: DayItem[]) {
    const lockedTotal = items.reduce(
      (total, item) =>
        item.widthLocked ? total + item.lockedWidthPercent : total,
      0,
    );

    const unlockedItems = items.filter((item) => !item.widthLocked);

    const unlockedWeightTotal = unlockedItems.reduce(
      (total, item) => total + item.widthWeight,
      0,
    );

    const remainingSpace = Math.max(
      3 * unlockedItems.length,
      100 - lockedTotal,
    );

    return items.map((item) => {
      if (item.widthLocked) {
        return item.lockedWidthPercent;
      }

      if (unlockedWeightTotal <= 0) {
        return 0;
      }

      return remainingSpace * (item.widthWeight / unlockedWeightTotal);
    });
  }

  const calculatedWidths = calculateDayWidths(schedule);

  function toggleSelectedDayWidthLock(locked: boolean) {
    if (selectedIndex === null) {
      return;
    }

    if (locked) {
      const currentWidth = calculatedWidths[selectedIndex];

      setSchedule((current) =>
        current.map((item, index) =>
          index === selectedIndex
            ? {
                ...item,
                widthLocked: true,
                lockedWidthPercent: currentWidth,
              }
            : item,
        ),
      );

      return;
    }

    updateDay(selectedIndex, "widthLocked", false);
  }

  function resetSelectedDayStyle() {
    if (selectedIndex === null) {
      return;
    }

    setSchedule((current) =>
      current.map((item, index) =>
        index === selectedIndex
          ? {
              ...item,
              ...defaultDayStyle,
            }
          : item,
      ),
    );
  }

  function updateTheme(field: keyof Theme, value: string) {
    setTheme((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSticker<K extends keyof Sticker>(
    stickerId: string,
    field: K,
    value: Sticker[K],
  ) {
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === stickerId ? { ...sticker, [field]: value } : sticker,
      ),
    );
  }

  function readImageFile(file: File, callback: (src: string) => void) {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        callback(reader.result);
      }
    };

    reader.onerror = () => {
      setToast({
        type: "error",
        text: `Could not read ${file.name}.`,
      });
    };

    reader.readAsDataURL(file);
  }

  function addSticker(file: File) {
    readImageFile(file, (src) => {
      const id = crypto.randomUUID();

      const newSticker: Sticker = {
        id,
        name: file.name,
        src,
        x: 50,
        y: 50,
        size: 160,
        rotation: 0,
        opacity: 100,
        zIndex: STICKER_DEFAULT_Z_INDEX,
        ...defaultStickerStyle,
      };

      setStickers((current) => [...current, newSticker]);
      setSelection({ kind: "sticker", id });
    });
  }

  function removeSticker(stickerId: string) {
    setStickers((current) =>
      current.filter((sticker) => sticker.id !== stickerId),
    );

    // No selection reset needed: activeSelection drops a sticker that no longer exists.
  }

  function moveSticker(stickerId: string, action: LayerAction) {
    const { min, max } = getGlobalZIndexBounds();

    setStickers((current) =>
      current.map((sticker) => {
        if (sticker.id !== stickerId) {
          return sticker;
        }

        if (action === "front") {
          return { ...sticker, zIndex: max + 1 };
        }

        if (action === "back") {
          return { ...sticker, zIndex: min - 1 };
        }

        if (action === "forward") {
          return { ...sticker, zIndex: sticker.zIndex + 1 };
        }

        return { ...sticker, zIndex: sticker.zIndex - 1 };
      }),
    );
  }

  function addTextBox() {
    const id = crypto.randomUUID();

    const newTextBox: TextBox = {
      id,
      text: "New text",
      bold: false,
      italic: false,
      x: 50,
      y: 50,
      width: 300,
      rotation: 0,
      fontSize: 32,
      color: "#ffffff",
      align: "left",
      zIndex: TEXT_BOX_DEFAULT_Z_INDEX,
    };

    setTextBoxes((current) => [...current, newTextBox]);
    setSelection({ kind: "text", id });
  }

  function updateTextBox<K extends keyof TextBox>(
    textBoxId: string,
    field: K,
    value: TextBox[K],
  ) {
    setTextBoxes((current) =>
      current.map((textBox) =>
        textBox.id === textBoxId ? { ...textBox, [field]: value } : textBox,
      ),
    );
  }

  function moveTextBox(textBoxId: string, action: LayerAction) {
    const { min, max } = getGlobalZIndexBounds();

    setTextBoxes((current) =>
      current.map((textBox) => {
        if (textBox.id !== textBoxId) {
          return textBox;
        }

        if (action === "front") {
          return { ...textBox, zIndex: max + 1 };
        }

        if (action === "back") {
          return { ...textBox, zIndex: min - 1 };
        }

        if (action === "forward") {
          return { ...textBox, zIndex: textBox.zIndex + 1 };
        }

        return { ...textBox, zIndex: textBox.zIndex - 1 };
      }),
    );
  }

  function removeTextBox(textBoxId: string) {
    setTextBoxes((current) =>
      current.filter((textBox) => textBox.id !== textBoxId),
    );

    // No selection reset needed: activeSelection drops a text box that no longer exists.
  }

  function beginCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    panDragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: panOffset.x,
      startOffsetY: panOffset.y,
    };
  }

  function beginStickerDrag(
    event: ReactPointerEvent<HTMLElement>,
    sticker: Sticker,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const currentX = bounds.left + (sticker.x / 100) * bounds.width;
    const currentY = bounds.top + (sticker.y / 100) * bounds.height;

    dragStateRef.current = {
      stickerId: sticker.id,
      offsetX: event.clientX - currentX,
      offsetY: event.clientY - currentY,
    };

    selectElement({ kind: "sticker", id: sticker.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginStickerResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    sticker: Sticker,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const centerX = bounds.left + (sticker.x / 100) * bounds.width;
    const centerY = bounds.top + (sticker.y / 100) * bounds.height;

    const startDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY),
    );

    resizeDragStateRef.current = {
      stickerId: sticker.id,
      centerX,
      centerY,
      startDistance,
      startSize: sticker.size,
    };

    selectElement({ kind: "sticker", id: sticker.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginStickerRotate(
    event: ReactPointerEvent<HTMLButtonElement>,
    sticker: Sticker,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const centerX = bounds.left + (sticker.x / 100) * bounds.width;
    const centerY = bounds.top + (sticker.y / 100) * bounds.height;

    const startAngle =
      (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
      Math.PI;

    rotateDragStateRef.current = {
      stickerId: sticker.id,
      centerX,
      centerY,
      startAngle,
      startRotation: sticker.rotation,
    };

    selectElement({ kind: "sticker", id: sticker.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginTextBoxDrag(
    event: ReactPointerEvent<HTMLElement>,
    textBox: TextBox,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const currentX = bounds.left + (textBox.x / 100) * bounds.width;
    const currentY = bounds.top + (textBox.y / 100) * bounds.height;

    textDragStateRef.current = {
      textBoxId: textBox.id,
      offsetX: event.clientX - currentX,
      offsetY: event.clientY - currentY,
    };

    selectElement({ kind: "text", id: textBox.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginTextBoxResize(
    event: ReactPointerEvent<HTMLButtonElement>,
    textBox: TextBox,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const centerX = bounds.left + (textBox.x / 100) * bounds.width;
    const centerY = bounds.top + (textBox.y / 100) * bounds.height;

    const startDistance = Math.max(
      1,
      Math.hypot(event.clientX - centerX, event.clientY - centerY),
    );

    textResizeDragStateRef.current = {
      textBoxId: textBox.id,
      centerX,
      centerY,
      startDistance,
      startWidth: textBox.width,
    };

    selectElement({ kind: "text", id: textBox.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginTextBoxRotate(
    event: ReactPointerEvent<HTMLButtonElement>,
    textBox: TextBox,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const bounds = preview.getBoundingClientRect();
    const centerX = bounds.left + (textBox.x / 100) * bounds.width;
    const centerY = bounds.top + (textBox.y / 100) * bounds.height;

    const startAngle =
      (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
      Math.PI;

    textRotateDragStateRef.current = {
      textBoxId: textBox.id,
      centerX,
      centerY,
      startAngle,
      startRotation: textBox.rotation,
    };

    selectElement({ kind: "text", id: textBox.id });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const panState = panDragRef.current;

      if (panState) {
        setPanOffset({
          x: panState.startOffsetX + (event.clientX - panState.startClientX),
          y: panState.startOffsetY + (event.clientY - panState.startClientY),
        });

        return;
      }

      const preview = previewRef.current;

      if (!preview) {
        return;
      }

      const dragState = dragStateRef.current;

      if (dragState) {
        const bounds = preview.getBoundingClientRect();

        const rawX =
          ((event.clientX - dragState.offsetX - bounds.left) / bounds.width) *
          100;

        const rawY =
          ((event.clientY - dragState.offsetY - bounds.top) / bounds.height) *
          100;

        const x = Math.min(100, Math.max(0, rawX));
        const y = Math.min(100, Math.max(0, rawY));

        setStickers((current) =>
          current.map((sticker) =>
            sticker.id === dragState.stickerId ? { ...sticker, x, y } : sticker,
          ),
        );

        return;
      }

      const resizeState = resizeDragStateRef.current;

      if (resizeState) {
        const currentDistance = Math.max(
          1,
          Math.hypot(
            event.clientX - resizeState.centerX,
            event.clientY - resizeState.centerY,
          ),
        );

        const scaleFactor = currentDistance / resizeState.startDistance;

        const nextSize = Math.min(
          STICKER_MAX_SIZE,
          Math.max(STICKER_MIN_SIZE, resizeState.startSize * scaleFactor),
        );

        setStickers((current) =>
          current.map((sticker) =>
            sticker.id === resizeState.stickerId
              ? { ...sticker, size: nextSize }
              : sticker,
          ),
        );

        return;
      }

      const rotateState = rotateDragStateRef.current;

      if (rotateState) {
        const currentAngle =
          (Math.atan2(
            event.clientY - rotateState.centerY,
            event.clientX - rotateState.centerX,
          ) *
            180) /
          Math.PI;

        const nextRotation = normalizeRotation(
          rotateState.startRotation + (currentAngle - rotateState.startAngle),
        );

        setStickers((current) =>
          current.map((sticker) =>
            sticker.id === rotateState.stickerId
              ? { ...sticker, rotation: nextRotation }
              : sticker,
          ),
        );

        return;
      }

      const textDragState = textDragStateRef.current;

      if (textDragState) {
        const bounds = preview.getBoundingClientRect();

        const rawX =
          ((event.clientX - textDragState.offsetX - bounds.left) /
            bounds.width) *
          100;

        const rawY =
          ((event.clientY - textDragState.offsetY - bounds.top) /
            bounds.height) *
          100;

        const x = Math.min(100, Math.max(0, rawX));
        const y = Math.min(100, Math.max(0, rawY));

        setTextBoxes((current) =>
          current.map((textBox) =>
            textBox.id === textDragState.textBoxId
              ? { ...textBox, x, y }
              : textBox,
          ),
        );

        return;
      }

      const textResizeState = textResizeDragStateRef.current;

      if (textResizeState) {
        const currentDistance = Math.max(
          1,
          Math.hypot(
            event.clientX - textResizeState.centerX,
            event.clientY - textResizeState.centerY,
          ),
        );

        const scaleFactor = currentDistance / textResizeState.startDistance;

        const nextWidth = Math.min(
          TEXT_BOX_MAX_WIDTH,
          Math.max(
            TEXT_BOX_MIN_WIDTH,
            textResizeState.startWidth * scaleFactor,
          ),
        );

        setTextBoxes((current) =>
          current.map((textBox) =>
            textBox.id === textResizeState.textBoxId
              ? { ...textBox, width: nextWidth }
              : textBox,
          ),
        );

        return;
      }

      const textRotateState = textRotateDragStateRef.current;

      if (textRotateState) {
        const currentAngle =
          (Math.atan2(
            event.clientY - textRotateState.centerY,
            event.clientX - textRotateState.centerX,
          ) *
            180) /
          Math.PI;

        const nextRotation = normalizeRotation(
          textRotateState.startRotation +
            (currentAngle - textRotateState.startAngle),
        );

        setTextBoxes((current) =>
          current.map((textBox) =>
            textBox.id === textRotateState.textBoxId
              ? { ...textBox, rotation: nextRotation }
              : textBox,
          ),
        );
      }
    }

    function handlePointerUp() {
      dragStateRef.current = null;
      resizeDragStateRef.current = null;
      rotateDragStateRef.current = null;
      panDragRef.current = null;
      textDragStateRef.current = null;
      textResizeDragStateRef.current = null;
      textRotateDragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const previewArea = previewAreaRef.current;

    if (!previewArea) {
      return;
    }

    function updatePreviewScale() {
      if (!previewArea) {
        return;
      }

      const availableWidth = Math.max(1, previewArea.clientWidth);

      const availableHeight = Math.max(1, previewArea.clientHeight);

      const nextScale = Math.min(
        availableWidth / canvasWidth,
        availableHeight / canvasHeight,
        1,
      );

      setFitScale(nextScale);
    }

    updatePreviewScale();

    const resizeObserver = new ResizeObserver(updatePreviewScale);

    resizeObserver.observe(previewArea);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    const previewArea = previewAreaRef.current;

    if (!previewArea) {
      return;
    }

    function handleWheelZoom(event: WheelEvent) {
      event.preventDefault();

      const zoomFactor = 1 - event.deltaY * 0.001;

      setZoomLevel((current) =>
        Math.min(
          MAX_ZOOM_LEVEL,
          Math.max(MIN_ZOOM_LEVEL, current * zoomFactor),
        ),
      );
    }

    previewArea.addEventListener("wheel", handleWheelZoom, { passive: false });

    return () => {
      previewArea.removeEventListener("wheel", handleWheelZoom);
    };
  }, []);

  const previewScale = fitScale * zoomLevel;

  useEffect(() => {
    if (zoomLevel <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoomLevel]);

  function createCurrentTemplate(): ScheduleTemplate {
    return {
      version: TEMPLATE_VERSION,
      exportedAt: new Date().toISOString(),

      project: {
        displayName,
        scheduleTitle,
        scheduleStartDate,
        scheduleEndDate,
      },

      canvas: {
        aspectRatio: aspectRatioId,
        scheduleLayout,
      },

      header: headerStyle,

      discord: {
        overrideTimezoneEnabled,
        overrideTimezone,
        timestampStyle: discordStyle,
      },

      appearance: {
        pattern: backgroundPattern,
        theme,
      },

      images: {
        avatarImage,
        avatarZoom,
        avatarOffsetX,
        avatarOffsetY,
        backgroundImage,
        backgroundOpacity,
        backgroundBlur,
        backgroundFit,
      },

      schedule,
      stickers,
      textBoxes,
    };
  }

  // --- Unsaved changes ---
  // The editor keeps nothing after the tab closes, so it compares the current state with
  // the last exported or imported template and warns before that work would be lost.
  const savedSnapshotRef = useRef<string | null>(null);
  // True means: take a fresh "saved" snapshot after the next render (first load, imports).
  const resnapshotRef = useRef(true);
  const hasUnsavedChangesRef = useRef<() => boolean>(() => false);

  function createSnapshot(template: ScheduleTemplate): string {
    // exportedAt changes on every call, so it is blanked out before comparing.
    return JSON.stringify({ ...template, exportedAt: "" });
  }

  function hasUnsavedChanges(): boolean {
    return createSnapshot(createCurrentTemplate()) !== savedSnapshotRef.current;
  }

  // Runs after every render, so the unload handler below always sees the latest state.
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;

    if (resnapshotRef.current) {
      savedSnapshotRef.current = createSnapshot(createCurrentTemplate());
      resnapshotRef.current = false;
    }
  });

  // Closing or reloading the tab: let the browser show its "Leave site?" prompt.
  useEffect(() => {
    function warnIfUnsaved(event: BeforeUnloadEvent) {
      if (!hasUnsavedChangesRef.current()) {
        return;
      }

      event.preventDefault();
      // Older browsers only show the prompt when returnValue is set.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnIfUnsaved);

    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, []);

  // Links inside the app don't fire beforeunload, so they ask here instead.
  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      hasUnsavedChanges() &&
      !window.confirm(
        "You have changes that aren't exported yet. Leave anyway and lose them?",
      )
    ) {
      event.preventDefault();
    }
  }

  function exportTemplate() {
    try {
      const template = createCurrentTemplate();
      const json = JSON.stringify(template, null, 2);
      const blob = new Blob([json], {
        type: "application/json",
      });

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = createTemplateFilename(displayName, scheduleStartDate);

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);

      // The current state is now saved in a file, so leaving the page is safe.
      savedSnapshotRef.current = createSnapshot(template);

      const sizeInMegabytes = blob.size / 1024 / 1024;

      setToast({
        type: "success",
        text:
          sizeInMegabytes >= 1
            ? `Template exported successfully (${sizeInMegabytes.toFixed(
                1,
              )} MB).`
            : "Template exported successfully.",
      });
    } catch (error) {
      console.error(error);

      setToast({
        type: "error",
        text: "The template could not be exported.",
      });
    }
  }

  function openTemplateImporter() {
    setToast(null);
    templateInputRef.current?.click();
  }

  async function importTemplateFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      setToast({
        type: "error",
        text: "This template is larger than the 50 MB import limit.",
      });

      return;
    }

    setIsImportingTemplate(true);
    setToast({
      type: "info",
      text: "Reading and validating template…",
    });

    try {
      const text = await file.text();

      let json: unknown;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }

      // Accepts v8, migrates v7, and gives a user-facing message otherwise.
      const result = parseTemplate(json);

      if (!result.ok) {
        throw new Error(result.error);
      }

      const parsed = result.template;

      setDisplayName(parsed.project.displayName);
      setScheduleTitle(parsed.project.scheduleTitle);
      setScheduleStartDate(parsed.project.scheduleStartDate);
      setScheduleEndDate(parsed.project.scheduleEndDate);

      setAspectRatioId(parsed.canvas.aspectRatio);
      setScheduleLayout(parsed.canvas.scheduleLayout);

      setHeaderStyle(parsed.header);

      setOverrideTimezoneEnabled(parsed.discord.overrideTimezoneEnabled);
      setOverrideTimezone(parsed.discord.overrideTimezone);
      setDiscordStyle(parsed.discord.timestampStyle);

      setBackgroundPattern(parsed.appearance.pattern);
      setTheme(parsed.appearance.theme);

      setAvatarImage(parsed.images.avatarImage);
      setAvatarZoom(parsed.images.avatarZoom);
      setAvatarOffsetX(parsed.images.avatarOffsetX);
      setAvatarOffsetY(parsed.images.avatarOffsetY);
      setBackgroundImage(parsed.images.backgroundImage);
      setBackgroundOpacity(parsed.images.backgroundOpacity);
      setBackgroundBlur(parsed.images.backgroundBlur);
      setBackgroundFit(parsed.images.backgroundFit);

      setSchedule(parsed.schedule);
      setStickers(parsed.stickers);
      setTextBoxes(parsed.textBoxes);

      setSelection(null);

      // The imported file is the new saved state once React has applied it.
      resnapshotRef.current = true;

      setToast({
        type: "success",
        text: `Loaded template “${file.name}” successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The template could not be imported.";

      setToast({
        type: "error",
        text: message,
      });
    } finally {
      setIsImportingTemplate(false);
    }
  }

  async function copyText(textToCopy: string, message: string) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setToast({ type: "success", text: message });
    } catch {
      setToast({ type: "error", text: "Could not access the clipboard." });
    }
  }

  // The floating toolbar for the selected element. The key (one per element) remounts it
  // when the selection changes, which also closes an open "More" panel.
  function renderElementToolbar(target: NonNullable<Selection>): React.ReactNode {
    // Shared by all four toolbars. The key and containerRef are set separately on each:
    // React warns when `key` arrives through a {...spread}, and the React lint rules
    // only accept a ref when it is passed straight to a JSX prop.
    const key = selectionKey(target);
    const frame = {
      anchorKey: selectionKey(target),
      label: selectionLabel(target),
      onClose: () => setSelection(null),
    };

    switch (target.kind) {
      case "day": {
        const day = schedule[target.index];

        return (
          <DayToolbar
            key={key}
            containerRef={previewAreaRef}
            {...frame}
            day={day}
            widthMode={
              scheduleLayout === "list" ? "list" : isGridLayout ? "grid" : "row"
            }
            aspectRatioLabel={ASPECT_RATIOS[aspectRatioId].label}
            calculatedDate={formatCalculatedDate(
              getDateForDay(scheduleStartDate, target.index),
            )}
            onUpdate={(field, value) => updateDay(target.index, field, value)}
            onToggleWidthLock={toggleSelectedDayWidthLock}
            onMove={moveDay}
            onResetStyle={resetSelectedDayStyle}
            onCopyTimestamp={copySelectedDayTimestamp}
          />
        );
      }
      case "sticker": {
        const sticker = stickers.find((item) => item.id === target.id);

        // Can't happen (activeSelection only keeps existing stickers); keeps TS happy.
        if (!sticker) return null;

        return (
          <StickerToolbar
            key={key}
            containerRef={previewAreaRef}
            {...frame}
            sticker={sticker}
            onUpdate={(field, value) => updateSticker(sticker.id, field, value)}
            onMove={(action) => moveSticker(sticker.id, action)}
            onRemove={() => removeSticker(sticker.id)}
          />
        );
      }
      case "text": {
        const textBox = textBoxes.find((item) => item.id === target.id);

        if (!textBox) return null;

        return (
          <TextBoxToolbar
            key={key}
            containerRef={previewAreaRef}
            {...frame}
            textBox={textBox}
            minWidth={TEXT_BOX_MIN_WIDTH}
            maxWidth={TEXT_BOX_MAX_WIDTH}
            onUpdate={(field, value) => updateTextBox(textBox.id, field, value)}
            onMove={(action) => moveTextBox(textBox.id, action)}
            onRemove={() => removeTextBox(textBox.id)}
          />
        );
      }
      case "header":
        return (
          <HeaderToolbar
            key={key}
            containerRef={previewAreaRef}
            {...frame}
            part={target.part}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            scheduleTitle={scheduleTitle}
            onScheduleTitleChange={setScheduleTitle}
            startDate={scheduleStartDate}
            onStartDateChange={setScheduleStartDate}
            endDate={scheduleEndDate}
            onEndDateChange={setScheduleEndDate}
            dateWarning={dateRangeWarning}
            headerStyle={headerStyle}
            onStyleChange={updateHeaderStyle}
            avatarZoom={avatarZoom}
            onAvatarZoomChange={setAvatarZoom}
            avatarOffsetX={avatarOffsetX}
            onAvatarOffsetXChange={setAvatarOffsetX}
            avatarOffsetY={avatarOffsetY}
            onAvatarOffsetYChange={setAvatarOffsetY}
            onAvatarReplace={(file) => readImageFile(file, setAvatarImage)}
            onAvatarRemove={() => setAvatarImage(null)}
          />
        );
    }
  }

  function getSelectedDayDiscordText(): string | null {
    if (!selectedDay) {
      return null;
    }

    const timestamp = createDiscordTimestamp(
      selectedDayDate,
      selectedDay.time,
      effectiveTimezone,
      discordStyle,
    );

    if (!timestamp) {
      return null;
    }

    const heading = [selectedDay.day, selectedDay.title.trim()]
      .filter(Boolean)
      .join(" — ");

    return heading ? `${heading}\n${timestamp}` : timestamp;
  }

  function getFullWeekDiscordText(): string | null {
    const entries = schedule
      .map((day, index) => ({
        day,
        date: getDateForDay(scheduleStartDate, index),
      }))
      .filter(({ day }) => day.active)
      .map(({ day, date }) => {
        const timestamp = createDiscordTimestamp(
          date,
          day.time,
          effectiveTimezone,
          discordStyle,
        );

        if (!timestamp) {
          return null;
        }

        const heading = [day.day, day.title.trim()].filter(Boolean).join(" — ");

        return heading ? `${heading}\n${timestamp}` : timestamp;
      })
      .filter((entry): entry is string => entry !== null);

    return entries.length > 0 ? entries.join("\n\n") : null;
  }

  async function copySelectedDayTimestamp() {
    if (!selectedDay) {
      setToast({ type: "info", text: "Click a day on the canvas first." });
      return;
    }

    const textToCopy = getSelectedDayDiscordText();

    if (!textToCopy) {
      setToast({
        type: "info",
        text: "Add a start date and a stream time first.",
      });
      return;
    }

    await copyText(textToCopy, `${selectedDay.day} timestamp copied`);
  }

  async function copyFullWeekTimestamps() {
    const textToCopy = getFullWeekDiscordText();

    if (!textToCopy) {
      setToast({
        type: "info",
        text: "No stream day has a valid stream time yet.",
      });
      return;
    }

    await copyText(textToCopy, "Full schedule copied");
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      {/* Wraps onto more lines on narrow screens, so nothing (Export PNG!) gets hidden. */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-800 px-5 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={confirmLeave}
            className="whitespace-nowrap rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-violet-400 hover:text-white"
          >
            ← Back
          </Link>

          <h1 className="text-sm font-bold tracking-wide text-slate-300">
            Streamer Tools{" "}
            <span className="text-slate-600" aria-hidden="true">
              /
            </span>{" "}
            <span className="text-white">Schedule Maker</span>
          </h1>

          <Link
            href="/privacy"
            onClick={confirmLeave}
            className="text-xs text-slate-400 underline hover:text-slate-200"
          >
            Privacy
          </Link>
        </div>

        {/* Schedule-wide settings. Canvas elements are edited in their own toolbars. */}
        <nav
          aria-label="Schedule settings"
          className="flex flex-wrap items-center gap-1"
        >
          <TopBarMenu label="Project" icon={MENU_ICONS.project}>
            {/* Name, title and dates live here too, so an empty header can be filled
                (an empty header part isn't on the canvas, so it can't be clicked). */}
            <TextInput
              label="Streamer name"
              value={displayName}
              onChange={setDisplayName}
            />

            <TextInput
              label="Schedule title"
              value={scheduleTitle}
              onChange={setScheduleTitle}
            />

            <div className="grid grid-cols-2 gap-2">
              <DateInput
                label="Start date"
                value={scheduleStartDate}
                onChange={setScheduleStartDate}
              />

              <DateInput
                label="End date"
                value={scheduleEndDate}
                onChange={setScheduleEndDate}
              />
            </div>

            {dateRangeWarning && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-300">
                {dateRangeWarning}
                {scheduleDayCountRaw > MAX_SCHEDULE_DAYS &&
                  ` (${scheduleDayCountRaw} selected)`}
              </p>
            )}

            {calculatedDateRangeLabel && (
              <p className="text-xs text-slate-400">
                {schedule.length} day{schedule.length === 1 ? "" : "s"} ·{" "}
                <span className="font-bold text-slate-200">
                  {calculatedDateRangeLabel}
                </span>
              </p>
            )}

            <p className="text-xs font-semibold text-slate-400">Aspect ratio</p>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ASPECT_RATIOS) as AspectRatioId[]).map((ratioId) => (
                <SmallButton
                  key={ratioId}
                  active={aspectRatioId === ratioId}
                  onClick={() => setAspectRatioId(ratioId)}
                >
                  {ASPECT_RATIOS[ratioId].label}
                </SmallButton>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-400">Layout</p>

            <div className="grid grid-cols-2 gap-2">
              <SmallButton
                active={scheduleLayout === "cards"}
                onClick={() => setScheduleLayout("cards")}
              >
                Cards
              </SmallButton>

              <SmallButton
                active={scheduleLayout === "list"}
                onClick={() => setScheduleLayout("list")}
              >
                List
              </SmallButton>
            </div>
          </TopBarMenu>

          <TopBarMenu label="Theme" icon={MENU_ICONS.theme}>
            <ColorInput
              label="Background 1"
              value={theme.backgroundA}
              onChange={(value) => updateTheme("backgroundA", value)}
            />

            <ColorInput
              label="Background 2"
              value={theme.backgroundB}
              onChange={(value) => updateTheme("backgroundB", value)}
            />

            <ColorInput
              label="Stream card"
              value={theme.cardActive}
              onChange={(value) => updateTheme("cardActive", value)}
            />

            <ColorInput
              label="Rest card"
              value={theme.cardRest}
              onChange={(value) => updateTheme("cardRest", value)}
            />

            <ColorInput
              label="Text"
              value={theme.text}
              onChange={(value) => updateTheme("text", value)}
            />
          </TopBarMenu>

          <TopBarMenu label="Background" icon={MENU_ICONS.background}>
            <PatternControls
              pattern={backgroundPattern}
              onChange={setBackgroundPattern}
            />

            <div className="border-t border-slate-800 pt-3">
              <FileInput
                label="Background image"
                onChange={(file) => readImageFile(file, setBackgroundImage)}
              />
            </div>

            {backgroundImage && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <SmallButton
                    active={backgroundFit === "cover"}
                    onClick={() => setBackgroundFit("cover")}
                  >
                    Cover
                  </SmallButton>

                  <SmallButton
                    active={backgroundFit === "contain"}
                    onClick={() => setBackgroundFit("contain")}
                  >
                    Contain
                  </SmallButton>
                </div>

                <RangeInput
                  label="Image opacity"
                  value={backgroundOpacity}
                  min={0}
                  max={100}
                  onChange={setBackgroundOpacity}
                />

                <RangeInput
                  label="Image blur"
                  value={backgroundBlur}
                  min={0}
                  max={20}
                  onChange={setBackgroundBlur}
                />

                <SecondaryButton onClick={() => setBackgroundImage(null)}>
                  Remove background image
                </SecondaryButton>
              </>
            )}
          </TopBarMenu>

          <TopBarMenu label="Add" icon={MENU_ICONS.add}>
            {/* A new sticker, text box or avatar is selected straight away, so its
                toolbar opens, and the menu closes (CLOSES_MENU). */}
            <div {...CLOSES_MENU}>
              <FileInput label="Upload sticker" onChange={addSticker} />
            </div>

            <p className="text-xs leading-5 text-slate-400">
              Transparent PNG or WebP files work best.
            </p>

            <button
              type="button"
              {...CLOSES_MENU}
              onClick={addTextBox}
              className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
            >
              + Add text box
            </button>

            {/* Once there is an avatar, it is replaced or removed in its own toolbar. */}
            {!avatarImage && (
              <div {...CLOSES_MENU}>
                <FileInput
                  label="Avatar"
                  onChange={(file) =>
                    readImageFile(file, (src) => {
                      setAvatarImage(src);
                      setSelection({ kind: "header", part: "avatar" });
                    })
                  }
                />
              </div>
            )}
          </TopBarMenu>

          <TopBarMenu label="Discord" icon={MENU_ICONS.discord}>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs font-semibold text-slate-400">
                Timezone used
              </p>

              <p className="mt-1 break-all text-sm font-bold text-slate-200">
                {effectiveTimezone}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                {overrideTimezoneEnabled
                  ? "Using your manually selected timezone."
                  : "Detected automatically from this device."}
              </p>
            </div>

            <ToggleInput
              label="Override timezone"
              checked={overrideTimezoneEnabled}
              onChange={setOverrideTimezoneEnabled}
            />

            {overrideTimezoneEnabled && (
              <SelectInput
                label="Timezone"
                value={overrideTimezone}
                onChange={setOverrideTimezone}
                options={timezoneOptions.map((timezoneName) => ({
                  value: timezoneName,
                  label: timezoneName,
                }))}
              />
            )}

            <SelectInput
              label="Timestamp appearance"
              value={discordStyle}
              onChange={(value) =>
                setDiscordStyle(value as DiscordTimestampStyle)
              }
              options={DISCORD_STYLE_OPTIONS}
            />

            <button
              type="button"
              {...CLOSES_MENU}
              onClick={copyFullWeekTimestamps}
              className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
            >
              Copy full schedule
            </button>

            <p className="text-xs leading-5 text-slate-400">
              Copy a single day from its card&apos;s toolbar. Discord shows
              timestamps in each reader&apos;s local timezone.
            </p>
          </TopBarMenu>

          <TopBarMenu label="Template" icon={MENU_ICONS.template}>
            <p className="text-xs leading-5 text-slate-400">
              Templates include all text, styles, dates, uploaded images and
              sticker positions.
            </p>

            <button
              type="button"
              {...CLOSES_MENU}
              onClick={exportTemplate}
              className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
            >
              Export template
            </button>

            <button
              type="button"
              {...CLOSES_MENU}
              onClick={openTemplateImporter}
              disabled={isImportingTemplate}
              className="w-full rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
            >
              {isImportingTemplate ? "Importing template…" : "Import template"}
            </button>

            <p className="text-xs leading-5 text-slate-400">
              Images are embedded in the JSON file. Large images will produce a
              larger template.
            </p>
          </TopBarMenu>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {/* Outside the Template menu, so it is still there while the file picker is
              open (the menu closes as soon as Import is clicked). */}
          <input
            ref={templateInputRef}
            type="file"
            accept=".json,application/json"
            onChange={importTemplateFile}
            className="hidden"
          />

          <div
            role="group"
            aria-label="Export quality"
            className="flex items-center gap-0.5 rounded-full border border-slate-700 p-0.5"
          >
            {EXPORT_QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setExportQuality(option.value)}
                aria-pressed={exportQuality === option.value}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-bold transition",
                  exportQuality === option.value
                    ? "bg-violet-500 text-white"
                    : "text-slate-400 hover:text-slate-200",
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportScheduleAsPng}
            disabled={isExportingPng}
            className="rounded-full bg-violet-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50"
          >
            {isExportingPng ? "Exporting PNG…" : "Export PNG"}
          </button>
        </div>
      </header>

      {/* The preview takes all the height below the top bar. */}
      <section className="relative min-h-0 flex-1 overflow-hidden">
        {/* Right under the top bar, above the canvas and its toolbars. */}
        <Toast message={toast} onDismiss={() => setToast(null)} />

        <div className="flex h-full flex-col">
          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#312e81,transparent_35%),radial-gradient(circle_at_bottom_left,#155e75,transparent_35%),#020617] p-6">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-400">
                  Live preview
                </p>
              </div>

              <p className="text-xs text-slate-400">
                {canvasWidth} × {canvasHeight} canvas ·{" "}
                {Math.round(previewScale * 100)}% · scroll to zoom
              </p>
            </div>

            <div
              ref={previewAreaRef}
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            >
              <div
                className="relative shrink-0"
                style={{
                  width: `${canvasWidth * previewScale}px`,
                  height: `${canvasHeight * previewScale}px`,
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                }}
              >
                <div
                  ref={previewRef}
                  onPointerDown={(event) => {
                    // Elements stop their own pointer-down, so reaching here means empty canvas.
                    setSelection(null);
                    beginCanvasPan(event);
                  }}
                  className="absolute left-0 top-0 touch-none overflow-hidden rounded-[2rem] bg-transparent p-10 cursor-grab active:cursor-grabbing"
                  style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                    backgroundColor: "transparent",
                    background: `radial-gradient(circle at top right, rgba(255,255,255,0.45), transparent 28%), linear-gradient(135deg, ${theme.backgroundA}, ${theme.backgroundB})`,
                    color: theme.text,
                    boxShadow: isExportingPng
                      ? "none"
                      : "0 25px 50px -12px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white/10 p-10">
                    {backgroundImage && (
                      <img
                        src={backgroundImage}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full select-none"
                        style={{
                          objectFit: backgroundFit,
                          opacity: backgroundOpacity / 100,
                          filter: `blur(${backgroundBlur}px)`,
                          transform:
                            backgroundBlur > 0 ? "scale(1.05)" : undefined,
                        }}
                      />
                    )}

                    <PatternLayer
                      pattern={backgroundPattern}
                      themeText={theme.text}
                    />

                    {showHeader && (
                      <div
                        className="relative flex items-start"
                        style={{
                          gap: `${headerStyle.avatarGap}px`,
                          zIndex: HEADER_Z_INDEX,
                        }}
                      >
                        {avatarImage && (
                          <div
                            {...headerPartProps(
                              "avatar",
                              "shrink-0 overflow-hidden rounded-full border-4 border-white/80 bg-white/70 shadow-xl",
                            )}
                            style={{
                              width: `${headerStyle.avatarSize}px`,
                              height: `${headerStyle.avatarSize}px`,
                            }}
                          >
                            <img
                              src={avatarImage}
                              alt="Avatar"
                              draggable={false}
                              className="h-full w-full select-none"
                              style={{
                                objectFit: "cover",
                                objectPosition: `${50 + avatarOffsetX}% ${50 + avatarOffsetY}%`,
                                transform: `scale(${avatarZoom})`,
                              }}
                            />
                          </div>
                        )}

                        <div>
                          {headerPartVisible(
                            "title",
                            Boolean(scheduleTitle.trim()),
                          ) && (
                            <p
                              {...headerPartProps(
                                "title",
                                "font-black uppercase tracking-[0.35em] opacity-70",
                              )}
                              style={{
                                fontSize: `${headerStyle.eyebrowFontSize}px`,
                              }}
                            >
                              {headerText(scheduleTitle, "Schedule title")}
                            </p>
                          )}

                          {headerPartVisible(
                            "name",
                            Boolean(displayName.trim()),
                          ) && (
                            <h2
                              {...headerPartProps(
                                "name",
                                "max-w-3xl font-black leading-tight",
                              )}
                              style={{
                                marginTop: `${headerStyle.textGap}px`,
                                fontSize: `${headerStyle.titleFontSize}px`,
                              }}
                            >
                              {headerText(displayName, "Streamer name")}
                            </h2>
                          )}

                          {headerPartVisible(
                            "dates",
                            Boolean(calculatedDateRangeLabel),
                          ) && (
                            <p
                              {...headerPartProps(
                                "dates",
                                "font-semibold opacity-80",
                              )}
                              style={{
                                marginTop: `${headerStyle.textGap}px`,
                                fontSize: `${headerStyle.dateFontSize}px`,
                              }}
                            >
                              {headerText(calculatedDateRangeLabel, "Pick dates")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {scheduleLayout === "cards" ? (
                      <div
                        className={
                          isGridLayout
                            ? "relative mt-auto grid h-[60%] gap-4"
                            : "relative mt-auto flex h-[48%] items-end gap-4"
                        }
                        style={
                          isGridLayout
                            ? {
                                gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                                gridAutoRows: "1fr",
                              }
                            : undefined
                        }
                      >
                        {schedule.map((item, index) => (
                          <ScheduleCard
                            key={index}
                            item={item}
                            layout={isGridLayout ? "grid" : "row"}
                            widthPercent={calculatedWidths[index]}
                            selected={isSelected({ kind: "day", index })}
                            activeColor={theme.cardActive}
                            restColor={theme.cardRest}
                            textColor={theme.text}
                            selectProps={selectableProps({
                              kind: "day",
                              index,
                            })}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="relative mt-auto flex h-[55%] flex-col gap-2 overflow-hidden">
                        {schedule.map((item, index) => (
                          <ScheduleListRow
                            key={index}
                            item={item}
                            selected={isSelected({ kind: "day", index })}
                            activeColor={theme.cardActive}
                            restColor={theme.cardRest}
                            textColor={theme.text}
                            selectProps={selectableProps({
                              kind: "day",
                              index,
                            })}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    {stickers.map((sticker) => {
                      const stickerSelected = isSelected({
                        kind: "sticker",
                        id: sticker.id,
                      });

                      const stickerShadowXY = getShadowOffsetXY(
                        sticker.shadowOffset,
                        sticker.shadowDirection,
                      );

                      return (
                        <div
                          key={sticker.id}
                          {...selectableProps({
                            kind: "sticker",
                            id: sticker.id,
                          })}
                          // Replaces the plain select from selectableProps: a sticker
                          // selects itself and also starts a drag.
                          onPointerDown={(event) => {
                            if (isExportingPng) {
                              return;
                            }

                            beginStickerDrag(event, sticker);
                          }}
                          className={[
                            "pointer-events-auto absolute touch-none select-none",
                            isExportingPng
                              ? "cursor-default"
                              : "cursor-grab active:cursor-grabbing",
                            stickerSelected ? SELECTED_OUTLINE : "",
                          ].join(" ")}
                          style={{
                            left: `${sticker.x}%`,
                            top: `${sticker.y}%`,
                            width: `${sticker.size}px`,
                            opacity: sticker.opacity / 100,
                            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                            zIndex: sticker.zIndex,
                          }}
                          title={
                            isExportingPng ? undefined : `Drag ${sticker.name}`
                          }
                        >
                          <div
                            className="w-full overflow-hidden"
                            style={{
                              borderRadius: `${sticker.borderRadius}px`,
                              borderWidth: `${sticker.borderWidth}px`,
                              borderColor: sticker.borderColor,
                              borderStyle:
                                sticker.borderWidth > 0 ? "solid" : "none",
                              boxShadow:
                                sticker.shadowOffset > 0
                                  ? `${stickerShadowXY.x}px ${stickerShadowXY.y}px 0 rgba(0,0,0,0.85)`
                                  : "none",
                            }}
                          >
                            <img
                              src={sticker.src}
                              alt={sticker.name}
                              draggable={false}
                              className="pointer-events-none block h-auto w-full select-none"
                            />
                          </div>

                          {stickerSelected && (
                            <>
                              <span className="pointer-events-none absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-full bg-violet-400/70" />

                              <button
                                type="button"
                                onPointerDown={(event) =>
                                  beginStickerRotate(event, sticker)
                                }
                                className="pointer-events-auto absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-[32px] cursor-grab touch-none rounded-full border-2 border-white bg-violet-500 shadow active:cursor-grabbing"
                                title="Drag to rotate"
                              />

                              <button
                                type="button"
                                onPointerDown={(event) =>
                                  beginStickerResize(event, sticker)
                                }
                                className="pointer-events-auto absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-violet-500 shadow"
                                title="Drag to resize"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    {textBoxes.map((textBox) => {
                      const textBoxSelected = isSelected({
                        kind: "text",
                        id: textBox.id,
                      });

                      return (
                        <div
                          key={textBox.id}
                          {...selectableProps({
                            kind: "text",
                            id: textBox.id,
                          })}
                          // Replaces the plain select from selectableProps: a text box
                          // selects itself and also starts a drag.
                          onPointerDown={(event) => {
                            if (isExportingPng) {
                              return;
                            }

                            beginTextBoxDrag(event, textBox);
                          }}
                          className={[
                            "pointer-events-auto absolute touch-none select-none rounded-md",
                            isExportingPng
                              ? "cursor-default"
                              : "cursor-grab active:cursor-grabbing",
                            textBoxSelected ? SELECTED_OUTLINE : "",
                          ].join(" ")}
                          style={{
                            left: `${textBox.x}%`,
                            top: `${textBox.y}%`,
                            width: `${textBox.width}px`,
                            transform: `translate(-50%, -50%) rotate(${textBox.rotation}deg)`,
                            zIndex: textBox.zIndex,
                          }}
                        >
                          <div
                            style={{
                              fontSize: `${textBox.fontSize}px`,
                              color: textBox.color,
                              textAlign: textBox.align,
                              fontWeight: textBox.bold ? 700 : 400,
                              fontStyle: textBox.italic ? "italic" : "normal",
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {textBox.text || "Text box"}
                          </div>

                          {textBoxSelected && (
                            <>
                              <span className="pointer-events-none absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 -translate-y-full bg-violet-400/70" />

                              <button
                                type="button"
                                onPointerDown={(event) =>
                                  beginTextBoxRotate(event, textBox)
                                }
                                className="pointer-events-auto absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-[32px] cursor-grab touch-none rounded-full border-2 border-white bg-violet-500 shadow active:cursor-grabbing"
                                title="Drag to rotate"
                              />

                              <button
                                type="button"
                                onPointerDown={(event) =>
                                  beginTextBoxResize(event, textBox)
                                }
                                className="pointer-events-auto absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-violet-500 shadow"
                                title="Drag to resize"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Outside the scaled canvas and the preview area (see FloatingToolbar), placed
                relative to this `relative` section. Not mounted during PNG export. */}
            {activeSelection !== null &&
              !isExportingPng &&
              renderElementToolbar(activeSelection)}
          </section>
        </div>
      </section>
    </main>
  );
}

function ScheduleListRow({
  item,
  selected,
  activeColor,
  restColor,
  textColor,
  selectProps,
}: {
  item: DayItem;
  selected: boolean;
  activeColor: string;
  restColor: string;
  textColor: string;
  // Focus, keyboard and pointer handling from the page, so selection lives in one place.
  selectProps: SelectableProps;
}) {
  const shadowXY = getShadowOffsetXY(item.shadowOffset, item.shadowDirection);

  return (
    <div
      className="min-h-0 w-full shrink-0 transition-[flex-grow,transform] duration-200"
      style={{
        flexGrow: item.height,
        flexBasis: 0,
        minHeight: "32px",
        transform: `rotate(${item.rotation}deg)`,
        zIndex: item.zIndex,
      }}
    >
      <div
        {...selectProps}
        className={[
          "flex h-full w-full cursor-pointer items-center gap-4 overflow-hidden px-5 py-2 text-left transition",
          selected ? SELECTED_OUTLINE : "",
        ].join(" ")}
        style={{
          background: item.active ? activeColor : restColor,
          color: textColor,
          borderRadius: `${item.borderRadius}px`,
          borderWidth: `${item.borderWidth}px`,
          borderColor: item.borderColor,
          borderStyle: "solid",
          boxShadow:
            item.shadowOffset > 0
              ? `${shadowXY.x}px ${shadowXY.y}px 0 rgba(0,0,0,0.85)`
              : "none",
        }}
      >
        <span
          className="shrink-0 font-black uppercase tracking-[0.2em]"
          style={{ fontSize: `${item.dayFontSize}px`, lineHeight: 1.2 }}
        >
          {item.day}
        </span>

        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          {item.title.trim() && (
            <span
              className="break-words font-black"
              style={{ fontSize: `${item.titleFontSize}px`, lineHeight: 1.08 }}
            >
              {item.title}
            </span>
          )}

          {item.time.trim() && (
            <span
              className="font-semibold"
              style={{ fontSize: `${item.timeFontSize}px`, lineHeight: 1.25 }}
            >
              {item.time}
            </span>
          )}

          {item.note.trim() && (
            <span
              className="break-words italic opacity-75"
              style={{ fontSize: `${item.noteFontSize}px`, lineHeight: 1.45 }}
            >
              {item.note}
            </span>
          )}

          {!item.title.trim() && !item.time.trim() && !item.note.trim() && (
            <span className="opacity-50">—</span>
          )}
        </span>
      </div>
    </div>
  );
}

function ScheduleCard({
  item,
  layout,
  widthPercent,
  selected,
  activeColor,
  restColor,
  textColor,
  selectProps,
}: {
  item: DayItem;
  layout: "row" | "grid";
  widthPercent: number;
  selected: boolean;
  activeColor: string;
  restColor: string;
  textColor: string;
  // Focus, keyboard and pointer handling from the page, so selection lives in one place.
  selectProps: SelectableProps;
}) {
  const shadowXY = getShadowOffsetXY(item.shadowOffset, item.shadowDirection);

  return (
    <div
      className={
        layout === "grid"
          ? "min-w-0 transition-[height,transform] duration-200"
          : "min-w-0 shrink-0 transition-[width,height,transform] duration-200"
      }
      style={{
        width: layout === "grid" ? "100%" : `calc(${widthPercent}% - 13.72px)`,
        height: `${Math.min(100, Math.max(0, item.height))}%`,
        transform: `rotate(${item.rotation}deg)`,
        zIndex: item.zIndex,
      }}
    >
      <div
        {...selectProps}
        className={[
          "relative h-full w-full cursor-pointer overflow-hidden p-6 text-left transition",
          selected ? SELECTED_OUTLINE : "",
        ].join(" ")}
        style={{
          background: item.active ? activeColor : restColor,
          color: textColor,
          borderRadius: `${item.borderRadius}px`,
          borderWidth: `${item.borderWidth}px`,
          borderColor: item.borderColor,
          borderStyle: "solid",
          boxShadow:
            item.shadowOffset > 0
              ? `${shadowXY.x}px ${shadowXY.y}px 0 rgba(0,0,0,0.85)`
              : "none",
        }}
      >
        <p
          className="mb-6 font-black uppercase tracking-[0.25em]"
          style={{
            fontSize: `${item.dayFontSize}px`,
            lineHeight: 1.2,
          }}
        >
          {item.day}
        </p>

        {item.title.trim() && (
          <h3
            className="break-words font-black"
            style={{
              fontSize: `${item.titleFontSize}px`,
              lineHeight: 1.08,
            }}
          >
            {item.title}
          </h3>
        )}

        {item.time.trim() && (
          <p
            className="mt-5 font-semibold"
            style={{
              fontSize: `${item.timeFontSize}px`,
              lineHeight: 1.25,
            }}
          >
            {item.time}
          </p>
        )}

        {item.note.trim() && (
          <p
            className="mt-5 break-words italic opacity-75"
            style={{
              fontSize: `${item.noteFontSize}px`,
              lineHeight: 1.45,
            }}
          >
            {item.note}
          </p>
        )}
      </div>
    </div>
  );
}
