import "@react-pdf-viewer/core/lib/styles/index.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/700.css";
import "katex/dist/katex.min.css";
import "react-loading-skeleton/dist/skeleton.css";
import { Global, ThemeProvider } from "@emotion/react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  mdiAlertCircle,
  mdiAlertCircleOutline,
  mdiArchiveArrowDownOutline,
  mdiArrowLeft,
  mdiCheck,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiCogOutline,
  mdiDeleteOutline,
  mdiDotsHorizontalCircleOutline,
  mdiDragVertical,
  mdiDownloadOutline,
  mdiEyeOutline,
  mdiFilePdfBox,
  mdiFolder,
  mdiFolderOutline,
  mdiFolderPlusOutline,
  mdiFormatListBulleted,
  mdiFormatListChecks,
  mdiInformationOutline,
  mdiKeyboardOutline,
  mdiMagnify,
  mdiMenu,
  mdiPin,
  mdiPinOutline,
  mdiPlus,
  mdiSquareEditOutline,
  mdiStar,
  mdiStarOutline,
  mdiUploadOutline,
  mdiViewSplitVertical,
  mdiWifi,
} from "@mdi/js";
import { Worker as PdfWorker, Viewer } from "@react-pdf-viewer/core";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import hotkeys from "hotkeys-js";
import { saveAs } from "file-saver";
import { format as timeagoFormat } from "timeago.js";
import Modal from "react-modal";
import { useDropzone } from "react-dropzone";
import Skeleton from "react-loading-skeleton";
import toast, { Toaster } from "react-hot-toast";
import { Virtuoso } from "react-virtuoso";
import { Route, Switch, useLocation } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { CronosExpression, validate as validateCron } from "cronosjs";
import { createNoteDraft, importNotesFromJson, type Folder, type HistoryEntry, type Note, type SortMode } from "@/lib/noteLogic";
import { getNoteWorker } from "@/workers/client";
import { selectSortedFolders, selectVisibleNotes, useNotesStore, type EditorFontFamily, type NoteDisplayMode, type Settings } from "@/store/notes";
import "./index.css";

Modal.setAppElement("#root");
dayjs.extend(relativeTime);

function Icon({ path, size = 1 }: { path: string; size?: number | string }) {
  const dimension = typeof size === "number" ? `${1.5 * size}rem` : size;
  return (
    <svg viewBox="0 0 24 24" width={dimension} height={dimension} aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

const theme = {
  colors: {
    background: "oklch(1 0 0)",
    surface: "oklch(0.982 0.003 260)",
    raised: "oklch(0.955 0.006 260)",
    text: "oklch(0.18 0.018 260)",
    muted: "oklch(0.46 0.018 260)",
    primary: "oklch(0.45 0.15 260)",
    accent: "oklch(0.72 0.14 78)",
    border: "oklch(0.9 0.008 260)",
  },
};

type ModalName = "share" | "history" | "settings" | "import" | "trash" | "shortcuts" | "command" | null;
type MobilePane = "list" | "editor";
type PreviewMode = "edit" | "split" | "preview";

const shortcutGroups = [
  {
    title: "View",
    items: [
      ["Ctrl + /", "Show keyboard shortcuts"],
      ["Ctrl + K", "Show command palette"],
      ["Ctrl + Shift + F", "Toggle focus mode"],
      ["Ctrl + Shift + S", "Focus search field"],
      ["Ctrl + G", "Jump to next match in note"],
      ["Ctrl + Shift + G", "Jump to previous match in note"],
    ],
  },
  {
    title: "Navigation",
    items: [
      ["Ctrl + Shift + U", "Toggle tag/folder drawer"],
      ["Ctrl + Shift + K", "Open note above current one"],
      ["Ctrl + Shift + J", "Open note below current one"],
      ["Ctrl + Shift + Y", "Toggle editing content/tags"],
      ["Ctrl + Shift + L", "Toggle note list (on narrow screens)"],
    ],
  },
  {
    title: "Note Editing",
    items: [
      ["Ctrl + Shift + I", "Create new note"],
      ["Ctrl + Shift + P", "Toggle Markdown preview"],
      ["Ctrl + Shift + C", "Insert checklist item"],
    ],
  },
];

function looksLikeMarkdown(content: string) {
  return /(^|\n)(#{1,6}\s|\s*[-*]\s|\s*[-*]\s\[[ xX]\]\s|>|`{3})|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\$\$?[^$]+\$\$?/.test(content);
}

function iconButtonLabel(label: string, path: string, onClick?: () => void, active = false) {
  return (
    <button className={`icon-button ${active ? "is-active" : ""}`} type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon path={path} size={0.82} />
    </button>
  );
}

function AppShell() {
  const [location, setLocation] = useLocation();
  const [modal, setModal] = useState<ModalName>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [noteListOpen, setNoteListOpen] = useState(true);
  const [isNarrow, setIsNarrow] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const state = useNotesStore();
  const isTrashView = state.selectedTag === "trash";
  const folders = useMemo(() => selectSortedFolders(state.folders), [state.folders]);
  const selectedFolder = folders.find(folder => folder.id === state.selectedFolderId);
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of state.notes) {
      if (!note.deletedAt && note.folderId) counts.set(note.folderId, (counts.get(note.folderId) || 0) + 1);
    }
    return counts;
  }, [state.notes]);
  const folderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleNotes = useMemo(() => {
    if (!isTrashView) return selectVisibleNotes(state);
    const query = state.query.trim().toLowerCase();
    return state.notes
      .filter(note => note.deletedAt)
      .filter(note => !query || [note.title, note.content, ...note.tags].join(" ").toLowerCase().includes(query))
      .sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
  }, [isTrashView, state.notes, state.query, state.selectedFolderId, state.selectedTag, state.settings.sortMode]);
  const deletedNotes = state.notes.filter(note => note.deletedAt);
  const selectedNote = isTrashView
    ? state.notes.find(note => note.id === state.selectedNoteId && note.deletedAt) || visibleNotes[0]
    : visibleNotes.find(note => note.id === state.selectedNoteId) || visibleNotes[0] || state.notes.find(note => !note.deletedAt);

  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const media = matchMedia("(max-width: 720px)");
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function applyTheme() {
      const nextTheme = state.settings.theme === "system" && typeof matchMedia !== "undefined"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : state.settings.theme;
      document.documentElement.dataset.theme = nextTheme;
    }
    applyTheme();
    if (state.settings.theme !== "system" || typeof matchMedia === "undefined") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [state.settings.theme]);

  useEffect(() => {
    const unsubscribe = useNotesStore.subscribe(current => {
      if (typeof BroadcastChannel === "undefined") return;
      const channel = new BroadcastChannel("quicknote-sync");
      channel.postMessage({ type: "updated", notes: current.notes, folders: current.folders, settings: current.settings });
      channel.close();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.settings.keyboardShortcuts) return;
    hotkeys("ctrl+/", event => {
      event.preventDefault();
      setModal("shortcuts");
    });
    hotkeys("ctrl+k", event => {
      event.preventDefault();
      setModal("command");
    });
    hotkeys("ctrl+shift+i,command+n", event => {
      event.preventDefault();
      createNote();
      toast.success("New note created");
    });
    hotkeys("ctrl+shift+s,command+l", event => {
      event.preventDefault();
      searchRef.current?.focus();
    });
    hotkeys("ctrl+g", event => {
      event.preventDefault();
      jumpMatch(1);
    });
    hotkeys("ctrl+shift+g", event => {
      event.preventDefault();
      jumpMatch(-1);
    });
    hotkeys("ctrl+shift+u", event => {
      event.preventDefault();
      setSidebarOpen(value => !value);
    });
    hotkeys("ctrl+shift+k", event => {
      event.preventDefault();
      selectRelativeNote(-1);
    });
    hotkeys("ctrl+shift+j", event => {
      event.preventDefault();
      selectRelativeNote(1);
    });
    hotkeys("ctrl+shift+y", event => {
      event.preventDefault();
      toggleContentTagsFocus();
    });
    hotkeys("ctrl+shift+l", event => {
      event.preventDefault();
      setNoteListOpen(value => !value);
    });
    hotkeys("ctrl+shift+p", event => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("quicknote-toggle-preview"));
    });
    hotkeys("ctrl+shift+c", event => {
      event.preventDefault();
      insertChecklist();
    });
    hotkeys("ctrl+h", event => {
      event.preventDefault();
      setModal("history");
    });
    hotkeys("ctrl+shift+f", event => {
      event.preventDefault();
      state.replaceSettings({ focusMode: !state.settings.focusMode });
    });
    return () => hotkeys.unbind("ctrl+/,ctrl+k,ctrl+shift+i,command+n,ctrl+shift+s,command+l,ctrl+g,ctrl+shift+g,ctrl+shift+u,ctrl+shift+k,ctrl+shift+j,ctrl+shift+y,ctrl+shift+l,ctrl+shift+p,ctrl+shift+c,ctrl+h,ctrl+shift+f");
  }, [selectedNote?.id, state.query, state.settings.focusMode, state.settings.keyboardShortcuts, state.selectedFolderId, state.selectedTag, visibleNotes]);

  useEffect(() => {
    const match = location.match(/^\/note\/(.+)$/);
    if (match?.[1] && state.notes.some(note => note.id === match[1])) {
      state.selectNote(match[1]);
      setMobilePane("editor");
    }
    if (location === "/settings") setModal("settings");
  }, [location, state.notes.length]);

  function createNote() {
    const specialViews = new Set(["all", "trash", "pinned", "favorites", "important"]);
    const tags = specialViews.has(state.selectedTag) ? [] : [state.selectedTag];
    const id = state.createNote("", tags, isTrashView ? null : state.selectedFolderId);
    if (state.selectedTag === "pinned") state.togglePin(id);
    if (state.selectedTag === "favorites") state.toggleFavorite(id);
    if (state.selectedTag === "important") state.toggleImportant(id);
    if (isTrashView) state.setSelectedTag("all");
    setLocation(`/note/${id}`);
    setMobilePane("editor");
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function selectNote(note: Note) {
    state.selectNote(note.id);
    setLocation(`/note/${note.id}`);
    setMobilePane("editor");
  }

  function selectRelativeNote(direction: -1 | 1) {
    if (!selectedNote || visibleNotes.length === 0) return;
    const index = visibleNotes.findIndex(note => note.id === selectedNote.id);
    const next = visibleNotes[Math.min(Math.max((index < 0 ? 0 : index) + direction, 0), visibleNotes.length - 1)];
    if (next) selectNote(next);
  }

  function jumpMatch(direction: -1 | 1) {
    if (!selectedNote) return;
    const query = state.query.trim();
    if (!query) {
      toast.error("Search query is empty");
      searchRef.current?.focus();
      return;
    }
    setMobilePane("editor");
    requestAnimationFrame(() => {
      const element = editorRef.current;
      if (!element) {
        toast.error("Open edit mode to jump matches");
        return;
      }
      const haystack = selectedNote.content.toLowerCase();
      const needle = query.toLowerCase();
      const start = direction > 0 ? element.selectionEnd : Math.max(element.selectionStart - 1, 0);
      let index = direction > 0 ? haystack.indexOf(needle, start) : haystack.lastIndexOf(needle, start);
      if (index < 0) index = direction > 0 ? haystack.indexOf(needle) : haystack.lastIndexOf(needle);
      if (index >= 0) {
        element.focus();
        element.setSelectionRange(index, index + query.length);
      } else {
        toast.error("No match in note");
      }
    });
  }

  function toggleContentTagsFocus() {
    const active = document.activeElement;
    if (active === tagInputRef.current) {
      editorRef.current?.focus();
    } else {
      tagInputRef.current?.focus();
    }
  }

  function insertChecklist() {
    if (!selectedNote) return;
    const element = editorRef.current;
    const insertion = "- [ ] ";
    if (!element) {
      state.updateNote(selectedNote.id, `${selectedNote.content}\n${insertion}`);
      return;
    }
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const next = `${selectedNote.content.slice(0, start)}${insertion}${selectedNote.content.slice(end)}`;
    state.updateNote(selectedNote.id, next);
    requestAnimationFrame(() => element.setSelectionRange(start + insertion.length, start + insertion.length));
  }

  function saveTags() {
    if (!selectedNote) return;
    state.setTags(selectedNote.id, tagDraft.split(","));
    setTagDraft("");
    toast.success("Tags updated");
  }

  function createFolder() {
    const name = folderDraft.trim();
    if (!name) {
      toast.error("Folder name is empty");
      return;
    }
    state.createFolder(name);
    setFolderDraft("");
    setSidebarOpen(true);
    toast.success("Folder created");
  }

  function startRenameFolder(folder: Folder) {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  }

  function saveFolderRename(folderId: string) {
    if (!editingFolderName.trim()) {
      toast.error("Folder name is empty");
      return;
    }
    state.renameFolder(folderId, editingFolderName);
    setEditingFolderId(null);
    setEditingFolderName("");
    toast.success("Folder renamed");
  }

  function removeFolder(folder: Folder) {
    const count = folderCounts.get(folder.id) || 0;
    const message = count > 0
      ? `Delete "${folder.name}"? ${count} notes will move to No folder.`
      : `Delete "${folder.name}"?`;
    if (!globalThis.confirm(message)) return;
    state.deleteFolder(folder.id);
    toast.success("Folder deleted");
  }

  function selectFolder(folder: Folder) {
    state.setSelectedFolder(folder.id);
    setSidebarOpen(false);
    setMobilePane("list");
  }

  function selectSpecialView(tag: string) {
    state.setSelectedTag(tag);
    setSidebarOpen(false);
    setMobilePane("list");
  }

  function onFolderDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : "";
    if (overId && activeId !== overId) state.reorderFolder(activeId, overId);
  }

  const currentViewTitle =
    selectedFolder ? selectedFolder.name :
      state.selectedTag === "all" ? "All Notes" :
        state.selectedTag === "pinned" ? "Pinned" :
          state.selectedTag === "favorites" ? "Favorites" :
            state.selectedTag === "important" ? "Important" :
              state.selectedTag === "trash" ? "Trash" : `#${state.selectedTag}`;

  function openTrash() {
    state.setSelectedTag("trash");
    const firstDeleted = state.notes.find(note => note.deletedAt);
    if (firstDeleted) state.selectNote(firstDeleted.id);
    setSidebarOpen(false);
    setMobilePane("list");
  }

  function restoreSelectedNote() {
    if (!selectedNote) return;
    state.restoreNote(selectedNote.id);
    toast.success("Note restored");
    const nextDeleted = deletedNotes.find(note => note.id !== selectedNote.id);
    if (nextDeleted) state.selectNote(nextDeleted.id);
    else state.setSelectedTag("all");
  }

  function deleteSelectedForever() {
    if (!selectedNote) return;
    const nextDeleted = deletedNotes.find(note => note.id !== selectedNote.id);
    state.deleteForever(selectedNote.id);
    toast.success("Note deleted forever");
    if (nextDeleted) state.selectNote(nextDeleted.id);
    else state.setSelectedTag("all");
  }

  function emptyTrash() {
    state.emptyTrash();
    state.setSelectedTag("all");
    toast.success("Trash emptied");
  }

  async function exportAllNotes() {
    const bytes = await getNoteWorker().exportZip(state.notes.filter(note => !note.deletedAt));
    saveAs(new Blob([bytes], { type: "application/zip" }), "quicknote-export.zip");
    toast.success("Export downloaded");
  }

  const commandActions = [
    { label: "Create new note", shortcut: "Ctrl + Shift + I", action: createNote },
    { label: "Focus search field", shortcut: "Ctrl + Shift + S", action: () => searchRef.current?.focus() },
    { label: "Toggle focus mode", shortcut: "Ctrl + Shift + F", action: () => state.replaceSettings({ focusMode: !state.settings.focusMode }) },
    { label: "Toggle tag/folder drawer", shortcut: "Ctrl + Shift + U", action: () => setSidebarOpen(value => !value) },
    { label: "Toggle note list", shortcut: "Ctrl + Shift + L", action: () => setNoteListOpen(value => !value) },
    { label: "Open folder manager", shortcut: "", action: () => setSidebarOpen(true) },
    { label: "Keyboard shortcuts", shortcut: "Ctrl + /", action: () => setModal("shortcuts") },
    { label: "Settings", shortcut: "", action: () => setModal("settings") },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Global styles={{ body: { margin: 0 } }} />
      <div className={`app-shell display-${state.settings.noteDisplay} line-${state.settings.lineLength} ${state.settings.focusMode ? "is-focus-mode" : ""} ${sidebarOpen ? "sidebar-open" : ""} ${noteListOpen ? "" : "note-list-hidden"}`}>
        <Toaster position="bottom-right" />
        {mobilePane !== "editor" ? (
          <MobileTopBar
            pane={mobilePane}
            setPane={setMobilePane}
            title={currentViewTitle}
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(value => !value)}
            createNote={createNote}
            openSettings={() => setModal("settings")}
          />
        ) : null}
        {sidebarOpen ? <button className="sidebar-backdrop" type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={`tag-pane ${sidebarOpen ? "mobile-open" : ""}`}>
          <div className="app-menu-main">
            <button className={`tag-row ${state.selectedTag === "all" && !state.selectedFolderId ? "selected" : ""}`} type="button" onClick={() => selectSpecialView("all")}>
              <Icon path={mdiArchiveArrowDownOutline} size={0.75} /> All Notes
            </button>
            <button className={`tag-row ${state.selectedTag === "trash" ? "selected" : ""}`} type="button" onClick={openTrash}>
              <Icon path={mdiDeleteOutline} size={0.75} /> Trash
              {deletedNotes.length > 0 ? <span className="count-pill">{deletedNotes.length}</span> : null}
            </button>
            <button className="tag-row" type="button" onClick={() => { setModal("settings"); setSidebarOpen(false); }}>
              <Icon path={mdiCogOutline} size={0.75} /> Settings
            </button>
          </div>
          <div className="sidebar-scroll">
            <section className="sidebar-section">
              <p className="sidebar-section-title">Quick filters</p>
              <button className={`tag-row compact ${state.selectedTag === "pinned" ? "selected" : ""}`} type="button" onClick={() => selectSpecialView("pinned")}>
                <Icon path={mdiPinOutline} size={0.72} /> Pinned
                <span className="count-pill">{state.notes.filter(note => !note.deletedAt && note.isPinned).length}</span>
              </button>
              <button className={`tag-row compact ${state.selectedTag === "favorites" ? "selected" : ""}`} type="button" onClick={() => selectSpecialView("favorites")}>
                <Icon path={mdiStarOutline} size={0.72} /> Favorites
                <span className="count-pill">{state.notes.filter(note => !note.deletedAt && note.isFavorite).length}</span>
              </button>
              <button className={`tag-row compact ${state.selectedTag === "important" ? "selected" : ""}`} type="button" onClick={() => selectSpecialView("important")}>
                <Icon path={mdiAlertCircleOutline} size={0.72} /> Important
                <span className="count-pill">{state.notes.filter(note => !note.deletedAt && note.isImportant).length}</span>
              </button>
            </section>
            <section className="sidebar-section">
              <div className="folder-section-head">
                <p className="sidebar-section-title">Folders</p>
                <Icon path={mdiFolderPlusOutline} size={0.72} />
              </div>
              <form className="folder-create-form" onSubmit={event => { event.preventDefault(); createFolder(); }}>
                <input value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="New folder" maxLength={48} />
                <button type="submit" aria-label="Create folder">
                  <Icon path={mdiPlus} size={0.68} />
                </button>
              </form>
              <DndContext sensors={folderSensors} collisionDetection={closestCenter} onDragEnd={onFolderDragEnd}>
                <SortableContext items={folders.map(folder => folder.id)} strategy={verticalListSortingStrategy}>
                  <div className="folder-list">
                    {folders.map(folder => (
                      <FolderNavItem
                        key={folder.id}
                        folder={folder}
                        count={folderCounts.get(folder.id) || 0}
                        selected={state.selectedFolderId === folder.id}
                        editing={editingFolderId === folder.id}
                        editValue={editingFolderName}
                        onEditChange={setEditingFolderName}
                        onSelect={() => selectFolder(folder)}
                        onStartEdit={() => startRenameFolder(folder)}
                        onCancelEdit={() => { setEditingFolderId(null); setEditingFolderName(""); }}
                        onSaveEdit={() => saveFolderRename(folder.id)}
                        onDelete={() => removeFolder(folder)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          </div>
          <div className="sidebar-footer">
            <div className="server-status"><Icon path={mdiWifi} size={0.72} /> Server connection</div>
            <button type="button" onClick={() => { setModal("shortcuts"); setSidebarOpen(false); }}>
              Keyboard Shortcuts
            </button>
            <button type="button" onClick={() => toast("Quicknote is a local-first notes app.")}>
              Help & Support&nbsp;&nbsp; About
            </button>
          </div>
        </aside>
        <section className={`note-list-pane ${mobilePane === "list" ? "mobile-open" : ""}`} aria-hidden={!noteListOpen && mobilePane !== "list"}>
          <div className="list-toolbar">
            {iconButtonLabel("Menu", mdiMenu, () => setSidebarOpen(value => !value), sidebarOpen)}
            <strong className="list-title">{currentViewTitle}</strong>
            <div className="list-toolbar-actions">
              {isTrashView ? null : iconButtonLabel("New note", mdiSquareEditOutline, createNote)}
              {iconButtonLabel("Toggle focus mode", mdiViewSplitVertical, () => state.replaceSettings({ focusMode: !state.settings.focusMode }), state.settings.focusMode)}
              {iconButtonLabel("Hide notes list", mdiChevronLeft, () => setNoteListOpen(false))}
            </div>
          </div>
          <div className="search-row">
            <Icon path={mdiMagnify} size={0.8} />
            <input ref={searchRef} value={state.query} onChange={event => state.setQuery(event.target.value)} placeholder={selectedFolder ? `Search ${selectedFolder.name}` : "Search all notes and tags"} />
            <select aria-label="Sort notes" value={state.settings.sortMode} onChange={event => state.replaceSettings({ sortMode: event.target.value as SortMode })}>
              <option value="modified-desc">Modified: Newest</option>
              <option value="modified-asc">Modified: Oldest</option>
              <option value="created-desc">Created: Newest</option>
              <option value="created-asc">Created: Oldest</option>
              <option value="name-asc">Name: A-Z</option>
              <option value="name-desc">Name: Z-A</option>
            </select>
          </div>
          {visibleNotes.length === 0 ? (
            <div className="empty-state">{isTrashView ? "Trash is empty." : "No notes match this view."}</div>
          ) : (
            <Virtuoso
              className="virtuoso-list"
              data={visibleNotes}
              itemContent={(_, note) => (
                <NoteListItem
                  note={note}
                  selected={note.id === selectedNote?.id}
                  previewLines={state.settings.previewLines}
                  folderName={folders.find(folder => folder.id === note.folderId)?.name}
                  onSelect={() => selectNote(note)}
                  onPin={() => state.togglePin(note.id)}
                  onFavorite={() => state.toggleFavorite(note.id)}
                  onImportant={() => state.toggleImportant(note.id)}
                  isTrashView={isTrashView}
                />
              )}
            />
          )}
          {isTrashView && deletedNotes.length > 0 ? (
            <button className="empty-trash-button" type="button" onClick={emptyTrash}>Empty Trash</button>
          ) : null}
        </section>
        <main className={`editor-pane ${mobilePane === "editor" ? "mobile-open" : ""}`}>
          <Switch>
            <Route path="/published/:slug">
              {params => <PublishedView note={state.notes.find(note => note.shareSlug === params.slug)} />}
            </Route>
            <Route>
              {selectedNote ? (
                <Editor
                  note={selectedNote}
                  settings={state.settings}
                  editorRef={editorRef}
                  setModal={setModal}
                  updateContent={content => state.updateNote(selectedNote.id, content)}
                  togglePin={() => state.togglePin(selectedNote.id)}
                  toggleFavorite={() => state.toggleFavorite(selectedNote.id)}
                  toggleImportant={() => state.toggleImportant(selectedNote.id)}
                  toggleMarkdown={() => state.toggleMarkdown(selectedNote.id)}
                  moveNoteToFolder={folderId => state.moveNoteToFolder(selectedNote.id, folderId)}
                  deleteNote={() => {
                    state.deleteNote(selectedNote.id);
                    toast.success("Note moved to trash");
                  }}
                  insertChecklist={insertChecklist}
                  tagDraft={tagDraft}
                  setTagDraft={setTagDraft}
                  saveTags={saveTags}
                  togglePublish={() => selectedNote.isPublished ? state.unpublishNote(selectedNote.id) : state.publishNote(selectedNote.id)}
                  onBackToList={() => setMobilePane("list")}
                  noteListOpen={noteListOpen}
                  showNoteList={() => setNoteListOpen(true)}
                  createNote={createNote}
                  isTrashView={isTrashView}
                  restoreNote={restoreSelectedNote}
                  deleteForever={deleteSelectedForever}
                  isNarrow={isNarrow}
                  tagInputRef={tagInputRef}
                  folders={folders}
                />
              ) : (
                <div className="editor-empty">{isTrashView ? "Select a deleted note." : <Skeleton count={5} />}</div>
              )}
            </Route>
          </Switch>
        </main>
        <ShareModal note={selectedNote} isOpen={modal === "share"} onClose={() => setModal(null)} />
        <HistoryModal note={selectedNote} isOpen={modal === "history"} onClose={() => setModal(null)} />
        <SettingsModal
          settings={state.settings}
          isOpen={modal === "settings"}
          onClose={() => setModal(null)}
          onChange={state.replaceSettings}
          onImport={() => setModal("import")}
          onExport={exportAllNotes}
        />
        <ShortcutsModal isOpen={modal === "shortcuts"} onClose={() => setModal(null)} />
        <CommandPaletteModal isOpen={modal === "command"} onClose={() => setModal(null)} commands={commandActions} />
        <ImportModal isOpen={modal === "import"} onClose={() => setModal(null)} />
      </div>
    </ThemeProvider>
  );
}

function MobileTopBar({
  pane,
  setPane,
  title,
  sidebarOpen,
  toggleSidebar,
  createNote,
  openSettings,
}: {
  pane: MobilePane;
  setPane: (pane: MobilePane) => void;
  title: string;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  createNote: () => void;
  openSettings: () => void;
}) {
  return (
    <header className="mobile-topbar">
      {iconButtonLabel("Menu", mdiMenu, toggleSidebar, sidebarOpen)}
      <button type="button" className="mobile-tab" onClick={() => setPane("list")}>
        {title}
      </button>
      <button type="button" className="mobile-tab" onClick={() => setPane("editor")}>
        Editor
      </button>
      {iconButtonLabel("New note", mdiSquareEditOutline, createNote)}
      {iconButtonLabel("Settings", mdiCogOutline, openSettings)}
    </header>
  );
}

function FolderNavItem({
  folder,
  count,
  selected,
  editing,
  editValue,
  onEditChange,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  folder: Folder;
  count: number;
  selected: boolean;
  editing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`folder-row ${selected ? "selected" : ""} ${isDragging ? "is-dragging" : ""}`}>
      <button className="folder-drag" type="button" aria-label={`Drag ${folder.name}`} {...attributes} {...listeners}>
        <Icon path={mdiDragVertical} size={0.62} />
      </button>
      {editing ? (
        <form className="folder-edit-form" onSubmit={event => { event.preventDefault(); onSaveEdit(); }}>
          <input value={editValue} onChange={event => onEditChange(event.target.value)} autoFocus maxLength={48} />
          <button type="submit" aria-label="Save folder">
            <Icon path={mdiCheck} size={0.62} />
          </button>
          <button type="button" aria-label="Cancel folder edit" onClick={onCancelEdit}>
            <Icon path={mdiClose} size={0.62} />
          </button>
        </form>
      ) : (
        <>
          <button className="folder-main" type="button" onClick={onSelect}>
            <Icon path={selected ? mdiFolder : mdiFolderOutline} size={0.72} />
            <span>{folder.name}</span>
            <em>{count}</em>
          </button>
          <button className="folder-mini-action" type="button" aria-label={`Rename ${folder.name}`} onClick={onStartEdit}>
            <Icon path={mdiSquareEditOutline} size={0.6} />
          </button>
          <button className="folder-mini-action danger" type="button" aria-label={`Delete ${folder.name}`} onClick={onDelete}>
            <Icon path={mdiClose} size={0.6} />
          </button>
        </>
      )}
    </div>
  );
}

function NoteListItem({
  note,
  selected,
  previewLines,
  folderName,
  onSelect,
  onPin,
  onFavorite,
  onImportant,
  isTrashView = false,
}: {
  note: Note;
  selected: boolean;
  previewLines: number;
  folderName?: string;
  onSelect: () => void;
  onPin: () => void;
  onFavorite: () => void;
  onImportant: () => void;
  isTrashView?: boolean;
}) {
  return (
    <article className={`note-list-item ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="note-list-title">
        <span>{note.title}</span>
        {!isTrashView ? (
          <div className="note-mark-buttons">
            <button type="button" className={note.isPinned ? "active" : ""} aria-label="Toggle pin" onClick={event => { event.stopPropagation(); onPin(); }}>
              <Icon path={note.isPinned ? mdiPin : mdiPinOutline} size={0.62} />
            </button>
            <button type="button" className={note.isFavorite ? "active favorite" : ""} aria-label="Toggle favorite" onClick={event => { event.stopPropagation(); onFavorite(); }}>
              <Icon path={note.isFavorite ? mdiStar : mdiStarOutline} size={0.62} />
            </button>
            <button type="button" className={note.isImportant ? "active important" : ""} aria-label="Toggle important" onClick={event => { event.stopPropagation(); onImportant(); }}>
              <Icon path={note.isImportant ? mdiAlertCircle : mdiAlertCircleOutline} size={0.62} />
            </button>
          </div>
        ) : null}
      </div>
      <p style={{ WebkitLineClamp: previewLines }}>{note.content.replace(/\s+/g, " ") || "Empty note"}</p>
      <div className="note-meta">
        <span>{isTrashView && note.deletedAt ? `Deleted ${timeagoFormat(note.deletedAt)}` : timeagoFormat(note.updatedAt)}</span>
        {folderName ? <span className="folder-chip"><Icon path={mdiFolderOutline} size={0.55} /> {folderName}</span> : null}
        {note.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
      </div>
    </article>
  );
}

function Editor(props: {
  note: Note;
  settings: Settings;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  setModal: (modal: ModalName) => void;
  updateContent: (content: string) => void;
  togglePin: () => void;
  toggleFavorite: () => void;
  toggleImportant: () => void;
  toggleMarkdown: () => void;
  moveNoteToFolder: (folderId: string | null) => void;
  deleteNote: () => void;
  insertChecklist: () => void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  saveTags: () => void;
  togglePublish: () => void;
  onBackToList: () => void;
  noteListOpen: boolean;
  showNoteList: () => void;
  createNote: () => void;
  isTrashView: boolean;
  restoreNote: () => void;
  deleteForever: () => void;
  isNarrow: boolean;
  tagInputRef: RefObject<HTMLInputElement | null>;
  folders: Folder[];
}) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(props.isNarrow ? "edit" : props.note.isMarkdown || looksLikeMarkdown(props.note.content) ? "split" : "edit");
  const [infoOpen, setInfoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(getNoteWorker().renderMarkdown(props.note.content))
      .then(html => {
        if (!cancelled) setPreviewHtml(html);
      });
    return () => {
      cancelled = true;
    };
  }, [props.note.content]);

  useEffect(() => {
    setPreviewMode(props.isNarrow ? "edit" : props.note.isMarkdown || looksLikeMarkdown(props.note.content) ? "split" : "edit");
    setInfoOpen(false);
    setMoreOpen(false);
  }, [props.note.id, props.isNarrow]);

  const words = props.note.content.trim() ? props.note.content.trim().split(/\s+/).length : 0;
  const characters = props.note.content.length;
  const publishedSlug = props.note.shareSlug || `${props.note.id.slice(0, 8)}-${props.note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const internalLink = `${globalThis.location.origin}/note/${props.note.id}`;
  const publishedLink = `${globalThis.location.origin}/published/${publishedSlug}`;

  function copyText(value: string, message: string) {
    if (!navigator.clipboard) {
      toast.error("Clipboard unavailable");
      return;
    }
    void navigator.clipboard.writeText(value).then(() => toast.success(message)).catch(() => toast.error("Copy failed"));
  }

  function togglePreview() {
    if (previewMode === "edit") {
      if (!props.note.isMarkdown) props.toggleMarkdown();
      setPreviewMode("split");
    } else {
      setPreviewMode("edit");
    }
  }

  useEffect(() => {
    function handleTogglePreview() {
      if (!props.isTrashView) togglePreview();
    }
    window.addEventListener("quicknote-toggle-preview", handleTogglePreview);
    return () => window.removeEventListener("quicknote-toggle-preview", handleTogglePreview);
  });

  function closeMenus() {
    setInfoOpen(false);
    setMoreOpen(false);
  }

  return (
    <>
      <div className={`editor-toolbar ${props.noteListOpen ? "" : "is-note-list-hidden"}`}>
        {!props.noteListOpen ? (
          <div className="hidden-list-actions">
            {iconButtonLabel("New note", mdiSquareEditOutline, props.createNote)}
            {iconButtonLabel("Show notes list", mdiViewSplitVertical, props.showNoteList)}
          </div>
        ) : null}
        <button className="mobile-editor-back" type="button" aria-label="Back to notes" onClick={props.onBackToList}>
          <Icon path={mdiArrowLeft} size={0.8} />
        </button>
        {props.isTrashView ? (
          <div className="trash-note-actions">
            <button className="danger-outline-action" type="button" onClick={props.deleteForever}>Delete Forever</button>
            <button className="restore-note-action" type="button" onClick={props.restoreNote}>Restore Note</button>
          </div>
        ) : (
          <>
            <div className="editor-title">
              <strong>{props.note.title}</strong>
              <span>{dayjs(props.note.updatedAt).fromNow?.() || dayjs(props.note.updatedAt).format("MMM D")}</span>
            </div>
            <div className="toolbar-actions">
          <div className="note-status-actions">
            {iconButtonLabel("Pin to top", props.note.isPinned ? mdiPin : mdiPinOutline, props.togglePin, props.note.isPinned)}
            {iconButtonLabel("Favorite", props.note.isFavorite ? mdiStar : mdiStarOutline, props.toggleFavorite, props.note.isFavorite)}
            {iconButtonLabel("Important", props.note.isImportant ? mdiAlertCircle : mdiAlertCircleOutline, props.toggleImportant, props.note.isImportant)}
          </div>
          {iconButtonLabel(previewMode === "edit" ? "Show preview" : "Hide preview", mdiEyeOutline, togglePreview, previewMode !== "edit")}
          {iconButtonLabel("Insert checklist", mdiFormatListChecks, props.insertChecklist)}
          <div className="toolbar-popover-wrap">
            {iconButtonLabel("Document info", mdiInformationOutline, () => {
              setInfoOpen(value => !value);
              setMoreOpen(false);
            }, infoOpen)}
            {infoOpen ? (
              <section className="document-info-popover" role="dialog" aria-label="Document information">
                <header>
                  <strong>Document</strong>
                  <button type="button" aria-label="Close document info" onClick={() => setInfoOpen(false)}>
                    <Icon path={mdiClose} size={0.7} />
                  </button>
                </header>
                <dl>
                  <div><dt>Last synced</dt><dd>{dayjs(props.note.updatedAt).format("MMM D, YYYY, h:mm A")}</dd></div>
                  <div><dt>Modified</dt><dd>{dayjs(props.note.updatedAt).format("MMM D, YYYY, h:mm A")}</dd></div>
                  <div><dt>Created</dt><dd>{dayjs(props.note.createdAt).format("MMM D, YYYY, h:mm A")}</dd></div>
                  <div><dt>Words</dt><dd>{words}</dd></div>
                  <div><dt>Characters</dt><dd>{characters}</dd></div>
                </dl>
              </section>
            ) : null}
          </div>
          <div className="toolbar-popover-wrap">
            {iconButtonLabel("More actions", mdiDotsHorizontalCircleOutline, () => {
              setMoreOpen(value => !value);
              setInfoOpen(false);
            }, moreOpen)}
            {moreOpen ? (
              <div className="more-menu-popover" role="menu" aria-label="More note actions">
                <label className="menu-check">
                  <span>Pin to top</span>
                  <input type="checkbox" checked={props.note.isPinned} onChange={props.togglePin} />
                </label>
                <label className="menu-check">
                  <span>Favorite</span>
                  <input type="checkbox" checked={props.note.isFavorite} onChange={props.toggleFavorite} />
                </label>
                <label className="menu-check">
                  <span>Important</span>
                  <input type="checkbox" checked={props.note.isImportant} onChange={props.toggleImportant} />
                </label>
                <label className="menu-check">
                  <span>Markdown</span>
                  <input type="checkbox" checked={props.note.isMarkdown} onChange={props.toggleMarkdown} />
                </label>
                <button type="button" role="menuitem" onClick={() => copyText(internalLink, "Internal link copied")}>Copy Internal Link</button>
                <button type="button" role="menuitem" disabled={props.note.history.length === 0} onClick={() => { closeMenus(); props.setModal("history"); }}>History</button>
                <hr />
                <label className="menu-check">
                  <span>Publish</span>
                  <input type="checkbox" checked={props.note.isPublished} onChange={props.togglePublish} />
                </label>
                <button type="button" role="menuitem" disabled={!props.note.isPublished} onClick={() => copyText(publishedLink, "Published link copied")}>Copy Link</button>
                <button type="button" role="menuitem" onClick={() => { closeMenus(); props.setModal("share"); }}>Collaborate...</button>
                <hr />
                <button type="button" role="menuitem" className="danger-menu-item" onClick={() => { closeMenus(); props.deleteNote(); }}>Move to Trash</button>
              </div>
            ) : null}
          </div>
            </div>
          </>
        )}
      </div>
      {props.isTrashView ? (
        <article className="trash-note-view" data-font={props.settings.editorFontFamily} style={{ fontSize: props.settings.editorFontSize }}>
          {props.note.content.split(/\r?\n/).map((line, index) => line ? <p key={index}>{line}</p> : <br key={index} />)}
        </article>
      ) : <div className={`editor-workspace preview-${previewMode}`}>
        {previewMode !== "preview" ? (
          <textarea
            ref={props.editorRef}
            value={props.note.content}
            onChange={event => props.updateContent(event.target.value)}
            style={{ fontSize: props.settings.editorFontSize }}
            data-font={props.settings.editorFontFamily}
            placeholder="Start typing..."
          />
        ) : null}
        {previewMode !== "edit" ? (
          <section
            className="markdown-preview"
            data-font={props.settings.editorFontFamily}
            style={{ fontSize: props.settings.editorFontSize }}
            dangerouslySetInnerHTML={{ __html: previewHtml || "<p>Preview will appear here.</p>" }}
          />
        ) : null}
      </div>}
      {!props.isTrashView ? <div className="tag-editor tag-editor-bottom">
        <div className="tag-chips">{props.note.tags.length ? props.note.tags.map(tag => <span key={tag}>#{tag}</span>) : <span>No tags</span>}</div>
        <select aria-label="Move note to folder" value={props.note.folderId || ""} onChange={event => props.moveNoteToFolder(event.target.value || null)}>
          <option value="">No folder</option>
          {props.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <input ref={props.tagInputRef} value={props.tagDraft} onChange={event => props.setTagDraft(event.target.value)} placeholder="Add tags, comma separated" />
        <button type="button" onClick={props.saveTags}>Save tags</button>
      </div> : null}
    </>
  );
}

function PublishedView({ note }: { note?: Note }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    if (!note) return;
    Promise.resolve(getNoteWorker().renderMarkdown(note.content)).then(setHtml);
  }, [note?.id, note?.content]);

  if (!note || !note.isPublished) return <div className="published-note">Published note not found.</div>;
  return (
    <article className="published-note">
      <h1>{note.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: note.isMarkdown ? html : note.content.replace(/\n/g, "<br />") }} />
    </article>
  );
}

function ShareModal({ note, isOpen, onClose }: { note?: Note; isOpen: boolean; onClose: () => void }) {
  const publish = useNotesStore(state => state.publishNote);
  const unpublish = useNotesStore(state => state.unpublishNote);
  const addCollaborator = useNotesStore(state => state.addCollaborator);
  const [email, setEmail] = useState("");
  if (!note) return null;
  const link = `${location.origin}/published/${note.shareSlug || `${note.id.slice(0, 8)}-${note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}`;
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Share note">
      <div className="modal-stack">
        <p>Publish a view-only link or add collaborator emails for local tracking.</p>
        <div className="share-link">{note.isPublished ? link : "Publish this note to create a local link."}</div>
        <div className="modal-actions">
          <button type="button" onClick={() => { publish(note.id); toast.success("Note published"); }}>Publish note</button>
          <button type="button" onClick={() => unpublish(note.id)}>Unpublish</button>
        </div>
        <div className="inline-form">
          <input value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" />
          <button type="button" onClick={() => { addCollaborator(note.id, email); setEmail(""); }}>Add collaborator</button>
        </div>
        <div className="tag-chips">{note.collaborators.map(item => <span key={item}>{item}</span>)}</div>
      </div>
    </AppModal>
  );
}

function HistoryModal({ note, isOpen, onClose }: { note?: Note; isOpen: boolean; onClose: () => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const entries = note?.history || [];
  const virtualizer = useVirtualizer({ count: entries.length, getScrollElement: () => parentRef.current, estimateSize: () => 120 });
  const [diffHtml, setDiffHtml] = useState("");

  async function showDiff(entry: HistoryEntry) {
    if (!note) return;
    setDiffHtml(await getNoteWorker().buildDiff(entry.content, note.content));
  }

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="History">
      <div ref={parentRef} className="history-list">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map(row => {
            const entry = entries[row.index];
            if (!entry) return null;
            return (
              <button key={entry.id} type="button" className="history-row" style={{ transform: `translateY(${row.start}px)` }} onClick={() => showDiff(entry)}>
                <strong>{entry.title}</strong>
                <span>{dayjs(entry.createdAt).format("MMM D, YYYY HH:mm")}</span>
                <p>{entry.content.slice(0, 140)}</p>
              </button>
            );
          })}
        </div>
      </div>
      <div className="diff-preview" dangerouslySetInnerHTML={{ __html: diffHtml || "<p>Select a version to compare changes.</p>" }} />
    </AppModal>
  );
}

type SettingsTab = "account" | "display" | "tools";

function SettingsModal({
  settings,
  isOpen,
  onClose,
  onChange,
  onImport,
  onExport,
}: {
  settings: Settings;
  isOpen: boolean;
  onClose: () => void;
  onChange: (settings: Partial<Settings>) => void;
  onImport: () => void;
  onExport: () => void;
}) {
  const cronOk = validateCron("*/10 * * * *");
  const nextBackup = CronosExpression.parse("*/10 * * * *").nextDate(new Date());
  const [tab, setTab] = useState<SettingsTab>("display");
  const displayOptions: Array<[NoteDisplayMode, string, Settings["previewLines"]]> = [
    ["comfy", "Comfy", 2],
    ["condensed", "Condensed", 1],
    ["expanded", "Expanded", 3],
  ];
  const sortOptions: Array<[SortMode, string]> = [
    ["name-asc", "Name: A-Z"],
    ["name-desc", "Name: Z-A"],
    ["created-desc", "Created: Newest"],
    ["created-asc", "Created: Oldest"],
    ["modified-desc", "Modified: Newest"],
    ["modified-asc", "Modified: Oldest"],
  ];
  const fontOptions: Array<[EditorFontFamily, string]> = [
    ["system", "System UI"],
    ["atkinson", "Atkinson Hyperlegible"],
    ["inter", "Inter"],
    ["serif", "Source Serif"],
    ["mono", "Monospace"],
  ];

  function radioRow(label: string, checked: boolean, onSelect: () => void) {
    return (
      <button className="settings-choice-row" type="button" onClick={onSelect}>
        <span>{label}</span>
        <span className={`settings-radio ${checked ? "checked" : ""}`} aria-hidden="true" />
      </button>
    );
  }

  function switchRow(label: string, checked: boolean, onToggle: () => void) {
    return (
      <label className="settings-switch-row">
        <span>{label}</span>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </label>
    );
  }

  function actionRow(label: string, onClick: () => void) {
    return (
      <button className="settings-action-row" type="button" onClick={onClick}>
        <span>{label}</span>
        <Icon path={mdiChevronRight} size={0.72} />
      </button>
    );
  }

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Settings" className="settings-modal">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {(["account", "display", "tools"] as SettingsTab[]).map(item => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item[0]?.toUpperCase()}{item.slice(1)}
          </button>
        ))}
      </div>
      <div className="settings-panel">
        {tab === "account" ? (
          <div className="settings-section-stack">
            <section className="settings-section">
              <h3>ACCOUNT</h3>
              <div className="settings-card">
                <div className="settings-static-row"><span>Storage</span><strong>Local IndexedDB</strong></div>
                <div className="settings-static-row"><span>Sync</span><strong>Local browser tabs</strong></div>
                <div className="settings-static-row"><span>Autosave</span><strong>{cronOk ? "Active" : "Unavailable"}</strong></div>
              </div>
            </section>
            <section className="settings-section">
              <h3>BACKUP</h3>
              <div className="settings-card">
                <div className="settings-static-row"><span>Next reminder</span><strong>{nextBackup?.toLocaleTimeString() || "Not scheduled"}</strong></div>
              </div>
            </section>
          </div>
        ) : null}

        {tab === "display" ? (
          <div className="settings-section-stack">
            <section className="settings-section">
              <h3>NOTE DISPLAY</h3>
              <div className="settings-card">
                {displayOptions.map(([value, label, previewLines]) => radioRow(label, settings.noteDisplay === value, () => onChange({ noteDisplay: value, previewLines })))}
              </div>
            </section>
            <section className="settings-section">
              <h3>LINE LENGTH</h3>
              <div className="settings-card">
                {radioRow("Narrow (65-75 chars)", settings.lineLength === "narrow", () => onChange({ lineLength: "narrow" }))}
                {radioRow("Full width", settings.lineLength === "full", () => onChange({ lineLength: "full" }))}
              </div>
            </section>
            <section className="settings-section">
              <h3>FONT</h3>
              <div className="settings-card">
                {fontOptions.map(([value, label]) => radioRow(label, settings.editorFontFamily === value, () => onChange({ editorFontFamily: value })))}
              </div>
            </section>
            <section className="settings-section">
              <h3>FONT SIZE</h3>
              <div className="settings-card">
                <label className="settings-slider-row">
                  <span>{settings.editorFontSize}px</span>
                  <input type="range" min={14} max={22} value={settings.editorFontSize} onChange={event => onChange({ editorFontSize: Number(event.target.value) })} />
                </label>
              </div>
            </section>
            <section className="settings-section">
              <h3>SORT BY</h3>
              <div className="settings-card">
                {sortOptions.map(([value, label]) => radioRow(label, settings.sortMode === value, () => onChange({ sortMode: value })))}
              </div>
            </section>
            <section className="settings-section">
              <h3>TAGS</h3>
              <div className="settings-card">
                {switchRow("Sort Alphabetically", settings.sortTagsAlphabetically, () => onChange({ sortTagsAlphabetically: !settings.sortTagsAlphabetically }))}
              </div>
            </section>
            <section className="settings-section">
              <h3>THEME</h3>
              <div className="settings-card">
                {radioRow("System", settings.theme === "system", () => onChange({ theme: "system" }))}
                {radioRow("Light", settings.theme === "light", () => onChange({ theme: "light" }))}
                {radioRow("Dark", settings.theme === "dark", () => onChange({ theme: "dark" }))}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "tools" ? (
          <div className="settings-section-stack">
            <section className="settings-section">
              <h3>TOOLS</h3>
              <div className="settings-card">
                {actionRow("Import Notes", () => { onClose(); onImport(); })}
                {actionRow("Export Notes", onExport)}
                {switchRow("Keyboard Shortcuts", settings.keyboardShortcuts, () => onChange({ keyboardShortcuts: !settings.keyboardShortcuts }))}
              </div>
            </section>
            <section className="settings-section">
              <div className="settings-card">
                {switchRow("Notify on remote changes", settings.notifyRemoteChanges, () => onChange({ notifyRemoteChanges: !settings.notifyRemoteChanges }))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppModal>
  );
}

function ShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" className="shortcuts-modal">
      <div className="shortcuts-panel">
        {shortcutGroups.map(group => (
          <section className="shortcut-section" key={group.title}>
            <h3>{group.title}</h3>
            <div className="shortcut-card">
              {group.items.map(([keys, label]) => (
                <div className="shortcut-row" key={keys}>
                  <kbd>{keys}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppModal>
  );
}

function CommandPaletteModal({ isOpen, onClose, commands }: { isOpen: boolean; onClose: () => void; commands: Array<{ label: string; shortcut: string; action: () => void }> }) {
  const [query, setQuery] = useState("");
  const filtered = commands.filter(command => command.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Command Palette" className="command-modal">
      <div className="command-panel">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search commands" autoFocus />
        <div className="command-list">
          {filtered.map(command => (
            <button
              type="button"
              key={command.label}
              onClick={() => {
                onClose();
                command.action();
              }}
            >
              <span>{command.label}</span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          ))}
        </div>
      </div>
    </AppModal>
  );
}

function ImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const notes = useNotesStore(state => state.notes);
  const importNotes = useNotesStore(state => state.importNotes);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");

  async function exportZip() {
    const bytes = await getNoteWorker().exportZip(notes.filter(note => !note.deletedAt));
    saveAs(new Blob([bytes], { type: "application/zip" }), "quicknote-export.zip");
    toast.success("Export downloaded");
  }

  const dropzone = useDropzone({
    multiple: true,
    async onDrop(files) {
      for (const file of files) {
        if (file.name.endsWith(".pdf")) {
          setPdfUrl(URL.createObjectURL(file));
          setPdfStatus(await getNoteWorker().describePdf(file.name, file.size));
          continue;
        }
        if (file.name.endsWith(".zip")) {
          const reader = new ZipReader(new BlobReader(file));
          const entries = await reader.getEntries();
          const jsonEntry = entries.find(entry => entry.filename.endsWith(".json"));
          if (jsonEntry && "getData" in jsonEntry && typeof jsonEntry.getData === "function") {
            importNotes(importNotesFromJson(await jsonEntry.getData(new TextWriter())));
          }
          await reader.close();
          continue;
        }
        const text = await file.text();
        if (file.name.endsWith(".json")) importNotes(importNotesFromJson(text));
        else importNotes([{ ...createNoteDraft(text, ["imported"], new Date().toISOString()), id: crypto.randomUUID(), title: file.name.replace(/\.(txt|md)$/i, ""), isMarkdown: file.name.endsWith(".md") }]);
      }
      toast.success("Import processed");
    },
  });

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Import and export">
      <div className="modal-stack">
        <div {...dropzone.getRootProps({ className: "dropzone" })}>
          <input {...dropzone.getInputProps()} />
          <Icon path={mdiUploadOutline} size={1.2} />
          <strong>Drop JSON, ZIP, TXT, MD, or PDF files</strong>
          <span>TXT and Markdown become notes. PDF opens in preview mode.</span>
        </div>
        <button type="button" className="primary-action" onClick={exportZip}>
          <Icon path={mdiDownloadOutline} size={0.75} /> Export ZIP
        </button>
        {pdfStatus ? <p className="settings-note"><Icon path={mdiFilePdfBox} size={0.75} /> {pdfStatus}</p> : null}
        {pdfUrl ? (
          <div className="pdf-preview">
            <PdfWorker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <Viewer fileUrl={pdfUrl} />
            </PdfWorker>
          </div>
        ) : null}
      </div>
    </AppModal>
  );
}

function AppModal({ isOpen, onClose, title, children, className = "" }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} className={`app-modal ${className}`} overlayClassName="modal-overlay">
      <div className="modal-header">
        <h2>{title}</h2>
        {iconButtonLabel("Close", mdiClose, onClose)}
      </div>
      {children}
    </Modal>
  );
}

export function App() {
  return <AppShell />;
}

export default App;
