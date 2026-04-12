"use client";

import { useState, useRef } from "react";
import { Plus, FileText, Globe, Video, AlignLeft, Trash2, CheckCircle, Clock, AlertCircle, Upload, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

type Source = {
  id: string;
  title: string;
  type: string;
  status: string;
  char_count: number;
  created_at: number;
};

type Props = {
  notebookId: string;
  sources: Source[];
  onSourceAdded: (s: Source) => void;
  onSourceUpdated: (s: Source) => void;
  onSourceDeleted: (id: string) => void;
};

const typeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-3.5 w-3.5" />,
  url: <Globe className="h-3.5 w-3.5" />,
  youtube: <Video className="h-3.5 w-3.5" />,
  text: <AlignLeft className="h-3.5 w-3.5" />,
};

export function SourcesPanel({ notebookId, sources, onSourceAdded, onSourceUpdated, onSourceDeleted }: Props) {
  const [adding, setAdding] = useState(false);
  const [uploadTab, setUploadTab] = useState("file");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ingest(formData: FormData, tempTitle: string, type: string) {
    setUploading(type);
    setAdding(false);

    // Optimistic add
    const tempSource: Source = {
      id: `temp_${Date.now()}`,
      title: tempTitle,
      type,
      status: "processing",
      char_count: 0,
      created_at: Date.now(),
    };
    onSourceAdded(tempSource);

    try {
      const res = await fetch("/api/sources", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let finalSource: Source | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.sourceId) finalSource = { ...tempSource, id: data.sourceId, status: data.status };
          if (data.status === "ready" && finalSource) {
            // Fetch actual source data
            const sr = await fetch(`/api/sources/${data.sourceId}`);
            const full = await sr.json();
            onSourceUpdated({ ...tempSource, ...full });
            toast.success("Source added successfully");
          } else if (data.status === "error") {
            onSourceUpdated({ ...tempSource, status: "error" });
            toast.error(`Failed: ${data.error}`);
          }
        }
      }
    } catch (err) {
      onSourceUpdated({ ...tempSource, status: "error" });
      toast.error("Upload failed");
    } finally {
      setUploading(null);
      setUrl("");
      setText("");
      setTextTitle("");
    }
  }

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("notebookId", notebookId);
    fd.append("type", "pdf");
    fd.append("file", file);
    await ingest(fd, file.name, "pdf");
  }

  async function addUrl() {
    if (!url.trim()) return;
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
    const type = isYoutube ? "youtube" : "url";
    const fd = new FormData();
    fd.append("notebookId", notebookId);
    fd.append("type", type);
    fd.append("url", url.trim());
    await ingest(fd, url.trim(), type);
  }

  async function addText() {
    if (!text.trim()) return;
    const fd = new FormData();
    fd.append("notebookId", notebookId);
    fd.append("type", "text");
    fd.append("text", text.trim());
    fd.append("title", textTitle.trim() || "Text Document");
    await ingest(fd, textTitle.trim() || "Text Document", "text");
  }

  async function deleteSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    onSourceDeleted(id);
    toast.success("Source removed");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sources</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sources.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No sources yet</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setAdding(true)}>
                <Plus className="h-3 w-3" />
                Add source
              </Button>
            </div>
          ) : (
            sources.map((src) => (
              <SourceItem key={src.id} source={src} onDelete={() => deleteSource(src.id)} />
            ))
          )}
        </div>
      </ScrollArea>

      {sources.length > 0 && (
        <div className="p-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3" />
            Add Source
          </Button>
        </div>
      )}

      {/* Add source dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Source</DialogTitle>
          </DialogHeader>
          <Tabs value={uploadTab} onValueChange={setUploadTab}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1 text-xs"><Upload className="h-3 w-3 mr-1" />PDF</TabsTrigger>
              <TabsTrigger value="url" className="flex-1 text-xs"><Link className="h-3 w-3 mr-1" />URL / YouTube</TabsTrigger>
              <TabsTrigger value="text" className="flex-1 text-xs"><AlignLeft className="h-3 w-3 mr-1" />Text</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.type === "application/pdf") uploadFile(file);
                  else toast.error("Only PDF files are supported");
                }}
              >
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Drop a PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-3">
              <Input
                placeholder="https://example.com/article or YouTube URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
              />
              <p className="text-xs text-muted-foreground">Supports web articles and YouTube videos (with captions).</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" onClick={addUrl} disabled={!url.trim()}>Add</Button>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-3">
              <Input placeholder="Title (optional)" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
              <textarea
                className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" onClick={addText} disabled={!text.trim()}>Add</Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceItem({ source, onDelete }: { source: Source; onDelete: () => void }) {
  const statusIcon = {
    ready: <CheckCircle className="h-3 w-3 text-green-500" />,
    processing: <Clock className="h-3 w-3 text-yellow-500 animate-spin" />,
    pending: <Clock className="h-3 w-3 text-muted-foreground" />,
    error: <AlertCircle className="h-3 w-3 text-destructive" />,
  }[source.status] ?? <Clock className="h-3 w-3 text-muted-foreground" />;

  return (
    <div className={cn(
      "group flex items-start gap-2 px-2 py-2 rounded-md hover:bg-accent transition-colors",
      source.status === "error" && "opacity-60"
    )}>
      <div className="text-muted-foreground mt-0.5 shrink-0">
        {typeIcons[source.type] ?? <FileText className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{source.title}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {statusIcon}
          <span className="text-[10px] text-muted-foreground capitalize">{source.status}</span>
          {source.char_count > 0 && (
            <span className="text-[10px] text-muted-foreground">· {Math.round(source.char_count / 1000)}k chars</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
