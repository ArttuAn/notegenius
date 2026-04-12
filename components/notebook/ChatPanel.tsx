"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, User, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

type Citation = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  passage: string;
  charStart: number;
  charEnd: number;
  index: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: number;
};

type Source = { id: string; title: string; status: string };

type Props = {
  notebookId: string;
  sessionId: string | null;
  sources: Source[];
};

export function ChatPanel({ notebookId, sessionId, sources }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/chat/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((msgs) => setMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionId || streaming) return;

    const userMsg = input.trim();
    setInput("");
    setStreaming(true);
    setStreamingText("");

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp_user_${Date.now()}`,
      role: "user",
      content: userMsg,
      citations: [],
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, sessionId, message: userMsg }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let finalCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "text") {
            fullText += data.text;
            setStreamingText(fullText);
          } else if (data.type === "citations") {
            finalCitations = data.citations;
          } else if (data.type === "done") {
            setMessages((prev) => [
              ...prev,
              {
                id: data.messageId ?? `msg_${Date.now()}`,
                role: "assistant",
                content: fullText,
                citations: finalCitations,
                created_at: Date.now(),
              },
            ]);
            setStreamingText("");
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to send message");
      setStreamingText("");
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }, [input, sessionId, notebookId, streaming]);

  const readySources = sources.filter((s) => s.status === "ready");

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && !streaming && (
            <div className="py-16 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Ask about your sources</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {readySources.length === 0
                  ? "Add sources in the left panel, then ask questions about them."
                  : `${readySources.length} source${readySources.length !== 1 ? "s" : ""} ready. Ask anything!`}
              </p>
              {readySources.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    "Summarize the main points",
                    "What are the key findings?",
                    "Explain the most important concepts",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                      className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-accent hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {streaming && streamingText && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="prose text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={readySources.length === 0 ? "Add sources to start chatting..." : "Ask a question about your sources..."}
            disabled={streaming || readySources.length === 0}
            className="min-h-[44px] max-h-[180px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || streaming || readySources.length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Replace [N] with citation chips in the text
  const renderContent = (content: string, citations: Citation[]) => {
    const parts = content.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const idx = parseInt(match[1]);
        const citation = citations.find((c) => c.index === idx);
        if (citation) {
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors mx-0.5 align-middle cursor-pointer">
                  {idx}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{citation.sourceTitle}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed line-clamp-4">
                    "{citation.passage}"
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-secondary" : "bg-primary/10"
      )}>
        {isUser ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "rounded-xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose whitespace-pre-wrap">
              {renderContent(message.content, message.citations)}
            </div>
          )}
        </div>
        {!isUser && message.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 px-1">
            {message.citations.map((c) => (
              <span key={c.chunkId} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                [{c.index}] {c.sourceTitle.slice(0, 30)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
