---
target: the form ui for the whole system
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:/Users/rafif.misbah/Documents/Code/finansial/.claude/worktrees/impeccable-init-f22085/src/components/app"
timestamp: 2026-11-04T07-35-09Z
slug: src-components-app
---
# Critique: form UI across Finansial (src/components/app)

Method: dual-agent. Score 20/40 (Acceptable).

| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 2 |
| 2 | Match with the real world | 3 |
| 3 | User control and freedom | 2 |
| 4 | Consistency and standards | 2 |
| 5 | Error prevention | 1 |
| 6 | Recognition rather than recall | 2 |
| 7 | Flexibility and efficiency | 1 |
| 8 | Aesthetic and minimalist design | 3 |
| 9 | Help users recover from errors | 1 |
| 10 | Help and documentation | 3 |

## Design specificity
The handmade half (budget editor, account delete-with-move, category-driven accounts) is authored for this app. The generic EntityFormButton half (Goals, Installments, Recurring, Accounts, Categories) is a flat column of fields with no grouping, no fields shown only when needed, and no field-level errors.

The code scan found 0 issues, but contrast checks don't run on .tsx. The in-browser checks found:
- text-text-tertiary at 2.6:1 in light mode and 2.3–2.4:1 in dark mode
- white on accent at 4.2:1
- secondary text on grey at 3.2–4.4:1
- a skipped heading level on Transactions

## Priority issues
- **[P0] Destructive actions have no confirm, and Delete is the bottom-most button on phones.** Evidence: transaction-form.tsx:120-137, transactions-view.tsx:332, members-manager.tsx:198, admin-users.tsx:76, modal.tsx:311. Command: harden.
- **[P0] Entity form errors are raw Zod text, off screen, and not tied to any field.** Evidence: entities.ts:59, entity-form.tsx, form-drawer.tsx FormError; no isInvalid or errorMessage anywhere in src/components/app. Command: harden, clarify.
- **[P1] Quick capture is slow.** 9 controls, a flat 15-item category select, no "save & add another", no last-used defaults, unreliable Enter. Evidence: transaction-form.tsx:149-222, fields.tsx. Command: distill, layout.
- **[P1] Tertiary text tokens fail contrast in both themes, and white on accent is 4.2:1.** Command: audit, colorize.
- **[P1] Recurring and installment forms show the whole schema.** 13 fields, 0–6 weekday numbers, no category required, native month input. Evidence: field-specs.ts:59-106, schema.ts:94-110. Command: shape.

## Persona red flags
- **Till:** about 5 taps, no recents, and the drawer closes after each save.
- **Casey:** every measured target is under 44px, and Delete sits at the bottom.
- **Sam:** every budget input is announced as "Amount", the DateField label isn't tied to its control, and nothing uses aria-invalid.
- **Jordan:** "Non-allocated" is unclear, and currency and number format are free text.

## Minor
- Glass popovers let the labels behind them show through.
- Money fields step on the scroll wheel.
- Copy-last-month overwrites unsaved edits, and leaving the page doesn't warn.
- Toasts don't say what was saved or deleted.
- Raw text-white on the login page, and a dark: override in budget-editor.
- Password length isn't checked on the client.
