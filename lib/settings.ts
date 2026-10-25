export type Settings = { theme: string; chunk_size: number; chunk_overlap: number; top_k: number };
export const DEFAULT_SETTINGS: Settings = { theme: "system", chunk_size: 1200, chunk_overlap: 200, top_k: 8 };

function integer(value: unknown): number {
  if (typeof value === "number") return value;
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
}

export function validSetting(key: string, value: unknown, settings: Settings): boolean {
  if (key === "theme") return typeof value === "string" && ["system", "light", "dark"].includes(value);
  const number = integer(value);
  if (!Number.isSafeInteger(number)) return false;
  if (key === "top_k") return number >= 1 && number <= 32;
  if (key === "chunk_size") return number >= 256 && number <= 4000 && settings.chunk_overlap <= number / 2;
  if (key === "chunk_overlap") return number >= 0 && number <= settings.chunk_size / 2;
  return false;
}

// Validate on read too: databases can contain values saved by older versions.
export function normalizeSettings(values: Record<string, unknown>): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  if (typeof values.theme === "string" && validSetting("theme", values.theme, settings)) settings.theme = values.theme;
  if (validSetting("top_k", values.top_k, settings)) settings.top_k = integer(values.top_k);
  const size = integer(values.chunk_size);
  const overlap = integer(values.chunk_overlap);
  if (Number.isSafeInteger(size) && size >= 256 && size <= 4000) settings.chunk_size = size;
  if (Number.isSafeInteger(overlap) && overlap >= 0 && overlap <= settings.chunk_size / 2) settings.chunk_overlap = overlap;
  else settings.chunk_overlap = Math.min(DEFAULT_SETTINGS.chunk_overlap, Math.floor(settings.chunk_size / 2));
  return settings;
}
