import { mutative } from "zustand-mutative";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createNoteDraft,
  filterNotes,
  normalizeTags,
  sortNotes,
  updateNoteContent,
  type Note,
  type SortMode,
} from "@/lib/noteLogic";
import { indexedDbStorage } from "./indexedDbStorage";

export type ThemeMode = "light" | "dark";

export type Settings = {
  sortMode: SortMode;
  previewLines: 1 | 2 | 3;
  theme: ThemeMode;
  editorFontSize: number;
  focusMode: boolean;
};

export type NotesState = {
  notes: Note[];
  selectedNoteId: string;
  selectedTag: string;
  query: string;
  settings: Settings;
  setQuery: (query: string) => void;
  setSelectedTag: (tag: string) => void;
  selectNote: (id: string) => void;
  createNote: (content?: string, tags?: string[]) => string;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  togglePin: (id: string) => void;
  toggleMarkdown: (id: string) => void;
  setTags: (id: string, tags: string[]) => void;
  publishNote: (id: string) => void;
  unpublishNote: (id: string) => void;
  addCollaborator: (id: string, email: string) => void;
  importNotes: (notes: Note[]) => void;
  replaceSettings: (settings: Partial<Settings>) => void;
  reorderTag: (fromTag: string, toTag: string) => void;
};

const now = () => new Date().toISOString();

const starterNotes: Note[] = [
  {
    ...createNoteDraft(
      "Welcome to Quicknote\n\nUse search, tags, pins, Markdown preview, history, publish links, and import/export tools from the toolbar.\n\n- [ ] Create a note\n- [ ] Add tags\n- [ ] Export your archive",
      ["inbox", "markdown"],
      "2026-06-07T10:00:00.000Z",
    ),
    id: "welcome",
    isPinned: true,
    isMarkdown: true,
  },
  {
    ...createNoteDraft("Meeting notes\n\nDecisions, follow-ups, and owners.", ["work"], "2026-06-07T09:30:00.000Z"),
    id: "meeting",
  },
  {
    ...createNoteDraft("Grocery list\n\n- rice\n- dates\n- milk", ["home"], "2026-06-07T08:15:00.000Z"),
    id: "grocery",
  },
];

const defaultSettings: Settings = {
  sortMode: "modified-desc",
  previewLines: 2,
  theme: "dark",
  editorFontSize: 17,
  focusMode: false,
};

export const useNotesStore = create<NotesState>()(
  persist(
    mutative((set, get) => ({
      notes: starterNotes,
      selectedNoteId: "welcome",
      selectedTag: "all",
      query: "",
      settings: defaultSettings,
      setQuery: query =>
        set(state => {
          state.query = query;
        }),
      setSelectedTag: tag =>
        set(state => {
          state.selectedTag = tag;
        }),
      selectNote: id =>
        set(state => {
          state.selectedNoteId = id;
        }),
      createNote: (content = "", tags = []) => {
        const note = createNoteDraft(content, tags, now());
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
          const existing = new Set(state.notes.map(note => note.id));
          state.notes.unshift(...notes.filter(note => !existing.has(note.id)));
          if (notes[0]) state.selectedNoteId = notes[0].id;
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
      version: 2,
      storage: createJSONStorage(() => indexedDbStorage),
      migrate: persistedState => {
        const state = persistedState as Partial<NotesState>;
        return {
          ...state,
          settings: {
            ...defaultSettings,
            ...state.settings,
            theme: state.settings?.theme === "light" ? "dark" : state.settings?.theme || "dark",
          },
        };
      },
    },
  ),
);

export function selectVisibleNotes(state: NotesState): Note[] {
  const tag = state.selectedTag === "pinned" ? "all" : state.selectedTag;
  const notes = filterNotes(state.notes, state.query, tag).filter(note => state.selectedTag !== "pinned" || note.isPinned);
  return sortNotes(notes, state.settings.sortMode);
}

export function selectAllTags(notes: Note[]): string[] {
  return Array.from(new Set(notes.flatMap(note => note.tags))).sort((a, b) => a.localeCompare(b));
}

export function broadcastStoreSnapshot(state: NotesState) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("quicknote-sync");
  channel.postMessage({ type: "snapshot", notes: state.notes, settings: state.settings });
  channel.close();
}
