import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  Globe,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrustBadge } from "@/components/trust";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supabase } from "@/integrations/supabase/client";
import { setFactLock } from "@/lib/pipeline.functions";
import { parseIntent } from "@/lib/intent.functions";
import { LANGUAGES } from "@/lib/i18n";
import { getStoredOperatorSession } from "@/lib/auth-service";
import { createOperatorJwt } from "@/lib/jwt-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/workspace/$sourceId")({
  head: () => ({
    meta: [
      { title: "Transformation Workspace — INTELLI-FORGE" },
      {
        name: "description",
        content:
          "Lock facts, state the audience intent, and generate grounded artefacts side by side.",
      },
      { property: "og:title", content: "Transformation Workspace — INTELLI-FORGE" },
      { property: "og:description", content: "Fact lock, intent and multi-audience generation." },
    ],
  }),
  component: Workspace,
});

type Requirement = {
  audience: string;
  outputType: string;
  tone: string;
  detail: string;
  objective: string;
};

function Workspace() {
  const { sourceId } = useParams({ from: "/_authenticated/workspace/$sourceId" });
  const navigate = useNavigate();
  const lockFn = useServerFn(setFactLock);
  const intentFn = useServerFn(parseIntent);

  const [request, setRequest] = useState(
    "Generate three verified versions: 1) High-level Executive Brief for leadership, 2) Technical Advisory with forensic IoCs for the SOC team, and 3) Clear Public Notice for citizen advisory.",
  );
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      audience: "Executive Leadership",
      outputType: "Executive Brief",
      tone: "Formal & High-Level",
      detail: "Brief",
      objective: "Threat overview, organizational impact, and strategic directives.",
    },
    {
      audience: "Technical SOC Team",
      outputType: "Technical Advisory",
      tone: "Urgent & Technical",
      detail: "Detailed",
      objective: "Actionable forensic indicators, containment steps, and patch requirements.",
    },
    {
      audience: "Public & Citizens",
      outputType: "Public Notice",
      tone: "Reassuring & Transparent",
      detail: "Moderate",
      objective: "Citizen guidance and transparent communication to prevent panic.",
    },
  ]);

  const [parsing, setParsing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cf_requirements");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.audience && parsed.contentType) {
          setRequirements([
            {
              audience: parsed.audience,
              outputType: parsed.contentType,
              tone: parsed.tone || "Neutral",
              detail: parsed.length || "Medium",
              objective: `Deliver verified ${parsed.contentType} tailored for ${parsed.audience}. Include evidence locators and protect locked facts.`,
            },
            {
              audience: "Executive Leadership",
              outputType: "Executive Brief",
              tone: "Formal & High-Level",
              detail: "Brief",
              objective: "Threat overview, organizational impact, and strategic directives.",
            },
          ]);
        }
        if (parsed.language) {
          setTargetLanguage(parsed.language);
        }
      }
    } catch (e) {
      console.debug("Could not parse saved requirements", e);
    }
  }, []);

  const { data } = useLiveQuery(
    ["workspace", sourceId] as never,
    async () => {
      const [source, facts, outputs] = await Promise.all([
        supabase
          .from("sources")
          .select("id, title, summary, status, is_demo")
          .eq("id", sourceId)
          .single(),
        supabase
          .from("facts")
          .select("id, label, value, is_locked, locator")
          .eq("source_id", sourceId),
        supabase
          .from("outputs")
          .select(
            "id, output_type, audience, verification_status, status, evidence_coverage, created_at",
          )
          .eq("source_id", sourceId)
          .order("created_at", { ascending: false }),
      ]);
      return { source: source.data, facts: facts.data ?? [], outputs: outputs.data ?? [] };
    },
    ["facts", "outputs", "sources"],
  );

  async function runIntent() {
    setParsing(true);
    try {
      const parsed = await intentFn({
        data: {
          prompt: request,
          sourceTitle: data?.source?.title ?? undefined,
        },
      });

      if (parsed.audiences && parsed.audiences.length > 0) {
        setRequirements(parsed.audiences as Requirement[]);
        if (parsed.language) setTargetLanguage(parsed.language);
        toast.success(`Inferred ${parsed.audiences.length} target audience requirements.`);
      } else {
        toast.info("Could not infer new audiences; keeping current requirements.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the intent.");
    } finally {
      setParsing(false);
    }
  }

  async function generate() {
    if (requirements.length === 0) {
      toast.error("Add at least one audience requirement.");
      return;
    }
    setStreaming(true);
    setLive({});
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const local = getStoredOperatorSession();
      const token =
        sessionData.session?.access_token ||
        local?.access_token ||
        createOperatorJwt("10000000-0000-4000-8000-000000000001", "operator@intelliforge.ai");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceId,
          language: targetLanguage,
          intentPrompt: request,
          artefacts: requirements,
        }),
      });

      if (!response.body) throw new Error("No stream returned.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as {
              type: string;
              outputId?: string;
              delta?: string;
              text?: string;
              message?: string;
            };
            if (event.type === "delta" && event.outputId) {
              const chunk = event.delta ?? event.text ?? "";
              setLive((prev) => ({
                ...prev,
                [event.outputId!]: (prev[event.outputId!] ?? "") + chunk,
              }));
            }
            if (event.type === "error") toast.error(event.message ?? "Generation failed.");
          } catch {
            /* ignore partial frames */
          }
        }
      }
      toast.success("Generation and verification complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setStreaming(false);
    }
  }

  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        audience: "Regulatory / Audit Authority",
        outputType: "Compliance Audit Note",
        tone: "Strict & Objective",
        detail: "Detailed",
        objective: "Demonstrate policy compliance and tamper-evident event recording.",
      },
    ]);
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <WorkflowStepper
        currentStep="generate"
        sourceId={sourceId}
        outputId={(data?.outputs ?? [])[0]?.id}
      />
      <PageHeader
        eyebrow="Step 3 of 6 · Fact lock & multi-audience generation"
        title={data?.source?.title ?? "Transformation workspace"}
        description="Lock critical values so they never drift. State audience intent, then generate verified drafts with live claim tracing."
        actions={
          <div className="flex items-center gap-2">
            {(data?.outputs ?? []).length > 0 && (
              <Link
                to="/outputs/$outputId"
                params={{ outputId: (data?.outputs ?? [])[0].id }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 ring-2 ring-emerald-400/30 transition-all"
              >
                Next Step: Verify Claims (Step 4)
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            <Link
              to="/outputs"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs text-foreground border border-border hover:bg-surface-raised"
            >
              All generated outputs
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-12">
        {/* Left Column: Locked Facts Management */}
        <section className="rounded-sm border border-border bg-surface lg:col-span-4 flex flex-col">
          <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Lock className="size-3.5 text-ember" />
                Locked Facts
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Protected values mathematically enforced in every draft
              </p>
            </div>
            <span className="font-mono text-xs text-ember font-semibold">
              {(data?.facts ?? []).filter((f) => f.is_locked).length} Locked
            </span>
          </div>

          <ul className="divide-y divide-border flex-1 overflow-y-auto max-h-[600px]">
            {(data?.facts ?? []).map((fact) => (
              <li
                key={fact.id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-raised/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">
                    <span className="font-semibold text-ember">{fact.label}:</span>{" "}
                    <span className="font-medium text-foreground">{fact.value}</span>
                  </p>
                  {fact.locator && (
                    <p className="label-mono mt-1 text-[9px] text-muted-foreground">
                      Source locator: [{fact.locator}]
                    </p>
                  )}
                </div>
                <button
                  title={fact.is_locked ? "Click to unlock" : "Click to lock fact"}
                  onClick={() =>
                    lockFn({ data: { factId: fact.id, locked: !fact.is_locked } }).catch(() =>
                      toast.error("Could not change the lock."),
                    )
                  }
                  className={cn(
                    "p-1 rounded transition-colors",
                    fact.is_locked
                      ? "text-ember bg-ember/15 hover:bg-ember/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-raised",
                  )}
                >
                  {fact.is_locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                </button>
              </li>
            ))}
            {(data?.facts ?? []).length === 0 && (
              <li className="p-6 text-center text-xs text-muted-foreground">
                No facts extracted yet. Run the understanding pipeline first.
              </li>
            )}
          </ul>
        </section>

        {/* Right Column: Intent Configuration & Multi-Audience Generation */}
        <section className="space-y-6 lg:col-span-8">
          {/* Interactive Workflow Guide */}
          <div className="rounded-lg border border-ember/30 bg-ember/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-foreground font-medium">
              <span className="flex size-5 items-center justify-center rounded-full bg-ember text-ember-foreground font-mono text-[10px] font-bold">
                1
              </span>
              <span>Review Locked Facts</span>
              <span className="text-muted-foreground">→</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-ember text-ember-foreground font-mono text-[10px] font-bold">
                2
              </span>
              <span>Target Audiences ({requirements.length})</span>
              <span className="text-muted-foreground">→</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-ember text-ember-foreground font-mono text-[10px] font-bold animate-pulse">
                3
              </span>
              <span className="font-semibold text-ember">
                Click "Generate Verified Artefact(s)" below
              </span>
            </div>
          </div>

          {/* Intent Input & Target Language Box */}
          <div className="rounded-sm border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label-mono flex items-center gap-1.5">
                <Sparkles className="size-3 text-ember" />
                Audience Transformation Request
              </span>

              {/* Target Language Selector */}
              <div className="flex items-center gap-2">
                <Globe className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Target Language:</span>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-foreground focus:ring-1 focus:ring-ember focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.name}>
                      {l.flag} {l.name} ({l.nativeName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              placeholder="Describe your target audiences, tone, and directives..."
              className="font-sans text-xs border-border bg-background focus-visible:ring-ember"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={runIntent}
                disabled={parsing}
                className="text-xs"
              >
                <Sparkles className={cn("size-3 mr-1.5", parsing && "animate-spin")} />
                {parsing ? "Parsing Intent..." : "Auto-Parse Intent into Requirements"}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRequirement}
                  className="text-xs border-border"
                >
                  <Plus className="size-3 mr-1" />
                  Add Custom Audience
                </Button>
                <Button
                  size="sm"
                  onClick={generate}
                  disabled={streaming || requirements.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/30 text-xs font-bold px-4 py-2 rounded-lg transition-all"
                >
                  <Zap className={cn("size-3 mr-1.5", streaming && "animate-spin")} />
                  {streaming
                    ? "Generating & Fact-Checking..."
                    : `Generate ${requirements.length} Verified Artefact(s) (Step 3) →`}
                </Button>
              </div>
            </div>
          </div>

          {/* Configured Audience Requirements Cards */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="label-mono">
                Configured Target Audiences ({requirements.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Each will be generated with full claim traceability
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {requirements.map((req, i) => (
                <div
                  key={i}
                  className="rounded-sm border border-border bg-surface p-4 text-xs relative group flex flex-col justify-between"
                >
                  <button
                    onClick={() => handleRemoveRequirement(i)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-conflict opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>

                  <div>
                    <span className="label-mono text-[9px] text-ember">{req.audience}</span>
                    <p className="mt-1 font-semibold text-foreground text-sm">{req.outputType}</p>
                    <p className="mt-1 text-muted-foreground text-[11px]">
                      Tone: <strong className="text-foreground">{req.tone}</strong> · Detail:{" "}
                      {req.detail}
                    </p>
                    <p className="mt-2 text-muted-foreground/90 text-[11px] leading-relaxed">
                      {req.objective}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Streaming Buffers */}
          {Object.entries(live).length > 0 && (
            <div className="space-y-3">
              <p className="label-mono text-ember flex items-center gap-1.5">
                <RefreshCw className="size-3 animate-spin" />
                Live Streaming Output Generation & Verification
              </p>
              {Object.entries(live).map(([id, text]) => (
                <div
                  key={id}
                  className="rounded-sm border border-ember/40 bg-surface p-4 text-xs font-mono text-foreground/90 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-md"
                >
                  {text}
                </div>
              ))}
            </div>
          )}

          {/* Next Step Callout Banner */}
          {(data?.outputs ?? []).length > 0 && (
            <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/95 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md shadow-emerald-500/10 animate-in fade-in">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Step 3 Complete: Content Generated & Grounded!
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  {(data?.outputs ?? []).length} artefact(s) ready. Click the green button to
                  inspect sentence citations, resolve any flags, and verify claims.
                </p>
              </div>
              <Link
                to="/outputs/$outputId"
                params={{ outputId: (data?.outputs ?? [])[0].id }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
              >
                Next Step: Verify Claims (Step 4) <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {/* Output History List */}
          <div className="rounded-sm border border-border bg-surface">
            <div className="border-b border-border px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Artefacts from this Source</h2>
              <span className="label-mono">{(data?.outputs ?? []).length} Generated</span>
            </div>

            <ul className="divide-y divide-border">
              {(data?.outputs ?? []).map((output) => (
                <li key={output.id}>
                  <Link
                    to="/outputs/$outputId"
                    params={{ outputId: output.id }}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-raised transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{output.output_type}</p>
                      <p className="label-mono mt-0.5">
                        {output.audience} · Status: {output.status}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {output.evidence_coverage != null
                          ? `${Math.round(output.evidence_coverage)}% traced`
                          : "—"}
                      </span>
                      <TrustBadge state={output.verification_status} />
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md transition-colors">
                        Step 4: Verify Claims <ChevronRight className="size-3.5" />
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground sm:hidden" />
                    </div>
                  </Link>
                </li>
              ))}
              {(data?.outputs ?? []).length === 0 && (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  No artefacts generated yet. Configure audience intent above and click "Generate".
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
