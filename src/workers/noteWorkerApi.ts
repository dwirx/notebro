import { diff } from "diffblazer";
import { strToU8, zipSync } from "fflate";
import katex from "katex";
import snarkdown from "snarkdown";
import type { Note } from "@/lib/noteLogic";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function renderMath(html: string): string {
  return html.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_match, block, inline) => {
    try {
      return katex.renderToString(block || inline, {
        displayMode: Boolean(block),
        throwOnError: false,
      });
    } catch {
      return escapeHtml(block || inline);
    }
  });
}

function protectTaskListSyntax(markdown: string): string {
  return markdown.replace(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/gm, (_line, indent, checked, label) => {
    const state = String(checked).toLowerCase() === "x" ? "CHECKED" : "UNCHECKED";
    return `${indent}- QNTASK${state}Q ${label}`;
  });
}

function restoreTaskListHtml(html: string): string {
  return html.replace(/<li>QNTASK(CHECKED|UNCHECKED)Q\s*([\s\S]*?)<\/li>/g, (_match, state, label) => {
    const checked = state === "CHECKED" ? " checked" : "";
    return `<li class="task-list-item"><input type="checkbox" disabled${checked} /> <span>${label}</span></li>`;
  });
}

export const noteWorkerApi = {
  renderMarkdown(markdown: string) {
    return renderMath(restoreTaskListHtml(snarkdown(protectTaskListSyntax(markdown))));
  },
  search(notes: Note[], query: string) {
    const value = query.trim().toLowerCase();
    if (!value) return notes.map(note => note.id);
    return notes
      .filter(note => [note.title, note.content, ...note.tags].join(" ").toLowerCase().includes(value))
      .map(note => note.id);
  },
  buildDiff(previous: string, next: string) {
    return diff(escapeHtml(previous), escapeHtml(next));
  },
  exportZip(notes: Note[]) {
    const files: Record<string, Uint8Array> = {
      "simplenote.json": strToU8(JSON.stringify(notes, null, 2)),
    };
    for (const note of notes) {
      const safeTitle = note.title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || note.id;
      files[`notes/${safeTitle}-${note.id.slice(0, 6)}.${note.isMarkdown ? "md" : "txt"}`] = strToU8(note.content);
    }
    return zipSync(files);
  },
  describePdf(name: string, size: number) {
    return `${name} (${Math.ceil(size / 1024)} KB) is ready for preview. Text extraction can be added when a sync backend is introduced.`;
  },
};

export type NoteWorkerApi = typeof noteWorkerApi;
