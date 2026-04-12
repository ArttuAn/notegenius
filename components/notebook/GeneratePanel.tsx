"use client";

import { useState } from "react";
import { Sparkles, FileText, HelpCircle, BookOpen, Clock, Hash, Network, Mic, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

type Generation = {
  id: string;
  type: string;
  title: string;
  content: string;
  created_at: number;
};

type Source = { id: string; title: string; status: string };

type Props = {
  notebookId: string;
  sources: Source[];
  generations: Generation[];
  onGenerationAdded: (g: Generation) => void;
};

const GENERATION_TYPES = [
  { id: "summary", label: "Summary", icon: FileText, desc: "Executive summary of all sources" },
  { id: "faq", label: "FAQ", icon: HelpCircle, desc: "Frequently asked questions & answers" },
  { id: "study_guide", label: "Study Guide", icon: BookOpen, desc: "Key concepts, definitions & practice Qs" },
  { id: "timeline", label: "Timeline", icon: Clock, desc: "Chronological events extracted" },
  { id: "key_topics", label: "Key Topics", icon: Hash, desc: "Top themes with analysis" },
  { id: "concept_map", label: "Concept Map", icon: Network, desc: "Hierarchical idea relationships" },
  { id: "audio_script", label: "Podcast Script", icon: Mic, desc: "Two-host podcast dialogue" },
] as const;

export function GeneratePanel({ notebookId, sources, generations, onGenerationAdded }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const readySources = sources.filter((s) => s.status === "ready");

  async function generate(type: string) {
    if (readySources.length === 0) {
      toast.error("Add sources before generating content");
      return;
    }
    setGenerating(type);
    setStreamText("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "text") {
            fullContent += data.text;
            setStreamText(fullContent);
          } else if (data.type === "done" && data.generation) {
            onGenerationAdded(data.generation);
            setExpandedId(data.generation.id);
            toast.success(`${data.generation.title} generated!`);
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Generation failed");
    } finally {
      setGenerating(null);
      setStreamText("");
    }
  }

  async function deleteGeneration(id: string) {
    await fetch("/api/generate", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Deleted");
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {/* Generation type buttons */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Generate</h3>
            <div className="grid grid-cols-2 gap-2">
              {GENERATION_TYPES.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => generate(id)}
                  disabled={!!generating || readySources.length === 0}
                  className={cn(
                    "flex items-start gap-2.5 p-3 rounded-lg border border-border text-left hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    generating === id && "border-primary/50 bg-primary/5"
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", generating === id ? "text-primary animate-pulse" : "text-muted-foreground")} />
                  <div>
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {readySources.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Add sources to enable generation
              </p>
            )}
          </div>

          {/* Streaming preview */}
          {generating && streamText && (
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">Generating...</span>
              </div>
              <div className="prose text-sm text-foreground whitespace-pre-wrap line-clamp-10">
                {streamText}
              </div>
            </div>
          )}

          {/* Past generations */}
          {generations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Generated Content</h3>
              <div className="space-y-2">
                {generations.map((gen) => (
                  <GenerationCard
                    key={gen.id}
                    generation={gen}
                    expanded={expandedId === gen.id}
                    onToggle={() => setExpandedId(expandedId === gen.id ? null : gen.id)}
                    onDelete={() => deleteGeneration(gen.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function GenerationCard({
  generation,
  expanded,
  onToggle,
  onDelete,
}: {
  generation: Generation;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const typeConfig = GENERATION_TYPES.find((t) => t.id === generation.type);
  const Icon = typeConfig?.icon ?? FileText;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent transition-colors"
        onClick={onToggle}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1">{generation.title}</span>
        <span className="text-[10px] text-muted-foreground">
          {new Date(generation.created_at).toLocaleDateString()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      {expanded && (
        <div className="border-t border-border p-4">
          <div className="prose text-sm text-foreground whitespace-pre-wrap">{generation.content}</div>
        </div>
      )}
    </div>
  );
}
