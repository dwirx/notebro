import { describe, expect, test } from "vitest";
import {
  createNoteDraft,
  exportNotesToJson,
  filterNotes,
  importNotesFromJson,
  sortNotes,
  updateNoteContent,
  type Note,
} from "./noteLogic";

const baseTime = "2026-06-07T10:00:00.000Z";

function note(overrides: Partial<Note>): Note {
  return {
    id: "note-1",
    title: "Untitled",
    content: "",
    tags: [],
    collaborators: [],
    isPinned: false,
    isMarkdown: false,
    isPublished: false,
    shareSlug: "",
    createdAt: baseTime,
    updatedAt: baseTime,
    deletedAt: null,
    history: [],
    ...overrides,
  };
}

describe("note logic", () => {
  test("creates a note title from the first content line", () => {
    const draft = createNoteDraft("Project plan\nWrite the outline", ["work"], baseTime);

    expect(draft.title).toBe("Project plan");
    expect(draft.tags).toEqual(["work"]);
    expect(draft.content).toContain("Write the outline");
  });

  test("updates note content while preserving previous version in history", () => {
    const updated = updateNoteContent(note({ content: "old", title: "old" }), "new title\nbody", "2026-06-07T11:00:00.000Z");

    expect(updated.title).toBe("new title");
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0]?.content).toBe("old");
  });

  test("sorts pinned notes first before modified date", () => {
    const notes = [
      note({ id: "older", title: "B", updatedAt: "2026-06-07T09:00:00.000Z" }),
      note({ id: "pinned", title: "C", isPinned: true, updatedAt: "2026-06-07T08:00:00.000Z" }),
      note({ id: "newer", title: "A", updatedAt: "2026-06-07T12:00:00.000Z" }),
    ];

    expect(sortNotes(notes, "modified-desc").map(item => item.id)).toEqual(["pinned", "newer", "older"]);
  });

  test("filters by search text and selected tag while ignoring deleted notes", () => {
    const notes = [
      note({ id: "a", title: "Recipe", content: "buy milk", tags: ["home"] }),
      note({ id: "b", title: "Work", content: "ship note app", tags: ["work"] }),
      note({ id: "c", title: "Deleted", content: "ship note app", tags: ["work"], deletedAt: baseTime }),
    ];

    expect(filterNotes(notes, "ship", "work").map(item => item.id)).toEqual(["b"]);
  });

  test("round trips notes through JSON export and import", () => {
    const notes = [note({ id: "exported", title: "Exported", tags: ["archive"] })];

    expect(importNotesFromJson(exportNotesToJson(notes))).toEqual(notes);
  });
});
