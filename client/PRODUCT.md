# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parents of junior tennis players in India. On the rankings pages they are either the parent of the ranked player (checking where their child stands, whether they are rising or falling, and what to do next) or a parent comparing players (scouting peers or rivals by rank, trend and state standing). Many read on a phone. They are not tennis insiders and need plain language.

## Product Purpose

PowerMySport is a parent-facing sports guidance platform. The rankings section mirrors the All India Tennis Association (AITA) junior rankings, stores every weekly list, and adds what AITA does not show: week-by-week history, a projection of what happens next, points composition, and what a rank opens or closes in tournament entry.

## Positioning

AITA publishes a rank list. PowerMySport keeps every list since it started tracking and explains it: movement over time, what drops off in the next three months, and how far a player is from the next rank band.

## Capabilities and Constraints

- Data is mirrored weekly from AITA; PowerMySport is not affiliated with AITA.
- The player page shows the own-age-group rank as the main list and any older age group as secondary ("playing up"), plus state rank.
- Projection copy is a ceiling, not a forecast, and must say so.
- Tournament entry rules are cited from the AITA Junior Tournament Structure (effective 1 January 2026) with a prompt to check current regulations.
- Rankings code lives in `client/src/modules/rankings/`; route files are capped at 400 lines.

## Brand Commitments

The warm-paper design system recorded in DESIGN.md stays: cream canvas, Geist with Newsreader italic accents, hairlines and tonal bands rather than shadows or stacked cards, brand orange reserved for the one decisive action. No fake metrics, no emoji icons, no em dashes, no purple gradients.

## Evidence on Hand

Real data only: weekly rank and points history, state rank, best rank, points to next band. Nothing is invented.

## Product Principles

- The first screen answers "where do they stand and which way are they moving".
- Plain language over jargon; explain a term once, where it is first needed.
- Never show a number without saying what it means for the family.
- Honest uncertainty: projections are labelled as ceilings, not forecasts.

## Accessibility & Inclusion

Charts must work by keyboard and without color alone. Layout must work at phone width. Text contrast meets WCAG AA.
