import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import http from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicPage, isPublicIp, validatePublicUrl } from "../lib/ingestion/public-http";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:http", () => ({ default: { get: vi.fn() } }));
vi.mock("node:https", () => ({ default: { get: vi.fn() } }));
import https from "node:https";

let replies: Array<{ status?: number; location?: string; text?: Buffer; contentType?: string }>;
let optionsSeen: Array<Parameters<typeof http.get>[1]>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never);
  replies = [{ text: Buffer.from("<html>public page</html>") }];
  optionsSeen = [];
  const get = (_url: unknown, options: unknown, callback: (response: unknown) => void) => {
    optionsSeen.push(options as never);
    const reply = replies.shift() ?? {};
    const response = Object.assign(new EventEmitter(), {
      statusCode: reply.status ?? 200,
      headers: { "content-type": reply.contentType ?? "text/html", location: reply.location },
      destroy: vi.fn(),
    });
    queueMicrotask(() => {
      callback(response);
      if ((reply.status ?? 200) === 200) {
        response.emit("data", reply.text ?? Buffer.from("ok"));
        response.emit("end");
      }
    });
    return new EventEmitter();
  };
  vi.mocked(http.get).mockImplementation(get as never);
  vi.mocked(https.get).mockImplementation(get as never);
});

describe("public URL import", () => {
  it("rejects private, loopback, link-local, reserved and mapped addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicIp(address), address).toBe(false);
    }
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });
  it("rejects alternate numeric loopback forms, credentials, schemes and ports", () => {
    for (const url of ["http://127.1", "http://2130706433", "http://0x7f000001", "http://[::ffff:127.0.0.1]", "file:///etc/passwd", "http://user:pass@example.com", "https://example.com:8443"]) {
      expect(() => validatePublicUrl(url), url).toThrow();
    }
  });
  it("rejects DNS destinations with any private address before connecting", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }] as never);
    await expect(fetchPublicPage("http://example.com")).rejects.toThrow(/Private/);
    expect(http.get).not.toHaveBeenCalled();
  });
  it("pins the validated DNS result rather than resolving again at connection time", async () => {
    await expect(fetchPublicPage("http://example.com")).resolves.toContain("public page");
    expect(lookup).toHaveBeenCalledTimes(1);
    const options = optionsSeen[0] as { lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void; family: number };
    const callback = vi.fn();
    options.lookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(options.family).toBe(4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it("rejects redirects to private addresses", async () => {
    replies = [{ status: 302, location: "http://127.0.0.1/admin" }];
    await expect(fetchPublicPage("http://example.com")).rejects.toThrow(/Private/);
    expect(http.get).toHaveBeenCalledTimes(1);
  });
  it("revalidates DNS on each public redirect", async () => {
    replies = [{ status: 302, location: "https://second.example.com" }];
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }] as never);
    await expect(fetchPublicPage("http://example.com")).rejects.toThrow(/Private/);
    expect(https.get).not.toHaveBeenCalled();
  });
  it("rejects oversized responses and unsupported content types", async () => {
    replies = [{ text: Buffer.alloc(5 * 1024 * 1024 + 1) }];
    await expect(fetchPublicPage("http://example.com")).rejects.toThrow(/5 MiB/);
    replies = [{ contentType: "application/octet-stream" }];
    await expect(fetchPublicPage("http://example.com")).rejects.toThrow(/HTML or plain text/);
  });
});
