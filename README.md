# Quicknote

Quicknote is a local-first, Simplenote-style notes app built with Bun, React, Zustand, IndexedDB, and a responsive desktop/mobile shell. It is designed for fast writing, quick search, lightweight organization, Markdown preview, note recovery, import/export, and keyboard-first navigation.

This app does not connect to the official Simplenote service. All data is stored in the browser unless exported by the user.

## Core Features

- Simplenote-style desktop layout with note list, editor, compact toolbar, and collapsible drawer.
- Mobile layout with single-pane list/editor navigation and touch-friendly controls.
- Local-first persistence through IndexedDB.
- Cross-tab update broadcasts through BroadcastChannel.
- Create, edit, delete, restore, and permanently remove notes.
- Folder/category organization with create, rename, delete, and drag-and-drop reorder.
- Folder-aware note creation: new notes inherit the active folder.
- Tags for flexible labels inside notes.
- Search by title, content, and tags.
- Sorting by modified date, created date, or title.
- Markdown preview modes: Edit, Split, and Preview.
- Markdown task list rendering for `- [ ]` and `- [x]`.
- KaTeX rendering for inline and block math.
- Note history and diff preview.
- Share/publish modal with local published routes.
- Import JSON, TXT, Markdown, PDF helper, and ZIP archives.
- Export notes as JSON or ZIP.
- Keyboard shortcuts and command palette.

## Organization Model

Quicknote separates folders, tags, and status markers:

- Folder: primary category for a note, such as Inbox, Work, Home, Projects, or Clients.
- Tag: lightweight labels, such as `#markdown`, `#meeting`, or `#draft`.
- Pin: keeps a note at the top of the list.
- Favorite: marks notes the user likes or wants to revisit.
- Important: marks notes that are sensitive, urgent, or high priority.

The drawer contains:

- All Notes
- Trash
- Settings
- Quick filters for Pinned, Favorites, and Important
- Folder manager with drag-and-drop ordering

## Folder Workflow

Create a folder from the drawer by typing a name in the folder field and pressing the plus button or Enter.

Rename a folder with the edit icon on the folder row.

Delete a folder with the close icon on the folder row. Notes inside the folder are not deleted; they are moved to No folder.

Reorder folders by dragging the handle at the left side of the folder row.

Move a note between folders from the editor footer folder selector on desktop. On mobile, folder selection and filtering stay in the drawer to keep the editor compact.

## Pin, Favorite, and Important

These markers are intentionally separate:

- Pin: controls list priority and keeps a note above unpinned notes.
- Favorite: marks a note as worth revisiting.
- Important: marks a note as priority or sensitive.

Desktop shows the three marker buttons in the editor toolbar and note list. Mobile keeps the editor toolbar compact and exposes the same controls through the More menu.

## Keyboard Shortcuts

View:

- `Ctrl + /`: Show keyboard shortcuts
- `Ctrl + K`: Show command palette
- `Ctrl + Shift + F`: Toggle focus mode
- `Ctrl + Shift + S`: Focus search field
- `Ctrl + G`: Jump to next match in note
- `Ctrl + Shift + G`: Jump to previous match in note

Navigation:

- `Ctrl + Shift + U`: Toggle tag/folder drawer
- `Ctrl + Shift + K`: Open note above current one
- `Ctrl + Shift + J`: Open note below current one
- `Ctrl + Shift + Y`: Toggle editing content/tags
- `Ctrl + Shift + L`: Toggle note list

Note editing:

- `Ctrl + Shift + I`: Create new note
- `Ctrl + Shift + P`: Toggle Markdown preview
- `Ctrl + Shift + C`: Insert checklist item

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

Quicknote stores notes, folders, settings, tags, history, publish state, and marker state in the browser using IndexedDB under the Quicknote database.

Export notes before clearing browser storage, changing browser profiles, or moving to another device.

## Project Files

- `PRODUCT.md`: product context and UX principles.
- `DESIGN.md`: visual system, palette, typography, and layout direction.
- `src/App.tsx`: main application shell, drawer, folder UI, note list, editor, modals, and shortcut handling.
- `src/store/notes.ts`: Zustand store, folder/note actions, persistence, migrations, and selectors.
- `src/store/indexedDbStorage.ts`: IndexedDB-backed storage adapter.
- `src/workers/noteWorkerApi.ts`: Markdown, math, ZIP, diff, and PDF helper work.
- `src/lib/noteLogic.ts`: note creation, filtering, sorting, import, export, and shared note/folder types.
- `src/lib/noteLogic.test.ts`: utility tests for note logic.

## Limitations

- No official Simplenote account integration.
- No cloud sync, authentication, or backend collaboration yet.
- Published note links are local browser routes unless a backend is added.
- Attachments are not stored permanently. File packages are used for import, preview, and export helpers.

## Verification

Run these checks before shipping changes:

```bash
bun test
bunx tsc --noEmit
bun run build
```
