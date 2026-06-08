export type SortMode = "modified-desc" | "modified-asc" | "created-desc" | "created-asc" | "name-asc" | "name-desc";

export type HistoryEntry = {
  id: string;
  content: string;
  title: string;
  createdAt: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  order: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string | null;
  collaborators: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isImportant: boolean;
  isMarkdown: boolean;
  isPublished: boolean;
  shareSlug: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  history: HistoryEntry[];
};

const fallbackTitle = "Untitled";

export function titleFromContent(content: string): string {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)
    ?.slice(0, 80) || fallbackTitle;
}

export function createNoteDraft(content = "", tags: string[] = [], now = new Date().toISOString(), folderId: string | null = null): Note {
  return {
    id: crypto.randomUUID(),
    title: titleFromContent(content),
    content,
    tags: normalizeTags(tags),
    folderId,
    collaborators: [],
    isPinned: false,
    isFavorite: false,
    isImportant: false,
    isMarkdown: false,
    isPublished: false,
    shareSlug: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    history: [],
  };
}

export function updateNoteContent(note: Note, content: string, now = new Date().toISOString()): Note {
  if (note.content === content) return note;

  return {
    ...note,
    content,
    title: titleFromContent(content),
    updatedAt: now,
    history: [
      {
        id: crypto.randomUUID(),
        title: note.title,
        content: note.content,
        createdAt: now,
      },
      ...note.history,
    ].slice(0, 40),
  };
}

export function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function sortNotes(notes: Note[], sortMode: SortMode): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

    switch (sortMode) {
      case "modified-asc":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "created-desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "created-asc":
        return a.createdAt.localeCompare(b.createdAt);
      case "name-asc":
        return a.title.localeCompare(b.title);
      case "name-desc":
        return b.title.localeCompare(a.title);
      case "modified-desc":
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  });
}

export function filterNotes(notes: Note[], query: string, selectedTag = "all", includeDeleted = false, selectedFolderId: string | null = null): Note[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTag = selectedTag.trim().toLowerCase();

  return notes.filter(note => {
    if (!includeDeleted && note.deletedAt) return false;
    if (selectedFolderId && note.folderId !== selectedFolderId) return false;
    if (normalizedTag !== "all" && !note.tags.includes(normalizedTag)) return false;
    if (!normalizedQuery) return true;

    const haystack = [note.title, note.content, ...note.tags].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function exportNotesToJson(notes: Note[]): string {
  return JSON.stringify(notes, null, 2);
}

export function importNotesFromJson(json: string): Note[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isNote);
}

export function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<Note>;
  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    typeof note.content === "string" &&
    Array.isArray(note.tags) &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string"
  );
}
