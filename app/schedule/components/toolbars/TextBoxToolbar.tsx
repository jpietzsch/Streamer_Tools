import type { JSX } from "react";
import type { TextBox } from "../../../../lib/template";
import { FloatingToolbar, type ToolbarFrameProps } from "../FloatingToolbar";
import {
  LayerButtons,
  RangeInput,
  ToolbarButton,
  ToolbarColor,
  ToolbarDivider,
  ToolbarRange,
  ToolbarTextArea,
  type LayerAction,
} from "../controls";

const ALIGNMENTS: Array<TextBox["align"]> = ["left", "center", "right"];

type TextBoxToolbarProps = ToolbarFrameProps & {
  textBox: TextBox;
  // The same limits the resize handle on the canvas uses.
  minWidth: number;
  maxWidth: number;
  // `field` and `value` must match, e.g. ("bold", true) or ("align", "center").
  onUpdate: <K extends keyof TextBox>(field: K, value: TextBox[K]) => void;
  onMove: (action: LayerAction) => void;
  onRemove: () => void;
};

// Toolbar for a text box: the text and its formatting on the row, box width,
// rotation and layering in "More".
export function TextBoxToolbar({
  textBox,
  minWidth,
  maxWidth,
  onUpdate,
  onMove,
  onRemove,
  ...frame
}: TextBoxToolbarProps): JSX.Element {
  const more = (
    <div className="space-y-3">
      <RangeInput
        label="Box width"
        value={textBox.width}
        min={minWidth}
        max={maxWidth}
        suffix="px"
        onChange={(value) => onUpdate("width", value)}
      />

      <RangeInput
        label="Rotation"
        value={textBox.rotation}
        min={-180}
        max={180}
        suffix="°"
        onChange={(value) => onUpdate("rotation", value)}
      />

      <LayerButtons
        actions={["front", "back", "forward", "backward"]}
        onMove={onMove}
      />
    </div>
  );

  return (
    <FloatingToolbar {...frame} more={more}>
      <ToolbarTextArea
        label="Text"
        value={textBox.text}
        onChange={(value) => onUpdate("text", value)}
      />

      <ToolbarButton
        label="Bold"
        pressed={textBox.bold}
        onClick={() => onUpdate("bold", !textBox.bold)}
      >
        <span className="font-black">B</span>
      </ToolbarButton>

      <ToolbarButton
        label="Italic"
        pressed={textBox.italic}
        onClick={() => onUpdate("italic", !textBox.italic)}
      >
        <span className="italic">I</span>
      </ToolbarButton>

      {/* A group so screen readers hear "Text alignment" before left/center/right. */}
      <div role="group" aria-label="Text alignment" className="flex shrink-0 gap-1">
        {ALIGNMENTS.map((align) => (
          <ToolbarButton
            key={align}
            label={`Align ${align}`}
            pressed={textBox.align === align}
            onClick={() => onUpdate("align", align)}
          >
            {/* "left" -> "Left" */}
            {align.charAt(0).toUpperCase() + align.slice(1)}
          </ToolbarButton>
        ))}
      </div>

      <ToolbarColor
        label="Color"
        value={textBox.color}
        onChange={(value) => onUpdate("color", value)}
      />

      <ToolbarRange
        label="Size"
        value={textBox.fontSize}
        min={4}
        max={200}
        suffix="px"
        onChange={(value) => onUpdate("fontSize", value)}
      />

      <ToolbarDivider />

      <ToolbarButton label="Delete text box" danger onClick={onRemove}>
        Delete
      </ToolbarButton>
    </FloatingToolbar>
  );
}
