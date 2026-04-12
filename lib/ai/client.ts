import Anthropic from "@anthropic-ai/sdk";

declare global {
  // eslint-disable-next-line no-var
  var __anthropic: Anthropic | undefined;
}

export function getClient(): Anthropic {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error("CLAUDE_API_KEY environment variable is not set");
  }
  if (!globalThis.__anthropic) {
    globalThis.__anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }
  return globalThis.__anthropic;
}

export const MODEL = "claude-sonnet-4-6";
