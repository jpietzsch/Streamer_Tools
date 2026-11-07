# Floating-Toolbar Editor and Background Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Schedule Maker's tabbed bottom panel with click-to-edit floating toolbars and add ten adjustable background patterns, without breaking existing templates.

**Architecture:** Pure logic (pattern definitions, template parsing and v7→v8 migration, toolbar positioning, selection clamping) moves out of the 4,800-line `app/schedule/page.tsx` into small `lib/` modules with Node's built-in test runner. The editor keeps one selection value; the selected canvas element gets a floating toolbar with a "More" panel, and whole-schedule settings move to top-bar popovers.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, TypeScript, Luxon, html-to-image. Tests: `node --test` (Node 24 strips TypeScript types natively, so no new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-07-editor-toolbar-and-patterns-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (`AGENTS.md`).
- No new runtime or dev dependencies.
- Keep the current visual style: dark slate (`bg-slate-950`, `slate-900` panels) with violet accents, Arial body font.
- Old templates must import: version-7 files are migrated; export always writes version 8.
- Every pattern must render in the PNG export (`html-to-image` on the preview DOM): CSS gradients, inline SVG data URIs or text only, never external URLs.
- Toolbars, "More" panels, selection outlines and handles must not appear in exported PNGs (`isExportingPng` already hides outlines; extend it).
- Keep the 2026-11-07 accessibility work: the `h1`, `aria-pressed` on toggles, the global `:focus-visible` ring in `app/globals.css`, `slate-400` (not `slate-500`) for helper text.
- The unsaved-changes guard (`createSnapshot`, `confirmLeave`, `beforeunload`) must cover all new state.
- Lint has three errors from before this work (two `react-hooks/set-state-in-effect`, one `react/no-unescaped-entities`). Add no new errors.
- Commits: Justin allows commits for this plan only after he says so at execution start. Never push.

## Review Focus

1. A real v7 template with avatar, background image, stickers and text boxes imports and looks identical, and the leave warning stays quiet right after import. Owned by Task 2 (test) and Task 3 (browser check).
2. PNG export with each pattern looks like the preview, with no toolbar, outline or handle in the image. Owned by Task 3 and Task 7.
3. An element at the top edge (the avatar) or the right edge must keep its toolbar fully on screen, flipped below or clamped. Owned by Task 4.
4. Pressing or dragging inside a toolbar must not deselect, pan the canvas or start a sticker drag, and a dragged sticker's toolbar follows it. Owned by Task 7.
5. Shortening the date range, deleting the selected sticker or switching cards↔list must never leave a selection pointing at something that no longer exists. Owned by Task 5.

---

### Task 1: Test runner and pattern definitions

**Files:**
- Modify: `package.json` (add script `"test": "node --test \"lib/**/*.test.ts\""`)
- Modify: `tsconfig.json` (add `"allowImportingTsExtensions": true`; `noEmit` is already true)
- Create: `lib/patterns.ts`
- Test: `lib/patterns.test.ts`

**Interfaces:**
- Produces:
  - `type PatternType = "none" | "dots" | "grid" | "stripes" | "checker" | "waves" | "zigzag" | "hearts" | "sparkles" | "grain" | "glow"`
  - `type BackgroundPattern = { type: PatternType; color: "theme" | string; size: number; opacity: number }` (size in percent, 25 to 400; opacity 0 to 100)
  - `const PATTERN_OPTIONS: Array<{ type: PatternType; label: string }>`, in the order none, dots, grid, stripes, checker, waves, zigzag, hearts, sparkles, grain, glow. Labels: "None", "Dots", "Grid", "Stripes", "Checker", "Waves", "Zigzag", "Hearts", "Sparkles", "Grain", "Glow blobs"
  - `const DEFAULT_PATTERN: BackgroundPattern = { type: "dots", color: "theme", size: 100, opacity: 20 }`
  - `function isBackgroundPattern(value: unknown): value is BackgroundPattern`
  - `function resolvePatternColor(pattern: BackgroundPattern, themeText: string): string`
  - `function patternLayerStyle(pattern: BackgroundPattern, themeText: string): Record<string, string> | null`. Returns CSS properties for one absolutely positioned layer (backgroundImage, backgroundSize, optionally backgroundPosition), or `null` for `"none"` and `"dots"`. Dots keep their own component.

All lib files import each other with explicit `.ts` extensions (for example `import { … } from "./patterns.ts"`) so Node can run the tests.

- [ ] **Step 1: Write the failing tests** in `lib/patterns.test.ts` using `node:test` and `node:assert/strict`:
  - `isBackgroundPattern` accepts `DEFAULT_PATTERN`, `{ type: "hearts", color: "#ff00aa", size: 25, opacity: 0 }` and `{ type: "glow", color: "theme", size: 400, opacity: 100 }`.
  - It rejects an unknown type `"retro"`, `color: "red"`, `color: "#fff"` (only 6-digit hex), `size: 24`, `size: 401`, `opacity: -1`, `opacity: 101`, a missing field, and `null`.
  - `resolvePatternColor({ ...DEFAULT_PATTERN, color: "theme" }, "#020617") === "#020617"` and a custom hex is returned unchanged.
  - `patternLayerStyle` returns `null` for `"none"` and `"dots"`, and a non-empty `backgroundImage` for each of the other nine types.
  - The `backgroundImage` contains the resolved colour (raw hex or its URL-encoded form `%23…` inside SVG data URIs) and never contains `http`.
  - Doubling `size` doubles the numeric tile size in `backgroundSize` (check grid at 100 vs 200).
  - `PATTERN_OPTIONS` has 11 entries and no `"retro"`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL, cannot find module `./patterns.ts`.
- [ ] **Step 3: Implement `lib/patterns.ts`.** Base tile at size 100 is the builder's call per pattern, with a target look matching the approved mockup (`claude-home/streamer-tools-design/.superpowers/brainstorm/2156-1794009377/content/patterns.html`).
  - Hearts and sparkles: SVG data URIs, so they tile evenly.
  - Grain: an SVG `feTurbulence` data URI, or dense radial gradients.
  - Glow: large radial gradients scaled by size.
  - Opacity is not part of this style. The layer applies it as `opacity`.
- [ ] **Step 4: Run `npm test`.** Expected: all pattern tests PASS. Then `npm run build`. Expected: compiles.
- [ ] **Step 5: Commit** (if allowed): `git add package.json tsconfig.json lib/patterns.ts lib/patterns.test.ts && git commit -m "Add background pattern definitions and test runner"`

### Task 2: Template model, version 8 and v7 migration

**Files:**
- Create: `lib/template.ts`
- Test: `lib/template.test.ts`, fixtures `lib/fixtures/template-v7.json` (export one from the live site before changing anything: avatar, background image, one sticker, one text box, dots on) and `lib/fixtures/template-v7-nodots.json` (same, `showDots: false`)
- Modify: `app/schedule/page.tsx`. Delete the moved types, constants and validators (today lines ~20-205 and ~368-1023) and import them from `lib/template.ts`.

**Interfaces:**
- Consumes: `BackgroundPattern`, `isBackgroundPattern`, `DEFAULT_PATTERN` from Task 1; `DiscordTimestampStyle` from `lib/discordTimestamp.ts`
- Produces (all exported from `lib/template.ts`):
  - the moved types `ShadowDirection`, `DayItem`, `Theme`, `Sticker`, `TextBox`, `HeaderStyle`, `AspectRatioId`, `ScheduleLayout`, and the constants `ASPECT_RATIOS`, `MIN_SCHEDULE_DAYS`, `MAX_SCHEDULE_DAYS`, `MAX_TEMPLATE_SIZE_BYTES`, `DISCORD_TIMESTAMP_STYLES`
  - `const TEMPLATE_VERSION = 8`
  - `type ScheduleTemplate`: today's `ScheduleTemplateV1` shape, but with `version: 8` and `appearance: { pattern: BackgroundPattern; theme: Theme }` (no `showDots`)
  - `function parseTemplate(value: unknown): { ok: true; template: ScheduleTemplate } | { ok: false; error: string }`. It accepts v8, migrates v7, and rejects anything else.
    - Errors keep today's user-facing wording.
    - An unknown version gives `"Unsupported template version. This editor supports versions 7 and 8."`

- [ ] **Step 1: Write the failing tests:**
  - `parseTemplate(v7 fixture)` is ok, `version === 8`, and `appearance.pattern` deep-equals `DEFAULT_PATTERN`.
  - The no-dots fixture gives `{ ...DEFAULT_PATTERN, type: "none" }`.
  - All other fields deep-equal the fixture.
  - A v8 round trip is unchanged: `parseTemplate(JSON.parse(JSON.stringify(t)))`.
  - `{ version: 6 }` gives `ok: false` with the unsupported-version message.
  - A v8 template with `pattern.type: "retro"` gives `ok: false`.
  - A duplicate sticker id gives `ok: false`.
  - `null` and `[]` give `ok: false`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module missing.
- [ ] **Step 3: Implement `lib/template.ts`** by moving the existing validators unchanged.
  - Add `migrateV7(value): unknown`. It maps `showDots` to a pattern and sets `version: 8`, and it runs before validation.
  - In `page.tsx`, replace the inline validation in `importTemplateFile` with `parseTemplate`, and keep its messages and states.
- [ ] **Step 4: Run `npm test` and `npm run build`.** Expected: PASS and compiles. The editor still imports the v7 fixture by hand (`npx next dev`, Import template) and shows dots.
- [ ] **Step 5: Commit** (if allowed): `"Move template model to lib and add v8 with v7 migration"`

### Task 3: Patterns in the editor and in the PNG

**Files:**
- Create: `app/schedule/components/PatternLayer.tsx`
- Modify: `app/schedule/page.tsx`. Replace `showDots` state with `backgroundPattern: BackgroundPattern`, wire it through `createCurrentTemplate` and import, and move `DotPattern` into `PatternLayer.tsx`. In the Appearance tab, replace the "Background dots" toggle with the pattern controls (temporary home until Task 8).

**Interfaces:**
- Consumes: Task 1 exports; `ScheduleTemplate` from Task 2
- Produces:
  - `function PatternLayer(props: { pattern: BackgroundPattern; themeText: string }): JSX.Element | null`. It renders the pattern absolutely across the inner canvas, `pointer-events-none`.
    - Dots: today's 12×6 grid and 6px marks at size 100. Columns `round(12 * 100 / size)`, rows `round(6 * 100 / size)`, mark `6 * size / 100` px.
    - Opacity is `opacity / 100`.
  - `function PatternControls(props: { pattern: BackgroundPattern; onChange: (next: BackgroundPattern) => void }): JSX.Element`
    - It shows a swatch grid of the 11 `PATTERN_OPTIONS`, each a button with `aria-pressed` and its label.
    - It has a "Match theme" toggle plus a custom `ColorInput` (picking a colour sets `color` to the hex; turning "Match theme" on sets `"theme"`).
    - It has `RangeInput`s "Pattern size" (25 to 400, suffix "%") and "Pattern strength" (0 to 100, suffix "%"), hidden when type is none.
    - It needs today's `ColorInput`, `RangeInput` and `ToggleInput`, so move all small form controls (`Panel`, `DateInput`, `TimeInput`, `SelectInput`, `TextInput`, `TextArea`, `ToggleInput`, `FileInput`, `ColorInput`, `RangeInput`, `SmallButton`, `SecondaryButton`) unchanged into `app/schedule/components/controls.tsx` in this task.

- [ ] **Step 1: Make the change and verify in the browser** (`npx next dev`):
  - With a fresh page, the dots look pixel-identical to production. Compare screenshots of https://streamertools.netlify.app/schedule and localhost at the same viewport.
  - Each of the 11 options renders, and none shows nothing.
  - "Match theme" follows a theme text colour change, and a custom colour does not.
  - Size 25 and 400 both render without gaps or seams.
- [ ] **Step 2: Export PNGs** at 1× for dots, hearts, grain and glow. Each PNG shows the pattern positioned like the preview.
- [ ] **Step 3: Check the round trip.** Import `lib/fixtures/template-v7.json`: it looks like before, and `beforeunload` is not prevented right after import. Export a template, re-import it, and nothing changes.
- [ ] **Step 4: Run `npm test`, `npm run build` and the lint command from Global Constraints.** Expected: pass, compiles, still only the three old lint errors.
- [ ] **Step 5: Commit** (if allowed): `"Add ten background patterns to the Schedule Maker"`

### Task 4: Toolbar positioning

**Files:**
- Create: `lib/toolbarPosition.ts`
- Test: `lib/toolbarPosition.test.ts`

**Interfaces:**
- Produces:
  - `type Box = { left: number; top: number; width: number; height: number }`
  - `function computeToolbarPosition(anchor: Box, bounds: Box, toolbar: { width: number; height: number }, gap = 8): { left: number; top: number; placement: "above" | "below" }`. All boxes are in the same coordinate space (the preview area's client rect). The toolbar centres on the anchor horizontally, sits `gap` above it, flips below when it would cross `bounds.top`, and clamps left and right into `bounds` with `gap` margin.

- [ ] **Step 1: Write the failing tests.** Bounds are `{0,0,1000,600}` and the toolbar is `{300,40}` in all of them:
  - An anchor at `{400,300,200,100}` gives `{ left: 350, top: 252, placement: "above" }`.
  - An anchor at the top, `{400,10,200,100}`, gives `placement: "below"` with `top: 118`.
  - An anchor at the right edge, `{900,300,100,50}`, gives `left: 692`.
  - An anchor at the left edge, `{0,300,50,50}`, gives `left: 8`.
  - An anchor taller than the bounds gives `placement: "below"`, clamped so `top + 40 <= 600 - 8`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** (if allowed): `"Add floating toolbar positioning"`

### Task 5: One selection model, keyboard-selectable elements

**Files:**
- Create: `lib/selection.ts`
- Test: `lib/selection.test.ts`
- Modify: `app/schedule/page.tsx`. Replace `selectedIndex`, `selectedStickerId` and `selectedTextBoxId` with `selection: Selection`. Make every canvas element selectable. The old tabs stay for now: selecting still switches `activeTab` (header parts switch to "project", or "images" for the avatar), so the app keeps working.

**Interfaces:**
- Produces:
  - `type HeaderPart = "avatar" | "name" | "title" | "dates"`
  - `type Selection = { kind: "day"; index: number } | { kind: "sticker"; id: string } | { kind: "text"; id: string } | { kind: "header"; part: HeaderPart } | null`
  - `function clampSelection(selection: Selection, state: { dayCount: number; stickerIds: string[]; textBoxIds: string[]; headerParts: HeaderPart[] }): Selection`. It returns `null` when the selected thing no longer exists; a day index ≥ `dayCount` becomes `null`.
  - `function selectionKey(selection: NonNullable<Selection>): string`, for example `"day-3"`, `"sticker-<id>"`, `"text-<id>"`, `"header-name"`. Canvas elements carry it as `data-select-key`, so the toolbar (Task 7) can find their rect.

- [ ] **Step 1: Write the failing tests** for `clampSelection`:
  - A day at index 6 with `dayCount` 7 is kept, and with 6 it becomes `null`.
  - A sticker id missing from `stickerIds` becomes `null`.
  - A header `"avatar"` without `"avatar"` in `headerParts` becomes `null`.
  - `null` stays `null`.
  - For `selectionKey`, one assertion per kind.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/selection.ts`, then wire it into `page.tsx`.**
  - Run `clampSelection` in the render path, not in an effect (avoid new `set-state-in-effect` errors). Store the raw selection and derive `const activeSelection = clampSelection(selection, …)`.
  - Every element (day card or list row, sticker, text box, avatar, name, title, dates) gets `tabIndex={0}`, an `aria-label` (for example "Wed card", "Sticker logo.png", "Streamer name"), `data-select-key`, and Enter or Space to select.
  - Pointer-down on an element selects it and stops propagation, so the canvas pan doesn't deselect it.
  - Pointer-down on empty canvas sets `null`.
  - The unsaved-changes guard must not count selection as a change (selection is not part of the template).
- [ ] **Step 4: Verify in the browser.**
  - Tabbing reaches every element, and Enter selects it (the outline appears).
  - Shortening the end date while the last day is selected doesn't crash and clears the selection.
  - Deleting the selected sticker clears it.
  - Run `npm test` and `npm run build`. Expected: pass.
- [ ] **Step 5: Commit** (if allowed): `"Unify editor selection and make canvas elements keyboard-selectable"`

### Task 6: Floating toolbar shell and "More" panel

**Files:**
- Create: `app/schedule/components/FloatingToolbar.tsx`

**Interfaces:**
- Consumes: `computeToolbarPosition`, `Box` (Task 4); `selectionKey` (Task 5)
- Produces:
  - `function FloatingToolbar(props: { anchorKey: string; containerRef: React.RefObject<HTMLElement | null>; label: string; more?: React.ReactNode; onClose: () => void; children: React.ReactNode }): JSX.Element`
    - It finds `[data-select-key="<anchorKey>"]` inside the container, measures it and the container with `getBoundingClientRect`, and positions itself with `computeToolbarPosition`.
    - It re-measures after every render, on window resize, and on `transitionend`/`scroll` of the container (`useLayoutEffect` without deps is fine).
    - It is `role="toolbar"` with `aria-label={label}`, and holds a "More" button (`aria-expanded`) when `more` is given.
    - "More" opens a panel attached to the toolbar on whichever side has more room, never covering the anchor; it scrolls internally with max height 60vh.
    - `onPointerDown` stops propagation on the toolbar and the panel.
    - Escape closes "More" first and then calls `onClose`, and focus returns to the anchor element.
    - Below 640px viewport width it docks to the bottom of the screen (full width, `fixed bottom-0`) instead of floating, and "More" opens upward from it.
    - It renders nothing while `isExportingPng` (pass `hidden` from the page, or don't mount it).

- [ ] **Step 1: Mount it in `page.tsx`** for the active selection with placeholder children (the element's label) and verify in the browser:
  - It appears above a selected day card and follows a dragged sticker.
  - It flips below the avatar at the top.
  - It docks at the bottom at a 390px viewport.
  - Pressing inside it doesn't pan or deselect.
  - Escape twice closes "More" and then the toolbar.
- [ ] **Step 2: Run `npm run build` and lint.** Expected: compiles, no new errors.
- [ ] **Step 3: Commit** (if allowed): `"Add floating toolbar shell"`

### Task 7: Element toolbars

**Files:**
- Create: `app/schedule/components/toolbars/DayToolbar.tsx`, `HeaderToolbar.tsx`, `StickerToolbar.tsx`, `TextBoxToolbar.tsx`
- Modify: `app/schedule/page.tsx`. Remove the Stickers, Text and Day editor tabs and their panels once their toolbars carry every control.

**Interfaces:**
- Consumes: `FloatingToolbar` (Task 6); controls from `app/schedule/components/controls.tsx` (Task 3); model types (Task 2)
- Each toolbar takes the item plus typed update callbacks already in `page.tsx` (`updateDay`, `updateSticker`, `updateTextBox`, `moveSticker`, `moveTextBox`, `moveDay`, `removeSticker`, `removeTextBox`, `updateHeaderStyle`, the header setters). Keep those functions; adapt `updateDay` to take the day index instead of reading `selectedIndex`.

Option placement. Toolbar means always visible; More means behind "More". Every control that exists today must end up in one of the two:

| Element | Toolbar | More |
|---|---|---|
| Day | stream title, time, "Stream day" toggle, copy Discord timestamp | note, width lock and widths, the four font sizes, height, rotation, corner radius, outline width and colour, shadow offset and direction, layering, reset style |
| Avatar | replace image, zoom, remove | avatar size, horizontal and vertical position, avatar gap |
| Name / Title / Dates | the text (dates: start and end date), font size | text line gap, avatar gap |
| Sticker | size, opacity, bring to front, send to back, delete | rotation, corner radius, border width and colour, shadow offset and direction, forward and backward |
| Text box | text, bold, italic, align, colour, font size, delete | box width, rotation, layering |

- [ ] **Step 1: Build the four toolbars and remove the three tabs.**
- [ ] **Step 2: Verify in the browser.**
  - Every control in the table changes the canvas.
  - Delete removes the element and closes the toolbar.
  - No toolbar, outline or handle appears in an exported PNG.
  - A dragged sticker keeps its toolbar attached.
  - Run `npm run build` and lint. Expected: pass, no new errors.
- [ ] **Step 3: Commit** (if allowed): `"Edit canvas elements through floating toolbars"`

### Task 8: Top bar, toast, and removing the bottom panel

**Files:**
- Create: `app/schedule/components/TopBarMenu.tsx` (popover button), `app/schedule/components/Toast.tsx`
- Modify: `app/schedule/page.tsx`. Delete the bottom `<aside>` panel, `TABS`, `activeTab`, `panelHeight`/`beginPanelResize`, `customizationMode` and the Simple/Advanced switch, and `TemplateNotice`. The preview area takes the full height below the top bar.

**Interfaces:**
- Produces:
  - `function TopBarMenu(props: { label: string; icon?: React.ReactNode; children: React.ReactNode }): JSX.Element`. It is a button with `aria-expanded` and `aria-haspopup="dialog"`, opening a panel below it (max height 70vh, scrolls). It closes on Escape, on outside pointer-down and on choosing an action.
  - `function Toast(props: { message: { type: "success" | "error" | "info"; text: string } | null; onDismiss: () => void }): JSX.Element | null`. It shows near the top bar with `role="status"` (error: `role="alert"`), auto-dismisses success and info after 4 s, and keeps errors until dismissed.
- Top bar, left to right:
  - "← Back", the `h1` and Privacy (unchanged)
  - **Project**: streamer name, schedule title, start and end date, aspect ratio, layout
  - **Theme**: the five colours
  - **Background**: `PatternControls` from Task 3 plus the background image upload, fit, opacity, blur and remove
  - **Add**: sticker upload, text box, avatar (only when none is set)
  - **Discord**: timezone override, timestamp appearance, copy full schedule
  - **Template**: export and import, plus the existing template help text
  - quality toggle and **Export PNG** (unchanged)
- `templateMessage`, `pngExportMessage` and `copyStatus` all feed one `Toast`.

- [ ] **Step 1: Build it and delete the old panel code.**
- [ ] **Step 2: Verify in the browser.**
  - Starting from an empty header, Project and Add can set the name, title, dates and avatar, and each is then clickable on the canvas.
  - The toast shows for an export, an import error and a copy.
  - A grep for `activeTab|customizationMode|panelHeight|TemplateNotice` in `app/` returns nothing.
  - At 390px the top bar wraps or scrolls without hiding Export PNG.
  - Run `npm test`, `npm run build` and lint. Expected: pass, only the old errors.
- [ ] **Step 3: Commit** (if allowed): `"Move schedule-wide settings to the top bar and remove the bottom panel"`

### Task 9: Final pass and documentation

**Files:**
- Modify: `app/page.tsx` (the home text mentions "the simple editing mode"; update it to describe click-to-edit in Holzig's casual tone and keep the "export your template" warning)
- Modify: `C:\HomeVault\Home\Notes and documentations\Streamer Tools.md` (new structure, `npm test`, template v8, patterns)

- [ ] **Step 1: Run the Review Focus walk-through end to end** on `npx next build && npx next start -p 3123`:
  - Import the v7 fixture and check it looks identical.
  - Export PNGs with three patterns.
  - Select the avatar and check the toolbar flips.
  - Drag a selected sticker.
  - Shorten the dates while the last day is selected.
  - Check the keyboard: Tab, Enter, and Escape twice.
- [ ] **Step 2: Run `npm test`, `npm run build` and lint.** Expected: all pass, only the three old lint errors.
- [ ] **Step 3: Commit** (if allowed): `"Update home text and docs for the new editor"`
