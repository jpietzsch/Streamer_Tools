import type { JSX } from "react";
import type { DayItem } from "../../../../lib/template";
import { FloatingToolbar, type ToolbarFrameProps } from "../FloatingToolbar";
import {
  ColorInput,
  LayerButtons,
  RangeInput,
  SecondaryButton,
  ShadowDirectionPicker,
  TextArea,
  ToggleInput,
  ToolbarButton,
  ToolbarDivider,
  ToolbarInput,
  type LayerAction,
} from "../controls";

// How the days are laid out, because the width and height controls mean different things:
// "row" = 16:9 cards side by side, "grid" = cards in a grid, "list" = full-width rows.
export type DayWidthMode = "row" | "grid" | "list";

type DayToolbarProps = ToolbarFrameProps & {
  day: DayItem;
  widthMode: DayWidthMode;
  // Shown in the grid hint, e.g. "1:1 Square".
  aspectRatioLabel: string;
  // The day's real date, already formatted ("Wednesday, Nov 11, 2026"), or "".
  calculatedDate: string;
  // A generic function type: `field` and `value` must match, like updateDay in page.tsx.
  onUpdate: <K extends keyof DayItem>(field: K, value: DayItem[K]) => void;
  onToggleWidthLock: (locked: boolean) => void;
  onMove: (action: LayerAction) => void;
  onResetStyle: () => void;
  onCopyTimestamp: () => void;
};

// Toolbar for a day card (or list row): content on the row, styling under "More".
export function DayToolbar({
  day,
  widthMode,
  aspectRatioLabel,
  calculatedDate,
  onUpdate,
  onToggleWidthLock,
  onMove,
  onResetStyle,
  onCopyTimestamp,
  ...frame
}: DayToolbarProps): JSX.Element {
  const more = (
    <div className="space-y-3">
      {calculatedDate && (
        <p className="text-xs text-slate-400">
          Date: <span className="font-bold text-slate-200">{calculatedDate}</span>
        </p>
      )}

      <TextArea
        label="Note"
        value={day.note}
        onChange={(value) => onUpdate("note", value)}
      />

      {widthMode === "list" ? (
        <p className="text-xs leading-5 text-slate-400">
          List rows always span the full width. Use the height slider below to
          control how much vertical space this row takes.
        </p>
      ) : widthMode === "grid" ? (
        <p className="text-xs leading-5 text-slate-400">
          Width controls only apply to the 16:9 row layout. On{" "}
          {aspectRatioLabel}, cards fill their grid cell evenly.
        </p>
      ) : (
        <>
          <ToggleInput
            label="Lock card width"
            checked={day.widthLocked}
            onChange={onToggleWidthLock}
          />

          {day.widthLocked ? (
            <RangeInput
              label="Locked width"
              // One decimal is enough on screen; the stored value keeps full precision.
              value={Number(day.lockedWidthPercent.toFixed(1))}
              min={5}
              max={50}
              step={0.5}
              suffix="%"
              onChange={(value) => onUpdate("lockedWidthPercent", value)}
            />
          ) : (
            <RangeInput
              label="Relative width"
              value={day.widthWeight}
              min={0.5}
              max={2.5}
              step={0.1}
              onChange={(value) => onUpdate("widthWeight", value)}
            />
          )}

          <p className="text-xs leading-5 text-slate-400">
            Locked cards keep their width while unlocked cards divide the
            remaining space.
          </p>
        </>
      )}

      <RangeInput
        label="Weekday size"
        value={day.dayFontSize}
        min={10}
        max={36}
        suffix="px"
        onChange={(value) => onUpdate("dayFontSize", value)}
      />

      <RangeInput
        label="Title size"
        value={day.titleFontSize}
        min={12}
        max={54}
        suffix="px"
        onChange={(value) => onUpdate("titleFontSize", value)}
      />

      <RangeInput
        label="Time size"
        value={day.timeFontSize}
        min={10}
        max={40}
        suffix="px"
        onChange={(value) => onUpdate("timeFontSize", value)}
      />

      <RangeInput
        label="Note size"
        value={day.noteFontSize}
        min={10}
        max={36}
        suffix="px"
        onChange={(value) => onUpdate("noteFontSize", value)}
      />

      {/* In the list layout "height" is a weight relative to the other rows; on cards
          it is a percentage of the card area. Same field, different range. */}
      {widthMode === "list" ? (
        <>
          <RangeInput
            label="Height (relative weight)"
            value={day.height}
            min={10}
            max={400}
            onChange={(value) => onUpdate("height", value)}
          />

          <p className="text-xs leading-5 text-slate-400">
            A row with 200 takes up twice the space of a row with 100.
          </p>
        </>
      ) : (
        <RangeInput
          label="Height"
          value={day.height}
          min={40}
          max={100}
          suffix="%"
          onChange={(value) => onUpdate("height", value)}
        />
      )}

      <RangeInput
        label="Rotation"
        value={day.rotation}
        min={-12}
        max={12}
        suffix="°"
        onChange={(value) => onUpdate("rotation", value)}
      />

      <RangeInput
        label="Corner radius"
        value={day.borderRadius}
        min={0}
        max={60}
        suffix="px"
        onChange={(value) => onUpdate("borderRadius", value)}
      />

      <RangeInput
        label="Outline width"
        value={day.borderWidth}
        min={0}
        max={12}
        suffix="px"
        onChange={(value) => onUpdate("borderWidth", value)}
      />

      <ColorInput
        label="Outline color"
        value={day.borderColor}
        onChange={(value) => onUpdate("borderColor", value)}
      />

      <RangeInput
        label="Shadow offset"
        value={day.shadowOffset}
        min={0}
        max={30}
        suffix="px"
        onChange={(value) => onUpdate("shadowOffset", value)}
      />

      <ShadowDirectionPicker
        value={day.shadowDirection}
        onChange={(direction) => onUpdate("shadowDirection", direction)}
      />

      <LayerButtons
        actions={["front", "back", "forward", "backward"]}
        onMove={onMove}
        hint="Send a day back to let stickers or text peek out in front of it."
      />

      <SecondaryButton onClick={onResetStyle}>Reset card style</SecondaryButton>
    </div>
  );

  return (
    <FloatingToolbar {...frame} more={more}>
      <ToolbarInput
        label="Title"
        value={day.title}
        onChange={(value) => onUpdate("title", value)}
      />

      <ToolbarInput
        label="Time"
        type="time"
        widthClass="w-24"
        value={day.time}
        onChange={(value) => onUpdate("time", value)}
      />

      <ToolbarButton
        label="Stream day"
        pressed={day.active}
        onClick={() => onUpdate("active", !day.active)}
      >
        Stream day
      </ToolbarButton>

      <ToolbarDivider />

      {/* The result ("Wed timestamp copied") shows in the page's toast. */}
      <ToolbarButton label="Copy Discord timestamp" onClick={onCopyTimestamp}>
        Copy Discord
      </ToolbarButton>
    </FloatingToolbar>
  );
}
