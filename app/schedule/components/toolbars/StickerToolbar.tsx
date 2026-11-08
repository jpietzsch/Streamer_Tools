import type { JSX } from "react";
import type { Sticker } from "../../../../lib/template";
import { FloatingToolbar, type ToolbarFrameProps } from "../FloatingToolbar";
import {
  ColorInput,
  LayerButtons,
  RangeInput,
  ShadowDirectionPicker,
  ToolbarButton,
  ToolbarDivider,
  ToolbarRange,
  type LayerAction,
} from "../controls";

// Same limits as the resize handle on the canvas (STICKER_MIN_SIZE / MAX in page.tsx).
const MIN_SIZE = 40;
const MAX_SIZE = 400;

type StickerToolbarProps = ToolbarFrameProps & {
  sticker: Sticker;
  // `field` and `value` must match, e.g. ("size", 120) or ("borderColor", "#fff").
  onUpdate: <K extends keyof Sticker>(field: K, value: Sticker[K]) => void;
  onMove: (action: LayerAction) => void;
  onRemove: () => void;
};

// Toolbar for a sticker: size, opacity, layering and delete on the row, styling in "More".
export function StickerToolbar({
  sticker,
  onUpdate,
  onMove,
  onRemove,
  ...frame
}: StickerToolbarProps): JSX.Element {
  const more = (
    <div className="space-y-3">
      <RangeInput
        label="Rotation"
        value={sticker.rotation}
        min={-180}
        max={180}
        suffix="°"
        onChange={(value) => onUpdate("rotation", value)}
      />

      <RangeInput
        label="Corner radius"
        value={sticker.borderRadius}
        min={0}
        max={200}
        suffix="px"
        onChange={(value) => onUpdate("borderRadius", value)}
      />

      <RangeInput
        label="Border width"
        value={sticker.borderWidth}
        min={0}
        max={40}
        suffix="px"
        onChange={(value) => onUpdate("borderWidth", value)}
      />

      <ColorInput
        label="Border color"
        value={sticker.borderColor}
        onChange={(value) => onUpdate("borderColor", value)}
      />

      <RangeInput
        label="Shadow"
        value={sticker.shadowOffset}
        min={0}
        max={80}
        suffix="px"
        onChange={(value) => onUpdate("shadowOffset", value)}
      />

      <ShadowDirectionPicker
        value={sticker.shadowDirection}
        onChange={(direction) => onUpdate("shadowDirection", direction)}
      />

      {/* Front and back are already on the toolbar row. */}
      <LayerButtons actions={["forward", "backward"]} onMove={onMove} />
    </div>
  );

  return (
    <FloatingToolbar {...frame} more={more}>
      <ToolbarRange
        label="Size"
        value={sticker.size}
        min={MIN_SIZE}
        max={MAX_SIZE}
        suffix="px"
        onChange={(value) => onUpdate("size", value)}
      />

      <ToolbarRange
        label="Opacity"
        value={sticker.opacity}
        min={0}
        max={100}
        suffix="%"
        onChange={(value) => onUpdate("opacity", value)}
      />

      <ToolbarDivider />

      <ToolbarButton label="Bring to front" onClick={() => onMove("front")}>
        Front
      </ToolbarButton>

      <ToolbarButton label="Send to back" onClick={() => onMove("back")}>
        Back
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton label="Delete sticker" danger onClick={onRemove}>
        Delete
      </ToolbarButton>
    </FloatingToolbar>
  );
}
