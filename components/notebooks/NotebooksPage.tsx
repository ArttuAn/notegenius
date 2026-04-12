"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Trash2, Moon, Sun, Monitor, Brain } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type Notebook = {
  id: string;
  title: string;
  description: string | null;
  created_at: number;
  updated_at: number;
};

export function NotebooksPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notebooks")
      .then((r) => r.json())
      .then((data) => { setNotebooks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function createNotebook() {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() || undefined }),
    });
    if (!res.ok) { toast.error("Failed to create notebook"); return; }
    const nb = await res.json();
    setCreating(false);
    setNewTitle("");
    setNewDesc("");
    router.push(`/notebook/${nb.id}`);
  }

  async function deleteNotebook(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notebook deleted");
  }

  const themeIcon = theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">NoteGenius</span>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Powered by Claude</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(nextTheme)} title="Toggle theme">
            {themeIcon}
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New Notebook
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Notebooks</h1>
          <p className="text-muted-foreground">Upload sources, chat with your documents, and generate AI insights.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No notebooks yet</h3>
            <p className="text-muted-foreground mb-6">Create your first notebook to start researching with AI.</p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Create Notebook
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notebooks.map((nb) => (
              <div
                key={nb.id}
                onClick={() => router.push(`/notebook/${nb.id}`)}
                className="group relative h-36 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {nb.title}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => deleteNotebook(nb.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {nb.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{nb.description}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(nb.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}

            {/* Create new card */}
            <div
              onClick={() => setCreating(true)}
              className="h-36 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">New Notebook</span>
            </div>
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Notebook</DialogTitle>
            <DialogDescription>Give your notebook a name to get started.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Notebook title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createNotebook()}
              autoFocus
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={createNotebook} disabled={!newTitle.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
