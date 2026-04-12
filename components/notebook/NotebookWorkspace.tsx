"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Brain, Moon, Sun, Monitor, FileText, MessageSquare, Sparkles, StickyNote, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SourcesPanel } from "./SourcesPanel";
import { ChatPanel } from "./ChatPanel";
import { GeneratePanel } from "./GeneratePanel";
import { NotesPanel } from "./NotesPanel";
import { toast } from "sonner";

type Notebook = {
  id: string;
  title: string;
  description: string | null;
  sources: Source[];
  generations: Generation[];
};

type Source = {
  id: string;
  title: string;
  type: string;
  status: string;
  char_count: number;
  created_at: number;
};

type Generation = {
  id: string;
  type: string;
  title: string;
  content: string;
  created_at: number;
};

type Session = {
  id: string;
  title: string;
  created_at: number;
};

export function NotebookWorkspace({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");

  const loadNotebook = useCallback(async () => {
    try {
      const [nbRes, sessRes] = await Promise.all([
        fetch(`/api/notebooks/${notebookId}`),
        fetch(`/api/chat/sessions?notebookId=${notebookId}`),
      ]);
      if (!nbRes.ok) { router.push("/notebooks"); return; }
      const nb = await nbRes.json();
      const sess = await sessRes.json();
      setNotebook(nb);
      setSessions(sess);
      if (sess.length > 0 && !activeSessionId) setActiveSessionId(sess[0].id);
    } catch {
      toast.error("Failed to load notebook");
    } finally {
      setLoading(false);
    }
  }, [notebookId, router, activeSessionId]);

  useEffect(() => { loadNotebook(); }, [notebookId]);

  const handleSourceAdded = useCallback((source: Source) => {
    setNotebook((prev) => prev ? { ...prev, sources: [...prev.sources, source] } : prev);
  }, []);

  const handleSourceUpdated = useCallback((updated: Source) => {
    setNotebook((prev) => prev ? {
      ...prev,
      sources: prev.sources.map((s) => s.id === updated.id ? updated : s),
    } : prev);
  }, []);

  const handleSourceDeleted = useCallback((id: string) => {
    setNotebook((prev) => prev ? {
      ...prev,
      sources: prev.sources.filter((s) => s.id !== id),
    } : prev);
  }, []);

  const handleGenerationAdded = useCallback((gen: Generation) => {
    setNotebook((prev) => prev ? { ...prev, generations: [gen, ...prev.generations] } : prev);
    setActiveTab("generate");
  }, []);

  const themeIcon = theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading notebook...</span>
        </div>
      </div>
    );
  }

  if (!notebook) return null;

  const readySources = notebook.sources.filter((s) => s.status === "ready");

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push("/notebooks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Brain className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-semibold text-sm truncate">{notebook.title}</h1>
          {readySources.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
              {readySources.length} source{readySources.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setTheme(nextTheme)}>
          {themeIcon}
        </Button>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Sources */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <SourcesPanel
            notebookId={notebookId}
            sources={notebook.sources}
            onSourceAdded={handleSourceAdded}
            onSourceUpdated={handleSourceUpdated}
            onSourceDeleted={handleSourceDeleted}
          />
        </div>

        {/* Center: Chat / Generate */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <div className="border-b border-border px-4 py-2 shrink-0">
              <TabsList className="h-8">
                <TabsTrigger value="chat" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="generate" className="text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex flex-col">
              <ChatPanel
                notebookId={notebookId}
                sessionId={activeSessionId}
                sources={notebook.sources}
              />
            </TabsContent>

            <TabsContent value="generate" className="flex-1 overflow-hidden mt-0 data-[state=active]:flex flex-col">
              <GeneratePanel
                notebookId={notebookId}
                sources={notebook.sources}
                generations={notebook.generations}
                onGenerationAdded={handleGenerationAdded}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Notes */}
        <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-hidden">
          <NotesPanel notebookId={notebookId} />
        </div>
      </div>
    </div>
  );
}
