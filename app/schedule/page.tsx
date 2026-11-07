"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
import {
  ColorInput,
  DateInput,
  FileInput,
  Panel,
  RangeInput,
  SecondaryButton,
  SelectInput,
  SmallButton,
  TextArea,
  TextInput,
  TimeInput,
  ToggleInput,
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

type TemplateMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

type TabId =
  "project" | "appearance" | "images" | "stickers" | "text" | "day" | "discord";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  {
    id: "project",
    label: "Project",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5a1 1 0 0 1 1-1h9l6 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 4v5a1 1 0 0 0 1 1h5"
        />
      </svg>
    ),
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.582 9 8 0 2.21-1.79 3-3.5 3H15a2 2 0 0 0-1.4 3.4c.4.4.4 1-.1 1.3-.5.3-1 .8-1.5 1.3-.3.3 0 1 0 1z"
        />
        <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "images",
    label: "Images",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L4 19"
        />
      </svg>
    ),
  },
  {
    id: "stickers",
    label: "Stickers",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 3v5a2 2 0 0 0 2 2h5"
        />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M9 6v14" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 20h6" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 20l4-11 4 11M15.3 16.5h5.4"
        />
      </svg>
    ),
  },
  {
    id: "day",
    label: "Day editor",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 10h18M8 3v4M16 3v4"
        />
      </svg>
    ),
  },
  {
    id: "discord",
    label: "Discord",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12a8 8 0 1 1 8 8 8.4 8.4 0 0 1-3.5-.8L4 20l1-4.2A7.9 7.9 0 0 1 4 12z"
        />
      </svg>
    ),
  },
];

type CustomizationMode = "simple" | "advanced";

const MIN_ZOOM_LEVEL = 0.25;
const MAX_ZOOM_LEVEL = 4;

const MIN_PANEL_HEIGHT = 160;

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

const SHADOW_DIRECTIONS: ShadowDirection[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

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
  const [customizationMode, setCustomizationMode] =
    useState<CustomizationMode>("advanced");

  const [detectedTimezone] = useState(getBrowserTimezone);
  const [overrideTimezoneEnabled, setOverrideTimezoneEnabled] = useState(false);
  const [overrideTimezone, setOverrideTimezone] = useState(getBrowserTimezone);

  const [discordStyle, setDiscordStyle] = useState<DiscordTimestampStyle>("F");
  const [copyStatus, setCopyStatus] = useState("");

  const [schedule, setSchedule] = useState(initialSchedule);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );

  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<TabId>("project");
  const [panelHeight, setPanelHeight] = useState(340);

  const [templateMessage, setTemplateMessage] = useState<TemplateMessage>(null);

  const [isImportingTemplate, setIsImportingTemplate] = useState(false);

  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportQuality, setExportQuality] = useState<ExportQuality>(1);
  const [pngExportMessage, setPngExportMessage] =
    useState<TemplateMessage>(null);

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
  const panelResizeRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );

  const selectedDay = schedule[selectedIndex];

  const canvasWidth = ASPECT_RATIOS[aspectRatioId].width;
  const canvasHeight = ASPECT_RATIOS[aspectRatioId].height;
  const gridColumns = ASPECT_RATIOS[aspectRatioId].gridColumns;
  const isGridLayout = gridColumns > 0;

  const scheduleDayCountRaw = getScheduleDayCount(
    scheduleStartDate,
    scheduleEndDate,
  );

  const selectedDayDate = getDateForDay(scheduleStartDate, selectedIndex);

  const selectedSticker =
    stickers.find((sticker) => sticker.id === selectedStickerId) ?? null;

  const selectedTextBox =
    textBoxes.find((textBox) => textBox.id === selectedTextBoxId) ?? null;

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

  const showHeader =
    Boolean(displayName.trim()) ||
    Boolean(scheduleTitle.trim()) ||
    Boolean(calculatedDateRangeLabel) ||
    Boolean(avatarImage);

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

    setSelectedIndex((current) => Math.min(current, dayCount - 1));
  }, [scheduleStartDate, scheduleEndDate]);

  function updateDay<K extends keyof DayItem>(field: K, value: DayItem[K]) {
    setSchedule((current) =>
      current.map((item, index) =>
        index === selectedIndex ? { ...item, [field]: value } : item,
      ),
    );
  }

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

  function moveDay(action: "front" | "back" | "forward" | "backward") {
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
    setPngExportMessage({
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

      setPngExportMessage({
        type: "success",
        text: `Schedule exported at ${outputWidth} × ${outputHeight}.`,
      });
    } catch (error) {
      console.error("PNG export failed:", error);

      setPngExportMessage({
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

    updateDay("widthLocked", false);
  }

  function resetSelectedDayStyle() {
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
      setTemplateMessage({
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
      setSelectedStickerId(id);
    });
  }

  function removeSticker(stickerId: string) {
    setStickers((current) =>
      current.filter((sticker) => sticker.id !== stickerId),
    );

    setSelectedStickerId((current) => (current === stickerId ? null : current));
  }

  function moveSticker(
    stickerId: string,
    action: "front" | "back" | "forward" | "backward",
  ) {
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
    setSelectedTextBoxId(id);
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

  function moveTextBox(
    textBoxId: string,
    action: "front" | "back" | "forward" | "backward",
  ) {
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

    setSelectedTextBoxId((current) => (current === textBoxId ? null : current));
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

    setSelectedStickerId(sticker.id);
    setActiveTab("stickers");
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

    setSelectedStickerId(sticker.id);
    setActiveTab("stickers");
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

    setSelectedStickerId(sticker.id);
    setActiveTab("stickers");
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

    setSelectedTextBoxId(textBox.id);
    setActiveTab("text");
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

    setSelectedTextBoxId(textBox.id);
    setActiveTab("text");
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

    setSelectedTextBoxId(textBox.id);
    setActiveTab("text");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();

    panelResizeRef.current = {
      startY: event.clientY,
      startHeight: panelHeight,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const resizeState = panelResizeRef.current;

      if (!resizeState) {
        return;
      }

      const deltaY = event.clientY - resizeState.startY;
      const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - 160);

      const nextHeight = Math.min(
        maxHeight,
        Math.max(MIN_PANEL_HEIGHT, resizeState.startHeight - deltaY),
      );

      setPanelHeight(nextHeight);
    }

    function handlePointerUp() {
      panelResizeRef.current = null;
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

      setTemplateMessage({
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

      setTemplateMessage({
        type: "error",
        text: "The template could not be exported.",
      });
    }
  }

  function openTemplateImporter() {
    setTemplateMessage(null);
    templateInputRef.current?.click();
  }

  async function importTemplateFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      setTemplateMessage({
        type: "error",
        text: "This template is larger than the 50 MB import limit.",
      });

      return;
    }

    setIsImportingTemplate(true);
    setTemplateMessage({
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

      setSelectedIndex(0);
      setSelectedStickerId(null);
      setSelectedTextBoxId(null);
      setCopyStatus("");

      // The imported file is the new saved state once React has applied it.
      resnapshotRef.current = true;

      setTemplateMessage({
        type: "success",
        text: `Loaded template “${file.name}” successfully.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The template could not be imported.";

      setTemplateMessage({
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
      setCopyStatus(message);

      window.setTimeout(() => {
        setCopyStatus("");
      }, 2000);
    } catch {
      setCopyStatus("Could not access clipboard");
    }
  }

  function getSelectedDayDiscordText(): string | null {
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
    const textToCopy = getSelectedDayDiscordText();

    if (!textToCopy) {
      setCopyStatus("Add a week start date and stream time first");
      return;
    }

    await copyText(textToCopy, `${selectedDay.day} timestamp copied`);
  }

  async function copyFullWeekTimestamps() {
    const textToCopy = getFullWeekDiscordText();

    if (!textToCopy) {
      setCopyStatus("No active days have a valid stream time");
      return;
    }

    await copyText(textToCopy, "Full schedule copied");
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={confirmLeave}
            className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-violet-400 hover:text-white"
          >
            ← Back
          </Link>

          <h1 className="text-sm font-bold tracking-wide text-slate-300">
            Streamer Tools <span className="text-slate-600" aria-hidden="true">/</span>{" "}
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

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={templateInputRef}
            type="file"
            accept=".json,application/json"
            onChange={importTemplateFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={openTemplateImporter}
            disabled={isImportingTemplate}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-violet-400 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
          >
            {isImportingTemplate ? "Importing…" : "Import template"}
          </button>

          <button
            type="button"
            onClick={exportTemplate}
            className="rounded-full border border-violet-400/50 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200 transition hover:bg-violet-500/20"
          >
            Export template
          </button>

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

      <section className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 flex h-[80vh] flex-col">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#312e81,transparent_35%),radial-gradient(circle_at_bottom_left,#155e75,transparent_35%),#020617] p-6">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  role="group"
                  aria-label="Customization mode"
                  className="flex items-center gap-0.5 rounded-full border border-slate-700 p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setCustomizationMode("simple")}
                    aria-pressed={customizationMode === "simple"}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold transition",
                      customizationMode === "simple"
                        ? "bg-violet-500 text-white"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Simple
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomizationMode("advanced")}
                    aria-pressed={customizationMode === "advanced"}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold transition",
                      customizationMode === "advanced"
                        ? "bg-violet-500 text-white"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    Advanced
                  </button>
                </div>

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
                    setSelectedStickerId(null);
                    setSelectedTextBoxId(null);
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

                    <PatternLayer pattern={backgroundPattern} themeText={theme.text} />

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
                            className="shrink-0 overflow-hidden rounded-full border-4 border-white/80 bg-white/70 shadow-xl"
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
                          {scheduleTitle.trim() && (
                            <p
                              className="font-black uppercase tracking-[0.35em] opacity-70"
                              style={{
                                fontSize: `${headerStyle.eyebrowFontSize}px`,
                              }}
                            >
                              {scheduleTitle}
                            </p>
                          )}

                          {displayName.trim() && (
                            <h2
                              className="max-w-3xl font-black leading-tight"
                              style={{
                                marginTop: `${headerStyle.textGap}px`,
                                fontSize: `${headerStyle.titleFontSize}px`,
                              }}
                            >
                              {displayName}
                            </h2>
                          )}

                          {calculatedDateRangeLabel && (
                            <p
                              className="font-semibold opacity-80"
                              style={{
                                marginTop: `${headerStyle.textGap}px`,
                                fontSize: `${headerStyle.dateFontSize}px`,
                              }}
                            >
                              {calculatedDateRangeLabel}
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
                            selected={
                              !isExportingPng && selectedIndex === index
                            }
                            activeColor={theme.cardActive}
                            restColor={theme.cardRest}
                            textColor={theme.text}
                            onSelect={() => {
                              if (isExportingPng) {
                                return;
                              }

                              setSelectedIndex(index);
                              setSelectedStickerId(null);
                              setActiveTab("day");
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="relative mt-auto flex h-[55%] flex-col gap-2 overflow-hidden">
                        {schedule.map((item, index) => (
                          <ScheduleListRow
                            key={index}
                            item={item}
                            selected={
                              !isExportingPng && selectedIndex === index
                            }
                            activeColor={theme.cardActive}
                            restColor={theme.cardRest}
                            textColor={theme.text}
                            onSelect={() => {
                              if (isExportingPng) {
                                return;
                              }

                              setSelectedIndex(index);
                              setSelectedStickerId(null);
                              setActiveTab("day");
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    {stickers.map((sticker) => {
                      const isSelected =
                        !isExportingPng && selectedStickerId === sticker.id;

                      const stickerShadowXY = getShadowOffsetXY(
                        sticker.shadowOffset,
                        sticker.shadowDirection,
                      );

                      return (
                        <div
                          role="button"
                          key={sticker.id}
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
                            isSelected
                              ? "outline outline-2 outline-offset-4 outline-violet-400"
                              : "",
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

                          {isSelected && (
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
                      const isSelected =
                        !isExportingPng && selectedTextBoxId === textBox.id;

                      return (
                        <div
                          role="button"
                          key={textBox.id}
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
                            isSelected
                              ? "outline outline-2 outline-offset-4 outline-violet-400"
                              : "",
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

                          {isSelected && (
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
          </section>
        </div>

        <aside
          className="absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden border-t border-slate-800 bg-slate-900/95 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.6)]"
          style={{ height: panelHeight }}
        >
          <div
            onPointerDown={beginPanelResize}
            className="flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
            title="Drag to resize the control panel"
          >
            <div className="h-1 w-12 rounded-full bg-slate-600" />
          </div>

          <div
            role="tablist"
            aria-label="Editor sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-4 py-2"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="editor-panel"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition",
                  activeTab === tab.id
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id="editor-panel"
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="p-5">
              {templateMessage && (
                <TemplateNotice
                  message={templateMessage}
                  onDismiss={() => setTemplateMessage(null)}
                />
              )}

              {pngExportMessage && (
                <TemplateNotice
                  message={pngExportMessage}
                  onDismiss={() => setPngExportMessage(null)}
                />
              )}

              <div className="space-y-5">
                {activeTab === "project" && (
                  <>
                    <Panel title="Template">
                      <p className="text-xs leading-5 text-slate-400">
                        Templates include all text, styles, dates, uploaded
                        images and sticker positions.
                      </p>

                      <button
                        type="button"
                        onClick={exportTemplate}
                        className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
                      >
                        Export current template
                      </button>

                      <SecondaryButton
                        onClick={openTemplateImporter}
                        disabled={isImportingTemplate}
                      >
                        {isImportingTemplate
                          ? "Importing template…"
                          : "Import template"}
                      </SecondaryButton>

                      <p className="text-xs leading-5 text-slate-400">
                        Images are embedded in the JSON file. Large images will
                        produce a larger template.
                      </p>
                    </Panel>
                    <Panel title="Project">
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

                      {scheduleStartDate &&
                        scheduleEndDate &&
                        scheduleDayCountRaw < 1 && (
                          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-300">
                            End date is before the start date. Pick a valid
                            range to update the schedule.
                          </p>
                        )}

                      {scheduleDayCountRaw > MAX_SCHEDULE_DAYS && (
                        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-300">
                          Range capped at {MAX_SCHEDULE_DAYS} days (
                          {scheduleDayCountRaw} selected).
                        </p>
                      )}

                      {calculatedDateRangeLabel && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3">
                          <p className="text-xs font-semibold text-slate-400">
                            Generated range · {schedule.length} day
                            {schedule.length === 1 ? "" : "s"}
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-200">
                            {calculatedDateRangeLabel}
                          </p>
                        </div>
                      )}
                    </Panel>

                    <Panel title="Canvas">
                      <p className="text-xs leading-5 text-slate-400">
                        Choose an aspect ratio for the exported image.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(ASPECT_RATIOS) as AspectRatioId[]).map(
                          (ratioId) => (
                            <SmallButton
                              key={ratioId}
                              active={aspectRatioId === ratioId}
                              onClick={() => setAspectRatioId(ratioId)}
                            >
                              {ASPECT_RATIOS[ratioId].label}
                            </SmallButton>
                          ),
                        )}
                      </div>

                      <p className="text-xs leading-5 text-slate-400">
                        Choose how the schedule itself is displayed.
                      </p>

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
                    </Panel>

                    {customizationMode === "advanced" && (
                      <Panel title="Header typography">
                        <RangeInput
                          label="Avatar size"
                          value={headerStyle.avatarSize}
                          min={40}
                          max={300}
                          step={2}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("avatarSize", value)
                          }
                        />

                        <RangeInput
                          label="Avatar gap"
                          value={headerStyle.avatarGap}
                          min={0}
                          max={100}
                          step={2}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("avatarGap", value)
                          }
                        />

                        <RangeInput
                          label="Eyebrow size"
                          value={headerStyle.eyebrowFontSize}
                          min={8}
                          max={60}
                          step={1}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("eyebrowFontSize", value)
                          }
                        />

                        <RangeInput
                          label="Title size"
                          value={headerStyle.titleFontSize}
                          min={16}
                          max={160}
                          step={1}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("titleFontSize", value)
                          }
                        />

                        <RangeInput
                          label="Date size"
                          value={headerStyle.dateFontSize}
                          min={8}
                          max={80}
                          step={1}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("dateFontSize", value)
                          }
                        />

                        <RangeInput
                          label="Text line gap"
                          value={headerStyle.textGap}
                          min={0}
                          max={60}
                          step={1}
                          suffix="px"
                          onChange={(value) =>
                            updateHeaderStyle("textGap", value)
                          }
                        />
                      </Panel>
                    )}
                  </>
                )}

                {activeTab === "appearance" && (
                  <>
                    <Panel title="Appearance">
                      <PatternControls
                        pattern={backgroundPattern}
                        onChange={setBackgroundPattern}
                      />
                    </Panel>
                    <Panel title="Colors">
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
                    </Panel>
                  </>
                )}

                {activeTab === "images" && (
                  <Panel title="Images">
                    <FileInput
                      label="Avatar"
                      onChange={(file) => readImageFile(file, setAvatarImage)}
                    />

                    {avatarImage && (
                      <>
                        <SecondaryButton onClick={() => setAvatarImage(null)}>
                          Remove avatar
                        </SecondaryButton>

                        <RangeInput
                          label="Avatar zoom"
                          value={avatarZoom}
                          min={1}
                          max={3}
                          step={0.05}
                          onChange={setAvatarZoom}
                        />

                        <RangeInput
                          label="Avatar horizontal position"
                          value={avatarOffsetX}
                          min={-50}
                          max={50}
                          step={1}
                          suffix="%"
                          onChange={setAvatarOffsetX}
                        />

                        <RangeInput
                          label="Avatar vertical position"
                          value={avatarOffsetY}
                          min={-50}
                          max={50}
                          step={1}
                          suffix="%"
                          onChange={setAvatarOffsetY}
                        />

                        <SecondaryButton
                          onClick={() => {
                            setAvatarZoom(1);
                            setAvatarOffsetX(0);
                            setAvatarOffsetY(0);
                          }}
                        >
                          Reset framing
                        </SecondaryButton>
                      </>
                    )}

                    <FileInput
                      label="Background image"
                      onChange={(file) =>
                        readImageFile(file, setBackgroundImage)
                      }
                    />

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

                        <SecondaryButton
                          onClick={() => setBackgroundImage(null)}
                        >
                          Remove background
                        </SecondaryButton>
                      </>
                    )}
                  </Panel>
                )}

                {activeTab === "stickers" && (
                  <Panel title="Stickers">
                    <FileInput label="Upload sticker" onChange={addSticker} />

                    <p className="text-xs leading-5 text-slate-400">
                      Transparent PNG or WebP files work best. Drag stickers
                      directly on the preview.
                    </p>

                    {stickers.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {stickers.map((sticker) => (
                          <button
                            type="button"
                            key={sticker.id}
                            onClick={() => setSelectedStickerId(sticker.id)}
                            className={[
                              "aspect-square overflow-hidden rounded-xl border bg-slate-900 p-1 transition",
                              selectedStickerId === sticker.id
                                ? "border-violet-400 ring-2 ring-violet-500/30"
                                : "border-slate-700 hover:border-slate-500",
                            ].join(" ")}
                            title={sticker.name}
                          >
                            <img
                              src={sticker.src}
                              alt={sticker.name}
                              className="h-full w-full object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedSticker && (
                      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                        <p className="truncate text-xs font-bold text-slate-300">
                          {selectedSticker.name}
                        </p>

                        <RangeInput
                          label="Size"
                          value={selectedSticker.size}
                          min={40}
                          max={400}
                          onChange={(value) =>
                            updateSticker(selectedSticker.id, "size", value)
                          }
                        />

                        <RangeInput
                          label="Rotation"
                          value={selectedSticker.rotation}
                          min={-180}
                          max={180}
                          onChange={(value) =>
                            updateSticker(selectedSticker.id, "rotation", value)
                          }
                        />

                        <RangeInput
                          label="Opacity"
                          value={selectedSticker.opacity}
                          min={0}
                          max={100}
                          onChange={(value) =>
                            updateSticker(selectedSticker.id, "opacity", value)
                          }
                        />

                        {customizationMode === "advanced" && (
                          <>
                            <RangeInput
                              label="Corner radius"
                              value={selectedSticker.borderRadius}
                              min={0}
                              max={200}
                              suffix="px"
                              onChange={(value) =>
                                updateSticker(
                                  selectedSticker.id,
                                  "borderRadius",
                                  value,
                                )
                              }
                            />

                            <RangeInput
                              label="Border width"
                              value={selectedSticker.borderWidth}
                              min={0}
                              max={40}
                              suffix="px"
                              onChange={(value) =>
                                updateSticker(
                                  selectedSticker.id,
                                  "borderWidth",
                                  value,
                                )
                              }
                            />

                            <ColorInput
                              label="Border color"
                              value={selectedSticker.borderColor}
                              onChange={(value) =>
                                updateSticker(
                                  selectedSticker.id,
                                  "borderColor",
                                  value,
                                )
                              }
                            />

                            <RangeInput
                              label="Shadow"
                              value={selectedSticker.shadowOffset}
                              min={0}
                              max={80}
                              suffix="px"
                              onChange={(value) =>
                                updateSticker(
                                  selectedSticker.id,
                                  "shadowOffset",
                                  value,
                                )
                              }
                            />

                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-400">
                                Shadow direction
                              </p>

                              <div className="grid grid-cols-2 gap-2">
                                {SHADOW_DIRECTIONS.map((direction) => (
                                  <SmallButton
                                    key={direction}
                                    active={
                                      selectedSticker.shadowDirection ===
                                      direction
                                    }
                                    onClick={() =>
                                      updateSticker(
                                        selectedSticker.id,
                                        "shadowDirection",
                                        direction,
                                      )
                                    }
                                  >
                                    {direction.replace("-", " ")}
                                  </SmallButton>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-400">
                                Layering
                              </p>

                              <div className="grid grid-cols-2 gap-2">
                                <SmallButton
                                  active={false}
                                  onClick={() =>
                                    moveSticker(selectedSticker.id, "front")
                                  }
                                >
                                  Bring to front
                                </SmallButton>

                                <SmallButton
                                  active={false}
                                  onClick={() =>
                                    moveSticker(selectedSticker.id, "back")
                                  }
                                >
                                  Send to back
                                </SmallButton>

                                <SmallButton
                                  active={false}
                                  onClick={() =>
                                    moveSticker(selectedSticker.id, "forward")
                                  }
                                >
                                  Forward
                                </SmallButton>

                                <SmallButton
                                  active={false}
                                  onClick={() =>
                                    moveSticker(selectedSticker.id, "backward")
                                  }
                                >
                                  Backward
                                </SmallButton>
                              </div>
                            </div>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => removeSticker(selectedSticker.id)}
                          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                        >
                          Delete sticker
                        </button>
                      </div>
                    )}
                  </Panel>
                )}

                {activeTab === "text" && (
                  <Panel title="Text">
                    <button
                      type="button"
                      onClick={addTextBox}
                      className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
                    >
                      + Add text box
                    </button>

                    <p className="text-xs leading-5 text-slate-400">
                      Position, rotate, and resize a text box on the canvas,
                      then select it here to write its content.
                    </p>

                    {textBoxes.length > 0 && (
                      <div className="space-y-1">
                        {textBoxes.map((textBox) => (
                          <button
                            type="button"
                            key={textBox.id}
                            onClick={() => setSelectedTextBoxId(textBox.id)}
                            className={[
                              "block w-full truncate rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                              selectedTextBoxId === textBox.id
                                ? "border-violet-400 bg-violet-500/10 text-violet-200"
                                : "border-slate-700 text-slate-400 hover:border-slate-500",
                            ].join(" ")}
                          >
                            {textBox.text.trim() || "(empty text box)"}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedTextBox && (
                      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-400">
                            Content
                          </span>

                          <textarea
                            value={selectedTextBox.text}
                            onChange={(event) =>
                              updateTextBox(
                                selectedTextBox.id,
                                "text",
                                event.target.value,
                              )
                            }
                            rows={3}
                            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
                          />
                        </label>

                        <div className="flex gap-2">
                          <SmallButton
                            active={selectedTextBox.bold}
                            onClick={() =>
                              updateTextBox(
                                selectedTextBox.id,
                                "bold",
                                !selectedTextBox.bold,
                              )
                            }
                          >
                            <span className="font-black">B</span>
                          </SmallButton>

                          <SmallButton
                            active={selectedTextBox.italic}
                            onClick={() =>
                              updateTextBox(
                                selectedTextBox.id,
                                "italic",
                                !selectedTextBox.italic,
                              )
                            }
                          >
                            <span className="italic">I</span>
                          </SmallButton>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {(["left", "center", "right"] as const).map(
                            (align) => (
                              <SmallButton
                                key={align}
                                active={selectedTextBox.align === align}
                                onClick={() =>
                                  updateTextBox(
                                    selectedTextBox.id,
                                    "align",
                                    align,
                                  )
                                }
                              >
                                {align}
                              </SmallButton>
                            ),
                          )}
                        </div>

                        <RangeInput
                          label="Font size"
                          value={selectedTextBox.fontSize}
                          min={4}
                          max={200}
                          suffix="px"
                          onChange={(value) =>
                            updateTextBox(selectedTextBox.id, "fontSize", value)
                          }
                        />

                        <RangeInput
                          label="Box width"
                          value={selectedTextBox.width}
                          min={TEXT_BOX_MIN_WIDTH}
                          max={TEXT_BOX_MAX_WIDTH}
                          suffix="px"
                          onChange={(value) =>
                            updateTextBox(selectedTextBox.id, "width", value)
                          }
                        />

                        <RangeInput
                          label="Rotation"
                          value={selectedTextBox.rotation}
                          min={-180}
                          max={180}
                          onChange={(value) =>
                            updateTextBox(selectedTextBox.id, "rotation", value)
                          }
                        />

                        <ColorInput
                          label="Text color"
                          value={selectedTextBox.color}
                          onChange={(value) =>
                            updateTextBox(selectedTextBox.id, "color", value)
                          }
                        />

                        {customizationMode === "advanced" && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-400">
                              Layering
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              <SmallButton
                                active={false}
                                onClick={() =>
                                  moveTextBox(selectedTextBox.id, "front")
                                }
                              >
                                Bring to front
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() =>
                                  moveTextBox(selectedTextBox.id, "back")
                                }
                              >
                                Send to back
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() =>
                                  moveTextBox(selectedTextBox.id, "forward")
                                }
                              >
                                Forward
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() =>
                                  moveTextBox(selectedTextBox.id, "backward")
                                }
                              >
                                Backward
                              </SmallButton>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => removeTextBox(selectedTextBox.id)}
                          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                        >
                          Delete text box
                        </button>
                      </div>
                    )}
                  </Panel>
                )}

                {activeTab === "day" && (
                  <>
                    <Panel title="Select day">
                      <div className="grid grid-cols-7 gap-1">
                        {schedule.map((item, index) => (
                          <button
                            type="button"
                            key={item.day}
                            onClick={() => setSelectedIndex(index)}
                            className={[
                              "rounded-lg py-2 text-xs font-black transition",
                              selectedIndex === index
                                ? "bg-violet-500 text-white"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700",
                            ].join(" ")}
                          >
                            {item.day}
                          </button>
                        ))}
                      </div>
                    </Panel>
                    <Panel title={`${selectedDay.day} content`}>
                      {selectedDayDate && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3">
                          <p className="text-xs font-semibold text-slate-400">
                            Calculated date
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-200">
                            {formatCalculatedDate(selectedDayDate)}
                          </p>
                        </div>
                      )}

                      <TextInput
                        label="Stream title"
                        value={selectedDay.title}
                        onChange={(value) => updateDay("title", value)}
                      />

                      <TimeInput
                        label="Stream time"
                        value={selectedDay.time}
                        onChange={(value) => updateDay("time", value)}
                      />

                      <TextArea
                        label="Note"
                        value={selectedDay.note}
                        onChange={(value) => updateDay("note", value)}
                      />

                      <ToggleInput
                        label="Stream day"
                        checked={selectedDay.active}
                        onChange={(checked) => updateDay("active", checked)}
                      />
                    </Panel>
                    {customizationMode === "advanced" && (
                      <>
                        <Panel title={`${selectedDay.day} width`}>
                          {scheduleLayout === "list" ? (
                            <p className="text-xs leading-5 text-slate-400">
                              List rows always span full width. Use the
                              &quot;Height&quot; slider in card style to control
                              how much vertical space this row takes relative to
                              the others.
                            </p>
                          ) : isGridLayout ? (
                            <p className="text-xs leading-5 text-slate-400">
                              Width controls only apply to the 16:9 row layout.
                              On {ASPECT_RATIOS[aspectRatioId].label}, cards
                              fill their grid cell evenly — use the card style
                              panel for height instead.
                            </p>
                          ) : (
                            <>
                              <ToggleInput
                                label="Lock card width"
                                checked={selectedDay.widthLocked}
                                onChange={toggleSelectedDayWidthLock}
                              />

                              {selectedDay.widthLocked ? (
                                <RangeInput
                                  label="Locked width"
                                  value={Number(
                                    selectedDay.lockedWidthPercent.toFixed(1),
                                  )}
                                  min={5}
                                  max={50}
                                  step={0.5}
                                  suffix="%"
                                  onChange={(value) =>
                                    updateDay("lockedWidthPercent", value)
                                  }
                                />
                              ) : (
                                <RangeInput
                                  label="Relative width"
                                  value={selectedDay.widthWeight}
                                  min={0.5}
                                  max={2.5}
                                  step={0.1}
                                  onChange={(value) =>
                                    updateDay("widthWeight", value)
                                  }
                                />
                              )}

                              <p className="text-xs leading-5 text-slate-400">
                                Locked cards keep their width while unlocked
                                cards divide the remaining space.
                              </p>
                            </>
                          )}
                        </Panel>
                        <Panel title={`${selectedDay.day} typography`}>
                          <RangeInput
                            label="Weekday size"
                            value={selectedDay.dayFontSize}
                            min={10}
                            max={36}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("dayFontSize", value)
                            }
                          />

                          <RangeInput
                            label="Title size"
                            value={selectedDay.titleFontSize}
                            min={12}
                            max={54}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("titleFontSize", value)
                            }
                          />

                          <RangeInput
                            label="Time size"
                            value={selectedDay.timeFontSize}
                            min={10}
                            max={40}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("timeFontSize", value)
                            }
                          />

                          <RangeInput
                            label="Note size"
                            value={selectedDay.noteFontSize}
                            min={10}
                            max={36}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("noteFontSize", value)
                            }
                          />
                        </Panel>
                        <Panel title={`${selectedDay.day} card style`}>
                          {scheduleLayout === "list" ? (
                            <>
                              <RangeInput
                                label="Height (relative weight)"
                                value={selectedDay.height}
                                min={10}
                                max={400}
                                onChange={(value) => updateDay("height", value)}
                              />

                              <p className="text-xs leading-5 text-slate-400">
                                Rows are sized relative to each other's weight —
                                a row with 200 takes up twice the space of a row
                                with 100.
                              </p>
                            </>
                          ) : (
                            <RangeInput
                              label="Height"
                              value={selectedDay.height}
                              min={40}
                              max={100}
                              suffix="%"
                              onChange={(value) => updateDay("height", value)}
                            />
                          )}

                          <RangeInput
                            label="Rotation"
                            value={selectedDay.rotation}
                            min={-12}
                            max={12}
                            suffix="°"
                            onChange={(value) => updateDay("rotation", value)}
                          />

                          <RangeInput
                            label="Corner radius"
                            value={selectedDay.borderRadius}
                            min={0}
                            max={60}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("borderRadius", value)
                            }
                          />

                          <RangeInput
                            label="Outline width"
                            value={selectedDay.borderWidth}
                            min={0}
                            max={12}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("borderWidth", value)
                            }
                          />

                          <ColorInput
                            label="Outline color"
                            value={selectedDay.borderColor}
                            onChange={(value) =>
                              updateDay("borderColor", value)
                            }
                          />

                          <RangeInput
                            label="Shadow offset"
                            value={selectedDay.shadowOffset}
                            min={0}
                            max={30}
                            suffix="px"
                            onChange={(value) =>
                              updateDay("shadowOffset", value)
                            }
                          />

                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-400">
                              Shadow direction
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              {SHADOW_DIRECTIONS.map((direction) => (
                                <SmallButton
                                  key={direction}
                                  active={
                                    selectedDay.shadowDirection === direction
                                  }
                                  onClick={() =>
                                    updateDay("shadowDirection", direction)
                                  }
                                >
                                  {direction.replace("-", " ")}
                                </SmallButton>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-400">
                              Layering
                            </p>

                            <p className="text-xs leading-5 text-slate-400">
                              Send a day back to let stickers or text peek out
                              in front of it, or above.
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              <SmallButton
                                active={false}
                                onClick={() => moveDay("front")}
                              >
                                Bring to front
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() => moveDay("back")}
                              >
                                Send to back
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() => moveDay("forward")}
                              >
                                Forward
                              </SmallButton>

                              <SmallButton
                                active={false}
                                onClick={() => moveDay("backward")}
                              >
                                Backward
                              </SmallButton>
                            </div>
                          </div>

                          <SecondaryButton onClick={resetSelectedDayStyle}>
                            Reset card style
                          </SecondaryButton>
                        </Panel>
                      </>
                    )}
                  </>
                )}

                {activeTab === "discord" && (
                  <Panel title="Discord timestamps">
                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
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
                      options={[
                        {
                          value: "F",
                          label: "Full date with weekday",
                        },
                        {
                          value: "f",
                          label: "Full date",
                        },
                        {
                          value: "R",
                          label: "Relative countdown",
                        },
                        {
                          value: "t",
                          label: "Short time",
                        },
                        {
                          value: "T",
                          label: "Time with seconds",
                        },
                        {
                          value: "D",
                          label: "Long date",
                        },
                        {
                          value: "d",
                          label: "Short date",
                        },
                      ]}
                    />

                    {getSelectedDayDiscordText() && (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                        <p className="mb-1 text-xs font-semibold text-slate-400">
                          Selected day output
                        </p>

                        <pre className="whitespace-pre-wrap break-all text-xs text-slate-300">
                          {getSelectedDayDiscordText()}
                        </pre>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={copySelectedDayTimestamp}
                      className="w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
                    >
                      Copy selected day
                    </button>

                    <SecondaryButton onClick={copyFullWeekTimestamps}>
                      Copy full schedule
                    </SecondaryButton>

                    {copyStatus && (
                      <p className="text-center text-xs font-semibold text-violet-300">
                        {copyStatus}
                      </p>
                    )}

                    <p className="text-xs leading-5 text-slate-400">
                      Discord automatically displays timestamps in each
                      reader&apos;s local timezone.
                    </p>
                  </Panel>
                )}
              </div>
            </div>
          </div>
        </aside>
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
  onSelect,
}: {
  item: DayItem;
  selected: boolean;
  activeColor: string;
  restColor: string;
  textColor: string;
  onSelect: () => void;
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
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className={[
          "flex h-full w-full items-center gap-4 overflow-hidden px-5 py-2 text-left transition",
          selected
            ? "ring-2 ring-violet-400 ring-offset-4 ring-offset-transparent"
            : "",
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
      </button>
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
  onSelect,
}: {
  item: DayItem;
  layout: "row" | "grid";
  widthPercent: number;
  selected: boolean;
  activeColor: string;
  restColor: string;
  textColor: string;
  onSelect: () => void;
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
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className={[
          "relative h-full w-full overflow-hidden p-6 text-left transition",
          selected
            ? "ring-2 ring-violet-400 ring-offset-4 ring-offset-transparent"
            : "",
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
      </button>
    </div>
  );
}

function TemplateNotice({
  message,
  onDismiss,
}: {
  message: NonNullable<TemplateMessage>;
  onDismiss: () => void;
}) {
  const classes = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    error: "border-red-500/40 bg-red-500/10 text-red-200",
    info: "border-blue-500/40 bg-blue-500/10 text-blue-200",
  };

  return (
    <div className={`mb-5 rounded-2xl border p-3 ${classes[message.type]}`}>
      <div className="flex items-start justify-between gap-3">
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
    </div>
  );
}

