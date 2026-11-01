# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Static HTML/CSS/JS, no build step (user decision, 2026-11-01). Opens by double-click from disk and deploys to GitHub Pages as-is. The calculation engine and the quote parser are standalone UMD modules so Node can unit-test them. External libraries (SheetJS, pdf.js) load lazily from a CDN only when a file is dropped.

## Users
Purchasing staff and technical-office engineers at Turkish construction contractors. They collect 3 to 6 quotes for one material package (rebar, ready-mix concrete, ceramics, MEP equipment) and must tell the project manager or owner which supplier is really cheapest. Desk work on a 24" monitor in the site office, quick checks on a phone on site.

## Product Purpose
Turns scattered supplier quotes ("factory delivery, cash", "on-site, 30-60-90 day cheques", "EUR, 30% advance") into one comparison sheet on the same basis: landed at site, VAT-excluded, discounted to today's cash value at the company's own monthly funding rate and expected FX drift. Success: the engineer can defend the award decision with numbers the boss trusts, and knows which line items to negotiate.

## Positioning
The AI only reads messy quotes into a fixed schema; every number is computed by a deterministic in-browser engine. Every parsed quote passes a human review step before it enters the sheet. Works without any API key (copy-paste prompt bridge, manual entry, Excel template).

## Operating Context
- Inputs: WhatsApp messages, e-mail text, PDF proformas, supplier Excel sheets.
- Rituals: the "mukayese cetveli" (comparison sheet) signed by the purchasing chief and the project manager; payment by post-dated cheques (30-60-90 days) is common; FX-denominated offers with advances.
- Outputs: approval form for signature, order letter to the chosen supplier, CSV/XLSX export, JSON for a budget system.

## Capabilities and Constraints
- Three ingestion modes: (1) direct AI with the user's own key (Anthropic, OpenAI-compatible endpoint incl. own proxy, Gemini), (2) zero-cost prompt bridge, (3) manual entry or the standard Excel template. File drop for PDF/Excel extracts text for modes 1 and 2.
- Engine: unit conversion (Ton/kg/m/boy via theoretical steel weight or custom factor), VAT normalisation, logistics (freight, crane, waste), NPV per payment tranche with FX projection, exact split-order optimisation with full logistics per used supplier, interest-rate sensitivity and break-even.
- Incomplete quotes are never filled in; they are flagged and kept out of the overall ranking.
- Languages: Turkish and English (user decision).
- Data stays in the browser (localStorage); API keys are kept in session memory only unless the user opts to remember them.

## Brand Commitments
- Part of the MKG tool family (same owner as İhaleDirektörü). No icons or emoji anywhere (user rule).
- Objective, technical tone.

## Evidence on Hand
- Ten demo packages ported from the prototype; all supplier names and prices are synthetic and must be labelled as such. No real company names.
- No real customer data, benchmarks or testimonials exist; none may be invented.

## Product Principles
1. Numbers are computed, never generated.
2. Nothing enters the sheet unreviewed; missing data is shown as missing.
3. Paper price versus real cost must be visible in one glance.
4. Works offline and without a key; AI is an accelerator, not a dependency.

## Accessibility & Inclusion
WCAG AA contrast, full keyboard operation, reduced-motion respected, readable on a 375px phone.
