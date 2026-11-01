# Design: Mukayese

The page borrows the material of a security-printed bank document (tinted paper, guilloche, perforated edges, dotted fill-in lines, a navy MICR band) without using cheque vocabulary in the interface. The verdict card names the supplier that is really cheapest; each quote is a card with its payment strip. Built in `css/app.css` (tokens on `:root`) and `js/app.js` (guilloche, microprint). Product name "Mukayese", logo "MKG" (KARARLAR K-07, K-08).
## Colour (restrained: sage paper ramp, one action colour, one warning colour)
| Token | Value | Use |
|---|---|---|
| `--masa` | #D9E0D4 | Desk: page ground. Cheques lie on it; perforation holes show it. |
| `--kagit` | #F2F5ED | Cheque paper: verdict, leaves, ledger, review sheet. |
| `--kocan` | #E6ECE0 | Stub paper and table heads. |
| `--cetvel` | #B4C0AF | Printed rules, dotted fill-in lines. |
| `--soluk` | #4F5B49 | Labels, secondary text (5.3:1 on desk, 6.5:1 on paper). |
| `--koyu` | #2E3A2B | Body copy on paper. |
| `--murekkep` | #121C2E | Ink. Text, outlines, MICR band ground. |
| `--banka` | #1F3A73 | Bank navy. The only action colour: primary button, selection, leader, best cell. |
| `--kirmizi` | #9E241C | Red pen. Only missing data, paper illusion, errors, FX exposure. |
| `--seri-1..6` | validated categorical set | Supplier identity in charts and swatches; always with a dash pattern and a direct label. |

The guilloche rosette and wave lines are generated once on a canvas at 3-5 % opacity and used as a background on cheque faces only.

## Type
- Archivo (variable width) for the printed form. Section headings at width 112 %, labels condensed at 80-88 %, uppercase, tracked.
- Martian Mono at width 87.5 % for amounts, days, rates and codes only. Never for prose.
- Amounts on the verdict card are written as on a bank document: `#3.040.312#` in the amount box, and in words on the "Yazıyla" line.

## Components
- **Verdict card** (`.cek`): decision summary on the left with a perforated edge (radial-gradient holes in the desk colour), face on the right with dotted fill-in lines (`.noktali`), an amount box with a 1.5 px ink border, microprint line, signature rule.
- **Quote card** (`.yaprak`): rank column, payment strip, ledger of the cost waterfall (single rule for subtotal, double rule for the final value).
- **Stamp** (`.damga`): rotated text in a border, multiply blend. Navy for status, double red border for problems, thin muted for notes. Status is stamped, never a coloured pill.
- **MICR band** (`.micr`): navy ink strip holding the market parameters; segments separated by a drawn transit mark. Number fields have drawn − / + steppers; browser spinners are hidden everywhere (K-09).
- **Fields**: underline only, dotted at rest, solid navy 2 px on focus; red when invalid.
- **Buttons**: filled navy (primary), ink outline (secondary), underlined text (tertiary). 2 px corners.
- No icons, no emoji.

## Layout
- Left-aligned, no centring and no max width (K-06). ≥1360 px: section rail | sheet | package dock (search + category filter), all three columns visible.
- 1100-1360 px: the dock becomes a right-hand drawer opened from "Paketler" in the top bar.
- <1100 px: rail becomes a horizontal tab strip under the MICR band.
- <640 px: only the rail stays pinned; cheques stack stub above face; payment strips are drawn at phone width.
- Quote intake is a page section right under the verdict (K-10): three mode tabs (1 AI, 2 copy-paste bridge, 3 manual entry and Excel), the two steps of a mode side by side from 1200 px. The review sheet opens in the same place; "Edit" on a quote card scrolls back to it.

## Motion
- One authored moment: when the leader changes, the verdict stamp is pressed (scale and blur settle, 260 ms); the ink strip eases to its new length; changed amounts settle in place.
- Everything else is colour and border transitions at 180 ms. `prefers-reduced-motion` removes all of it.
