import "@react-pdf-viewer/core/lib/styles/index.css";
import "katex/dist/katex.min.css";
import "react-loading-skeleton/dist/skeleton.css";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Global, ThemeProvider } from "@emotion/react";
import {
  mdiArchiveArrowDownOutline,
  mdiArrowLeft,
  mdiBookOpenPageVariantOutline,
  mdiChevronLeft,
  mdiClose,
  mdiCogOutline,
  mdiDeleteOutline,
  mdiDotsHorizontalCircleOutline,
  mdiDownloadOutline,
  mdiEyeOutline,
  mdiFilePdfBox,
  mdiFormatListBulleted,
  mdiFormatListChecks,
  mdiInformationOutline,
  mdiMagnify,
  mdiMenu,
  mdiPin,
  mdiPinOutline,
  mdiRestore,
  mdiSquareEditOutline,
  mdiTagOutline,
  mdiUploadOutline,
  mdiViewSplitVertical,
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
import { createNoteDraft, importNotesFromJson, type HistoryEntry, type Note, type SortMode } from "@/lib/noteLogic";
import { getNoteWorker } from "@/workers/client";
import { selectAllTags, selectVisibleNotes, useNotesStore, type Settings } from "@/store/notes";
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

type ModalName = "share" | "history" | "settings" | "import" | "trash" | null;
type MobilePane = "tags" | "list" | "editor";
type PreviewMode = "edit" | "split" | "preview";

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
  const [tagDraft, setTagDraft] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const state = useNotesStore();
  const visibleNotes = useMemo(() => selectVisibleNotes(state), [state.notes, state.query, state.selectedTag, state.settings.sortMode]);
  const tags = useMemo(() => selectAllTags(state.notes), [state.notes]);
  const selectedNote = state.notes.find(note => note.id === state.selectedNoteId) || visibleNotes[0] || state.notes[0];
  const deletedNotes = state.notes.filter(note => note.deletedAt);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  useEffect(() => {
    const unsubscribe = useNotesStore.subscribe(current => {
      if (typeof BroadcastChannel === "undefined") return;
      const channel = new BroadcastChannel("quicknote-sync");
      channel.postMessage({ type: "updated", notes: current.notes, settings: current.settings });
      channel.close();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    hotkeys("ctrl+shift+i,command+n", event => {
      event.preventDefault();
      const id = state.createNote("", state.selectedTag === "all" ? [] : [state.selectedTag]);
      setLocation(`/note/${id}`);
      setMobilePane("editor");
      toast.success("New note created");
    });
    hotkeys("ctrl+shift+s,command+l", event => {
      event.preventDefault();
      searchRef.current?.focus();
    });
    hotkeys("ctrl+shift+p", event => {
      event.preventDefault();
      if (selectedNote) state.toggleMarkdown(selectedNote.id);
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
    return () => hotkeys.unbind("ctrl+shift+i,command+n,ctrl+shift+s,command+l,ctrl+shift+p,ctrl+shift+c,ctrl+h,ctrl+shift+f");
  }, [selectedNote?.id, state.settings.focusMode, state.selectedTag]);

  useEffect(() => {
    const match = location.match(/^\/note\/(.+)$/);
    if (match?.[1] && state.notes.some(note => note.id === match[1])) {
      state.selectNote(match[1]);
      setMobilePane("editor");
    }
    if (location === "/settings") setModal("settings");
  }, [location, state.notes.length]);

  function createNote() {
    const id = state.createNote("", state.selectedTag === "all" ? [] : [state.selectedTag]);
    setLocation(`/note/${id}`);
    setMobilePane("editor");
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function selectNote(note: Note) {
    state.selectNote(note.id);
    setLocation(`/note/${note.id}`);
    setMobilePane("editor");
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

  function onDragEnd(event: DragEndEvent) {
    const from = String(event.active.id);
    const to = String(event.over?.id || "");
    if (from && to && from !== to) state.reorderTag(from, to);
  }

  const currentViewTitle =
    state.selectedTag === "all" ? "All Notes" : state.selectedTag === "pinned" ? "Pinned" : `#${state.selectedTag}`;

  return (
    <ThemeProvider theme={theme}>
      <Global styles={{ body: { margin: 0 } }} />
      <div className={`app-shell ${state.settings.focusMode ? "is-focus-mode" : ""} ${sidebarOpen ? "sidebar-open" : ""} ${noteListOpen ? "" : "note-list-hidden"}`}>
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
          <div className="brand-row">
            <div className="brand-mark"><Icon path={mdiBookOpenPageVariantOutline} size={0.82} /></div>
            <div>
              <strong>Quicknote</strong>
              <span>{state.notes.filter(note => !note.deletedAt).length} notes</span>
            </div>
            {iconButtonLabel("Close sidebar", mdiClose, () => setSidebarOpen(false))}
          </div>
          <button className={`tag-row ${state.selectedTag === "all" ? "selected" : ""}`} type="button" onClick={() => { state.setSelectedTag("all"); setSidebarOpen(false); }}>
            <Icon path={mdiArchiveArrowDownOutline} size={0.75} /> All notes
          </button>
          <button className={`tag-row ${state.selectedTag === "pinned" ? "selected" : ""}`} type="button" onClick={() => { state.setSelectedTag("pinned"); setSidebarOpen(false); }}>
            <Icon path={mdiPin} size={0.75} /> Pinned
          </button>
          <DndContext onDragEnd={onDragEnd}>
            <SortableContext items={tags} strategy={verticalListSortingStrategy}>
              <div className="tag-group">
                {tags.map(tag => (
                  <SortableTag key={tag} tag={tag} selected={state.selectedTag === tag} onClick={() => { state.setSelectedTag(tag); setSidebarOpen(false); }} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button className="tag-row" type="button" onClick={() => setModal("trash")}>
            <Icon path={mdiDeleteOutline} size={0.75} /> Trash
            {deletedNotes.length > 0 ? <span className="count-pill">{deletedNotes.length}</span> : null}
          </button>
          <div className="sidebar-footer">
            <button type="button" onClick={() => setModal("import")}>
              <Icon path={mdiUploadOutline} size={0.72} /> Import
            </button>
            <button type="button" onClick={() => setModal("settings")}>
              <Icon path={mdiCogOutline} size={0.72} /> Settings
            </button>
          </div>
        </aside>
        <section className={`note-list-pane ${mobilePane === "list" ? "mobile-open" : ""}`} aria-hidden={!noteListOpen && mobilePane !== "list"}>
          <div className="list-toolbar">
            {iconButtonLabel("Menu", mdiMenu, () => setSidebarOpen(value => !value), sidebarOpen)}
            <strong className="list-title">{currentViewTitle}</strong>
            <div className="list-toolbar-actions">
              {iconButtonLabel("New note", mdiSquareEditOutline, createNote)}
              {iconButtonLabel("Toggle focus mode", mdiViewSplitVertical, () => state.replaceSettings({ focusMode: !state.settings.focusMode }), state.settings.focusMode)}
              {iconButtonLabel("Hide notes list", mdiChevronLeft, () => setNoteListOpen(false))}
            </div>
          </div>
          <div className="search-row">
            <Icon path={mdiMagnify} size={0.8} />
            <input ref={searchRef} value={state.query} onChange={event => state.setQuery(event.target.value)} placeholder="Search all notes and tags" />
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
            <div className="empty-state">No notes match this view.</div>
          ) : (
            <Virtuoso
              className="virtuoso-list"
              data={visibleNotes}
              itemContent={(_, note) => (
                <NoteListItem
                  note={note}
                  selected={note.id === selectedNote?.id}
                  previewLines={state.settings.previewLines}
                  onSelect={() => selectNote(note)}
                  onPin={() => state.togglePin(note.id)}
                />
              )}
            />
          )}
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
                  toggleMarkdown={() => state.toggleMarkdown(selectedNote.id)}
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
                />
              ) : (
                <div className="editor-empty">
                  <Skeleton count={5} />
                </div>
              )}
            </Route>
          </Switch>
        </main>
        <ShareModal note={selectedNote} isOpen={modal === "share"} onClose={() => setModal(null)} />
        <HistoryModal note={selectedNote} isOpen={modal === "history"} onClose={() => setModal(null)} />
        <SettingsModal settings={state.settings} isOpen={modal === "settings"} onClose={() => setModal(null)} onChange={state.replaceSettings} />
        <ImportModal isOpen={modal === "import"} onClose={() => setModal(null)} />
        <TrashModal notes={deletedNotes} isOpen={modal === "trash"} onClose={() => setModal(null)} />
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

function SortableTag({ tag, selected, onClick }: { tag: string; selected: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tag });
  return (
    <button
      ref={setNodeRef}
      className={`tag-row ${selected ? "selected" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      type="button"
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <Icon path={mdiTagOutline} size={0.7} /> {tag}
    </button>
  );
}

function NoteListItem({ note, selected, previewLines, onSelect, onPin }: { note: Note; selected: boolean; previewLines: number; onSelect: () => void; onPin: () => void }) {
  return (
    <article className={`note-list-item ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="note-list-title">
        <span>{note.title}</span>
        <button type="button" aria-label="Toggle pin" onClick={event => { event.stopPropagation(); onPin(); }}>
          <Icon path={note.isPinned ? mdiPin : mdiPinOutline} size={0.68} />
        </button>
      </div>
      <p style={{ WebkitLineClamp: previewLines }}>{note.content.replace(/\s+/g, " ") || "Empty note"}</p>
      <div className="note-meta">
        <span>{timeagoFormat(note.updatedAt)}</span>
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
  toggleMarkdown: () => void;
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
}) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>(props.note.isMarkdown || looksLikeMarkdown(props.note.content) ? "split" : "edit");
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
    setPreviewMode(props.note.isMarkdown || looksLikeMarkdown(props.note.content) ? "split" : "edit");
    setInfoOpen(false);
    setMoreOpen(false);
  }, [props.note.id]);

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
        <div className="editor-title">
          <strong>{props.note.title}</strong>
          <span>{dayjs(props.note.updatedAt).fromNow?.() || dayjs(props.note.updatedAt).format("MMM D")}</span>
        </div>
        <div className="toolbar-actions">
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
      </div>
      <div className={`editor-workspace preview-${previewMode}`}>
        {previewMode !== "preview" ? (
          <textarea
            ref={props.editorRef}
            value={props.note.content}
            onChange={event => props.updateContent(event.target.value)}
            style={{ fontSize: props.settings.editorFontSize }}
            placeholder="Start typing..."
          />
        ) : null}
        {previewMode !== "edit" ? (
          <section className="markdown-preview" dangerouslySetInnerHTML={{ __html: previewHtml || "<p>Preview will appear here.</p>" }} />
        ) : null}
      </div>
      <div className="tag-editor tag-editor-bottom">
        <div className="tag-chips">{props.note.tags.length ? props.note.tags.map(tag => <span key={tag}>#{tag}</span>) : <span>No tags</span>}</div>
        <input value={props.tagDraft} onChange={event => props.setTagDraft(event.target.value)} placeholder="Add tags, comma separated" />
        <button type="button" onClick={props.saveTags}>Save tags</button>
      </div>
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

function SettingsModal({ settings, isOpen, onClose, onChange }: { settings: Settings; isOpen: boolean; onClose: () => void; onChange: (settings: Partial<Settings>) => void }) {
  const cronOk = validateCron("*/10 * * * *");
  const nextBackup = CronosExpression.parse("*/10 * * * *").nextDate(new Date());
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-grid">
        <label>Theme<select value={settings.theme} onChange={event => onChange({ theme: event.target.value as Settings["theme"] })}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label>Preview lines<select value={settings.previewLines} onChange={event => onChange({ previewLines: Number(event.target.value) as Settings["previewLines"] })}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
        <label>Editor size<input type="range" min={14} max={22} value={settings.editorFontSize} onChange={event => onChange({ editorFontSize: Number(event.target.value) })} /></label>
        <label className="check-row"><input type="checkbox" checked={settings.focusMode} onChange={event => onChange({ focusMode: event.target.checked })} /> Focus mode</label>
      </div>
      <p className="settings-note">Autosave check: {cronOk ? "valid" : "invalid"}. Next local backup reminder: {nextBackup?.toLocaleTimeString()}.</p>
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

function TrashModal({ notes, isOpen, onClose }: { notes: Note[]; isOpen: boolean; onClose: () => void }) {
  const restoreNote = useNotesStore(state => state.restoreNote);
  return (
    <AppModal isOpen={isOpen} onClose={onClose} title="Trash">
      <div className="modal-stack">
        {notes.length === 0 ? <p>No deleted notes.</p> : notes.map(note => (
          <div className="trash-row" key={note.id}>
            <div><strong>{note.title}</strong><span>{note.deletedAt ? dayjs(note.deletedAt).format("MMM D, YYYY") : ""}</span></div>
            <button type="button" onClick={() => restoreNote(note.id)}><Icon path={mdiRestore} size={0.75} /> Restore</button>
          </div>
        ))}
      </div>
    </AppModal>
  );
}

function AppModal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} className="app-modal" overlayClassName="modal-overlay">
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
