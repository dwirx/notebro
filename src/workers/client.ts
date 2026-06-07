import { wrap, type Remote } from "comlink";
import { noteWorkerApi, type NoteWorkerApi } from "./noteWorkerApi";

let workerApi: Remote<NoteWorkerApi> | NoteWorkerApi | null = null;

export function getNoteWorker() {
  if (!workerApi) {
    try {
      const worker = new Worker(new URL("./noteWorker.ts", import.meta.url), { type: "module" });
      workerApi = wrap<NoteWorkerApi>(worker);
    } catch {
      workerApi = noteWorkerApi;
    }
  }
  return workerApi;
}
