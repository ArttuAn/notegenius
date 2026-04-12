"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pin, PinOff, Trash2, StickyNote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

type Note = {
  id: string;
  title: string;
  content: string;
  pinned: number;
  created_at: number;
  updated_at: number;
};

export function NotesPanel({ notebookId }: { notebookId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/notes?notebookId=${notebookId}`)
      .then((r) => r.json())
      .then((data) => {
        setNotes(Array.isArray(data) ? data : []);
        if (data.length > 0) setActiveNoteId(data[0].id);
      })
      .catch(() => {});
  }, [notebookId]);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  async function createNote() {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebookId, title: "New Note", content: "" }),
    });
    const note = await res.json();
    setNotes((prev) => [note, ...prev]);
    setActiveNoteId(note.id);
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(notes.find((n) => n.id !== id)?.id ?? null);
    toast.success("Note deleted");
  }

  async function togglePin(note: Note) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: note.pinned ? 0 : 1 }),
    });
    const updated = await res.json();
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)).sort((a, b) => b.pinned - a.pinned || b.updated_at - a.updated_at));
  }

  const updateNote = useCallback(
    (field: "title" | "content", value: string) => {
      if (!activeNoteId) return;
      setNotes((prev) => prev.map((n) => n.id === activeNoteId ? { ...n, [field]: value } : n));

      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/notes/${activeNoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        setSaving(false);
      }, 800);
    },
    [activeNoteId]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</span>
        <div className="flex items-center gap-1">
          {saving && <span className="text-[10px] text-muted-foreground">Saving...</span>}
          {!saving && activeNote && <Check className="h-3 w-3 text-green-500" />}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={createNote}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Note list */}
        <div className="border-b border-border">
          <ScrollArea className="max-h-40">
            <div className="p-1.5 space-y-0.5">
              {notes.length === 0 ? (
                <div className="py-4 text-center">
                  <StickyNote className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No notes yet</p>
                  <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={createNote}>
                    <Plus className="h-3 w-3" />
                    New note
                  </Button>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className={cn(
                      "group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors",
                      activeNoteId === note.id ? "bg-accent" : "hover:bg-accent/50"
                    )}
                  >
                    {note.pinned ? <Pin className="h-3 w-3 text-primary shrink-0" /> : <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className="text-xs flex-1 truncate">{note.title || "Untitled"}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(note); }}
                        className="p-0.5 hover:text-primary text-muted-foreground transition-colors"
                      >
                        {note.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="p-0.5 hover:text-destructive text-muted-foreground transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Note editor */}
        {activeNote ? (
          <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
            <Input
              value={activeNote.title}
              onChange={(e) => updateNote("title", e.target.value)}
              className="text-sm font-medium border-0 border-b border-border rounded-none px-1 focus-visible:ring-0 focus-visible:border-primary h-8"
              placeholder="Note title..."
            />
            <textarea
              value={activeNote.content}
              onChange={(e) => updateNote("content", e.target.value)}
              placeholder="Write your notes here... Markdown is supported."
              className="flex-1 w-full text-sm bg-transparent resize-none focus:outline-none leading-relaxed placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <StickyNote className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Select or create a note</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
