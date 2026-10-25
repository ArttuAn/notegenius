import { afterEach, describe, expect, it, vi } from "vitest";
import { JSON_BODY_LIMIT, readJsonBody, readSourceForm, withRequestErrors } from "../lib/request";

afterEach(() => vi.useRealTimers());
const jsonRequest = (body: BodyInit, headers: Record<string, string> = {}) => new Request("http://localhost/api/test", {
  method: "POST", body, headers: { "content-type": "application/json", ...headers },
});

describe("bounded request parsing", () => {
  it("accepts a JSON object and a real multipart upload", async () => {
    expect(await readJsonBody(jsonRequest('{"message":"hello"}'))).toEqual({ message: "hello" });
    const form = new FormData();
    form.set("file", new File(["%PDF-1.7"], "test.pdf"));
    const parsed = await readSourceForm(new Request("http://localhost", { method: "POST", body: form }));
    expect((parsed.get("file") as File).name).toBe("test.pdf");
  });
  it("rejects a declared oversized body before reading it", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const request = new Request("http://localhost", { method: "POST", body, duplex: "half", headers: {
      "content-type": "application/json", "content-length": String(JSON_BODY_LIMIT + 1),
    } } as RequestInit);
    await expect(readJsonBody(request)).rejects.toMatchObject({ status: 413 });
    expect(request.bodyUsed).toBe(false);
  });
  it("enforces the streamed byte count when length is absent or understated", async () => {
    for (const headers of [{}, { "content-length": "1" }] as Record<string, string>[]) {
      await expect(readJsonBody(jsonRequest("x".repeat(JSON_BODY_LIMIT + 1), headers)))
        .rejects.toMatchObject({ status: 413 });
    }
  });
  it("rejects invalid JSON, scalar bodies, invalid UTF-8, and wrong content types", async () => {
    for (const body of ["{", "null", "[]", '"text"', "1", new Uint8Array([0xff])]) {
      await expect(readJsonBody(jsonRequest(body))).rejects.toMatchObject({ status: 400 });
    }
    await expect(readJsonBody(jsonRequest("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    await expect(readSourceForm(jsonRequest("{}"))).rejects.toMatchObject({ status: 415 });
  });
  it("times out and cancels a stalled body", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" },
      body: new ReadableStream({ cancel }), duplex: "half" } as RequestInit);
    const result = expect(readJsonBody(request)).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(15000);
    await result;
    expect(cancel).toHaveBeenCalled();
  });
  it("returns client errors while leaving unexpected errors visible to the server", async () => {
    const handler = withRequestErrors(async (req) => Response.json(await readJsonBody(req)));
    expect((await handler(jsonRequest("[]"))).status).toBe(400);
    const broken = withRequestErrors(async () => { throw new Error("unexpected"); });
    await expect(broken(jsonRequest("{}"))).rejects.toThrow("unexpected");
  });
});
