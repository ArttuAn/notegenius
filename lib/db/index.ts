import Database from "better-sqlite3";
import { migrate } from "./migrate";
import { prepareDatabasePath } from "./path";

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createDb() {
  const databasePath = prepareDatabasePath(process.env.DATABASE_URL);
  const instance = new Database(databasePath);
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
