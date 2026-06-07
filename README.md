# Quicknote

Quicknote is a local-first, Simplenote-style notes app built with Bun, React, Zustand, and IndexedDB. It focuses on fast writing, searchable notes, tags, pins, Markdown preview, history, trash restore, import, export, and responsive layouts for desktop and mobile.

## Features

- Three-pane desktop layout with tags, note list, and editor.
- Mobile layout with focused list/editor navigation and a collapsible tag drawer.
- Local-first persistence through IndexedDB.
- Cross-tab state updates through BroadcastChannel.
- Create, edit, pin, tag, delete, and restore notes.
- Search notes by title, content, and tags.
- Sort notes by modified date, created date, or name.
- Markdown preview modes: Edit, Split, and Preview.
- Markdown task list rendering for `- [ ]` and `- [x]` items.
- KaTeX math rendering for inline and block formulas.
- Note history and text diff modal.
- Publish/share modal with local published route.
- Import JSON, TXT, Markdown, PDF helper, and ZIP archives.
- Export notes as JSON or ZIP.
- Keyboard shortcuts for common note actions.

## Tech Stack

- Runtime: Bun
- UI: React, Theme UI, Emotion
- Routing: wouter
- State: Zustand, zustand-mutative, mutative
- Storage: IndexedDB via `idb`
- Workers: Comlink with main-thread fallback
- Lists: React Virtuoso and TanStack Virtual
- Drag and drop: dnd-kit
- Markdown and math: snarkdown and KaTeX
- Files: zip.js, fflate, file-saver, react-dropzone, React PDF Viewer
- Feedback: react-hot-toast, react-modal, react-loading-skeleton
- Dates and shortcuts: dayjs, timeago.js, cronosjs, hotkeys-js

## Getting Started

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun dev
```

Open:

```text
http://localhost:3000/
```

Build for production:

```bash
bun run build
```

Run tests:

```bash
bun test
```

Run TypeScript checks:

```bash
bunx tsc --noEmit
```

## Data Storage

Notes are stored in the browser using IndexedDB under the Quicknote database. The app is local-first and does not connect to Simplenote or any external account service.

Export notes from the toolbar before clearing browser storage or moving to another device.

## Keyboard Shortcuts

- New note
- Search
- Toggle Markdown preview
- Insert checklist
- Open history
- Open share modal
- Delete note
- Focus editor

The shortcuts are registered in the app with `hotkeys-js`.

## Project Files

- `PRODUCT.md`: product context and UX principles.
- `DESIGN.md`: visual system, palette, typography, and layout direction.
- `src/App.tsx`: main application shell and UI.
- `src/store/notes.ts`: Zustand store, note actions, and persistence setup.
- `src/store/indexedDbStorage.ts`: IndexedDB-backed storage adapter.
- `src/workers/noteWorkerApi.ts`: Markdown, math, ZIP, diff, and PDF helper work.
- `src/lib/noteLogic.ts`: note creation, filtering, sorting, import, and export utilities.

## Limitations

- This is not connected to the official Simplenote service.
- There is no cloud sync, account login, or real-time collaboration backend yet.
- Attachments are not stored permanently. File packages are used for import, preview, and export helpers.
- Published note links are local browser routes unless a backend is added.

## Verification

Use these checks before shipping changes:

```bash
bun test
bunx tsc --noEmit
bun run build
```

