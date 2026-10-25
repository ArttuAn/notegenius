import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamGenerate } from "../lib/ai/generate";
import { getClient } from "../lib/ai/client";
import { getSource, listSources } from "../lib/db/queries/sources";
import type { Source } from "../lib/db/schema";

vi.mock("../lib/ai/client", () => ({ getClient: vi.fn(), MODEL: "test" }));
vi.mock("../lib/db/queries/sources", () => ({ getSource: vi.fn(), listSources: vi.fn() }));
const stream = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getClient).mockReturnValue({ messages: { stream } } as never);
  stream.mockImplementation(async function* () { yield { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } }; });
});
const source = (id: string, notebook_id = "nb_one", status = "ready") => ({ id, notebook_id, status, title: id, raw_text: "x".repeat(10000) }) as Source;
async function consume(ids?: string[]) { for await (const text of streamGenerate("nb_one", "summary", ids)) expect(text).toBe("ok"); }

describe("generation provider context", () => {
  it("excludes foreign and unfinished selected sources even outside the route handler", async () => {
    vi.mocked(getSource).mockImplementation((id) => id === "allowed" ? source(id) : id === "foreign" ? source(id, "nb_two") : source(id, "nb_one", "processing"));
    await consume(["allowed", "foreign", "unfinished"]);
    const prompt = stream.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('"allowed"');
    expect(prompt).not.toContain('"foreign"');
    expect(prompt).not.toContain('"unfinished"');
  });
  it("bounds context for large notebooks before sending to the provider", async () => {
    vi.mocked(listSources).mockReturnValue(Array.from({ length: 100 }, (_, i) => source(`source${i}`)));
    await consume();
    const prompt = stream.mock.calls[0][0].messages[0].content as string;
    const context = prompt.split("<sources>\n")[1].split("\n</sources>")[0];
    expect(context.length).toBeLessThan(64100);
    expect(context).not.toContain('"source99"');
  });
});
