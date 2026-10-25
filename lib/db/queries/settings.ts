import { db } from "../index";
import { normalizeSettings } from "../../settings";

export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return normalizeSettings(Object.fromEntries(rows.map(({ key, value }) => [key, value])));
}
