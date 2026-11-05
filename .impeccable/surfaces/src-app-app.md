---
version: 1
slug: "src-app-app"
primary_target: "src/app/(app)"
related_targets: []
---

# App shell and every in-book screen

Mode: Operate. A two-person household logs and checks money on phone and laptop, often at night.
Pinned by the user (2026-11-05): adopt the shadcn.io "Apple" DESIGN.md as the visual world, as a full re-skin with the iOS type scale. Glass only on the functional bars.

## Direction contract
THESIS: An Apple-native money app. Quiet parchment ground, white cards, one Action Blue for every action. Refuses gradient buttons, ambient washes and shadows on cards.
OWN-WORLD: #f5f5f7 page, #ffffff cards with #e0e0e0 hairlines at 18px radius. Ink #1d1d1f with #424245 / #6e6e73 grays. Action Blue #0066cc (focus #0071e3, links on dark #2997ff). Pill buttons, no weight 500, SF Pro via the system stack (Inter elsewhere). Dark mode: #000 ground, #1c1c1e cards.
STORY: Open the app, see what's left this period, tap the blue pill, log, done.
FIRST VIEWPORT: frosted sidebar (phone: frosted top bar and tab bar), 28px page title, white cards in a grid. The blue Catat pill is the only saturated object.
FORM: Apple macOS/iOS app idiom on web components; signature move = the single Action Blue pill plus tight SF tracking. No concept roll ran: the user pinned the world (shadcn.io Apple DESIGN.md), which replaces the roll. seed: none (unavailable)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
