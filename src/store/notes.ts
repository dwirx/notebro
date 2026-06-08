import { mutative } from "zustand-mutative";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createNoteDraft,
  filterNotes,
  normalizeTags,
  sortNotes,
  updateNoteContent,
  type Folder,
  type Note,
  type SortMode,
} from "@/lib/noteLogic";
import { indexedDbStorage } from "./indexedDbStorage";

export type ThemeMode = "system" | "light" | "dark";
export type NoteDisplayMode = "comfy" | "condensed" | "expanded";
export type LineLengthMode = "narrow" | "full";
export type EditorFontFamily = "system" | "inter" | "atkinson" | "serif" | "mono";

export type Settings = {
  sortMode: SortMode;
  previewLines: 1 | 2 | 3;
  theme: ThemeMode;
  editorFontSize: number;
  editorFontFamily: EditorFontFamily;
  focusMode: boolean;
  noteDisplay: NoteDisplayMode;
  lineLength: LineLengthMode;
  sortTagsAlphabetically: boolean;
  keyboardShortcuts: boolean;
  notifyRemoteChanges: boolean;
};

export type NotesState = {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string;
  selectedTag: string;
  selectedFolderId: string | null;
  query: string;
  settings: Settings;
  setQuery: (query: string) => void;
  setSelectedTag: (tag: string) => void;
  setSelectedFolder: (folderId: string | null) => void;
  selectNote: (id: string) => void;
  createNote: (content?: string, tags?: string[], folderId?: string | null) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  restoreNote: (id: string) => void;
  togglePin: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleImportant: (id: string) => void;
  toggleMarkdown: (id: string) => void;
  setTags: (id: string, tags: string[]) => void;
  moveNoteToFolder: (id: string, folderId: string | null) => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  reorderFolder: (activeId: string, overId: string) => void;
  publishNote: (id: string) => void;
  unpublishNote: (id: string) => void;
  addCollaborator: (id: string, email: string) => void;
  importNotes: (notes: Note[]) => void;
  replaceSettings: (settings: Partial<Settings>) => void;
  reorderTag: (fromTag: string, toTag: string) => void;
};

const now = () => new Date().toISOString();

const defaultFolders: Folder[] = [
  { id: "inbox", name: "Inbox", createdAt: "2026-06-07T10:00:00.000Z", updatedAt: "2026-06-07T10:00:00.000Z", order: 0 },
  { id: "work", name: "Work", createdAt: "2026-06-07T09:30:00.000Z", updatedAt: "2026-06-07T09:30:00.000Z", order: 1 },
  { id: "home", name: "Home", createdAt: "2026-06-07T08:15:00.000Z", updatedAt: "2026-06-07T08:15:00.000Z", order: 2 },
];

const starterNotes: Note[] = [
  {
    ...createNoteDraft(
      "Welcome to Quicknote\n\nUse search, tags, pins, Markdown preview, history, publish links, and import/export tools from the toolbar.\n\n- [ ] Create a note\n- [ ] Add tags\n- [ ] Export your archive",
      ["inbox", "markdown"],
      "2026-06-07T10:00:00.000Z",
      "inbox",
    ),
    id: "welcome",
    isPinned: true,
    isFavorite: true,
    isMarkdown: true,
  },
  {
    ...createNoteDraft("Meeting notes\n\nDecisions, follow-ups, and owners.", ["work"], "2026-06-07T09:30:00.000Z", "work"),
    id: "meeting",
    isImportant: true,
  },
  {
    ...createNoteDraft("Grocery list\n\n- rice\n- dates\n- milk", ["home"], "2026-06-07T08:15:00.000Z", "home"),
    id: "grocery",
  },
];

const defaultSettings: Settings = {
  sortMode: "modified-desc",
  previewLines: 2,
  theme: "dark",
  editorFontSize: 17,
  editorFontFamily: "system",
  focusMode: false,
  noteDisplay: "condensed",
  lineLength: "narrow",
  sortTagsAlphabetically: false,
  keyboardShortcuts: true,
  notifyRemoteChanges: false,
};

export const useNotesStore = create<NotesState>()(
  persist(
    mutative((set, get) => ({
      notes: starterNotes,
      folders: defaultFolders,
      selectedNoteId: "welcome",
      selectedTag: "all",
      selectedFolderId: null,
      query: "",
      settings: defaultSettings,
      setQuery: query =>
        set(state => {
          state.query = query;
        }),
      setSelectedTag: tag =>
        set(state => {
          state.selectedTag = tag;
          if (["all", "trash", "pinned", "favorites", "important"].includes(tag)) state.selectedFolderId = null;
        }),
      setSelectedFolder: folderId =>
        set(state => {
          state.selectedFolderId = folderId;
          state.selectedTag = "all";
        }),
      selectNote: id =>
        set(state => {
          state.selectedNoteId = id;
        }),
      createNote: (content = "", tags = [], folderId = null) => {
        const note = createNoteDraft(content, tags, now(), folderId);
        set(state => {
          state.notes.unshift(note);
          state.selectedNoteId = note.id;
        });
        return note.id;
      },
      updateNote: (id, content) =>
        set(state => {
          const index = state.notes.findIndex(note => note.id === id);
          const note = state.notes[index];
          if (index >= 0 && note) state.notes[index] = updateNoteContent(note, content, now());
        }),
      deleteNote: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) note.deletedAt = now();
        }),
      deleteForever: id =>
        set(state => {
          state.notes = state.notes.filter(note => note.id !== id);
          if (state.selectedNoteId === id) state.selectedNoteId = state.notes.find(note => !note.deletedAt)?.id || state.notes[0]?.id || "";
        }),
      emptyTrash: () =>
        set(state => {
          const deletedIds = new Set(state.notes.filter(note => note.deletedAt).map(note => note.id));
          state.notes = state.notes.filter(note => !deletedIds.has(note.id));
          if (deletedIds.has(state.selectedNoteId)) state.selectedNoteId = state.notes.find(note => !note.deletedAt)?.id || state.notes[0]?.id || "";
        }),
      restoreNote: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) note.deletedAt = null;
        }),
      togglePin: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) note.isPinned = !note.isPinned;
        }),
      toggleFavorite: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) {
            note.isFavorite = !note.isFavorite;
            note.updatedAt = now();
          }
        }),
      toggleImportant: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) {
            note.isImportant = !note.isImportant;
            note.updatedAt = now();
          }
        }),
      toggleMarkdown: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) note.isMarkdown = !note.isMarkdown;
        }),
      setTags: (id, tags) =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) {
            note.tags = normalizeTags(tags);
            note.updatedAt = now();
          }
        }),
      moveNoteToFolder: (id, folderId) =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) {
            note.folderId = folderId;
            note.updatedAt = now();
          }
        }),
      createFolder: name => {
        const timestamp = now();
        const folder: Folder = {
          id: crypto.randomUUID(),
          name: normalizeFolderName(name),
          createdAt: timestamp,
          updatedAt: timestamp,
          order: get().folders.length,
        };
        set(state => {
          state.folders.push(folder);
          state.selectedFolderId = folder.id;
          state.selectedTag = "all";
        });
        return folder.id;
      },
      renameFolder: (id, name) =>
        set(state => {
          const folder = state.folders.find(folder => folder.id === id);
          if (folder) {
            folder.name = normalizeFolderName(name);
            folder.updatedAt = now();
          }
        }),
      deleteFolder: id =>
        set(state => {
          state.folders = state.folders.filter(folder => folder.id !== id);
          state.notes.forEach(note => {
            if (note.folderId === id) note.folderId = null;
          });
          state.folders.forEach((folder, index) => {
            folder.order = index;
          });
          if (state.selectedFolderId === id) state.selectedFolderId = null;
        }),
      reorderFolder: (activeId, overId) =>
        set(state => {
          const from = state.folders.findIndex(folder => folder.id === activeId);
          const to = state.folders.findIndex(folder => folder.id === overId);
          if (from < 0 || to < 0 || from === to) return;
          const [folder] = state.folders.splice(from, 1);
          if (!folder) return;
          state.folders.splice(to, 0, folder);
          state.folders.forEach((item, index) => {
            item.order = index;
          });
        }),
      publishNote: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) {
            note.isPublished = true;
            note.shareSlug = note.shareSlug || `${note.id.slice(0, 8)}-${note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
          }
        }),
      unpublishNote: id =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          if (note) note.isPublished = false;
        }),
      addCollaborator: (id, email) =>
        set(state => {
          const note = state.notes.find(note => note.id === id);
          const normalized = email.trim().toLowerCase();
          if (note && normalized && !note.collaborators.includes(normalized)) note.collaborators.push(normalized);
        }),
      importNotes: notes =>
        set(state => {
          const normalizedNotes = normalizeNotes(notes);
          const existing = new Set(state.notes.map(note => note.id));
          state.notes.unshift(...normalizedNotes.filter(note => !existing.has(note.id)));
          if (normalizedNotes[0]) state.selectedNoteId = normalizedNotes[0].id;
        }),
      replaceSettings: settings =>
        set(state => {
          state.settings = { ...state.settings, ...settings };
        }),
      reorderTag: (fromTag, toTag) =>
        set(state => {
          for (const note of state.notes) {
            const from = note.tags.indexOf(fromTag);
            const to = note.tags.indexOf(toTag);
            if (from >= 0 && to >= 0) {
              const [tag] = note.tags.splice(from, 1);
              if (tag) note.tags.splice(to, 0, tag);
            }
          }
        }),
    })),
    {
      name: "quicknote-store",
      version: 3,
      storage: createJSONStorage(() => indexedDbStorage),
      migrate: persistedState => {
        const state = persistedState as Partial<NotesState>;
        const folders = normalizeFolders(state.folders);
        const notes = normalizeNotes(state.notes);
        return {
          ...state,
          notes,
          folders,
          selectedFolderId: state.selectedFolderId || null,
          settings: {
            ...defaultSettings,
            ...state.settings,
            theme: state.settings?.theme || "dark",
          },
        };
      },
    },
  ),
);

export function selectVisibleNotes(state: NotesState): Note[] {
  const tag = ["pinned", "favorites", "important"].includes(state.selectedTag) ? "all" : state.selectedTag;
  const notes = filterNotes(state.notes, state.query, tag, false, state.selectedFolderId).filter(note => {
    if (state.selectedTag === "pinned") return note.isPinned;
    if (state.selectedTag === "favorites") return note.isFavorite;
    if (state.selectedTag === "important") return note.isImportant;
    return true;
  });
  return sortNotes(notes, state.settings.sortMode);
}

export function selectAllTags(notes: Note[]): string[] {
  return Array.from(new Set(notes.flatMap(note => note.tags))).sort((a, b) => a.localeCompare(b));
}

export function selectSortedFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function broadcastStoreSnapshot(state: NotesState) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("quicknote-sync");
  channel.postMessage({ type: "snapshot", notes: state.notes, folders: state.folders, settings: state.settings });
  channel.close();
}

function normalizeFolderName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48) || "New Folder";
}

function normalizeFolders(folders?: Folder[]) {
  const source = Array.isArray(folders) && folders.length > 0 ? folders : defaultFolders;
  return source
    .map((folder, index) => ({
      ...folder,
      id: folder.id || crypto.randomUUID(),
      name: normalizeFolderName(folder.name || "New Folder"),
      createdAt: folder.createdAt || now(),
      updatedAt: folder.updatedAt || folder.createdAt || now(),
      order: Number.isFinite(folder.order) ? folder.order : index,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((folder, index) => ({ ...folder, order: index }));
}

function normalizeNotes(notes?: Note[]) {
  const source = Array.isArray(notes) && notes.length > 0 ? notes : starterNotes;
  return source.map(note => ({
    ...note,
    folderId: note.folderId || null,
    collaborators: Array.isArray(note.collaborators) ? note.collaborators : [],
    tags: Array.isArray(note.tags) ? note.tags : [],
    history: Array.isArray(note.history) ? note.history : [],
    isPinned: Boolean(note.isPinned),
    isFavorite: Boolean(note.isFavorite),
    isImportant: Boolean(note.isImportant),
    isMarkdown: Boolean(note.isMarkdown),
    isPublished: Boolean(note.isPublished),
    shareSlug: note.shareSlug || "",
    deletedAt: note.deletedAt || null,
  }));
}
