---
name: Finansial
description: Household money tracker backed by Google Sheets. Quiet neutral surfaces under adjustable glass, with blue reserved for action.
colors:
  accent-blue: "#2b7fff"
  accent-blue-deep: "#155dfc"
  accent-blue-bright: "#3392ff"
  ink: "#0a0a0a"
  ink-muted: "#525252"
  ink-faint: "#666666"
  placeholder: "#737373"
  paper: "#ffffff"
  paper-soft: "#f7f7f7"
  hairline: "#ebebeb"
  night-ground: "#121212"
  night-panel: "#171717"
  night-surface: "#262626"
  night-hairline: "#262626"
  error-red: "#fb2c36"
  warning-amber: "#f0b100"
  chart-teal: "#00d5be"
  chart-lime: "#9ae600"
  chart-pink: "#fb64b6"
  chart-sky: "#00bcff"
  chart-purple: "#c27aff"
typography:
  title-1:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: "2.125rem"
  title-2:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.625rem"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.375rem"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-strong:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  body-2:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.125rem"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.15px"
rounded:
  sm: "4px"
  lg: "8px"
  2lg: "10px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-blue-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.2lg}"
    height: "36px"
    padding: "8px"
    typography: "{typography.body-strong}"
  button-primary-hover:
    backgroundColor: "{colors.accent-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2lg}"
    height: "36px"
    padding: "8px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-soft}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2lg}"
    height: "36px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.3xl}"
    padding: "16px"
  nav-item:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.2lg}"
    padding: "8px"
    typography: "{typography.body-strong}"
  nav-item-active:
    backgroundColor: "{colors.accent-blue}"
    textColor: "{colors.paper}"
  sidebar:
    backgroundColor: "{colors.paper-soft}"
    rounded: "{rounded.3xl}"
    width: "260px"
    padding: "12px"
  tab-bar-cta:
    backgroundColor: "{colors.accent-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    size: "56px"
  category-tile:
    rounded: "{rounded.xl}"
    size: "36px"
---

# Design System: Finansial

## Overview

**Creative North Star: "The Quiet Dashboard"**

Finansial is a working tool that two people open several times a day, on a phone at the till and on a laptop at the end of the month. The interface stays quiet so the numbers can speak. Surfaces are neutral white and soft grey (near-black at night), type is Inter at small, even sizes, and color is held back. Blue appears only where you act or where something is selected. Data colors appear only in charts and category tiles.

The one atmospheric move is **glass**. Panels, the sidebar, the phone header and the tab bar are frosted over a faint wash of accent blue, purple and teal. A single per-device knob (`--glass`, 0 to 1, set in Settings → Appearance) controls blur, saturation and see-through together, and at 0 every surface renders exactly as its solid token. The system's Reduce Transparency setting overrides the knob. Glass is the signature, but it never costs legibility.

Components are soft and tactile: very round cards, gradient primary buttons with a light top highlight, and emoji category tiles that make every row recognizable at a glance. The tactility is in the shapes and the small details. Nothing is loud.

**Key Characteristics:**
- Neutral surfaces, with blue as the only accent and used only for action and selection.
- Adjustable frosted glass over a soft color wash, solid at 0, honoring Reduce Transparency.
- Large 24px card corners. Controls sit at 8–10px.
- Small, even Inter type with tabular numbers for money.
- Dark mode is first-class: every semantic token flips under `.dark`.
- Category identity is an emoji on a tinted tile, defaulting by group (Needs blue, Wants orange, Savings purple, Income lime).

## Colors

The palette is near-neutral with a single blue accent ramp and a separate set of data colors for charts and categories.

### Primary
- **Action Blue** (`accent-blue`, accent-500): focus rings, checked controls, selection edges. It's the only hue that means "do this" or "you are here".
- **Deep Action Blue** (`accent-blue-deep`, accent-600): top stop of every white-label fill (primary button, active nav row, tab-bar action, gradient 600 → 700), so white text clears 4.5:1 (5.3:1).
- **Bright Action Blue** (`accent-blue-bright`, accent-400, a deliberate primitive override): one of the three glass-wash blobs. Never under white text.

### Neutral
- **Ink** (`ink`, neutral-950): primary text and primary icons in light mode.
- **Muted Ink** (`ink-muted`, neutral-600): secondary text, idle nav labels, badges on grey.
- **Faint Ink** (`ink-faint`, a 60/40 mix of neutral-500 and 600): tertiary text, descriptions, helper lines, money sub-lines. It clears 4.5:1 even on #ebebeb.
- **Placeholder** (`placeholder`, neutral-500): placeholders only, on the white field (4.7:1). In dark mode, secondary is neutral-400 and tertiary and placeholder are a 60/40 mix of neutral-400 and 500 (≥4.6:1 on neutral-800).
- **Paper** (`paper`): page ground and primary surfaces (cards, inputs) in light mode.
- **Soft Paper** (`paper-soft`, neutral-100 override): secondary surface (sidebar, sheets) and hover on primary surfaces.
- **Hairline** (`hairline`, neutral-200 override): card borders, separators, table rules.
- **Night Ground / Night Panel / Night Surface** (`night-ground` neutral-925, `night-panel` neutral-900, `night-surface` neutral-800): dark-mode page ground, secondary surfaces and primary surfaces. Text flips to neutral-50.

### Status and data
- **Error Red** (`error-red`, red-500): over-budget remainders, destructive text, field errors.
- **Warning Amber** (`warning-amber`, yellow-500): the "items to reconcile" dot, and the meter tone at 90% or more of a budget.
- **Chart set** (`chart-teal`, `chart-lime`, `chart-pink`, `chart-sky`, `chart-purple`, plus chart-6…9): the data palette, each with an `-active` (500) variant. These are used only in charts, the glass wash and category tints, never on controls.

### Named Rules
**The One Voice Rule.** Blue means action or selection, and nothing else in the UI uses it. Content blues (charts, info chips) reference `blue-*` directly, never `accent-*`, so the accent can be re-tinted without recoloring data.

**The AA Floor Rule.** Every text token clears 4.5:1 on every surface it sits on, in both themes, placeholders included. When a pair fails, change the token value, never a single component.

**The Token-Only Rule.** Every color is a BoardUI semantic token (`text-text-*`, `bg-background-*`, `border-border-*`, `chart-*`, `accent-*`). Raw palette classes and hex literals are banned, because the tokens are what make dark mode work.

## Typography

**Body Font:** Inter (via `next/font`, with the optical-size axis), falling back to ui-sans-serif and system-ui
**Mono Font:** JetBrains Mono, rarely used

**Character:** a single neutral sans at small, tightly stepped sizes. Hierarchy comes from weight (400 / 500 / 600) more than size, which suits dense money rows.

### Hierarchy
- **Title 1** (500, 1.5rem / 2.125rem): page titles from `sm` up.
- **Title 2** (600, 1.25rem / 1.625rem): page titles on phones, and large figures.
- **Headline** (600, 1rem / 1.375rem): card titles.
- **Body** (400 or 500, 0.875rem / 1.25rem): rows, nav labels, inputs and buttons. 500 is for names and labels.
- **Body 2** (400 or 500, 0.8125rem / 1.125rem): descriptions, "spent / budget" amounts, secondary links.
- **Caption** (500 or 600, 0.75rem / 1rem, +0.15px): meter sub-lines ("Rp… left · 72%"), badges, xs buttons.

### Named Rules
**The Composite Rule.** Type is set only with BoardUI composite utilities (`text-title-1-medium`, `text-body-2-regular`, …), which set size, weight, line-height and tracking together. Never stack `text-sm font-medium leading-5`.

**The Tabular Money Rule.** Every money figure uses `tabular-nums` so columns of amounts line up.

## Layout

- **Desktop (`lg` and up):** a floating 260px sidebar inset 12px from the viewport edges (sticky, full height minus 24px), next to a fluid main column with 24px side padding. Page sections stack with 24px gaps.
- **Phone (below `lg`):** a sticky glass header with the book switcher and avatar, a fixed glass bottom tab bar (max width 32rem) with a raised 56px circular center button, and a "More" bottom sheet for everything else. Main content has 16px side padding and 20px gaps, and its bottom padding clears the tab bar plus the safe-area inset.
- **Cards** pad 16px on phones and 20px from `sm` up, with 16px between header and body.
- **Page headers** stack on phones and sit title-left, actions-right from `sm` up.
- **Safe areas** (`env(safe-area-inset-*)`) are respected on the header, tab bar and sheets. The viewport uses `viewport-fit=cover`.
- **Direction:** use logical properties only (`ms`/`me`, `ps`/`pe`, `start`/`end`).

## Elevation & Depth

Depth comes from **glass plus tonal layering**, with shadows kept to small contact cues. A fixed, `pointer-events-none` color wash sits behind the page: three radial gradients of accent-400, chart-5 and chart-1 at 22–32% strength, with opacity tied to `--glass`. Glass surfaces mix their solid token toward transparent (up to 42% clarity), add a blur of up to 22px, and saturate up to 1.7×. Floating, text-dense surfaces (menus, toasts) use `.glass-raised` at 24% clarity so text stays readable.

### Shadow Vocabulary
- **Card contact** (`0 1px 1px 0 rgb(0 0 0 / 0.05)`; 0.14 in dark mode): white cards sitting on the secondary surface.
- **Sidebar elevation** (three layers: `0 1px 0` at 2%, `0 1px 12px` at 6%, `0 0 1px` at 32%): the floating desktop sidebar.
- **Selected nav** (`0 0 0 1px accent-500` plus `inset 0 1px 0 rgb(255 255 255 / 0.25)`): the active nav item and the phone Catat/add button. It gives a crisp blue edge with a lit top lip.
- **Dropdown** (`0 1px 1px` at 4%, plus `0 4px 4px` at 2%): menus and popovers.
- **Button xs** (Tailwind `shadow-xs`): primary and secondary buttons at rest.

### Named Rules
**The Solid-at-Zero Rule.** Every glass surface must look correct as its solid token when `--glass` is 0 or Reduce Transparency is on. At 0, no backdrop filter runs at all.

**The Contact-Not-Lift Rule.** Shadows only anchor surfaces in place. They are never large ambient drop shadows used to make cards float.

## Shapes

The shapes are soft. Containers are the roundest element on screen, controls are moderately rounded, and anything circular is a person or the main action.

- **24px** (`rounded-3xl`): cards, the desktop sidebar, top-rounded bottom sheets.
- **20px** (`rounded-2-5xl`): large inset panels.
- **10px** (`rounded-2lg`): medium buttons, inputs, nav items, the account row.
- **8px** (`rounded-lg`) for small buttons, and **4px** (`rounded-sm`) for xs buttons.
- **Category tiles** step with size: 28px at 8px radius, 36px at 12px, 48px at 16px.
- **Full** (`rounded-full`): avatars, the 56px tab-bar action button, status dots, pills.
- Borders are 1px hairlines (`border-border-button-default`). The sidebar uses a white inner edge (`border-border-button-white`) so its glass reads as a pane of material.

## Components

### Buttons
- **Shape:** gently rounded (10px at medium/36px tall, 8px at small/32px tall, 4px at xs/24px tall).
- **Primary:** a vertical gradient from accent-600 to accent-700, with white text and `shadow-xs`. Hover flattens it to solid 600, and active deepens it to 700 → 800. Disabled is a neutral 200 → 300 gradient.
- **Secondary:** primary surface with a 1px hairline border and `shadow-xs`. Hover moves to the primary hover surface.
- **Ghost / Link:** accent-tinted text on a transparent background, used for quiet actions.
- **Danger:** a red gradient matching the primary recipe (red-600 → 700).
- **Focus:** `outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring` (accent-500) on every interactive element.
- **Icons:** Remixicon, passed as component references (`leadingIcon={RiAddLine}`).

### Cards / Containers
- **Corner style:** 24px.
- **Background:** the primary surface, frosted with `.glass`.
- **Border:** 1px `border-border-button-default`.
- **Header:** a headline-semibold title with an optional body-2 tertiary description, and an optional action or "View all" link (accent-600, accent-400 in dark mode).
- **Empty state:** centered body-2 tertiary text with 24px vertical padding.

### Inputs / Fields
- **One field family:** text inputs, number and money fields, selects and date triggers all share the raised look: primary surface, a 1px hairline edge (`border-button-default`), `shadow-xs`, 10px radius, 36px tall (44px on phones). Text inputs are not filled grey wells.
- **Hover / Focus:** the edge strengthens to `border-button-hover` on hover. Focus is a 2px accent ring (`border-focus-ring`). The placeholder keeps its colour on focus.
- **Error:** the field turns `background-tertiary-error` with a red edge, and the message sits directly under it in caption type. Required fields carry a red asterisk on the label.
- **Forms:** every drawer form validates on the client first and shows each message under its field. The sticky footer repeats the problem ("Enter an amount", or "3 fields need attention."), and focus moves to the first invalid field after a submit. ⌘/Ctrl+Enter saves from anywhere. Server issues come back per field in plain words, never as schema text.
- **Money:** the transaction amount is a display-size field (`text-title-1-semibold`). Money fields ignore the scroll wheel and never round what was typed.
- **Popovers:** listboxes, calendars and menus use `.glass-raised` at 8% clarity, so labels behind them never read through.

### Navigation
- **Desktop sidebar:** the book switcher on top, then rows with a 20px icon and a body-medium label at 10px radius. Idle rows use muted ink and hover to the secondary hover surface. The **active** row is filled with the accent gradient, with white icon and label and the selected-nav shadow. Badges (unverified count) sit at the end of the row. The footer holds the account menu row and a quiet theme toggle.
- **Phone:** a glass header, a glass bottom tab bar with 24px icons and short labels, and a raised 56px accent circle in the center (4px ring in the page-ground color, scales to 95% on press). An amber dot on "More" marks items to reconcile.

### Budget Bar (signature)
One line per budget category: the category tile, its name and "spent / budget" in tabular body-2, a small meter, and a caption showing "left · %" or "over · %". Meter tone is accent below 90%, warning from 90%, and error over 100%. Savings lines go to success at 100% instead of warning.

### Category Tile (signature)
The category's emoji on a tile tinted with its chosen chip color (blue, cyan, green, yellow, orange, red, purple, gray). It falls back to the group color, and to the name's first letter when no emoji is set. Every transaction and budget row starts with one.

### Category Picker (signature)
Quick capture picks a category from tiles, not a list: the seven most used in the last 90 days plus an "All" tile that opens every category grouped by Needs / Wants / Savings / Income, with search. The selected tile gets the selected-pill background and a 2px accent ring.

### Deletes
Deletes happen at once and show an Undo toast for 8 seconds that names what went ("Deleted Meals · Rp 25.000"). Only actions that can't be undone (removing a member, resetting a password, deleting an account with moves) ask first, in an AlertDialog that names the consequence. In drawer footers, Delete is a quiet red text button set apart from the primary actions, and never the bottom-most button on a phone.

### Menus
shadcn/Radix dropdowns styled to BoardUI's menu motion: a 150ms fade with a scale from 95% and a 2px blur, both opening and closing, and no motion under Reduce Motion.

## Do's and Don'ts

### Do:
- **Do** use BoardUI semantic color tokens and composite type utilities only. Pick a different token rather than writing a `dark:` override with a raw color.
- **Do** check every surface in dark mode as well as light. Dark mode is first-class.
- **Do** keep the primary accent for action and selection: primary buttons, the active nav row, the Catat/add button, focus and checked states.
- **Do** make every glass surface correct at `--glass: 0` and under Reduce Transparency, and use `.glass-raised` for floating text-dense layers.
- **Do** use 24px corners and a hairline border on cards and panels, and 8–12px corners on controls and rows.
- **Do** set money in `tabular-nums` and start category rows with the category tile.
- **Do** give every touch target 44px on phones (fields, footer buttons, the drawer close button's hit area, checkbox rows).
- **Do** offer Undo for deletes, and confirm only what can't be undone.
- **Do** respect `prefers-reduced-motion`. Motion is short (150–200ms) with a `cubic-bezier(0.32, 0.72, 0, 1)` ease-out.

### Don't:
- **Don't** use raw palette classes (`text-gray-500`, `bg-white`) or hex/oklch literals in components.
- **Don't** use accent blue for data, decoration or non-interactive emphasis. Charts use the `chart-*` tokens.
- **Don't** add large ambient drop shadows to make cards float. Depth comes from glass and tonal layering.
- **Don't** hand-build a control that BoardUI already ships, and don't use raw `<input>`/`<select>`.
- **Don't** blur whole content areas. Glass is for chrome and containers, and scroll regions use the `ScrollFade` recipe at the top edge.
