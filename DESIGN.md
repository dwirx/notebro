# Design

## Visual Direction

Restrained product UI with a pure white light surface, a near-black dark surface, cobalt primary actions, and a small amber accent for status and published states.

## Palette

Use OKLCH tokens throughout.

- Background: `oklch(1 0 0)`
- Surface: `oklch(0.982 0.003 260)`
- Surface raised: `oklch(0.955 0.006 260)`
- Ink: `oklch(0.18 0.018 260)`
- Muted ink: `oklch(0.46 0.018 260)`
- Primary: `oklch(0.45 0.15 260)`
- Accent: `oklch(0.72 0.14 78)`
- Border: `oklch(0.9 0.008 260)`

## Typography

Use a system sans stack for the entire product surface. The note editor uses the same family at a comfortable 16px to 18px size, with a monospace stack only for code blocks.

## Layout

Desktop uses three panes: tags, note list, editor. Tablet collapses tags into a drawer. Mobile uses one active pane at a time with sticky toolbar controls.

## Components

Buttons, icon buttons, inputs, list rows, tags, modals, toasts, skeletons, dropzones, and editor panels share the same 8px radius, clear focus rings, and restrained color use.

## Motion

Use short 150ms to 220ms transitions only for drawers, modals, hover states, selection, and toast feedback. Respect reduced motion.
