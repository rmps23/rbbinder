// Local file-backed database used only when SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are not set, so the app is fully usable for
// local testing without a Supabase account. See repo.ts for the functions
// that read/write through here (never used in production on Vercel, where
// the filesystem is ephemeral - configure real Supabase before deploying).

import { promises as fs } from "fs";
import path from "path";
import type { RiftCard } from "./types";

const DB_PATH = path.join(process.cwd(), ".data", "local-db.json");

export type LocalCard = { id: string; setId: string; payload: RiftCard; updatedAt: string };
export type LocalSet = { id: string; name: string; cardCount: number; updatedAt: string };
export type LocalBinder = {
  id: string;
  name: string;
  layout: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
export type LocalBinderCard = { binderId: string; cardId: string; qty: number; updatedAt: string };
export type LocalBulk = { cardId: string; qty: number; updatedAt: string };

export type LocalDb = {
  cards: LocalCard[];
  sets: LocalSet[];
  binders: LocalBinder[];
  binderCards: LocalBinderCard[];
  bulk: LocalBulk[];
};

const EMPTY_DB: LocalDb = { cards: [], sets: [], binders: [], binderCards: [], bulk: [] };

// Serializes reads/writes within this process so concurrent requests don't
// clobber each other's changes (good enough for a single local dev user).
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => undefined);
  return result;
}

async function readDb(): Promise<LocalDb> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

async function writeDb(db: LocalDb): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export function readLocalDb(): Promise<LocalDb> {
  return serialized(readDb);
}

export function withLocalDb<T>(fn: (db: LocalDb) => T | Promise<T>): Promise<T> {
  return serialized(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
}
