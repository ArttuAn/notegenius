import { getNotebook } from "./db/queries/notebooks";
import { getSource } from "./db/queries/sources";
import { RequestError, requiredString } from "./request";

export function requireNotebook(value: unknown): string {
  const id = requiredString(value, "notebookId");
  if (!getNotebook(id)) throw new RequestError("Notebook not found", 404);
  return id;
}

export function selectedSourceIds(value: unknown, notebookId: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32) throw new RequestError("sourceIds must contain at most 32 source IDs");
  const ids = value.map((id) => requiredString(id, "sourceId"));
  for (const id of ids) {
    const source = getSource(id);
    if (!source || source.notebook_id !== notebookId || source.status !== "ready") {
      throw new RequestError("Selected sources must be ready and belong to this notebook");
    }
  }
  return [...new Set(ids)];
}
