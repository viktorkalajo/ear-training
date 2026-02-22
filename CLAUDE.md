# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Ear Training App (Gehörsträning)

Piano ear training web app for recognizing note sequences. Built for a piano teacher to use with students.

## Tech Stack

- **React 19 + TypeScript** (strict mode, `verbatimModuleSyntax` enabled — use `type` keyword for type-only imports)
- **Vite** for dev/build
- **soundfont-player** for realistic piano audio (loads samples from CDN)
- No backend — fully static, hosted on GitHub Pages

## Commands

- `npm run dev` — start dev server
- `npm run build` — type-check + production build (outputs to `dist/`)
- `npx tsc --noEmit` — type-check only
- `npm run lint` — ESLint

## Deployment

GitHub Pages via Actions workflow (`.github/workflows/deploy.yml`). Pushes to `main` auto-deploy to `https://viktorkalajo.github.io/ear-training/`. The `base` in `vite.config.ts` is set to `/ear-training/`.

## Architecture

All source is in `src/`:

- **`App.tsx`** — main component, all game logic, sequence parsing, keyboard handling
- **`audio.ts`** — soundfont-player wrapper, loads acoustic grand piano samples
- **`types.ts`** — `Sequence` and `GameState` types
- **`index.css`** — all styling (dark theme, champagne accents, Cormorant Garamond font)
- **`main.tsx`** — React entry point

## How Sequences Work

Sequences are passed via URL query parameter `sequences` (or `s`). Semicolons separate sequences. Within a sequence, notes are tokenized without separators using ABC-style notation:

| Input | Result | Rule |
|-------|--------|------|
| `C`   | C4     | Uppercase = octave 4 |
| `c`   | C5     | Lowercase = octave 5 |
| `C,`  | C3     | Comma lowers one octave |
| `c'`  | C6     | Apostrophe raises one octave |
| `C5`  | C5     | Explicit octave also works |

Example URL: `?s=CFGc;CDGc;cdedc`

Notes are mapped to C major scale degrees (C=1, D=2, ... B=7). The user answers in scale degrees. Octave is irrelevant for the answer.

## UI Language

All user-facing text is in **Swedish**.

## Keyboard Shortcuts

Detected at runtime (first keypress sets `hasKeyboard`). Only shown to keyboard users via `<kbd>` tags on buttons.

- `1`–`7` — input scale degrees
- `Enter` / `Space` — submit answer (Kolla) / next round (Nästa)
- `Backspace` — undo last note (Ångra)
- `R` — replay sequence (Spela igen)

## Style Notes

- Dark background with warm champagne accents (`#d4c4a6`), not saturated gold
- Font: Cormorant Garamond (loaded from Google Fonts) for headings/buttons, system-ui for numbers/data
- Ivory-toned degree buttons with subtle shadows
- All colors meet WCAG AA contrast (4.5:1 minimum)
