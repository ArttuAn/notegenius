import fs from "node:fs";
import path from "node:path";

export function resolveDatabasePath(configured: string | undefined, cwd = process.cwd()): string {
  const root = path.resolve(cwd, "data");
  const candidate = path.resolve(cwd, configured ?? path.join(root, "notegenius.db"));
  if (!candidate.startsWith(root + path.sep) || path.extname(candidate) !== ".db") {
    throw new Error("DATABASE_URL must point to a .db file inside the app's data directory");
  }
  return candidate;
}

export function prepareDatabasePath(configured: string | undefined, cwd = process.cwd()): string {
  const candidate = resolveDatabasePath(configured, cwd);
  const root = path.resolve(cwd, "data");
  fs.mkdirSync(root, { recursive: true });
  const realRoot = fs.realpathSync(root);
  // Check the closest existing ancestor before creating any nested directories.
  let ancestor = path.dirname(candidate);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== realRoot && !realAncestor.startsWith(realRoot + path.sep)) {
    throw new Error("Database directory escapes the data directory through a symbolic link");
  }
  // Mutable database files are runtime data and must not enter the server bundle.
  if (fs.existsSync(/* turbopackIgnore: true */ candidate) &&
      !fs.realpathSync(/* turbopackIgnore: true */ candidate).startsWith(realRoot + path.sep)) {
    throw new Error("Database file escapes the data directory through a symbolic link");
  }
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  return candidate;
}
