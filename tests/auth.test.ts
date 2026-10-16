import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeRequest } from "../lib/auth";

function request(path = "/api/notebooks", headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000${path}`, { headers });
}
const authorization = () => `Basic ${Buffer.from(`admin:${"p".repeat(32)}`).toString("base64")}`;

beforeEach(() => {
  vi.stubEnv("NOTEGENIUS_PASSWORD", "p".repeat(32));
  vi.stubEnv("NOTEGENIUS_USERNAME", "admin");
  vi.stubEnv("NOTEGENIUS_ORIGIN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("owner access", () => {
  it("fails closed without a strong configured password", () => {
    vi.stubEnv("NOTEGENIUS_PASSWORD", "");
    expect(authorizeRequest(request())?.status).toBe(503);
  });
  it("rejects missing, malformed and incorrect credentials", () => {
    for (const value of ["", "Basic !!!!", "Bearer fake", `Basic ${Buffer.from("admin:wrong").toString("base64")}`]) {
      expect(authorizeRequest(request("/api/chat", { authorization: value }))?.status).toBe(401);
    }
  });
  it("accepts the authenticated owner", () => {
    expect(authorizeRequest(request("/api/notebooks", { authorization: authorization() }))).toBeNull();
  });
  it("rejects cross-origin use even when credentials are present", () => {
    expect(authorizeRequest(request("/api/chat", { authorization: authorization(), origin: "https://evil.example" }))?.status).toBe(403);
  });
  it("requires an explicit matching remote origin", () => {
    const remote = new Request("https://notes.example.com/api/notebooks", { headers: { authorization: authorization() } });
    expect(authorizeRequest(remote)?.status).toBe(403);
    vi.stubEnv("NOTEGENIUS_ORIGIN", "https://notes.example.com");
    expect(authorizeRequest(remote)).toBeNull();
    expect(authorizeRequest(new Request("https://other.example.com/", { headers: { authorization: authorization() } }))?.status).toBe(403);
  });
});
