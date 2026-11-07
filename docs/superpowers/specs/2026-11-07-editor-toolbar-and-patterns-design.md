# Schedule Maker: floating-toolbar editor and background patterns

Date: 2026-11-07. Author: Justin (decisions), written up by Claude.

## Why

Streamer Tools started as a schedule-card maker for one friend of Justin's and spread to her streamer friends, so a small, slowly growing group uses it. Nobody has complained. This round is Justin's own wish to make the Schedule Maker better to work with and more customizable.

His main pain is the editor itself: "All the tabbing around in the editor to get to what you want/need, the entire UI just isn't where it should be." Today you pick a tab in the bottom panel first and then look for your element. The natural order is the other way round: point at the thing, then change it.

His customization wish: more backgrounds. Today the only background pattern is a dot grid you can toggle on or off.

## Goals

1. **Click the thing, edit the thing.** Selecting an element on the canvas shows its settings right there. No tab hunting.
2. **More background patterns** to choose from, each adjustable.
3. Keep everything that works today working, especially existing users' saved templates.

## Non-goals

- No visual restyle of the site. The current dark slate and violet look stays (Justin: "Let's keep the current style"). A visual refresh may come later as its own project.
- No new tools. "Go-Live Post" and "Stream Recap" stay as "Soon" cards.
- No accounts, no cloud saving, no server code. Everything stays in the browser.

## Anti-goals (would count as failure even if it works)

- **Old templates stop importing.** Users rely on exported `.stream-template.json` files because the editor keeps nothing after the tab closes. A version-7 template must still import and look the same.
- PNG exports that look different from the preview, for example a pattern that shows in the editor but is missing or shifted in the PNG.
- A toolbar that hides the element you are editing, or makes small elements (stickers, text boxes) hard to grab.

## Constraints

- Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, TypeScript. The repo's `AGENTS.md` says to read the bundled docs in `node_modules/next/dist/docs/` before writing code, because Next 16 differs from older versions.
- The editor is one Client Component, `app/schedule/page.tsx` (about 4,800 lines). Splitting it into files is allowed and probably wise, but it's not a goal by itself.
- PNG export uses `html-to-image` on the preview DOM. Every pattern must render through it: CSS gradients, inline SVG or text glyphs work; external image URLs do not (they'd also break the privacy page's "no third-party requests" promise).
- No new runtime dependencies unless there's no reasonable way without them.
- Accessibility fixes from 2026-11-07 must survive: the `h1`, `aria-pressed` toggles, the global `:focus-visible` ring and `slate-400` helper text. The tab semantics (`role="tablist"` etc.) go away together with the tabs.
- The unsaved-changes guard compares the current state with the last exported or imported template (`createSnapshot`), so it must keep covering every new piece of state.
- Lint has three errors that existed before this work; don't add new ones.

## What Justin decided

### Editing: floating toolbar (picked from three mockups, option B)

- The canvas takes almost the whole screen. The resizable bottom panel with its seven tabs (Project, Appearance, Images, Stickers, Text, Day editor, Discord) goes away.
- Clicking any element on the canvas selects it and opens a small toolbar right above it with the options used most for that kind of element. Elements: each day card (or list row in the list layout), stickers, text boxes, and each part of the header on its own. Justin: "Everything should be clickable." So the avatar, the streamer name, the schedule title and the date range are four separately selectable elements, each with its own toolbar. Header-wide spacing settings (avatar gap, text gap) can live under "More" on any of the four.
- A "More" button on the toolbar opens the element's full settings, which is everything the current tabs offer for it.
- Settings that belong to the whole schedule move to buttons in the top bar: theme colours, background (image and pattern), "Add" (sticker, text box), Discord timestamps, project data (name, title, dates, aspect ratio, layout), template import and export, and Export PNG with its quality toggle.
- Clicking empty canvas deselects and closes the toolbar.
- Justin agreed ("Sounds very good") to these points Claude proposed:
  - The Simple/Advanced switch goes away: the toolbar is the simple mode and "More" is the advanced mode.
  - Dragging, resizing and rotating stickers and text boxes stay as they work today, directly on the canvas.
  - On small screens the toolbar docks to the bottom of the screen instead of floating.

### Background patterns

Ten patterns, picked from a mockup gallery: **dots** (existing), **grid**, **diagonal stripes**, **checker**, **waves** (scallops), **zigzag** (chevrons), **hearts**, **sparkles** (stars), **grain** (subtle texture) and **glow blobs** (soft colour spots). The retro synthwave grid was rejected. Plus "none".

One pattern at a time. Each pattern gets colour, size and strength (opacity) controls. These controls are new for every pattern, dots included: today the dots are only an on/off switch (fixed 12×6 grid stretched over the canvas, 6px marks, 20% opacity, theme text colour).

## Claude's calls (Justin can overrule these)

- **Template version 8.** `appearance.showDots: boolean` becomes a pattern object: type, colour, size, opacity. Version-7 files import through a small migration: `showDots: true` turns into dots with default settings, and `false` turns into none. Export always writes version 8.
- **Pattern colour follows the theme by default.** The colour is stored as either `"theme"` (live theme text colour, like the dots today) or a fixed hex. New patterns and migrated v7 files use `"theme"`, so changing the theme recolours the pattern as it does now. The colour control offers "Match theme" plus a custom colour.
- **"Size" scales the whole pattern** (marks and spacing together). At size 100% the dots render exactly like today's `DotPattern`, stretched 12×6 grid included, so old schedules don't shift. Dots may keep that special layout; the other patterns can be tile-based.
- Keyboard: Escape closes "More" first, then the toolbar. Tab moves through the toolbar's controls. Every canvas element is reachable and selectable with the keyboard, not only with the mouse.
- Delete and layering (bring forward, send back) for stickers and text boxes sit in their toolbar, since that's where you already are.
- Status messages (template exported, PNG failed, timestamp copied) need a new home now that the bottom panel is gone. A small toast near the top bar is the obvious one.

## Left to the builder

- Exactly which options sit on each toolbar and which only appear under "More". The rule: what someone changes on almost every schedule goes on the toolbar, fine-tuning goes under "More".
- What "More" looks like: a popover attached to the toolbar or a side panel. It must not cover the selected element.
- How the toolbar avoids the canvas edges and the top bar, and how it follows an element while it's dragged.
- Default size, colour and opacity per pattern, and how each is drawn (CSS, SVG or glyphs), within the PNG-export constraint.
- How to split `page.tsx` into components.
- What the "Add", "Background" and "Theme" buttons open (popovers or a panel).
