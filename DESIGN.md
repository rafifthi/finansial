---
name: Finansial
description: An Apple-native household money app. Parchment ground, white cards, one Action Blue for every action.
colors:
  action-blue: "#0066cc"
  action-blue-hover: "#0058b0"
  action-blue-pressed: "#004a94"
  focus-blue: "#0071e3"
  sky-link-blue: "#2997ff"
  selected-tint: "#e8f2fc"
  ink: "#1d1d1f"
  graphite: "#424245"
  slate: "#636366"
  placeholder-grey: "#6e6e73"
  field-edge: "#86868b"
  parchment: "#f5f5f7"
  card-white: "#ffffff"
  mist: "#e8e8ed"
  control-hairline: "#d2d2d7"
  card-hairline: "#e0e0e0"
  system-green: "#248a3d"
  system-red: "#d70015"
  night: "#000000"
  night-card: "#1c1c1e"
  night-inset: "#2c2c2e"
  night-raised: "#3a3a3c"
  night-ink: "#f5f5f7"
  night-graphite: "#c7c7cc"
  night-slate: "#a1a1a6"
  night-placeholder: "#98989d"
  night-field-edge: "#7c7c80"
  night-green: "#30d158"
  night-red: "#ff453a"
  night-selected-tint: "#0a2a4d"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: "2.5625rem"
    letterSpacing: "-0.015em"
  title-1:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.125rem"
    letterSpacing: "-0.015em"
  title-2:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.012em"
  title-3:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.5625rem"
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: "1.375rem"
    letterSpacing: "-0.022em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.375rem"
    letterSpacing: "-0.022em"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "-0.016em"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.125rem"
    letterSpacing: "-0.006em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    letterSpacing: "0em"
  money:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Inter, system-ui, sans-serif"
    fontFeature: "\"tnum\""
rounded:
  tile-sm: "8px"
  control: "12px"
  sheet: "14px"
  card: "18px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  grid: "10px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.card-white}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-hover}"
  button-primary-active:
    backgroundColor: "{colors.action-blue-pressed}"
  button-secondary:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hairline}"
  button-ghost:
    textColor: "{colors.action-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.selected-tint}"
  icon-button:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "36px"
  input-text:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    height: "44px"
  select-trigger:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  catat-pill:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.card-white}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  catat-tab-button:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    size: "56px"
  stat-icon-disc:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "40px"
  switch-track-off:
    backgroundColor: "{colors.mist}"
    rounded: "{rounded.pill}"
  switch-track-on:
    backgroundColor: "{colors.action-blue}"
    rounded: "{rounded.pill}"
---

# Design System: Finansial

## Overview

**Creative North Star: "The Quiet Apple Ledger"**

Finansial is a two-person money app that should feel like it shipped with the phone. The world is adopted, by the household's choice, from the shadcn.io "Apple" DESIGN.md (author Dov Azencot, a reading of apple.com's marketing system): a parchment ground, near-black ink, a muted grey text ladder, SF Pro type with tight tracking, no weight 500, no gradients, no shadows on chrome, and one Action Blue that is every action and nothing else. Credit for the palette, the type stance and the single-accent discipline belongs to that source.

Apple's file describes marketing pages; Finansial is an app, so several patterns are translated rather than copied. Full-bleed alternating light and dark product tiles became white cards on a parchment ground, edged by hairlines, because an app screen is many small containers, not one product per viewport. The source's single product-photo shadow has no product photo to sit under here; that one shadow is kept for things that float over content (menus, popovers, listboxes), and nothing at rest carries one. The marketing display ramp gave way to the iOS text styles (Body 17, Subhead 15, Footnote 13, Caption 12, Headline 17 semibold, Title 1 to 3 at 28/22/20), since this is reading and logging, not a hero headline. Frosted glass from Apple's sticky bars stays, but only on the functional layer that floats over scrolling content.

Density is calm and even. Each screen is a page title, then a grid of white cards. The blue Catat pill is meant to be the only saturated object in view; every other icon sits on a grey disc, and good or bad changes are coloured text, not tinted chips. Dark mode is first-class: a true black ground with #1c1c1e cards, the iOS system greys, and the brighter link and focus blue.

**Key Characteristics:**
- One Action Blue for every action and selection; the Catat pill is the only saturated object on screen.
- Parchment ground, white cards with hairline edges at 18px; flat at rest.
- SF Pro through the system stack (Inter elsewhere) on the iOS text styles, weights 400, 600 and 700 only.
- Pills for every button, circles for every icon control, 44px touch targets.
- Glass only on bars, sheets, menus and toasts that float over content.
- Money in tabular numerals; changes in Apple system green and red, as text.

## Colors

A near-monochrome Apple palette: parchment, white and four greys, with one blue for action and two system colours for change.

### Primary
- **Action Blue** (action-blue): every primary button, the Catat pill and tab button, checked checkboxes, radios, switches and slider fills, ghost-button and link text, the active nav icon. White text on it clears 5.57:1.
- **Action Blue Hover and Pressed** (action-blue-hover, action-blue-pressed): the flat hover and press steps of the same fill. One colour per state, never a light-to-dark gradient.
- **Focus Blue** (focus-blue): the 2px focus ring in light mode, and the primary button fill in dark mode.
- **Sky Link Blue** (sky-link-blue): links, ghost text and the focus ring on dark surfaces, where Action Blue would sink.
- **Selected Tint** (selected-tint; night-selected-tint in dark): ghost-button hover and selected pill-tab backgrounds.

### Neutral
- **Ink** (ink; night-ink in dark): primary text and primary icons.
- **Graphite** (graphite; night-graphite): secondary text, stat footnotes, neutral deltas.
- **Slate** (slate; night-slate): tertiary text, descriptions and helper lines.
- **Placeholder Grey** (placeholder-grey; night-placeholder): field placeholders and secondary icons.
- **Field Edge** (field-edge; night-field-edge): the 1px edge on text inputs, textareas and the off switch track, kept at 3:1 for non-text contrast. Also the tertiary icon colour and control hover edge.
- **Parchment** (parchment; night in dark): the page ground, the icon-button and stat-icon discs, and secondary insets.
- **Card White** (card-white; night-card in dark): cards, panels, fields and dropdowns.
- **Mist** (mist; night-raised in dark): the grey secondary capsule, segmented-control track, chart track, pressed rows.
- **Control Hairline** (control-hairline): the edge on select and date triggers, secondary capsule hover.
- **Card Hairline** (card-hairline; night-inset in dark): card edges, table rules and separators.

### Status
- **System Green** (system-green; night-green in dark): good changes, as text only.
- **System Red** (system-red; night-red in dark): bad changes, as text only. Errors keep BoardUI's red error tokens.

### Named Rules
**The One Blue Rule.** Action Blue means "you can press this" or "this is selected". It never decorates, never marks data, and never tints an icon tile. Charts use the `chart-*` tokens.

**The AA Floor Rule.** Every text token clears 4.5:1 on every surface it sits on, in both themes, placeholders included. When a pair fails, change the token value, never a single component.

**The Flat Fill Rule.** Every fill is one colour. Buttons, checkboxes, radios, the Catat pill and the logo carry no gradient in any state.

## Typography

**Display Font:** SF Pro Display through `-apple-system` (Inter via next/font on non-Apple devices)
**Body Font:** SF Pro Text through the same system stack
**Label/Mono Font:** JetBrains Mono, for code only

**Character:** Apple's own voice: tight negative tracking, regular weight for reading, semibold for anything that names a thing. Weight 500 is absent; the BoardUI `-medium` utilities render at 400 for text sizes and 600 for titles and headlines.

### Hierarchy
- **Large Title** (600, 34px, 41px, -0.015em): the headline figure on footer stat cards (BoardUI's Display 4 utility renders at this size).
- **Title 1** (600, 28px, 34px, -0.015em): page titles from small screens up, and the transaction amount field.
- **Title 2** (600, 22px, 28px, -0.012em): page titles on phones.
- **Title 3** (600, 20px, 25px, -0.012em): wizard, setup and dialog titles, and summary figures (budget totals, bill-check totals).
- **Headline** (600, 17px, 22px, -0.022em): card titles.
- **Body** (400, 17px, 22px, -0.022em): row labels, field values, button labels at medium size.
- **Subhead** (400, 15px, 20px, -0.016em): descriptions, small buttons, semibold deltas.
- **Footnote** (400, 13px, 18px, -0.006em): captions, field messages, tab-bar labels.
- **Caption** (400, 12px, 16px): the smallest text; badges and dense meta.

### Named Rules
**The No 500 Rule.** Text is 400, titles and names are 600, and 700 is for rare emphasis. Never stack a medium weight back in.

**The Tabular Money Rule.** Every money figure uses tabular numerals so columns of amounts line up.

## Layout

Phones get a single column with 16px side padding, a frosted top bar and a frosted bottom tab bar with the raised Catat button in the centre. From the large breakpoint the app becomes a 260px frosted sidebar inset 12px from the window, beside a content column with 24px side padding. Page content stacks with 20px gaps (24px from small screens up). Cards pad 16px (20px from small screens up) and space their contents 16px apart. Stat cards tile two across on phones with 10px gaps. Forms open in a right-side drawer on desktop and a bottom sheet on phones, with a sticky footer.

## Elevation & Depth

Flat by default. Cards, buttons, fields and the sidebar sit on tonal steps (parchment ground, white card, grey inset) and are edged by 1px hairlines, not shadows. Real depth appears only where something floats over content: bars, sheets and drawers frost what scrolls under them with backdrop blur, and menus, popovers and listboxes add the one shadow.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 5px 30px 0 rgb(0 0 0 / 0.16), 0 0 0 1px rgb(0 0 0 / 0.04)`; dark `0 5px 30px 0 rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.06)`): dropdown menus, popovers, listboxes and calendars. Apple's product-photo shadow, moved to the things that float.
- **Sidebar ring** (`box-shadow: 0 0 0 1px` card hairline): the sidebar's edge, drawn as a ring.

### Named Rules
**The One Shadow Rule.** There is one shadow, and it belongs to floating layers. Nothing at rest casts one.

**The Glass Is Chrome Rule.** Glass is for what floats over content: the phone bars, sheets and drawers, menus, toasts, the bulk-action bar and the desktop sidebar. Cards, lists and panels are content and stay solid. Every glass surface must read correctly at `--glass: 0` and under Reduce Transparency, and text-dense floating layers use the 8% raised clarity.

## Shapes

Two shapes carry the world: the capsule and the soft rectangle. Every button is a full pill and every icon control a circle. Cards and panels round at 18px. Fields, select and date triggers, and nav rows round at 12px. Sheets and chat bubbles round at 14px. Category tiles step with size: 28px at 8px, 36px at 12px, 48px at 14px. Edges are always 1px.

## Components

### Buttons
Quiet capsules that press in.
- **Shape:** full pill (9999px). Medium 44px tall with 16px side padding and Body type; small 36px with Subhead; xs 28px with semibold Footnote. Icon-only buttons are circles of the same height.
- **Primary:** a flat Action Blue fill with white text. Hover steps to Action Blue Hover and press to Action Blue Pressed. In dark mode the fill is Focus Blue.
- **Secondary:** the grey capsule: a Mist fill with ink text, no edge and no shadow. Hover deepens to Control Hairline.
- **Ghost:** Action Blue text on transparent (Sky Link Blue in dark), with a Selected Tint hover.
- **Danger:** a flat red fill on the same recipe.
- **Press:** buttons scale to 95% on press with a 420ms ease back.
- **Focus:** a 2px Focus Blue ring with a 2px offset on every interactive element.

### Icon Buttons
A grey Parchment disc with an ink icon, 36px at medium. Hover deepens to Mist, press scales to 95%. On phones the hit area extends 6px past the disc to reach 44px.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** Card White (Night Card in dark), solid, never glass.
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** 1px Card Hairline.
- **Internal Padding:** 16px, 20px from small screens up, with a 16px gap.
- **Header:** a Headline title, an optional Subhead description in Slate, and an optional ghost action.

### Stat Cards (signature)
A white card with a 40px grey icon disc and an ink icon, the label in Graphite Body and the value in tabular Large Title, then a footnote row under a hairline: the comparison caption in Graphite on the start side and the change on the end side as a direction arrow plus semibold tabular Subhead in System Green, System Red or Graphite. No tinted pill behind the change.

### Inputs / Fields
- **Text inputs and textareas:** Card White, 12px radius, 44px tall, a 1px inset Field Edge so the control clears 3:1.
- **Selects and date triggers:** Card White, 12px radius, 44px tall, a 1px Control Hairline edge that strengthens to Field Edge on hover.
- **Focus:** a 2px Focus Blue ring.
- **Error:** the field takes the red error surface and edge, and the message sits directly under it in Footnote. Required fields carry a red asterisk on the label.
- **Forms:** every drawer form validates on the client first and shows each message under its field. The sticky footer repeats the problem ("Enter an amount", or "3 fields need attention."), and focus moves to the first invalid field after a submit. Server issues come back per field in plain words.
- **Money:** the transaction amount is a Title 1 field. Money fields ignore the scroll wheel and never round what was typed.

### Switches
On: a flat Action Blue track. Off: a Mist track with a 1px inset Field Edge ring, so the off state still reads as a control.

### Navigation
- **Desktop sidebar:** a frosted 260px panel, 18px radius, inset 12px. The Catat pill sits on top: 44px Action Blue capsule, Body label, press to 95%. Nav rows are 12px-radius rows with a 20px Placeholder Grey icon and Graphite Body label; the active row is a white raised row with an Action Blue icon and a semibold Ink label. Solid blue stays reserved for Catat.
- **Phone:** a frosted top bar and frosted tab bar with 24px icons and Footnote labels, Ink at rest and Action Blue when active. Catat is a raised 56px Action Blue circle in the centre with a 4px ring in the page-ground colour, pressing to 95%.

### Category Tiles and Picker (signature)
A category's emoji on a tile tinted with its chosen chip colour, falling back to its group colour and then to the name's first letter. Every transaction and budget row starts with one. Quick capture picks a category from tiles, not a list: the seven most used in the last 90 days plus an "All" tile that opens every category grouped by Needs, Wants, Savings and Income, with search.

### Deletes
Deletes happen at once and show an Undo toast for 8 seconds that names what went. Only actions that can't be undone (removing a member, resetting a password, deleting an account with moves) ask first, in a dialog that names the consequence.

### Menus
Dropdowns, listboxes and calendars are almost-opaque glass (8% clarity) with the Float shadow. They open and close with a 150ms fade, a scale from 95% and a 2px blur, and do not animate under Reduce Motion.

## Do's and Don'ts

### Do:
- **Do** use BoardUI semantic colour tokens and composite type utilities only; pick a different token rather than writing a `dark:` override with a raw colour.
- **Do** keep Action Blue for action and selection, and keep the Catat pill the only saturated object on screen.
- **Do** put cards on the parchment ground as white panels with an 18px radius and a 1px Card Hairline edge.
- **Do** make every button a pill and every icon control a circle, with flat single-colour fills.
- **Do** put icons on grey discs (Parchment) with ink glyphs.
- **Do** show changes as System Green or System Red text with a direction arrow.
- **Do** give every touch target 44px on phones (buttons, fields, triggers, footer buttons, icon-button hit areas).
- **Do** set money in tabular numerals and start category rows with the category tile.
- **Do** offer Undo for deletes, and confirm only what can't be undone.
- **Do** show each field error inline under its field and repeat the summary in the sticky footer.
- **Do** check every surface in dark mode and keep every text token at 4.5:1 or above in both themes.
- **Do** respect Reduce Motion and Reduce Transparency.

### Don't:
- **Don't** use gradients on any fill, in any state.
- **Don't** put a shadow on cards, buttons, fields or the sidebar; the Float shadow is for menus and popovers only.
- **Don't** frost cards, lists or panels, and don't add a decorative wash or colour blob behind the glass.
- **Don't** use weight 500.
- **Don't** use Action Blue, or any saturated colour, for icon tiles, data or decoration.
- **Don't** put status colours in tinted pills behind deltas.
- **Don't** use raw palette classes or hex literals in components.
- **Don't** hand-build a control that BoardUI already ships.
