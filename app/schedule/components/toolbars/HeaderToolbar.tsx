import type { JSX } from "react";
import type { HeaderStyle } from "../../../../lib/template";
import type { HeaderPart } from "../../../../lib/selection";
import { FloatingToolbar, type ToolbarFrameProps } from "../FloatingToolbar";
import {
  RangeInput,
  SecondaryButton,
  ToolbarButton,
  ToolbarDivider,
  ToolbarFileButton,
  ToolbarInput,
  ToolbarRange,
} from "../controls";

type HeaderToolbarProps = ToolbarFrameProps & {
  part: HeaderPart;

  displayName: string;
  onDisplayNameChange: (value: string) => void;
  scheduleTitle: string;
  onScheduleTitleChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  // A short problem with the date range ("End date is before the start date"), or "".
  dateWarning: string;

  headerStyle: HeaderStyle;
  // `field` and `value` must match, e.g. ("avatarSize", 120).
  onStyleChange: <K extends keyof HeaderStyle>(
    field: K,
    value: HeaderStyle[K],
  ) => void;

  avatarZoom: number;
  onAvatarZoomChange: (value: number) => void;
  avatarOffsetX: number;
  onAvatarOffsetXChange: (value: number) => void;
  avatarOffsetY: number;
  onAvatarOffsetYChange: (value: number) => void;
  onAvatarReplace: (file: File) => void;
  onAvatarRemove: () => void;
};

// One toolbar for the four header parts (avatar, name, title, dates). They share the
// header's spacing settings, so keeping them together avoids repeating those controls.
export function HeaderToolbar(props: HeaderToolbarProps): JSX.Element {
  const {
    part,
    headerStyle,
    onStyleChange,
    displayName,
    onDisplayNameChange,
    scheduleTitle,
    onScheduleTitleChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    dateWarning,
    avatarZoom,
    onAvatarZoomChange,
    avatarOffsetX,
    onAvatarOffsetXChange,
    avatarOffsetY,
    onAvatarOffsetYChange,
    onAvatarReplace,
    onAvatarRemove,
    // Everything not named above (anchorKey, label, ...) goes on to FloatingToolbar.
    ...frame
  } = props;

  // Shared by every part: the space between the avatar and the text column.
  const avatarGap = (
    <RangeInput
      label="Avatar gap"
      value={headerStyle.avatarGap}
      min={0}
      max={100}
      step={2}
      suffix="px"
      onChange={(value) => onStyleChange("avatarGap", value)}
    />
  );

  if (part === "avatar") {
    return (
      <FloatingToolbar
        {...frame}
        more={
          <div className="space-y-3">
            <RangeInput
              label="Avatar size"
              value={headerStyle.avatarSize}
              min={40}
              max={300}
              step={2}
              suffix="px"
              onChange={(value) => onStyleChange("avatarSize", value)}
            />

            {/* The offsets move the picture inside its circle (object-position). */}
            <RangeInput
              label="Horizontal position"
              value={avatarOffsetX}
              min={-50}
              max={50}
              suffix="%"
              onChange={onAvatarOffsetXChange}
            />

            <RangeInput
              label="Vertical position"
              value={avatarOffsetY}
              min={-50}
              max={50}
              suffix="%"
              onChange={onAvatarOffsetYChange}
            />

            {avatarGap}

            <SecondaryButton
              onClick={() => {
                onAvatarZoomChange(1);
                onAvatarOffsetXChange(0);
                onAvatarOffsetYChange(0);
              }}
            >
              Reset framing
            </SecondaryButton>
          </div>
        }
      >
        <ToolbarFileButton label="Replace image" onChange={onAvatarReplace} />

        <ToolbarRange
          label="Zoom"
          value={avatarZoom}
          min={1}
          max={3}
          step={0.05}
          suffix="×"
          onChange={onAvatarZoomChange}
        />

        <ToolbarDivider />

        <ToolbarButton label="Remove avatar" danger onClick={onAvatarRemove}>
          Remove
        </ToolbarButton>
      </FloatingToolbar>
    );
  }

  // The text parts. Careful with the names: the "title" part is the small line above
  // the name, which the style calls the eyebrow; the big name uses titleFontSize.
  const more = (
    <div className="space-y-3">
      <RangeInput
        label="Text line gap"
        value={headerStyle.textGap}
        min={0}
        max={60}
        suffix="px"
        onChange={(value) => onStyleChange("textGap", value)}
      />

      {avatarGap}
    </div>
  );

  return (
    <FloatingToolbar {...frame} more={more}>
      {part === "name" && (
        <>
          <ToolbarInput
            label="Name"
            value={displayName}
            onChange={onDisplayNameChange}
          />

          <ToolbarRange
            label="Size"
            value={headerStyle.titleFontSize}
            min={16}
            max={160}
            suffix="px"
            onChange={(value) => onStyleChange("titleFontSize", value)}
          />
        </>
      )}

      {part === "title" && (
        <>
          <ToolbarInput
            label="Title"
            value={scheduleTitle}
            onChange={onScheduleTitleChange}
          />

          <ToolbarRange
            label="Size"
            value={headerStyle.eyebrowFontSize}
            min={8}
            max={60}
            suffix="px"
            onChange={(value) => onStyleChange("eyebrowFontSize", value)}
          />
        </>
      )}

      {part === "dates" && (
        <>
          <ToolbarInput
            label="Start"
            type="date"
            widthClass="w-32"
            value={startDate}
            onChange={onStartDateChange}
          />

          <ToolbarInput
            label="End"
            type="date"
            widthClass="w-32"
            value={endDate}
            onChange={onEndDateChange}
          />

          <ToolbarRange
            label="Size"
            value={headerStyle.dateFontSize}
            min={8}
            max={80}
            suffix="px"
            onChange={(value) => onStyleChange("dateFontSize", value)}
          />

          {dateWarning && (
            <span
              role="status"
              className="text-[11px] font-semibold text-amber-300"
            >
              {dateWarning}
            </span>
          )}
        </>
      )}
    </FloatingToolbar>
  );
}
