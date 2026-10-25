import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ai/chat", () => ({ streamChat: vi.fn(async function* () { yield { type: "done" }; }) }));
vi.mock("../lib/ai/generate", () => ({ streamGenerate: vi.fn(async function* () { yield "generated"; }) }));
vi.mock("../lib/ingestion", () => ({ ingestSource: vi.fn(async () => {}) }));

let dir: string;
let modules: Awaited<ReturnType<typeof load>>;
async function load() {
  return {
    notebooks: await import("../lib/db/queries/notebooks"),
    sources: await import("../lib/db/queries/sources"),
    sessions: await import("../lib/db/queries/sessions"),
    settings: await import("../app/api/settings/route"),
    chat: await import("../app/api/chat/route"),
    generate: await import("../app/api/generate/route"),
    upload: await import("../app/api/sources/route"),
    aiChat: await import("../lib/ai/chat"),
    aiGenerate: await import("../lib/ai/generate"),
    ingestion: await import("../lib/ingestion"),
    database: await import("../lib/db"),
  };
}
beforeAll(async () => {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  dir = fs.mkdtempSync(path.join(process.cwd(), "data", "notegenius-input-"));
  vi.stubEnv("DATABASE_URL", path.join(dir, "test.db"));
  vi.stubEnv("NOTEGENIUS_PASSWORD", "p".repeat(32));
  vi.stubEnv("NOTEGENIUS_USERNAME", "admin");
  vi.stubEnv("NOTEGENIUS_ORIGIN", "");
  modules = await load();
});
afterAll(() => {
  modules.database.db.close();
  delete globalThis.__db;
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});
function request(endpoint: string, body: unknown, method = "POST") {
  return new NextRequest(`http://localhost:3000/api/${endpoint}`, { method,
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`admin:${"p".repeat(32)}`).toString("base64")}` },
    body: JSON.stringify(body),
  });
}
function formRequest(form: FormData) {
  return new NextRequest("http://localhost:3000/api/sources", { method: "POST", body: form,
    headers: { authorization: `Basic ${Buffer.from(`admin:${"p".repeat(32)}`).toString("base64")}` },
  });
}

describe("API security boundaries", () => {
  it("rejects unauthenticated requests before reading their bodies", async () => {
    const denied = new NextRequest("http://localhost:3000/api/settings", { method: "PATCH", body: "invalid" });
    expect((await modules.settings.PATCH(denied)).status).toBe(401);
    expect(denied.bodyUsed).toBe(false);
  });
  it("rejects unsafe settings without changing the database", async () => {
    for (const body of [{ key: "top_k", value: -1 }, { key: "chunk_overlap", value: 1200 }, { key: "chunk_size", value: 0 }, { key: "other", value: "x" }]) {
      expect((await modules.settings.PATCH(request("settings", body, "PATCH"))).status).toBe(400);
    }
    expect(modules.database.db.prepare("SELECT value FROM settings WHERE key = 'top_k'").get()).toEqual({ value: "8" });
    expect((await modules.settings.PATCH(request("settings", { key: "top_k", value: 12 }, "PATCH"))).status).toBe(200);
  });
  it("rejects cross-notebook chat sessions before saving a message or calling AI", async () => {
    const one = modules.notebooks.createNotebook("One");
    const two = modules.notebooks.createNotebook("Two");
    const session = modules.sessions.createSession(two.id);
    expect((await modules.chat.POST(request("chat", { notebookId: one.id, sessionId: session.id, message: "hello" }))).status).toBe(404);
    expect(modules.sessions.listMessages(session.id)).toEqual([]);
    expect(modules.aiChat.streamChat).not.toHaveBeenCalled();
  });
  it("rejects another notebook's source and invalid generation types before AI", async () => {
    const one = modules.notebooks.createNotebook("Generate One");
    const two = modules.notebooks.createNotebook("Generate Two");
    const source = modules.sources.createSource(two.id, "text", "Private", "private text");
    modules.sources.updateSourceStatus(source.id, "ready", { rawText: "private text" });
    for (const body of [
      { notebookId: one.id, type: "summary", sourceIds: [source.id] },
      { notebookId: one.id, type: "constructor" },
      { notebookId: one.id, type: "summary", sourceIds: "bad" },
    ]) expect((await modules.generate.POST(request("generate", body))).status).toBe(400);
    expect(modules.aiGenerate.streamGenerate).not.toHaveBeenCalled();
  });
  it("accepts valid chat and generation requests", async () => {
    const notebook = modules.notebooks.createNotebook("Valid");
    const session = modules.sessions.createSession(notebook.id);
    const chat = await modules.chat.POST(request("chat", { notebookId: notebook.id, sessionId: session.id, message: "hello" }));
    expect(chat.status).toBe(200);
    expect(await chat.text()).toContain('"type":"done"');
    const generation = await modules.generate.POST(request("generate", { notebookId: notebook.id, type: "summary" }));
    expect(await generation.text()).toContain("generated");
  });
  it("rejects malformed or oversized source fields before creating a source", async () => {
    const notebook = modules.notebooks.createNotebook("Uploads");
    for (const [type, field, value] of [
      ["pdf", "file", "not a file"], ["text", "text", new File(["data"], "text.txt")],
      ["text", "text", "x".repeat(1024 * 1024 + 1)], ["url", "url", "http://127.0.0.1/"],
    ] as const) {
      const form = new FormData();
      form.set("notebookId", notebook.id); form.set("type", type); form.set(field, value);
      expect((await modules.upload.POST(formRequest(form))).status).toBe(400);
    }
    expect(modules.sources.listSources(notebook.id)).toEqual([]);
    expect(modules.ingestion.ingestSource).not.toHaveBeenCalled();
  });
  it("accepts a valid text source", async () => {
    const notebook = modules.notebooks.createNotebook("Text");
    const form = new FormData();
    form.set("notebookId", notebook.id); form.set("type", "text"); form.set("text", "A source.");
    const response = await modules.upload.POST(formRequest(form));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"status":"ready"');
    expect(modules.sources.listSources(notebook.id)).toHaveLength(1);
  });
  it("rejects oversized and mislabeled PDFs before creating a source", async () => {
    const notebook = modules.notebooks.createNotebook("PDF checks");
    for (const [file, status] of [
      [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf"), 413],
      [new File(["not a PDF"], "fake.pdf", { type: "application/pdf" }), 400],
    ] as const) {
      const form = new FormData();
      form.set("notebookId", notebook.id); form.set("type", "pdf"); form.set("file", file);
      expect((await modules.upload.POST(formRequest(form))).status).toBe(status);
    }
    expect(modules.sources.listSources(notebook.id)).toEqual([]);
  });
});
