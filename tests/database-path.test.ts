import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareDatabasePath, resolveDatabasePath } from "../lib/db/path";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "notegenius-path-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe("database storage boundary", () => {
  it("supports the default path and nested databases inside data", () => {
    expect(resolveDatabasePath(undefined, root)).toBe(path.join(root, "data", "notegenius.db"));
    const file = prepareDatabasePath("data/nested/notes.db", root);
    expect(file).toBe(path.join(root, "data", "nested", "notes.db"));
    expect(fs.statSync(path.dirname(file)).isDirectory()).toBe(true);
    expect(resolveDatabasePath(file, root)).toBe(file);
  });
  it("rejects traversal, outside absolute paths, and prefix lookalikes before filesystem writes", () => {
    for (const file of ["data/../../outside.db", path.join(root, "outside.db"), "data-backup/notes.db", "data/notes.txt", "data"]) {
      expect(() => prepareDatabasePath(file, root), file).toThrow(/DATABASE_URL/);
    }
    expect(fs.existsSync(path.join(root, "data"))).toBe(false);
  });
  it("rejects a directory link that escapes data without creating children outside", () => {
    const outside = path.join(root, "outside");
    const data = path.join(root, "data");
    fs.mkdirSync(outside); fs.mkdirSync(data);
    fs.symlinkSync(outside, path.join(data, "link"), process.platform === "win32" ? "junction" : "dir");
    expect(() => prepareDatabasePath("data/link/new/notes.db", root)).toThrow(/symbolic link/);
    expect(fs.existsSync(path.join(outside, "new"))).toBe(false);
  });
  it.skipIf(process.platform === "win32")("rejects a database file symlink escaping data", () => {
    const data = path.join(root, "data");
    fs.mkdirSync(data);
    const outside = path.join(root, "outside.db");
    fs.writeFileSync(outside, "existing");
    fs.symlinkSync(outside, path.join(data, "linked.db"));
    expect(() => prepareDatabasePath("data/linked.db", root)).toThrow(/symbolic link/);
    expect(fs.readFileSync(outside, "utf8")).toBe("existing");
  });
});
