import { DateTime } from "luxon";
import { DEFAULT_PATTERN, isBackgroundPattern } from "./patterns.ts";
import type { BackgroundPattern } from "./patterns.ts";
import type { DiscordTimestampStyle } from "./discordTimestamp.ts";

export type ShadowDirection =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type DayItem = {
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
  shadowDirection: ShadowDirection;
  zIndex: number;

  dayFontSize: number;
  titleFontSize: number;
  timeFontSize: number;
  noteFontSize: number;
};

export type Theme = {
  backgroundA: string;
  backgroundB: string;
  cardActive: string;
  cardRest: string;
  text: string;
};

export type Sticker = {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  zIndex: number;

  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadowOffset: number;
  shadowDirection: ShadowDirection;
};

export type TextBox = {
  id: string;
  text: string;
  bold: boolean;
  italic: boolean;
  x: number;
  y: number;
  width: number;
  rotation: number;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  zIndex: number;
};

export type HeaderStyle = {
  avatarSize: number;
  avatarGap: number;
  eyebrowFontSize: number;
  titleFontSize: number;
  dateFontSize: number;
  textGap: number;
};

export type AspectRatioId = "16:9" | "9:16" | "1:1" | "4:5";
export type ScheduleLayout = "cards" | "list";

export const ASPECT_RATIOS: Record<
  AspectRatioId,
  { width: number; height: number; label: string; gridColumns: number }
> = {
  "16:9": {
    width: 1920,
    height: 1080,
    label: "16:9 Landscape",
    gridColumns: 0,
  },
  "9:16": { width: 1080, height: 1920, label: "9:16 Vertical", gridColumns: 2 },
  "1:1": { width: 1080, height: 1080, label: "1:1 Square", gridColumns: 3 },
  "4:5": { width: 1080, height: 1350, label: "4:5 Portrait", gridColumns: 3 },
};

export const MIN_SCHEDULE_DAYS = 1;
export const MAX_SCHEDULE_DAYS = 31;

export const DISCORD_TIMESTAMP_STYLES: DiscordTimestampStyle[] = [
  "t",
  "T",
  "d",
  "D",
  "f",
  "F",
  "R",
];

// Version 8 replaced the dots toggle with a background pattern. Version 7 files are migrated on import.
export const TEMPLATE_VERSION = 8;
export const MAX_TEMPLATE_SIZE_BYTES = 50 * 1024 * 1024;

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

function isAspectRatioId(value: unknown): value is AspectRatioId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ASPECT_RATIOS, value)
  );
}

function isScheduleLayout(value: unknown): value is ScheduleLayout {
  return value === "cards" || value === "list";
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

function isShadowDirection(value: unknown): value is ShadowDirection {
  return (
    value === "top-left" ||
    value === "top-right" ||
    value === "bottom-left" ||
    value === "bottom-right"
  );
}

function validateDayItem(value: unknown): value is DayItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.day === "string" &&
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
    isShadowDirection(value.shadowDirection) &&
    isFiniteNumber(value.zIndex) &&
    value.zIndex >= -100000 &&
    value.zIndex <= 100000 &&
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

function validateHeaderStyle(value: unknown): value is HeaderStyle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.avatarSize) &&
    value.avatarSize >= 20 &&
    value.avatarSize <= 800 &&
    isFiniteNumber(value.avatarGap) &&
    value.avatarGap >= 0 &&
    value.avatarGap <= 400 &&
    isFiniteNumber(value.eyebrowFontSize) &&
    value.eyebrowFontSize >= 1 &&
    value.eyebrowFontSize <= 300 &&
    isFiniteNumber(value.titleFontSize) &&
    value.titleFontSize >= 1 &&
    value.titleFontSize <= 400 &&
    isFiniteNumber(value.dateFontSize) &&
    value.dateFontSize >= 1 &&
    value.dateFontSize <= 300 &&
    isFiniteNumber(value.textGap) &&
    value.textGap >= 0 &&
    value.textGap <= 200
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
    value.opacity <= 100 &&
    isFiniteNumber(value.zIndex) &&
    value.zIndex >= -100000 &&
    value.zIndex <= 100000 &&
    isFiniteNumber(value.borderRadius) &&
    value.borderRadius >= 0 &&
    value.borderRadius <= 2000 &&
    isFiniteNumber(value.borderWidth) &&
    value.borderWidth >= 0 &&
    value.borderWidth <= 200 &&
    isHexColor(value.borderColor) &&
    isFiniteNumber(value.shadowOffset) &&
    value.shadowOffset >= 0 &&
    value.shadowOffset <= 500 &&
    isShadowDirection(value.shadowDirection)
  );
}

function validateTextBox(value: unknown): value is TextBox {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.text === "string" &&
    typeof value.bold === "boolean" &&
    typeof value.italic === "boolean" &&
    isFiniteNumber(value.x) &&
    value.x >= 0 &&
    value.x <= 100 &&
    isFiniteNumber(value.y) &&
    value.y >= 0 &&
    value.y <= 100 &&
    isFiniteNumber(value.width) &&
    value.width >= 20 &&
    value.width <= 5000 &&
    isFiniteNumber(value.rotation) &&
    value.rotation >= -3600 &&
    value.rotation <= 3600 &&
    isFiniteNumber(value.fontSize) &&
    value.fontSize >= 4 &&
    value.fontSize <= 400 &&
    isHexColor(value.color) &&
    (value.align === "left" ||
      value.align === "center" ||
      value.align === "right") &&
    isFiniteNumber(value.zIndex) &&
    value.zIndex >= -100000 &&
    value.zIndex <= 100000
  );
}

// The current template shape. It is the old v7 shape, except the dots toggle became a pattern.
export type ScheduleTemplate = {
  version: 8;
  exportedAt: string;

  project: {
    displayName: string;
    scheduleTitle: string;
    scheduleStartDate: string;
    scheduleEndDate: string;
  };

  canvas: {
    aspectRatio: AspectRatioId;
    scheduleLayout: ScheduleLayout;
  };

  header: HeaderStyle;

  discord: {
    overrideTimezoneEnabled: boolean;
    overrideTimezone: string;
    timestampStyle: DiscordTimestampStyle;
  };

  appearance: {
    pattern: BackgroundPattern;
    theme: Theme;
  };

  images: {
    avatarImage: string | null;
    avatarZoom: number;
    avatarOffsetX: number;
    avatarOffsetY: number;
    backgroundImage: string | null;
    backgroundOpacity: number;
    backgroundBlur: number;
    backgroundFit: "cover" | "contain";
  };

  schedule: DayItem[];
  stickers: Sticker[];
  textBoxes: TextBox[];
};

function validateTemplate(value: unknown): value is ScheduleTemplate {
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
    !isDateInputValue(value.project.scheduleStartDate) ||
    !isDateInputValue(value.project.scheduleEndDate)
  ) {
    return false;
  }

  if (
    !isRecord(value.canvas) ||
    !isAspectRatioId(value.canvas.aspectRatio) ||
    !isScheduleLayout(value.canvas.scheduleLayout)
  ) {
    return false;
  }

  if (!validateHeaderStyle(value.header)) {
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
    !isBackgroundPattern(value.appearance.pattern) ||
    !validateTheme(value.appearance.theme)
  ) {
    return false;
  }

  if (!isRecord(value.images)) {
    return false;
  }

  if (
    !isNullableImageDataUrl(value.images.avatarImage) ||
    !isFiniteNumber(value.images.avatarZoom) ||
    value.images.avatarZoom < 1 ||
    value.images.avatarZoom > 3 ||
    !isFiniteNumber(value.images.avatarOffsetX) ||
    value.images.avatarOffsetX < -50 ||
    value.images.avatarOffsetX > 50 ||
    !isFiniteNumber(value.images.avatarOffsetY) ||
    value.images.avatarOffsetY < -50 ||
    value.images.avatarOffsetY > 50 ||
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
    value.schedule.length < MIN_SCHEDULE_DAYS ||
    value.schedule.length > MAX_SCHEDULE_DAYS
  ) {
    return false;
  }

  const scheduleIsValid = value.schedule.every((day) => validateDayItem(day));

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

  if (
    !Array.isArray(value.textBoxes) ||
    !value.textBoxes.every(validateTextBox)
  ) {
    return false;
  }

  const textBoxIds = value.textBoxes.map((textBox) => textBox.id);

  if (new Set(textBoxIds).size !== textBoxIds.length) {
    return false;
  }

  return true;
}

// Turns a v7 template into the v8 shape (showDots becomes a pattern). Runs before validation,
// so it must not assume the input is well formed: anything odd is left for the validator to reject.
function migrateV7(value: Record<string, unknown>): unknown {
  const { appearance } = value;

  if (!isRecord(appearance)) {
    return { ...value, version: 8 };
  }

  // Drop showDots; the dots pattern with its default look matches what v7 drew.
  const { showDots, ...restAppearance } = appearance;
  const pattern =
    typeof showDots === "boolean"
      ? { ...DEFAULT_PATTERN, type: showDots ? "dots" : "none" }
      : undefined; // missing or wrong type: the validator rejects the file

  return { ...value, version: 8, appearance: { ...restAppearance, pattern } };
}

export type ParseTemplateResult =
  | { ok: true; template: ScheduleTemplate }
  | { ok: false; error: string };

// Accepts a parsed JSON value: v8 as is, v7 migrated, everything else rejected.
// The error texts are shown to the user as they are.
export function parseTemplate(value: unknown): ParseTemplateResult {
  if (!isRecord(value)) {
    return { ok: false, error: "The template has an invalid structure." };
  }

  if (value.version !== 7 && value.version !== TEMPLATE_VERSION) {
    return {
      ok: false,
      error:
        "Unsupported template version. This editor supports versions 7 and 8.",
    };
  }

  const candidate = value.version === 7 ? migrateV7(value) : value;

  if (!validateTemplate(candidate)) {
    return {
      ok: false,
      error:
        "The file is missing required information or contains invalid values.",
    };
  }

  return { ok: true, template: candidate };
}
