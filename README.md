# NoteGenius

A self-hostable, open-source NotebookLM alternative powered by **Claude AI** (claude-sonnet-4-6).

Upload documents, paste text, add web URLs or YouTube videos — then chat with your sources, generate insights, and take notes, all in one workspace.

## Why NoteGenius > NotebookLM

| Feature | NoteGenius | NotebookLM |
|---------|-----------|------------|
| AI Model | Claude (superior reasoning) | Gemini |
| Self-hostable | ✅ Yes | ❌ No |
| Open source | ✅ Yes | ❌ No |
| Source limits | ✅ Unlimited | ❌ 50 sources |
| Inline citation popovers | ✅ Show exact passages | ⚠️ Basic |
| Notes panel | ✅ Markdown notes alongside chat | ⚠️ Limited |
| Generation types | ✅ 7 types | ⚠️ Fewer |
| Local data storage | ✅ SQLite, your machine | ❌ Google cloud |
| Dark mode | ✅ Built-in | ❌ Light only |

## Features

- **Multi-source notebooks** — PDF upload, web URLs, YouTube videos (auto-transcript), plain text
- **Grounded AI chat** — Answers sourced from your documents with inline `[1]` citation chips. Click any citation to see the exact passage.
- **7 generation types** — Executive Summary, FAQ, Study Guide, Timeline, Key Topics, Concept Map, Podcast Script
- **Notes panel** — Markdown notes with auto-save, pin, and per-notebook organization
- **FTS5 retrieval** — Fast SQLite full-text search, no vector DB or Python required
- **Streaming** — All AI responses stream in real-time
- **Dark mode** — System, light, or dark theme
- **100% local** — Only external dependency is the Claude API key

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + Radix UI primitives
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Database**: SQLite via `better-sqlite3` with FTS5 for full-text search
- **Ingestion**: `pdf-parse`, `cheerio`, `youtube-transcript`

## Getting Started

### Prerequisites

- Node.js 18+
- A Claude API key from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
git clone https://github.com/your-username/notegenius
cd notegenius
npm install
```

### Configuration

```bash
cp .env.example .env.local
# Edit .env.local and add your CLAUDE_API_KEY
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is created automatically at `./data/notegenius.db` on first run.

## Project Structure

```
app/
  api/           # REST API routes (notebooks, sources, chat, generate, notes)
  notebook/[id]  # Notebook workspace page
  notebooks/     # Notebooks list page
lib/
  ai/            # Claude client, prompts, streaming chat & generation
  db/            # SQLite schema, migrations, typed query helpers
  ingestion/     # PDF, URL, YouTube, text extractors + chunker
components/
  notebook/      # SourcesPanel, ChatPanel, GeneratePanel, NotesPanel
  notebooks/     # Notebooks grid page
  ui/            # Shared UI primitives (Button, Dialog, etc.)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAUDE_API_KEY` | ✅ | — | Your Anthropic API key |
| `DATABASE_URL` | ❌ | `./data/notegenius.db` | Custom SQLite path |

## License

MIT
