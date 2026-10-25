export const JSON_BODY_LIMIT = 1024 * 1024;
export const UPLOAD_BODY_LIMIT = 12 * 1024 * 1024;

export class RequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function withRequestErrors<RequestType extends Request, Args extends unknown[]>(
  handler: (request: RequestType, ...args: Args) => Promise<Response>
) {
  return async (request: RequestType, ...args: Args): Promise<Response> => {
    try { return await handler(request, ...args); }
    catch (error) {
      if (!(error instanceof RequestError)) throw error;
      return Response.json({ error: error.message }, { status: error.status });
    }
  };
}

// Count bytes from the stream: Content-Length can be missing or dishonest.
async function readBody(request: Request, limit: number): Promise<Buffer> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new RequestError("Invalid Content-Length");
  }
  if (length !== null && Number(length) > limit) throw new RequestError("Request body is too large", 413);
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestError("Request body timed out", 408)), 15000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > limit) throw new RequestError("Request body is too large", 413);
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof RequestError) throw error;
    throw new RequestError("Could not read request body");
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError("Content-Type must be application/json", 415);
  }
  const body = await readBody(request, JSON_BODY_LIMIT);
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new RequestError("Invalid JSON body"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new RequestError("Expected a JSON object");
  return parsed as Record<string, unknown>;
}

export async function readSourceForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "multipart/form-data") {
    throw new RequestError("Content-Type must be multipart/form-data", 415);
  }
  const body = await readBody(request, UPLOAD_BODY_LIMIT);
  try { return await new Response(new Uint8Array(body), { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new RequestError("Invalid multipart body"); }
}

export function requiredString(value: unknown, name: string, maxLength = 128): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new RequestError(`${name} must be a non-empty string of at most ${maxLength} characters`);
  }
  return value;
}

export function optionalString(value: unknown, name: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) throw new RequestError(`${name} must be a string of at most ${maxLength} characters`);
  return value;
}
