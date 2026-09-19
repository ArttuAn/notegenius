import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { migrate } from "./migrate";

const DB_PATH =
  process.env.DATABASE_URL ??
  path.join(process.cwd(), "data", "notegenius.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const instance = new Database(DB_PATH);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  migrate(instance);
  return instance;
}

// Opened on first use, never at import time.
//
// `next build` collects page data by importing every route in several worker
// processes at once. Connecting at module scope meant each of them opened the
// same SQLite file and ran the migration concurrently, and the build died with
// SQLITE_BUSY before it could emit anything. Nothing touches the database
// until a request actually arrives, so there is no reason to connect earlier.
function getDb(): Database.Database {
  if (!globalThis.__db) {
    globalThis.__db = createDb();
  }
  return globalThis.__db;
}

export const db = new Proxy({} as Database.Database, {
  get(_target, property) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[property];
    return typeof value === "function" ? value.bind(real) : value;
  },
  set(_target, property, value) {
    (getDb() as unknown as Record<string | symbol, unknown>)[property] = value;
    return true;
  },
  has(_target, property) {
    return property in (getDb() as unknown as object);
  },
});
