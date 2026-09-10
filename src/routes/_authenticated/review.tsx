import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCheck,
  Filter,
  ListChecks,
  Lock,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrustBadge } from "@/components/trust";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supabase } from "@/integrations/supabase/client";
import { decideOutput } from "@/lib/review.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Human Review & Approval Queue — INTELLI-FORGE" },
      {
        name: "description",
        content:
          "Human-in-the-loop review gate. Verify fact locks, inspect claim traces, and approve artefacts for distribution.",
      },
    ],
  }),
  component: ReviewPage,
});

type FilterTab = "all" | "pending" | "approved" | "rejected" | "conflicts";

function ReviewPage() {
  const decideFn = useServerFn(decideOutput);
  const [activeTab, setActiveTab] = useState<FilterTab>("pending");
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data, isLoading } = useLiveQuery(
    ["review_queue"] as never,
    async () => {
      const [outputsRes, sourcesRes, conflictsRes] = await Promise.all([
        supabase
          .from("outputs")
          .select(
            "id, source_id, output_type, audience, tone, content, status, verification_status, evidence_coverage, created_at, updated_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("sources").select("id, title"),
        supabase
          .from("fact_conflicts")
          .select("id, output_id, fact_label, locked_value, generated_text, status"),
      ]);

      const sourcesMap = new Map((sourcesRes.data ?? []).map((s) => [s.id, s.title]));
      const conflicts = conflictsRes.data ?? [];

      return {
        outputs: (outputsRes.data ?? []).map((o) => {
          const openConflicts = conflicts.filter(
            (c) => c.output_id === o.id && ["open", "suggested"].includes(c.status),
          );
          return {
            ...o,
            sourceTitle: sourcesMap.get(o.source_id) || "Unknown Source",
            openConflicts,
          };
        }),
      };
    },
    ["outputs", "sources", "fact_conflicts", "reviews"],
  );

  const allOutputs = data?.outputs ?? [];

  const filteredOutputs = allOutputs.filter((item) => {
    if (activeTab === "pending") return ["generated", "edited"].includes(item.status);
    if (activeTab === "approved") return item.status === "approved";
    if (activeTab === "rejected") return item.status === "rejected";
    if (activeTab === "conflicts") return item.openConflicts.length > 0;
    return true;
  });

  const selectedItem = allOutputs.find((o) => o.id === selectedOutputId);

  const handleDecision = async (outputId: string, action: "approve" | "reject") => {
    setIsProcessing(true);
    try {
      await decideFn({
        data: {
          outputId,
          action,
          notes: reviewerNotes.trim() || undefined,
        },
      });
      toast.success(
        action === "approve" ? "Artefact approved for distribution." : "Artefact rejected.",
      );
      setReviewerNotes("");
      setSelectedOutputId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Decision failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <WorkflowStepper
        currentStep="review"
        outputId={selectedOutputId || allOutputs[0]?.id}
        sourceId={allOutputs[0]?.source_id}
      />
      <PageHeader
        eyebrow="Step 5 of 6 · Human Review & Verification Gate"
        title="Human review & approval queue"
        description="Nothing leaves INTELLI-FORGE without human sign-off. Critical fact conflicts strictly block approval."
        actions={
          <div className="flex items-center gap-2">
            {allOutputs.some((o) => o.status === "approved") && (
              <Link
                to="/distribution"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 ring-2 ring-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Next Step: Distribution (Step 6)
                <ArrowRight className="size-3.5" />
              </Link>
            )}
            <Link
              to="/outputs"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50"
            >
              All outputs & downloads
            </Link>
          </div>
        }
      />

      {/* Step 5 Guidance Callout Banner */}
      <div className="mx-6 mt-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/90 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Step 5: Operator Review & Authoritative Gate
            </h3>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl">
            Select an artefact below, inspect the fact checks, and sign off. Once approved, the
            green Next Step button will take you directly to Multi-Channel Distribution (Step 6).
          </p>
        </div>
        {allOutputs.some((o) => o.status === "approved") && (
          <Link
            to="/distribution"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            Next Step: Distribution (Step 6) <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border bg-surface px-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
            activeTab === "pending"
              ? "border-ember text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Awaiting Review</span>
          <span className="rounded-full bg-ember/15 px-2 py-0.5 font-mono text-[10px] text-ember">
            {allOutputs.filter((o) => ["generated", "edited"].includes(o.status)).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("conflicts")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
            activeTab === "conflicts"
              ? "border-conflict text-conflict font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Blocked by Conflicts</span>
          <span className="rounded-full bg-conflict/15 px-2 py-0.5 font-mono text-[10px] text-conflict">
            {allOutputs.filter((o) => o.openConflicts.length > 0).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
            activeTab === "approved"
              ? "border-verified text-verified font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Approved</span>
          <span className="rounded-full bg-verified/15 px-2 py-0.5 font-mono text-[10px] text-verified">
            {allOutputs.filter((o) => o.status === "approved").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
            activeTab === "rejected"
              ? "border-border text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Rejected</span>
          <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {allOutputs.filter((o) => o.status === "rejected").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
            activeTab === "all"
              ? "border-border text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <span>All Artefacts</span>
          <span className="rounded-full bg-surface-raised px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {allOutputs.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-12 min-h-[650px]">
        {/* Artefacts List Column */}
        <div className="lg:col-span-6 border-r border-border divide-y divide-border">
          {isLoading && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading review queue...
            </div>
          )}

          {!isLoading && filteredOutputs.length === 0 && (
            <div className="p-8 text-center">
              <FileCheck className="size-8 text-muted-foreground/50 mx-auto" />
              <p className="mt-2 text-sm text-foreground">No artefacts in this view.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeTab === "pending"
                  ? "All generated drafts have been reviewed."
                  : "Try selecting another filter tab above."}
              </p>
            </div>
          )}

          {filteredOutputs.map((item) => {
            const isSelected = selectedOutputId === item.id;
            const hasConflicts = item.openConflicts.length > 0;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedOutputId(item.id)}
                className={cn(
                  "cursor-pointer p-5 transition-colors",
                  isSelected
                    ? "bg-surface-raised border-l-2 border-ember"
                    : "hover:bg-surface-raised/60 bg-surface",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {item.output_type}
                      {hasConflicts && (
                        <span className="rounded bg-conflict/15 px-1.5 py-0.5 font-mono text-[9px] text-conflict font-semibold flex items-center gap-1">
                          <AlertTriangle className="size-2.5" />
                          Conflict Blocked
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Audience: <span className="text-foreground">{item.audience}</span> · Source:{" "}
                      {item.sourceTitle}
                    </p>
                  </div>
                  <TrustBadge state={item.verification_status} />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      Coverage:{" "}
                      <strong className="text-foreground font-mono">
                        {item.evidence_coverage != null
                          ? `${Math.round(item.evidence_coverage)}%`
                          : "N/A"}
                      </strong>
                    </span>
                    <span className="capitalize">
                      Status: <strong className="text-foreground">{item.status}</strong>
                    </span>
                  </div>
                  <Link
                    to="/outputs/$outputId"
                    params={{ outputId: item.id }}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] text-ember hover:underline"
                  >
                    Trace <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Artefact Detail / Action Panel */}
        <div className="lg:col-span-6 p-6 bg-background">
          {selectedItem ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {selectedItem.output_type}
                  </h3>
                  <p className="label-mono mt-0.5">
                    {selectedItem.audience} · {selectedItem.tone}
                  </p>
                </div>
                <Link
                  to="/outputs/$outputId"
                  params={{ outputId: selectedItem.id }}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-surface px-3 py-1 text-xs text-foreground border border-border hover:bg-surface-raised"
                >
                  <Eye className="size-3.5" />
                  Full Evidence Trace
                </Link>
              </div>

              {/* Fact Conflict Warning in Detail View */}
              {selectedItem.openConflicts.length > 0 && (
                <div className="rounded border border-conflict/40 bg-conflict/10 p-4 text-xs text-conflict">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Approval Gate Blocked ({selectedItem.openConflicts.length} Conflict)
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    This artefact contradicts locked facts from the source. You must resolve or
                    formally override the conflict before approval can be granted.
                  </p>
                  <div className="mt-3">
                    <Link
                      to="/outputs/$outputId"
                      params={{ outputId: selectedItem.id }}
                      className="inline-flex items-center gap-1 rounded bg-conflict/20 px-2.5 py-1 font-mono text-[11px] text-conflict font-semibold hover:bg-conflict/30"
                    >
                      Resolve Conflicts in Trace View →
                    </Link>
                  </div>
                </div>
              )}

              {/* Content Preview */}
              <div className="rounded-sm border border-border bg-surface p-4">
                <p className="label-mono pb-2 border-b border-border">Artefact Content Preview</p>
                <div className="mt-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-72 overflow-y-auto font-sans">
                  {selectedItem.content}
                </div>
              </div>

              {/* Reviewer Sign-off Form */}
              <div className="rounded-sm border border-border bg-surface p-4 space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  Reviewer Decision & Notes
                </label>
                <Textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Add mandatory notes or sign-off remarks for the immutable audit trail..."
                  rows={3}
                  className="text-xs border-border bg-background focus-visible:ring-ember"
                />

                {/* Already Approved Callout & Next Step 6 Action */}
                {selectedItem.status === "approved" && (
                  <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-50/90 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-in fade-in">
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Artefact Approved & Signed Off!
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        This document has passed the human gate. Proceed to Step 6 to prepare
                        multi-channel payloads.
                      </p>
                    </div>
                    <Link
                      to="/distribution"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                    >
                      Next Step: Distribution (Step 6) <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleDecision(selectedItem.id, "reject")}
                    className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                  >
                    <XCircle className="size-3.5 mr-1" />
                    Reject Artefact
                  </Button>

                  <Button
                    size="sm"
                    disabled={isProcessing || selectedItem.openConflicts.length > 0}
                    onClick={() => handleDecision(selectedItem.id, "approve")}
                    className={cn(
                      "text-xs font-bold transition-all",
                      selectedItem.openConflicts.length > 0
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/30",
                    )}
                  >
                    <CheckCircle2 className="size-3.5 mr-1" />
                    {selectedItem.openConflicts.length > 0
                      ? "Approval Blocked (Resolve Conflicts)"
                      : "Approve for Distribution →"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center text-center p-6">
              <ListChecks className="size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Select an artefact from the queue
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Inspect content, verify fact-lock enforcement, and grant distribution sign-off.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
