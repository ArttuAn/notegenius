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

export const db: Database.Database =
  globalThis.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
}
