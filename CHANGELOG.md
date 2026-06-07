# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning while it is developed toward stable releases.

## [Unreleased]

### Added

- Added a Simplenote-style document information popover with synced, modified, created, word, and character details.
- Added an overflow actions menu for pin, Markdown, copy link, history, publish, collaborate, and trash actions.
- Added a Simplenote-style app drawer menu with All Notes, Trash, Settings, server status, Keyboard Shortcuts, Help, and About entries.
- Added a Keyboard Shortcuts modal covering View, Navigation, and Note Editing shortcuts.
- Added a command palette opened with `Ctrl + K`.
- Added a full Trash view with deleted-note list, read-only deleted note preview, restore, delete forever, and empty trash actions.
- Added a tabbed Settings dialog with Account, Display, and Tools sections.
- Added Display settings for note density, editor line length, sort order, tag sorting, and theme.
- Added bundled note fonts: System UI, Atkinson Hyperlegible, Inter, Source Serif, and Monospace.
- Added Display controls for editor font family and font size.
- Added Tools settings for import, export, keyboard shortcuts, and remote-change notifications.

### Changed

- Reworked the editor toolbar into compact icon actions for preview, checklist, document info, and more actions.
- Reworked the note-list header to match the compact Simplenote-style toolbar with icon-only new note and focus mode controls.
- Reworked the mobile editor into a Simplenote-style single toolbar with back, preview, checklist, info, and overflow actions.
- Reworked the hidden note-list state so the editor toolbar shows icon-only new note and show-list actions instead of a floating text button.
- Reworked the Settings dialog visual structure to match Simplenote-style tabbed panels and row controls.
- Reworked line length to use character-based sizing for a better notes reading measure.
- Reworked Trash from a modal into a Simplenote-style main view.

### Fixed

- Removed the duplicated notes-list hide/show control from the editor toolbar.
- Simplified the hidden-notes reveal button so it appears as a single compact `Notes` action.
- Fixed direct mobile note routes so `/note/:id` opens the editor pane instead of the note list.
- Fixed mobile Markdown notes opening in live preview by default. Mobile now opens notes in edit mode first.

### Documentation

- Replaced the default Bun template README with product documentation for Quicknote.
- Added this changelog using the Keep a Changelog structure.

## [0.1.0] - 2026-06-08

### Added

- Simplenote-style notes app shell with tag navigation, note list, and editor panes.
- Responsive desktop, tablet, and mobile layouts.
- Local-first persistence with IndexedDB.
- Zustand store for notes, tags, settings, history, trash, publishing, import, and export.
- Search, sorting, pins, tags, trash restore, settings, share, history, and import/export workflows.
- Markdown preview with Edit, Split, and Preview modes.
- Markdown task list rendering and KaTeX math rendering.
- ZIP and JSON export support.
- JSON, TXT, Markdown, ZIP, and PDF helper import flows.
- Worker API for Markdown rendering, diff generation, ZIP export, search helpers, and PDF helper text.
- Tests for note creation, updates, sorting, filtering, history, export, and import.

### Changed

- Reworked the initial Bun React template into a product-focused notes app.
- Tuned the UI toward a quiet, compact Simplenote-like interface.

### Fixed

- Fixed Markdown checklist preview so `- [ ]` and `- [x]` render as disabled checkboxes instead of malformed links.
- Fixed worker fallback handling so synchronous fallback rendering does not break Markdown preview.
- Fixed IndexedDB persistence to use the installed `idb` package.
