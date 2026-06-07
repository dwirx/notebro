import { openDB } from "idb";
import type { StateStorage } from "zustand/middleware";

const prefix = "quicknote:";
const dbPromise = openDB("quicknote-db", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("zustand")) {
      db.createObjectStore("zustand");
    }
  },
});

export const indexedDbStorage: StateStorage = {
  async getItem(name) {
    const db = await dbPromise;
    const key = `${prefix}${name}`;
    let value = await db.get("zustand", key);
    if (!value && typeof localStorage !== "undefined") {
      value = localStorage.getItem(name);
      if (value) await db.put("zustand", value, key);
    }
    return value ?? null;
  },
  async setItem(name, value) {
    const db = await dbPromise;
    await db.put("zustand", value, `${prefix}${name}`);
  },
  async removeItem(name) {
    const db = await dbPromise;
    await db.delete("zustand", `${prefix}${name}`);
  },
};
