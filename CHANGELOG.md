# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows semantic versioning while it is developed toward stable releases.

## [Unreleased]

### Added

- Added a Simplenote-style document information popover with synced, modified, created, word, and character details.
- Added an overflow actions menu for pin, Markdown, copy link, history, publish, collaborate, and trash actions.

### Changed

- Reworked the editor toolbar into compact icon actions for preview, checklist, document info, and more actions.
- Reworked the note-list header to match the compact Simplenote-style toolbar with icon-only new note and focus mode controls.
- Reworked the mobile editor into a Simplenote-style single toolbar with back, preview, checklist, info, and overflow actions.
- Reworked the hidden note-list state so the editor toolbar shows icon-only new note and show-list actions instead of a floating text button.

### Fixed

- Removed the duplicated notes-list hide/show control from the editor toolbar.
- Simplified the hidden-notes reveal button so it appears as a single compact `Notes` action.
- Fixed direct mobile note routes so `/note/:id` opens the editor pane instead of the note list.

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
