"use client";

import { runReviewQueueAssistant, type ReviewQueueAssistantResult } from "@/app/actions/library";
import { cn } from "@/lib/utils";
import { Bot, CheckCircle2, ChevronRight, Loader2, PanelRightOpen, Send, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type AssistantMessage = { role: "assistant" | "user"; content: string };

type AssistantContext = {
  title: string;
  description: string;
  suggestions: string[];
  canRunReviewQueue?: boolean;
};

function getContext(pathname: string): AssistantContext {
  if (pathname.startsWith("/library/review")) {
    return {
      title: "Review queue copilot",
      description: "Evaluate candidates, choose the next action, and keep claim hygiene moving.",
      canRunReviewQueue: true,
      suggestions: [
        "Evaluate each candidate in the review queue, decide which action should be taken, and execute it.",
        "Which candidates should become canon versus marketing copy?",
        "Show me how to handle conflicts and sensitive snippets.",
      ],
    };
  }

  if (pathname.startsWith("/library")) {
    return {
      title: "Library copilot",
      description: "Help with canon, marketing nuggets, red flags, imports, and search.",
      suggestions: [
        "Explain the difference between canon, marketing gold, and internal docs.",
        "How should I promote a candidate safely?",
        "What should I check before using an entry in public marketing?",
      ],
    };
  }

  if (pathname.startsWith("/campaigns")) {
    return {
      title: "Campaign copilot",
      description: "Turn approved positioning into campaign lanes, customer discovery plans, and claim-safe execution.",
      suggestions: [
        "Help me plan a campaign from approved canon.",
        "Identify prospective customers for this initiative.",
        "What claims need proof before launch?",
      ],
    };
  }

  return {
    title: "MarketOps copilot",
    description: "Ask for generic workspace help or page-specific operating guidance.",
    suggestions: [
      "What can I do from this page?",
      "How does the MarketOps workflow fit together?",
      "What should I review before publishing marketing assets?",
    ],
  };
}

function localHelp(context: AssistantContext, prompt: string) {
  const lower = prompt.toLowerCase();
  if (context.canRunReviewQueue && lower.includes("evaluate each candidate")) {
    return "I can run that workflow from this page. Use the Run review queue assistant button so the execution is explicit and auditable.";
  }
  if (lower.includes("canon")) {
    return "Canon is durable source-of-truth material: positioning, product facts, audience definitions, glossary, claims, and proof-backed statements. Approve only if it should guide future marketing.";
  }
  if (lower.includes("prospective customers") || lower.includes("customer finder") || lower.includes("identify prospective customers")) {
    return "Use the Customer Finder from the Campaigns workspace to suggest a target description, choose supported sources, create a planning campaign, and prepare review-only outreach drafts.";
  }
  if (lower.includes("public") || lower.includes("safe") || lower.includes("claim")) {
    return "Before using content publicly, confirm it is non-sensitive, proof-backed, not roadmap-as-current-capability, and linked to source evidence when required.";
  }
  return `${context.title}: ${context.description} Try one of the page-specific prompts above, or ask what action to take next.`;
}

function summarizeRun(result: ReviewQueueAssistantResult) {
  const lines = [
    `Evaluated ${result.evaluated} candidate${result.evaluated === 1 ? "" : "s"}.`,
    `Executed ${result.executed}, skipped ${result.skipped}, failed ${result.failures.length}.`,
  ];
  const preview = result.actions.slice(0, 5).map((a) => `• ${a.title}: ${a.action} (${Math.round(a.confidence * 100)}%)`);
  return [...lines, ...preview].join("\n");
}

export function AiAssistantSidebar() {
  const pathname = usePathname();
  const context = useMemo(() => getContext(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [useOllama, setUseOllama] = useState(true);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: "assistant", content: "I can provide generic help and page-specific guidance. Open me on Library Review to run queue actions." },
  ]);

  async function submit(text = prompt) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setPrompt("");
    setMessages((m) => [...m, { role: "assistant", content: localHelp(context, trimmed) }]);
  }

  async function runQueue() {
    setRunning(true);
    setMessages((m) => [...m, { role: "user", content: "Run review queue assistant." }]);
    try {
      const result = await runReviewQueueAssistant({ useOllama });
      setMessages((m) => [...m, { role: "assistant", content: summarizeRun(result) }]);
    } catch (error) {
      setMessages((m) => [...m, { role: "assistant", content: error instanceof Error ? error.message : "Assistant run failed." }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <aside className={cn("fixed right-0 top-0 z-50 flex h-screen transition-transform", open ? "translate-x-0" : "translate-x-[calc(100%-3.25rem)]")}>
      <button aria-label={open ? "Collapse AI assistant" : "Open AI assistant"} onClick={() => setOpen((v) => !v)} className="mt-24 flex h-12 w-13 items-center justify-center rounded-l-2xl border border-r-0 border-border/70 bg-background shadow-lg">
        {open ? <ChevronRight className="size-4" /> : <PanelRightOpen className="size-4" />}
      </button>
      <div className="flex w-[22rem] max-w-[calc(100vw-3.25rem)] flex-col border-l border-border/70 bg-background/95 shadow-2xl backdrop-blur">
        <div className="border-b border-border/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4" />{context.title}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{context.description}</p>
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={useOllama} onChange={(e) => setUseOllama(e.target.checked)} />Use local Ollama for executable actions</label>
        </div>
        <div className="space-y-2 border-b border-border/70 p-3">
          {context.suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => submit(suggestion)} className="w-full rounded-xl border border-border/60 bg-muted/25 p-2 text-left text-xs leading-5 hover:bg-muted/50">{suggestion}</button>
          ))}
          {context.canRunReviewQueue ? <button disabled={running} onClick={runQueue} className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50">{running ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}Run review queue assistant</button> : null}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((message, index) => <div key={index} className={cn("rounded-xl p-3 text-xs leading-5", message.role === "user" ? "ml-6 bg-foreground text-background" : "mr-6 border border-border/60 bg-muted/30")}>{message.role === "assistant" ? <CheckCircle2 className="mb-1 size-3" /> : null}<p className="whitespace-pre-line">{message.content}</p></div>)}
        </div>
        <form action={() => submit()} className="flex gap-2 border-t border-border/70 p-3">
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask the assistant…" className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-xs outline-none focus:border-foreground" />
          <button type="submit" className="rounded-lg bg-foreground p-2 text-background"><Send className="size-4" /></button>
        </form>
      </div>
    </aside>
  );
}
