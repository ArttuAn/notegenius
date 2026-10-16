import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export function isPublicIp(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }
  return parsed.range() === "unicast";
}

export function validatePublicUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")))) {
    throw new Error("Only public HTTP(S) URLs on standard ports are supported");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicIp(host)) throw new Error("Private or reserved destinations are not allowed");
  return url;
}

async function resolvePublicAddress(url: URL, remaining: number) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return { address: host, family: isIP(host) };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("URL lookup timed out")), remaining);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error("Private or reserved destinations are not allowed");
  }
  return addresses[0];
}

export async function fetchPublicPage(value: string): Promise<string> {
  const deadline = Date.now() + 15000;
  let url = validatePublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("URL import timed out");
    const address = await resolvePublicAddress(url, remaining);
    const result = await new Promise<{ text?: string; location?: string }>((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const request = transport.get(url, {
        agent: false,
        family: address.family,
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        headers: { "User-Agent": "NoteGenius/1.0", "Accept": "text/html,application/xhtml+xml,text/plain" },
      }, (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location;
          response.destroy();
          if (!location) reject(new Error("Redirect has no location"));
          else resolve({ location });
          return;
        }
        if (status < 200 || status >= 300) {
          response.destroy();
          reject(new Error(`URL returned HTTP ${status}`));
          return;
        }
        const contentType = response.headers["content-type"]?.split(";")[0].trim().toLowerCase();
        if (!contentType || !["text/html", "application/xhtml+xml", "text/plain"].includes(contentType)) {
          response.destroy();
          reject(new Error("URL must return HTML or plain text"));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy();
            reject(new Error("URL response exceeds 5 MiB"));
          } else chunks.push(chunk);
        });
        response.on("end", () => resolve({ text: Buffer.concat(chunks).toString("utf8") }));
        response.on("error", reject);
        response.on("aborted", () => reject(new Error("URL response was interrupted")));
      });
      request.on("error", reject);
    });
    if (result.location) {
      url = validatePublicUrl(new URL(result.location, url).href);
      continue;
    }
    return result.text ?? "";
  }
  throw new Error("Too many URL redirects");
}
