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

type DayItem = {
  day: string;
  title: string;
  time: string;
  note: string;
  active: boolean;

  widthWeight: number;
  widthLocked: boolean;
  lockedWidthPercent: number;

  height: number;
  rotation: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowOffset: number;

  dayFontSize: number;
  titleFontSize: number;
  timeFontSize: number;
  noteFontSize: number;
};

type Theme = {
  backgroundA: string;
  backgroundB: string;
  cardActive: string;
  cardRest: string;
  text: string;
};

type Sticker = {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
};

type DragState = {
  stickerId: string;
  offsetX: number;
  offsetY: number;
};

type ScheduleTemplateV1 = {
  version: 1;
  exportedAt: string;

  project: {
    displayName: string;
    scheduleTitle: string;
    weekStartDate: string;
  };

  discord: {
    overrideTimezoneEnabled: boolean;
    overrideTimezone: string;
    timestampStyle: DiscordTimestampStyle;
  };

  appearance: {
    showDots: boolean;
    theme: Theme;
  };

  images: {
    avatarImage: string | null;
    backgroundImage: string | null;
    backgroundOpacity: number;
    backgroundBlur: number;
    backgroundFit: "cover" | "contain";
  };

  schedule: DayItem[];
  stickers: Sticker[];
};

type TemplateMessage = {
  type: "success" | "error" | "info";
  text: string;
} | null;

const TEMPLATE_VERSION = 1;
const MAX_TEMPLATE_SIZE_BYTES = 50 * 1024 * 1024;

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DISCORD_TIMESTAMP_STYLES: DiscordTimestampStyle[] = [
  "t",
  "T",
  "d",
  "D",
  "f",
  "F",
  "R",
];

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

  dayFontSize: 18,
  titleFontSize: 30,
  timeFontSize: 20,
  noteFontSize: 18,
};

const initialTheme: Theme = {
  backgroundA: "#06b6d4",
  backgroundB: "#0e7490",
  cardActive: "#cffafe",
  cardRest: "#0891b2",
  text: "#020617",
};

const initialSchedule: DayItem[] = DAY_NAMES.map((day) => ({
  day,
  title: "",
  time: "",
  note: "",
  active: false,
  ...defaultDayStyle,
}));

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

function getDateForDay(weekStartDate: string, dayIndex: number): string {
  if (!weekStartDate) {
    return "";
  }

  const start = DateTime.fromISO(weekStartDate);

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

function formatWeekRange(weekStartDate: string): string {
  if (!weekStartDate) {
    return "";
  }

  const start = DateTime.fromISO(weekStartDate);

  if (!start.isValid) {
    return "";
  }

  const end = start.plus({ days: 6 });

  if (start.year !== end.year) {
    return `${start.toFormat("LLL d, yyyy")} – ${end.toFormat("LLL d, yyyy")}`;
  }

  if (start.month !== end.month) {
    return `${start.toFormat("LLL d")} – ${end.toFormat("LLL d, yyyy")}`;
  }

  return `${start.toFormat("LLL d")} – ${end.toFormat("d, yyyy")}`;
}

function isMonday(date: string): boolean {
  if (!date) {
    return true;
  }

  const parsed = DateTime.fromISO(date);

  return parsed.isValid && parsed.weekday === 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDiscordTimestampStyle(
  value: unknown,
): value is DiscordTimestampStyle {
  return (
    typeof value === "string" &&
    DISCORD_TIMESTAMP_STYLES.includes(value as DiscordTimestampStyle)
  );
}

function isImageDataUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function isNullableImageDataUrl(value: unknown): value is string | null {
  return value === null || isImageDataUrl(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isDateInputValue(value: unknown): value is string {
  if (value === "") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const parsed = DateTime.fromISO(value);

  return parsed.isValid && parsed.toISODate() === value;
}

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format();

    return true;
  } catch {
    return false;
  }
}

function validateTheme(value: unknown): value is Theme {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isHexColor(value.backgroundA) &&
    isHexColor(value.backgroundB) &&
    isHexColor(value.cardActive) &&
    isHexColor(value.cardRest) &&
    isHexColor(value.text)
  );
}

function validateDayItem(
  value: unknown,
  expectedDay: string,
): value is DayItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.day === expectedDay &&
    typeof value.title === "string" &&
    typeof value.time === "string" &&
    typeof value.note === "string" &&
    typeof value.active === "boolean" &&
    isFiniteNumber(value.widthWeight) &&
    value.widthWeight >= 0.1 &&
    value.widthWeight <= 20 &&
    typeof value.widthLocked === "boolean" &&
    isFiniteNumber(value.lockedWidthPercent) &&
    value.lockedWidthPercent >= 1 &&
    value.lockedWidthPercent <= 100 &&
    isFiniteNumber(value.height) &&
    value.height >= 1 &&
    value.height <= 100 &&
    isFiniteNumber(value.rotation) &&
    value.rotation >= -360 &&
    value.rotation <= 360 &&
    isFiniteNumber(value.borderRadius) &&
    value.borderRadius >= 0 &&
    value.borderRadius <= 500 &&
    isFiniteNumber(value.borderWidth) &&
    value.borderWidth >= 0 &&
    value.borderWidth <= 100 &&
    isHexColor(value.borderColor) &&
    isFiniteNumber(value.shadowOffset) &&
    value.shadowOffset >= 0 &&
    value.shadowOffset <= 500 &&
    isFiniteNumber(value.dayFontSize) &&
    value.dayFontSize >= 1 &&
    value.dayFontSize <= 300 &&
    isFiniteNumber(value.titleFontSize) &&
    value.titleFontSize >= 1 &&
    value.titleFontSize <= 300 &&
    isFiniteNumber(value.timeFontSize) &&
    value.timeFontSize >= 1 &&
    value.timeFontSize <= 300 &&
    isFiniteNumber(value.noteFontSize) &&
    value.noteFontSize >= 1 &&
    value.noteFontSize <= 300
  );
}

function validateSticker(value: unknown): value is Sticker {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    isImageDataUrl(value.src) &&
    isFiniteNumber(value.x) &&
    value.x >= 0 &&
    value.x <= 100 &&
    isFiniteNumber(value.y) &&
    value.y >= 0 &&
    value.y <= 100 &&
    isFiniteNumber(value.size) &&
    value.size >= 1 &&
    value.size <= 5000 &&
    isFiniteNumber(value.rotation) &&
    value.rotation >= -3600 &&
    value.rotation <= 3600 &&
    isFiniteNumber(value.opacity) &&
    value.opacity >= 0 &&
    value.opacity <= 100
  );
}

function validateTemplate(value: unknown): value is ScheduleTemplateV1 {
  if (!isRecord(value)) {
    return false;
  }

  if (value.version !== TEMPLATE_VERSION) {
    return false;
  }

  if (typeof value.exportedAt !== "string") {
    return false;
  }

  if (!isRecord(value.project)) {
    return false;
  }

  if (
    typeof value.project.displayName !== "string" ||
    typeof value.project.scheduleTitle !== "string" ||
    !isDateInputValue(value.project.weekStartDate)
  ) {
    return false;
  }

  if (!isRecord(value.discord)) {
    return false;
  }

  if (
    typeof value.discord.overrideTimezoneEnabled !== "boolean" ||
    !isValidTimezone(value.discord.overrideTimezone) ||
    !isDiscordTimestampStyle(value.discord.timestampStyle)
  ) {
    return false;
  }

  if (!isRecord(value.appearance)) {
    return false;
  }

  if (
    typeof value.appearance.showDots !== "boolean" ||
    !validateTheme(value.appearance.theme)
  ) {
    return false;
  }

  if (!isRecord(value.images)) {
    return false;
  }

  if (
    !isNullableImageDataUrl(value.images.avatarImage) ||
    !isNullableImageDataUrl(value.images.backgroundImage) ||
    !isFiniteNumber(value.images.backgroundOpacity) ||
    value.images.backgroundOpacity < 0 ||
    value.images.backgroundOpacity > 100 ||
    !isFiniteNumber(value.images.backgroundBlur) ||
    value.images.backgroundBlur < 0 ||
    value.images.backgroundBlur > 100 ||
    (value.images.backgroundFit !== "cover" &&
      value.images.backgroundFit !== "contain")
  ) {
    return false;
  }

  if (
    !Array.isArray(value.schedule) ||
    value.schedule.length !== DAY_NAMES.length
  ) {
    return false;
  }

  const scheduleIsValid = value.schedule.every((day, index) =>
    validateDayItem(day, DAY_NAMES[index]),
  );

  if (!scheduleIsValid) {
    return false;
  }

  if (
    !Array.isArray(value.stickers) ||
    !value.stickers.every(validateSticker)
  ) {
    return false;
  }

  const stickerIds = value.stickers.map((sticker) => sticker.id);

  if (new Set(stickerIds).size !== stickerIds.length) {
    return false;
  }

  return true;
}

function createTemplateFilename(
  displayName: string,
  weekStartDate: string,
): string {
  const safeName = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const datePart = weekStartDate || DateTime.now().toISODate() || "template";
  const namePart = safeName || "stream-schedule";

  return `${namePart}-${datePart}.stream-template.json`;
}

function createPngFilename(displayName: string, weekStartDate: string): string {
  const safeName = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const datePart = weekStartDate || DateTime.now().toISODate() || "schedule";

  const namePart = safeName || "stream-schedule";

  return `${namePart}-${datePart}.png`;
}

export default function SchedulePage() {
  const [displayName, setDisplayName] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [weekStartDate, setWeekStartDate] = useState("");

  const [detectedTimezone] = useState(getBrowserTimezone);
  const [overrideTimezoneEnabled, setOverrideTimezoneEnabled] = useState(false);
  const [overrideTimezone, setOverrideTimezone] = useState(getBrowserTimezone);

  const [discordStyle, setDiscordStyle] = useState<DiscordTimestampStyle>("F");
  const [copyStatus, setCopyStatus] = useState("");

  const [schedule, setSchedule] = useState(initialSchedule);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [theme, setTheme] = useState(initialTheme);

  const [showDots, setShowDots] = useState(true);

  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(45);
  const [backgroundBlur, setBackgroundBlur] = useState(0);
  const [backgroundFit, setBackgroundFit] = useState<"cover" | "contain">(
    "cover",
  );

  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );

  const [templateMessage, setTemplateMessage] = useState<TemplateMessage>(null);

  const [isImportingTemplate, setIsImportingTemplate] = useState(false);

  const [isExportingPng, setIsExportingPng] = useState(false);
  const [pngExportMessage, setPngExportMessage] =
    useState<TemplateMessage>(null);

  const [previewScale, setPreviewScale] = useState(1);

  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDay = schedule[selectedIndex];

  const selectedDayDate = getDateForDay(weekStartDate, selectedIndex);

  const selectedSticker =
    stickers.find((sticker) => sticker.id === selectedStickerId) ?? null;

  const effectiveTimezone = overrideTimezoneEnabled
    ? overrideTimezone
    : detectedTimezone;

  const calculatedWeekLabel = formatWeekRange(weekStartDate);

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
    Boolean(calculatedWeekLabel) ||
    Boolean(avatarImage);

  function updateDay<K extends keyof DayItem>(field: K, value: DayItem[K]) {
    setSchedule((current) =>
      current.map((item, index) =>
        index === selectedIndex ? { ...item, [field]: value } : item,
      ),
    );
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

    setIsExportingPng(true);
    setPngExportMessage({
      type: "info",
      text: "Preparing 1920 × 1080 PNG…",
    });

    try {
      await document.fonts.ready;
      await waitForNextPaint();

      const dataUrl = await toPng(canvas, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pixelRatio: 1,
        cacheBust: true,

        style: {
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          transform: "none",
          transformOrigin: "top left",
          backgroundColor: "transparent",
        },
      });

      const downloadLink = document.createElement("a");

      downloadLink.download = createPngFilename(displayName, weekStartDate);

      downloadLink.href = dataUrl;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      setPngExportMessage({
        type: "success",
        text: "Schedule exported at 1920 × 1080.",
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

  function updateSticker(
    stickerId: string,
    field: keyof Sticker,
    value: string | number,
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

  function beginStickerDrag(
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
    const currentX = bounds.left + (sticker.x / 100) * bounds.width;
    const currentY = bounds.top + (sticker.y / 100) * bounds.height;

    dragStateRef.current = {
      stickerId: sticker.id,
      offsetX: event.clientX - currentX,
      offsetY: event.clientY - currentY,
    };

    setSelectedStickerId(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      const preview = previewRef.current;

      if (!dragState || !preview) {
        return;
      }

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
    }

    function handlePointerUp() {
      dragStateRef.current = null;
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
        availableWidth / CANVAS_WIDTH,
        availableHeight / CANVAS_HEIGHT,
        1,
      );

      setPreviewScale(nextScale);
    }

    updatePreviewScale();

    const resizeObserver = new ResizeObserver(updatePreviewScale);

    resizeObserver.observe(previewArea);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  function createCurrentTemplate(): ScheduleTemplateV1 {
    return {
      version: TEMPLATE_VERSION,
      exportedAt: new Date().toISOString(),

      project: {
        displayName,
        scheduleTitle,
        weekStartDate,
      },

      discord: {
        overrideTimezoneEnabled,
        overrideTimezone,
        timestampStyle: discordStyle,
      },

      appearance: {
        showDots,
        theme,
      },

      images: {
        avatarImage,
        backgroundImage,
        backgroundOpacity,
        backgroundBlur,
        backgroundFit,
      },

      schedule,
      stickers,
    };
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
      anchor.download = createTemplateFilename(displayName, weekStartDate);

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);

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

      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }

      if (!isRecord(parsed)) {
        throw new Error("The template has an invalid structure.");
      }

      if (parsed.version !== TEMPLATE_VERSION) {
        throw new Error(
          `Unsupported template version. This editor currently supports version ${TEMPLATE_VERSION}.`,
        );
      }

      if (!validateTemplate(parsed)) {
        throw new Error(
          "The file is missing required information or contains invalid values.",
        );
      }

      setDisplayName(parsed.project.displayName);
      setScheduleTitle(parsed.project.scheduleTitle);
      setWeekStartDate(parsed.project.weekStartDate);

      setOverrideTimezoneEnabled(parsed.discord.overrideTimezoneEnabled);
      setOverrideTimezone(parsed.discord.overrideTimezone);
      setDiscordStyle(parsed.discord.timestampStyle);

      setShowDots(parsed.appearance.showDots);
      setTheme(parsed.appearance.theme);

      setAvatarImage(parsed.images.avatarImage);
      setBackgroundImage(parsed.images.backgroundImage);
      setBackgroundOpacity(parsed.images.backgroundOpacity);
      setBackgroundBlur(parsed.images.backgroundBlur);
      setBackgroundFit(parsed.images.backgroundFit);

      setSchedule(parsed.schedule);
      setStickers(parsed.stickers);

      setSelectedIndex(0);
      setSelectedStickerId(null);
      setCopyStatus("");

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
        date: getDateForDay(weekStartDate, index),
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

    await copyText(textToCopy, "Full week copied");
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-violet-400 hover:text-white"
          >
            ← Back
          </Link>

          <p className="text-sm font-bold tracking-wide text-slate-300">
            Streamer Tools <span className="text-slate-600">/</span>{" "}
            <span className="text-white">Schedule Maker</span>
          </p>
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

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[calc(100vh-56px)] overflow-y-auto border-r border-slate-800 bg-slate-900/70 p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-violet-300">
            Controls
          </p>

          <h1 className="mb-6 text-2xl font-black">Edit schedule</h1>

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
            <Panel title="Template">
              <p className="text-xs leading-5 text-slate-500">
                Templates include all text, styles, dates, uploaded images and
                sticker positions.
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

              <p className="text-xs leading-5 text-slate-600">
                Images are embedded in the JSON file. Large images will produce
                a larger template.
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
                label="Week starts on"
                value={weekStartDate}
                onChange={setWeekStartDate}
              />

              {weekStartDate && !isMonday(weekStartDate) && (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-300">
                  This date is not a Monday. It will still be treated as Monday.
                </p>
              )}

              {calculatedWeekLabel && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Generated week
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-200">
                    {calculatedWeekLabel}
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Appearance">
              <ToggleInput
                label="Background dots"
                checked={showDots}
                onChange={setShowDots}
              />
            </Panel>

            <Panel title="Images">
              <FileInput
                label="Avatar"
                onChange={(file) => readImageFile(file, setAvatarImage)}
              />

              {avatarImage && (
                <SecondaryButton onClick={() => setAvatarImage(null)}>
                  Remove avatar
                </SecondaryButton>
              )}

              <FileInput
                label="Background image"
                onChange={(file) => readImageFile(file, setBackgroundImage)}
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

                  <SecondaryButton onClick={() => setBackgroundImage(null)}>
                    Remove background
                  </SecondaryButton>
                </>
              )}
            </Panel>

            <Panel title="Stickers">
              <FileInput label="Upload sticker" onChange={addSticker} />

              <p className="text-xs leading-5 text-slate-500">
                Transparent PNG or WebP files work best. Drag stickers directly
                on the preview.
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
                  <p className="text-xs font-semibold text-slate-500">
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

            <Panel title="Discord timestamps">
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                <p className="text-xs font-semibold text-slate-500">
                  Timezone used
                </p>

                <p className="mt-1 break-all text-sm font-bold text-slate-200">
                  {effectiveTimezone}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
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
                  <p className="mb-1 text-xs font-semibold text-slate-500">
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
                Copy full week
              </SecondaryButton>

              {copyStatus && (
                <p className="text-center text-xs font-semibold text-violet-300">
                  {copyStatus}
                </p>
              )}

              <p className="text-xs leading-5 text-slate-500">
                Discord automatically displays timestamps in each reader&apos;s
                local timezone.
              </p>
            </Panel>

            <Panel title={`${selectedDay.day} width`}>
              <ToggleInput
                label="Lock card width"
                checked={selectedDay.widthLocked}
                onChange={toggleSelectedDayWidthLock}
              />

              {selectedDay.widthLocked ? (
                <RangeInput
                  label="Locked width"
                  value={Number(selectedDay.lockedWidthPercent.toFixed(1))}
                  min={5}
                  max={50}
                  step={0.5}
                  suffix="%"
                  onChange={(value) => updateDay("lockedWidthPercent", value)}
                />
              ) : (
                <RangeInput
                  label="Relative width"
                  value={selectedDay.widthWeight}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  onChange={(value) => updateDay("widthWeight", value)}
                />
              )}

              <p className="text-xs leading-5 text-slate-500">
                Locked cards keep their width while unlocked cards divide the
                remaining space.
              </p>
            </Panel>

            <Panel title={`${selectedDay.day} typography`}>
              <RangeInput
                label="Weekday size"
                value={selectedDay.dayFontSize}
                min={10}
                max={36}
                suffix="px"
                onChange={(value) => updateDay("dayFontSize", value)}
              />

              <RangeInput
                label="Title size"
                value={selectedDay.titleFontSize}
                min={12}
                max={54}
                suffix="px"
                onChange={(value) => updateDay("titleFontSize", value)}
              />

              <RangeInput
                label="Time size"
                value={selectedDay.timeFontSize}
                min={10}
                max={40}
                suffix="px"
                onChange={(value) => updateDay("timeFontSize", value)}
              />

              <RangeInput
                label="Note size"
                value={selectedDay.noteFontSize}
                min={10}
                max={36}
                suffix="px"
                onChange={(value) => updateDay("noteFontSize", value)}
              />
            </Panel>

            <Panel title={`${selectedDay.day} card style`}>
              <RangeInput
                label="Height"
                value={selectedDay.height}
                min={40}
                max={100}
                suffix="%"
                onChange={(value) => updateDay("height", value)}
              />

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
                onChange={(value) => updateDay("borderRadius", value)}
              />

              <RangeInput
                label="Outline width"
                value={selectedDay.borderWidth}
                min={0}
                max={12}
                suffix="px"
                onChange={(value) => updateDay("borderWidth", value)}
              />

              <ColorInput
                label="Outline color"
                value={selectedDay.borderColor}
                onChange={(value) => updateDay("borderColor", value)}
              />

              <RangeInput
                label="Shadow offset"
                value={selectedDay.shadowOffset}
                min={0}
                max={30}
                suffix="px"
                onChange={(value) => updateDay("shadowOffset", value)}
              />

              <SecondaryButton onClick={resetSelectedDayStyle}>
                Reset card style
              </SecondaryButton>
            </Panel>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,#312e81,transparent_35%),radial-gradient(circle_at_bottom_left,#155e75,transparent_35%),#020617] p-6">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className="text-sm font-semibold text-slate-400">Live preview</p>

            <p className="text-xs text-slate-500">
              1920 × 1080 canvas · {Math.round(previewScale * 100)}% preview
            </p>
          </div>

          <div
            ref={previewAreaRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-auto"
          >
            <div
              className="relative shrink-0"
              style={{
                width: `${CANVAS_WIDTH * previewScale}px`,
                height: `${CANVAS_HEIGHT * previewScale}px`,
              }}
            >
              <div
                ref={previewRef}
                onPointerDown={() => setSelectedStickerId(null)}
                className="absolute left-0 top-0 touch-none overflow-hidden rounded-[2rem] bg-transparent p-10"
                style={{
                  width: `${CANVAS_WIDTH}px`,
                  height: `${CANVAS_HEIGHT}px`,
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

                  {showDots && <DotPattern color={theme.text} />}

                  {showHeader && (
                    <div className="relative z-10 flex items-start gap-6">
                      {avatarImage && (
                        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-white/80 bg-white/70 shadow-xl">
                          <img
                            src={avatarImage}
                            alt="Avatar"
                            draggable={false}
                            className="h-full w-full select-none object-cover"
                          />
                        </div>
                      )}

                      <div>
                        {scheduleTitle.trim() && (
                          <p className="text-sm font-black uppercase tracking-[0.35em] opacity-70">
                            {scheduleTitle}
                          </p>
                        )}

                        {displayName.trim() && (
                          <h2 className="mt-3 max-w-3xl text-5xl font-black leading-tight">
                            {displayName}
                          </h2>
                        )}

                        {calculatedWeekLabel && (
                          <p className="mt-3 text-xl font-semibold opacity-80">
                            {calculatedWeekLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="relative z-10 mt-auto flex h-[48%] items-end gap-4">
                    {schedule.map((item, index) => (
                      <ScheduleCard
                        key={item.day}
                        item={item}
                        widthPercent={calculatedWidths[index]}
                        selected={!isExportingPng && selectedIndex === index}
                        activeColor={theme.cardActive}
                        restColor={theme.cardRest}
                        textColor={theme.text}
                        onSelect={() => {
                          if (isExportingPng) {
                            return;
                          }

                          setSelectedIndex(index);
                          setSelectedStickerId(null);
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 z-30">
                  {stickers.map((sticker) => {
                    const isSelected =
                      !isExportingPng && selectedStickerId === sticker.id;

                    return (
                      <button
                        type="button"
                        key={sticker.id}
                        onPointerDown={(event) => {
                          if (isExportingPng) {
                            return;
                          }

                          beginStickerDrag(event, sticker);
                        }}
                        className={[
                          "pointer-events-auto absolute touch-none select-none rounded-lg",
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
                        }}
                        title={
                          isExportingPng ? undefined : `Drag ${sticker.name}`
                        }
                      >
                        <img
                          src={sticker.src}
                          alt={sticker.name}
                          draggable={false}
                          className="pointer-events-none block h-auto w-full select-none"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function ScheduleCard({
  item,
  widthPercent,
  selected,
  activeColor,
  restColor,
  textColor,
  onSelect,
}: {
  item: DayItem;
  widthPercent: number;
  selected: boolean;
  activeColor: string;
  restColor: string;
  textColor: string;
  onSelect: () => void;
}) {
  return (
    <div
      className="min-w-0 shrink-0 transition-[width,height,transform] duration-200"
      style={{
        width: `calc(${widthPercent}% - 13.72px)`,
        height: `${item.height}%`,
        transform: `rotate(${item.rotation}deg)`,
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
              ? `${item.shadowOffset}px ${item.shadowOffset}px 0 rgba(0,0,0,0.85)`
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <h2 className="mb-3 text-sm font-bold text-slate-300">{title}</h2>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DateInput({
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
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function TimeInput({
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
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function SelectInput({
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
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function TextInput({
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
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function TextArea({
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
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function ToggleInput({
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

function FileInput({
  label,
  onChange,
}: {
  label: string;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
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

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-slate-500">{label}</span>

      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
        />

        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded-lg border border-slate-700 bg-slate-900"
        />
      </div>
    </label>
  );
}

function RangeInput({
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
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
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

function SmallButton({
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

function SecondaryButton({
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

function DotPattern({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-20">
      {Array.from({ length: 72 }).map((_, index) => (
        <span
          key={index}
          className="m-auto h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
      ))}
    </div>
  );
}
