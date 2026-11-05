---
name: Finansial
description: Household money on the household's own Google Sheets, in Linear's dark-led workspace with one green.
colors:
  forest: "#0f3d33"
  forest-hover: "#135243"
  forest-pressed: "#0b2e26"
  lime: "#b8e08a"
  lime-hover: "#c9e8a5"
  lime-pressed: "#a6d473"
  on-lime: "#0f2a22"
  link-green: "#1a6b52"
  focus-green: "#2f8a6b"
  selection-tint: "#eef7e3"
  selection-tint-night: "#13362d"
  paper: "#f7f8f8"
  card-white: "#ffffff"
  mist: "#f3f4f5"
  cloud: "#eaebec"
  hairline: "#e6e7e9"
  control-edge: "#dcdee1"
  field-edge: "#8a8f98"
  ink: "#1b1c1e"
  graphite: "#3c3f44"
  slate: "#62666d"
  canvas: "#08090a"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#1c1d1f"
  surface-4: "#232427"
  night-hairline: "#23252a"
  night-hairline-strong: "#34343a"
  night-field-edge: "#6b6f78"
  moonlight: "#f7f8f8"
  haze: "#d0d6e0"
  steel: "#8a8f98"
  positive: "#1e7a35"
  negative: "#c5221f"
  positive-night: "#4cc06a"
  negative-night: "#ff6b6b"
typography:
  title-1:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: "2.125rem"
    letterSpacing: "-0.021em"
  title-2:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.018em"
  title-3:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.625rem"
    letterSpacing: "-0.01em"
  stat-value:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: "2.375rem"
    letterSpacing: "-0.022em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.375rem"
    letterSpacing: "-0.011em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.375rem"
    letterSpacing: "-0.006em"
  body-2:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "-0.003em"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0em"
rounded:
  small: "6px"
  control: "8px"
  card: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.card-white}"
    typography: "{typography.body-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-primary-active:
    backgroundColor: "{colors.forest-pressed}"
  button-primary-night:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    typography: "{typography.body-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-primary-night-hover:
    backgroundColor: "{colors.lime-hover}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.mist}"
  button-secondary-night:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.control}"
    height: "36px"
  button-ghost:
    textColor: "{colors.link-green}"
    rounded: "{rounded.control}"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.selection-tint}"
  icon-button:
    textColor: "{colors.slate}"
    rounded: "{rounded.control}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-2}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
    height: "36px"
  input-night:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.control}"
    height: "36px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-night:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.card}"
    padding: "16px"
  catat-tab:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.on-lime}"
    rounded: "{rounded.pill}"
    size: "56px"
---

# Design System: Finansial

## Overview

**Creative North Star: "The Night Ledger"**

Finansial wears Linear's precise, dark-led workspace, adapted for a two-person household that checks its money on phone and laptop, often at night. The source is the shadcn.io "Linear" DESIGN.md (Dov Azencot's packaging of Linear's marketing system), pinned by the user. From it the app takes the near-black surface ladder, hairlines in place of shadows, tightly tracked sans type, 8px controls, 12px cards and the discipline of a single chromatic accent. Dark is the default; light is a full peer theme for daytime.

Four translations separate this build from the source file. **The accent:** Linear's lavender-blue became one green from the user's finance-app reference, forest (#0f3d33) as the fill in light and lime (#b8e08a) as the fill in dark, on a shared ramp. **Light mode:** the marketing file is dark only, so the light theme follows Linear's own app light theme: a pale grey page, white cards and grey hairlines. **Type:** Linear Display, Linear Text and Linear Mono are proprietary, so Inter (with its optical-size axis) stands in for all three. **Glass:** Linear has no frosted chrome, but the functional bars (the phone top and tab bars, the sidebar, sheets, menus and toasts) stay glass, a choice the user made before this world. One build divergence from the source: the dark canvas ships at #08090a, a step above Linear's #010102.

Density is compact. The type is a size smaller than a consumer app's, controls are 36px on desktop and the app grows them to 44px on phones. Hierarchy comes from surface steps and hairlines, never from shadow or colour. Green means "you can act here" or "this is selected", and the Spent series is the only data that wears it.

**Key Characteristics:**
- Dark-led: a #08090a canvas with a four-step surface ladder; light mode is a pale page with white cards.
- One green, flipping per theme: forest fills in light, lime fills in dark.
- Hairlines, not shadows; the only shadow belongs to floating menus.
- Inter with tracking that tightens as size grows, and weight 500 for labels and controls.
- 8px controls, 12px cards, pills only for chips and the phone Catat button.
- Glass on the bars only; content stays solid.

## Colors

A near-neutral grey ladder in both themes, with a single green that is used only for action and selection.

### Primary
- **Forest** (`forest`): the light-theme action fill. Primary buttons, the Catat button, checked checkboxes, radios, switches, slider fills, tab underlines, the family book icon and the Spent bars. White text on it.
- **Lime** (`lime`): the dark-theme action fill, in the same roles. It carries **On-Lime** (`on-lime`) text, never white.
- **Forest Hover / Pressed** and **Lime Hover / Pressed**: the step-up and step-down of the fill on hover and press.
- **Link Green** (`link-green`): green text for ghost buttons, "View all" links and the active nav icon in light. In dark the same role uses Lime.
- **Focus Green** (`focus-green`): the focus ring in light. In dark the ring is Lime.
- **Selection Tint** (`selection-tint`, night `selection-tint-night`): the ghost-button hover and selected-pill background.

### Neutral (light)
- **Paper** (`paper`): the page ground and the frosted bars' base.
- **Card White** (`card-white`): cards, fields, secondary buttons.
- **Mist** (`mist`) and **Cloud** (`cloud`): hover, secondary and tertiary fills, segmented-control track, icon discs.
- **Hairline** (`hairline`): card edges, separators, table rules. **Control Edge** (`control-edge`): the secondary-button and select edge.
- **Field Edge** (`field-edge`): the inset edge of text inputs and textareas, chosen to clear 3:1 against white.
- **Ink** (`ink`), **Graphite** (`graphite`), **Slate** (`slate`): primary, secondary and tertiary text. Slate is also placeholder text.

### Neutral (dark)
- **Canvas** (`canvas`): the page ground. **Surface 1–4** (`surface-1` … `surface-4`): cards, then hover and secondary fills, then tertiary fills and selected segments.
- **Night Hairline** (`night-hairline`) and **Night Hairline Strong** (`night-hairline-strong`): edges and separators.
- **Night Field Edge** (`night-field-edge`): the input edge, 3:1 against Surface 1.
- **Moonlight** (`moonlight`), **Haze** (`haze`), **Steel** (`steel`): primary, secondary and tertiary text.

### State
- **Positive** / **Negative** (`positive`, `negative`; night `positive-night`, `negative-night`): income, under-budget and favourable changes; spending over budget and unfavourable changes. Text only, beside a direction arrow.

### Named Rules
**The One Green Rule.** Green appears only on actions, selection and the Spent series. Icon discs, book icons other than the family book, chart series other than Spent and decoration stay neutral. Gains and losses are Positive and Negative text, never green fills.

**The Flip Rule.** Every accent fill goes through the theme-flipping fill and on-fill tokens (forest with white, lime with On-Lime). Fixed ramp steps (`accent-500`, `accent-600`) don't flip and must not carry text unless they are paired per theme.

**The AA Floor Rule.** Every text token clears 4.5:1 against the surfaces it sits on, in both themes. Slate reads 5.4:1 on Paper and Steel 5.2:1 on Surface 3; that margin is the floor, not a target to spend.

## Typography

**Display Font:** Inter (with ui-sans-serif, system-ui, -apple-system)
**Body Font:** Inter
**Label/Mono Font:** Inter, with tabular numerals for money

**Character:** One neutral sans set tight, standing in for Linear's proprietary family. Tracking tightens as size grows, from 0 at 12px to −0.021em at 28px, so titles feel engineered rather than loud.

### Hierarchy
- **Title 1** (500, 28px, 34px): page titles from small screens up.
- **Title 2** (600, 22px, 28px): page titles on phones; drawer and sheet titles.
- **Title 3** (600, 20px, 26px): section titles inside wide surfaces.
- **Stat Value** (500, 32px, 38px, tabular): the headline number on dashboard stat cards.
- **Headline** (600, 16px, 22px): card titles.
- **Body** (400, 15px, 22px): running text, list rows, stat labels (at 500).
- **Body 2** (500, 14px, 20px): buttons, fields, selects, nav labels and card descriptions (at 400).
- **Caption** (500, 12px, 16px): tab-bar labels, chart ticks, helper text and field errors.

### Named Rules
**The Tabular Money Rule.** Every amount, total, delta and count is set in tabular numerals so columns align and figures don't jitter as they update.

**The Composite Utility Rule.** Type is applied only through the composite text utilities, which carry size, weight, line height and tracking together. A missing style is looked up in the typography file, never stacked from parts.

## Layout

Desktop is a floating 260px sidebar inset 12px from the viewport, beside a content column. From the large breakpoint down, the sidebar gives way to a frosted top bar and a frosted bottom tab bar with Catat raised in its centre. Spacing stays on the 4px Tailwind scale with flex and grid gaps rather than margins. Cards pad 16px, 20px from small screens up, with 16px gaps between and inside them. Dashboard stat cards run one per row on phones, two up from small screens and four up at the widest. Page headers stack on phones and put actions on the end side from small screens up. Controls are 36px tall on desktop and 44px on phones; the phone value is the touch target, and icon buttons extend their hit area to 44px on phones even when the visible square is smaller. Layout uses logical properties throughout so it mirrors in RTL.

## Elevation & Depth

Flat by construction. Depth comes from the surface ladder (Canvas, then Surface 1 to 4 in dark; Paper, then Card White, Mist and Cloud in light) and from 1px hairlines. Card, button, field, nav-row and checkbox shadows are all set to nothing. The sidebar's only edge is a 1px hairline ring. Floating layers over content (menus, popovers, listboxes) take the one shadow.

Glass is functional, not atmospheric. The phone bars, the desktop sidebar, sheets, drawers, menus, toasts and the bulk-action bar frost whatever scrolls beneath them, from one per-device glass level (0.6 by default: up to 22px blur and a mild saturation lift). Text-dense floating surfaces are nearly opaque (8% clarity). Glass turns off entirely at level 0 and under Reduce Transparency. There is no wash, gradient or colour blob behind it.

### Shadow Vocabulary
- **Float** (light `0 4px 24px 0 rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.04)`; dark `0 4px 24px 0 rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.06)`): menus, popovers and listboxes over content.
- **Sidebar Ring** (`0 0 0 1px` in the separator colour): the floating sidebar's edge.

### Named Rules
**The Ladder Rule.** A surface that needs to read as raised steps up the ladder; it never gains a shadow. Shadow is for things that float over content.

**The Bars-Only Glass Rule.** Frost only the bars and floating layers. Cards, lists and panels are content and stay solid.

## Shapes

Precise, small corners. Cards and panels are 12px, the sidebar included. Buttons, fields, selects, date triggers, icon buttons and nav rows are 8px; small and extra-small buttons are 6px. Pills are for chips, filter toggles, progress tracks and the 56px phone Catat circle only; Catat chat bubbles take the card radius. Edges are 1px: hairlines on cards and secondary controls, and a 1px inset field edge on text inputs. Bars in charts have 4px top corners.

## Components

### Buttons
Linear controls: small, square-shouldered, quiet until they're the action.
- **Shape:** gently rounded (8px); medium 36px tall (44px on phones) with 12px side padding and Body 2 type; small 32px and extra-small 24px at 6px.
- **Primary:** the theme fill: Forest with white text in light, Lime with On-Lime text in dark. Hover and press step along the fill. Disabled is a Cloud (Surface 3 in dark) fill with muted text.
- **Secondary:** Card White (Surface 1 in dark) with a 1px Control Edge; hover steps to Mist and strengthens the edge.
- **Ghost:** green text on transparent, with a Selection Tint hover.
- **Danger:** a flat red fill on the same recipe.
- **Focus:** a 2px ring in the focus green on every interactive element.

### Icon Buttons
A ghost square: transparent with a Slate (Steel in dark) icon, 8px corners. Hover shows a surface and darkens the icon to Ink; press scales to 98%. On phones the hit area extends 6px past the square.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Card White in light, Surface 1 in dark; always solid.
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** 1px hairline.
- **Internal Padding:** 16px, 20px from small screens up, 16px gap.
- **Header:** a Headline title, an optional Body 2 description in Slate, and an optional green "View all" link.

### Stat Cards (signature)
A hairline card with a 40px neutral icon disc and an Ink icon, the label in Graphite Body, the value in tabular Stat Value, then a footnote row under a hairline: the comparison caption on the start side and the change on the end side as a direction arrow plus semibold tabular Body 2 in Positive, Negative or Graphite. No tinted pill behind the change.

### Inputs / Fields
- **Text inputs and textareas:** Card White (Surface 1 in dark), 8px radius, 36px tall (44px on phones), a 1px inset Field Edge so the control clears 3:1.
- **Selects and date triggers:** the same size and radius with a 1px Control Edge that strengthens on hover.
- **Focus:** a 2px focus-green ring.
- **Error:** the field takes the red error surface and edge, and the message sits directly under it in Caption. Required fields carry a red asterisk on the label.
- **Forms:** every drawer form validates on the client first and shows each message under its field. The sticky footer repeats the problem ("Enter an amount", or "3 fields need attention."), and focus moves to the first invalid field after a submit.
- **Money:** amount fields are tabular, ignore the scroll wheel and never round what was typed.

### Selection Controls
Checkboxes, radios, switches and slider fills use the theme fill when on, with the on-fill colour for the tick and the radio dot. The off switch is a Cloud track with a 1px inset Field Edge ring so it still reads as a control.

### Navigation
- **Desktop sidebar:** the frosted 260px panel with a 12px radius. The Catat button sits on top: a 36px fill-colour control with a semibold Body label. Nav rows are 8px rows with a 20px Slate icon and a Graphite Body label; the active row is a Card White (Surface 1) row with a green icon and a semibold Ink label.
- **Phone:** a frosted top bar and tab bar with 24px icons and Caption labels, Ink at rest and green when active. Catat is a raised 56px fill-colour circle in the centre with a 4px ring in the page-ground colour.

### Book Icon
The family (shared) book wears the fill colour; a personal book is a neutral Cloud (Surface 3) tile with an Ink letter. That keeps one accent even in the book switcher.

### Charts
Spent bars are the fill colour; Budget bars are the neutral chart grey; the track is Cloud (Surface 4 in dark). Bars have 4px top corners and ticks are Caption in Slate.

### Category Tiles and Picker (signature)
A category's emoji on a tile tinted with its chosen chip colour, falling back to its group colour and then to the name's first letter. Every transaction and budget row starts with one. Quick capture picks a category from tiles, not a list: the most used in the last 90 days plus an "All" tile that opens every category grouped by Needs, Wants, Savings and Income, with search.

### Deletes
Deletes happen at once and show an Undo toast for 8 seconds that names what went. Only actions that can't be undone (removing a member, resetting a password, deleting an account with moves) ask first, in a dialog that names the consequence.

### Menus
Dropdowns, listboxes and calendars are nearly opaque glass (8% clarity) with the Float shadow. They open and close with a 150ms fade, a scale from 95% and a 2px blur, and don't animate under Reduce Motion.

## Do's and Don'ts

### Do:
- **Do** use BoardUI semantic colour tokens and composite type utilities only; pick a different token rather than writing a `dark:` override with a raw colour.
- **Do** colour every accent fill with the theme fill and its on-fill text (Forest with white, Lime with On-Lime).
- **Do** keep green for actions, selection and the Spent series; keep Catat the most saturated object on screen.
- **Do** build hierarchy from the surface ladder and 1px hairlines: 12px cards, 8px controls.
- **Do** put icons on neutral discs with Ink glyphs.
- **Do** show changes as Positive or Negative text with a direction arrow.
- **Do** give every touch target 44px on phones (buttons, fields, triggers, icon-button hit areas, the tab bar).
- **Do** set money in tabular numerals and start category rows with the category tile.
- **Do** offer Undo for deletes, and confirm only what can't be undone.
- **Do** show each field error inline under its field and repeat the summary in the sticky footer.
- **Do** keep every text token at 4.5:1 or above and every field edge at 3:1, in both themes, and check every surface in dark (the default) and light.
- **Do** respect Reduce Motion and Reduce Transparency.

### Don't:
- **Don't** use gradients on any fill, in any state.
- **Don't** put a shadow on cards, buttons, fields, nav rows or the sidebar; the Float shadow is for menus and popovers only.
- **Don't** frost cards, lists or panels, and don't add a decorative wash or colour blob behind the glass.
- **Don't** introduce a second accent, or use green for icon tiles, non-Spent data or decoration.
- **Don't** put text on a fixed accent ramp step without a per-theme pair; use the flipping tokens.
- **Don't** put status colours in tinted pills behind deltas.
- **Don't** use raw palette classes or hex literals in components.
- **Don't** hand-build a control that BoardUI already ships.
