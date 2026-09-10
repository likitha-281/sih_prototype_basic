import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Lock,
  Sparkles,
  X,
  Cpu,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/trust";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supabase } from "@/integrations/supabase/client";
import { analyzeSource } from "@/lib/pipeline.functions";
import { useI18n } from "@/context/language-context";

export const Route = createFileRoute("/_authenticated/processing/$jobId")({
  head: () => ({
    meta: [
      { title: "Processing & Extraction — ContentForge" },
      {
        name: "description",
        content:
          "Watch each pipeline stage complete live: parsing, understanding, fact lock, indexing.",
      },
    ],
  }),
  component: ProcessingPage,
});

type Stage = { key: string; label: string; status: string; note?: string };

function ProcessingPage() {
  const { jobId } = useParams({ from: "/_authenticated/processing/$jobId" });
  const analyze = useServerFn(analyzeSource);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useLiveQuery(
    ["job", jobId] as never,
    async () => {
      const { data: job } = await supabase
        .from("jobs")
        .select("id, source_id, status, stages, error")
        .eq("id", jobId)
        .single();
      if (!job) return null;
      const [source, facts, claims, entities] = await Promise.all([
        supabase
          .from("sources")
          .select("id, title, summary, status, is_demo")
          .eq("id", job.source_id)
          .single(),
        supabase
          .from("facts")
          .select("id, label, value, is_locked, locator")
          .eq("source_id", job.source_id),
        supabase.from("claims").select("id, text, locator").eq("source_id", job.source_id),
        supabase.from("entities").select("id, name, entity_type").eq("source_id", job.source_id),
      ]);
      return {
        job,
        source: source.data,
        facts: facts.data ?? [],
        claims: claims.data ?? [],
        entities: entities.data ?? [],
      };
    },
    ["jobs", "facts", "claims", "entities", "sources"],
  );

  useEffect(() => {
    if (started.current || !data?.job) return;
    if (data.job.status === "queued") {
      started.current = true;
      analyze({ data: { jobId } }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Pipeline failed.";
        setError(message);
        toast.error(message);
      });
    }
  }, [data?.job, analyze, jobId]);

  const stages = (data?.job?.stages as Stage[] | undefined) ?? [];
  const ready = data?.job?.status === "ready";

  return (
    <div>
      {/* 6-Stage Stepper: Step 2 Process */}
      <WorkflowStepper currentStep="process" jobId={jobId} sourceId={data?.source?.id} />

      <PageHeader
        eyebrow="Step 2 of 6 · Extraction & Understanding"
        title={data?.source?.title ?? "Processing source"}
        description="Every extraction stage below is written to the database as it finishes and reflected here in real time."
        actions={
          ready && data?.source ? (
            <Link
              to="/workspace/$sourceId"
              params={{ sourceId: data.source.id }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-all inline-flex items-center gap-2 ring-2 ring-emerald-400/30"
            >
              <Sparkles className="size-3.5" />
              Next Step: Generate Outputs (Step 3) →
            </Link>
          ) : null
        }
      />

      <div className="space-y-6 p-6">
        {data?.source?.is_demo && <DemoNotice />}
        {(error || data?.job?.error) && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error ?? data?.job?.error}
          </div>
        )}

        {/* Action Banner When Ready */}
        {ready && data?.source && (
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/95 p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-md shadow-emerald-500/10 animate-in fade-in slide-in-from-top-3">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Step 2 Complete: Facts Locked & Passages Indexed!
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                Source has been verified with [P1, P2] locators and critical facts are locked. Click
                the green button to move to Step 3 and generate tailored audience outputs.
              </p>
            </div>
            <Link
              to="/workspace/$sourceId"
              params={{ sourceId: data.source.id }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              <Sparkles className="size-4" />
              Next Step: Generate Outputs (Step 3) <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-border bg-surface shadow-xs">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold flex items-center gap-2">
            <Cpu className="size-4 text-blue-500" />
            Workflow Stages
          </h2>
          <ol className="divide-y divide-border">
            {stages.map((stage) => (
              <li key={stage.key} className="flex items-start gap-3 px-5 py-3">
                {stage.status === "done" ? (
                  <Check className="mt-0.5 size-4 text-emerald-500 stroke-[3]" />
                ) : stage.status === "failed" ? (
                  <X className="mt-0.5 size-4 text-destructive" />
                ) : (
                  <CircleDashed
                    className={`mt-0.5 size-4 text-blue-500 ${stage.status === "running" ? "animate-spin" : ""}`}
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{stage.label}</p>
                  {stage.note && <p className="label-mono mt-0.5">{stage.note}</p>}
                </div>
              </li>
            ))}
            {stages.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">Queued in database…</li>
            )}
          </ol>
        </section>

        {data?.source?.summary && (
          <section className="rounded-xl border border-border bg-surface p-5 shadow-xs">
            <p className="label-mono font-semibold text-blue-600 dark:text-blue-400">
              Understanding Summary
            </p>
            <p className="mt-2 text-sm text-foreground leading-relaxed">{data.source.summary}</p>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-border bg-surface shadow-xs">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold flex items-center gap-2">
              <Lock className="size-4 text-emerald-500" />
              Locked Facts ({data?.facts?.length ?? 0})
            </h2>
            <ul className="divide-y divide-border text-xs max-h-72 overflow-y-auto">
              {(data?.facts ?? []).map((f) => (
                <li key={f.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{f.label}</span>
                    {f.is_locked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-mono">
                        <Lock className="size-3" /> Locked
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-muted-foreground">{f.value}</p>
                  {f.locator && (
                    <span className="label-mono text-[10px] mt-1 block">{f.locator}</span>
                  )}
                </li>
              ))}
              {(data?.facts ?? []).length === 0 && (
                <li className="p-4 text-muted-foreground text-center">No facts extracted yet</li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface shadow-xs">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold flex items-center gap-2">
              <Layers className="size-4 text-blue-500" />
              Extracted Claims ({data?.claims?.length ?? 0})
            </h2>
            <ul className="divide-y divide-border text-xs max-h-72 overflow-y-auto">
              {(data?.claims ?? []).map((c) => (
                <li key={c.id} className="p-3">
                  <p className="text-foreground">{c.text}</p>
                  {c.locator && (
                    <span className="label-mono text-[10px] mt-1 block">{c.locator}</span>
                  )}
                </li>
              ))}
              {(data?.claims ?? []).length === 0 && (
                <li className="p-4 text-muted-foreground text-center">No claims extracted yet</li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface shadow-xs">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">
              Identified Entities ({data?.entities?.length ?? 0})
            </h2>
            <ul className="divide-y divide-border text-xs max-h-72 overflow-y-auto">
              {(data?.entities ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between p-3">
                  <span className="font-semibold text-foreground">{e.name}</span>
                  <span className="label-mono text-[10px]">{e.entity_type}</span>
                </li>
              ))}
              {(data?.entities ?? []).length === 0 && (
                <li className="p-4 text-muted-foreground text-center">No entities extracted yet</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
