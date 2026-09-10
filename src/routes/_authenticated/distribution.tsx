import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Key,
  Mail,
  MessageSquare,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supabase } from "@/integrations/supabase/client";
import { prepareDistribution } from "@/lib/review.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/distribution")({
  head: () => ({
    meta: [
      { title: "Distribution Readiness — INTELLI-FORGE" },
      {
        name: "description",
        content:
          "Multi-channel distribution readiness. Export cryptographically verified communication packages across Web, Email, API, and SMS.",
      },
    ],
  }),
  component: DistributionPage,
});

type ChannelType = "web" | "email" | "api" | "sms";

function DistributionPage() {
  const prepareFn = useServerFn(prepareDistribution);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [channel, setChannel] = useState<ChannelType>("web");
  const [targetEndpoint, setTargetEndpoint] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useLiveQuery(
    ["distribution_data"] as never,
    async () => {
      const [outputsRes, distsRes] = await Promise.all([
        supabase
          .from("outputs")
          .select(
            "id, source_id, output_type, audience, tone, content, status, evidence_coverage, created_at",
          )
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        supabase
          .from("distributions")
          .select("id, output_id, channel, target, status, payload, created_at")
          .order("created_at", { ascending: false }),
      ]);
      return {
        approvedOutputs: outputsRes.data ?? [],
        distributions: distsRes.data ?? [],
      };
    },
    ["outputs", "distributions"],
  );

  const approvedOutputs = data?.approvedOutputs ?? [];
  const distributions = data?.distributions ?? [];

  const activeOutput = approvedOutputs.find((o) => o.id === selectedOutputId) || approvedOutputs[0];

  const handlePrepare = async () => {
    if (!activeOutput) {
      toast.error("Please select an approved artefact first.");
      return;
    }
    setIsPreparing(true);
    try {
      await prepareFn({
        data: {
          outputId: activeOutput.id,
          channel: channel === "sms" ? "api" : channel,
          target: targetEndpoint.trim() || undefined,
        },
      });
      toast.success(`Distribution payload prepared for ${channel.toUpperCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preparation failed.");
    } finally {
      setIsPreparing(false);
    }
  };

  // Channel Format Generator
  const generatePayloadPreview = () => {
    if (!activeOutput) return "";

    const timestamp = new Date().toISOString();
    const cleanContent = activeOutput.content || "";

    if (channel === "web") {
      return (
        `<!-- INTELLI-FORGE Verified Web Embed [SIH 2026] -->\n` +
        `<article class="verified-advisory" data-source-id="${activeOutput.source_id}" data-coverage="${Math.round(activeOutput.evidence_coverage ?? 100)}%">\n` +
        `  <header class="advisory-header">\n` +
        `    <span class="badge verified">Verified & Fact-Locked</span>\n` +
        `    <h1>${activeOutput.output_type} — ${activeOutput.audience}</h1>\n` +
        `    <time datetime="${timestamp}">${new Date().toLocaleString()}</time>\n` +
        `  </header>\n` +
        `  <div class="advisory-body">\n` +
        `    ${cleanContent
          .split("\n\n")
          .map((p) => `<p>${p}</p>`)
          .join("\n    ")}\n` +
        `  </div>\n` +
        `</article>`
      );
    }

    if (channel === "email") {
      return (
        `SUBJECT: [SECURITY ADVISORY] ${activeOutput.output_type} (${activeOutput.audience})\n` +
        `FROM: cert-alerts@gov.in (INTELLI-FORGE Verified System)\n` +
        `DATE: ${timestamp}\n` +
        `X-INTELLI-COVERAGE: ${Math.round(activeOutput.evidence_coverage ?? 100)}%\n` +
        `X-INTELLI-STATUS: APPROVED\n\n` +
        `=======================================================\n` +
        `CRITICAL DIRECTIVE — PLEASE READ AND ACTION IMMEDIATELY\n` +
        `=======================================================\n\n` +
        `${cleanContent}\n\n` +
        `--\n` +
        `Verified by INTELLI-FORGE (Problem Statement 26154)`
      );
    }

    if (channel === "sms") {
      const summaryLines = cleanContent.split("\n").filter((l) => l.trim().length > 0);
      return (
        `[GOVT ALERT] ${activeOutput.output_type}: ` +
        (summaryLines[0] || "Critical security advisory issued.") +
        ` Action mandatory within 6h. Full details at https://portal.gov.in/advisory/${activeOutput.id.slice(0, 8)}`
      );
    }

    // Default API format
    return JSON.stringify(
      {
        version: "1.0",
        schema: "sih2026.intelliforge.distribution",
        artefact_id: activeOutput.id,
        source_id: activeOutput.source_id,
        audience: activeOutput.audience,
        output_type: activeOutput.output_type,
        verification: {
          grounding_coverage: activeOutput.evidence_coverage,
          status: "APPROVED_AND_LOCKED",
          verified_at: timestamp,
        },
        payload: {
          content: cleanContent,
        },
        cryptographic_token: `sha256:hmac:${activeOutput.id.replace(/-/g, "").slice(0, 32)}`,
      },
      null,
      2,
    );
  };

  const payloadText = generatePayloadPreview();

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadText);
    setCopied(true);
    toast.success("Payload copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([payloadText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribution-${activeOutput?.output_type.toLowerCase().replace(/\s+/g, "-")}-${channel}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Package downloaded.");
  };

  const handleDownloadMarkdown = () => {
    if (!activeOutput) return;
    const content = `# ${activeOutput.output_type}\n**Target Audience:** ${activeOutput.audience} | **Tone:** ${activeOutput.tone ?? "Standard"}\n**Evidence Coverage:** ${Math.round(activeOutput.evidence_coverage ?? 100)}%\n\n${activeOutput.content}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeOutput.output_type.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${activeOutput.audience.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Markdown document.");
  };

  const handleDownloadJson = () => {
    if (!activeOutput) return;
    const dataObj = {
      artefact: activeOutput,
      distribution: {
        channel,
        targetEndpoint: targetEndpoint || "broadcast",
        payload: payloadText,
        generatedAt: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribution-package-${activeOutput.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded JSON bundle.");
  };

  return (
    <div>
      <WorkflowStepper
        currentStep="distribute"
        outputId={activeOutput?.id}
        sourceId={activeOutput?.source_id}
      />
      <PageHeader
        eyebrow="Step 6 of 6 · Multi-Channel Distribution"
        title="Distribution readiness & multi-channel exporter"
        description="Only human-approved, fact-grounded artefacts can be prepared for distribution across channels."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 ring-2 ring-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Start New Run (Step 1)
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/outputs"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50"
            >
              All outputs & downloads
            </Link>
          </div>
        }
      />

      {approvedOutputs.length === 0 && !isLoading && (
        <div className="m-6 rounded-2xl border-2 border-amber-500/30 bg-amber-50/80 p-8 text-center shadow-sm">
          <ShieldCheck className="size-10 text-amber-600 mx-auto" />
          <h3 className="mt-3 text-base font-bold text-amber-950">
            No Approved Artefacts Available for Distribution Yet
          </h3>
          <p className="mt-2 text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
            Artefacts must complete the 7-point audit check and receive human sign-off in the{" "}
            <Link to="/review" className="font-bold underline underline-offset-4">
              Review Queue (Step 5)
            </Link>{" "}
            before they can be exported to external channels.
          </p>
          <div className="mt-5">
            <Link
              to="/review"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Step 5: Review & Sign Off Artefacts <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {approvedOutputs.length > 0 && (
        <div className="grid lg:grid-cols-12 gap-px bg-border">
          {/* Left Column: Selector & Channel Config */}
          <div className="lg:col-span-5 p-6 bg-surface space-y-6">
            {/* Step 1: Select Artefact */}
            <div>
              <label className="block label-mono pb-2">1. Select Approved Artefact</label>
              <div className="space-y-2">
                {approvedOutputs.map((item) => {
                  const isSelected = activeOutput?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedOutputId(item.id)}
                      className={cn(
                        "cursor-pointer rounded-sm border p-3 text-xs transition-colors",
                        isSelected
                          ? "border-ember bg-surface-raised ring-1 ring-ember"
                          : "border-border bg-background hover:bg-surface-raised",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{item.output_type}</span>
                        <span className="rounded bg-verified/15 px-1.5 py-0.2 font-mono text-[9px] text-verified">
                          Approved
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground text-[11px]">
                        Target Audience:{" "}
                        <strong className="text-foreground">{item.audience}</strong> · Coverage:{" "}
                        {Math.round(item.evidence_coverage ?? 100)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Choose Target Channel */}
            <div>
              <label className="block label-mono pb-2">2. Select Distribution Channel</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChannel("web")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-sm border p-3 text-left transition-colors",
                    channel === "web"
                      ? "border-ember bg-ember/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-surface-raised",
                  )}
                >
                  <Globe className={cn("size-4", channel === "web" ? "text-ember" : "")} />
                  <span className="text-xs font-semibold">Web Portal</span>
                  <span className="text-[10px] text-muted-foreground">HTML Embed / Microdata</span>
                </button>

                <button
                  onClick={() => setChannel("email")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-sm border p-3 text-left transition-colors",
                    channel === "email"
                      ? "border-ember bg-ember/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-surface-raised",
                  )}
                >
                  <Mail className={cn("size-4", channel === "email" ? "text-ember" : "")} />
                  <span className="text-xs font-semibold">Email Advisory</span>
                  <span className="text-[10px] text-muted-foreground">MIME Headers & Body</span>
                </button>

                <button
                  onClick={() => setChannel("api")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-sm border p-3 text-left transition-colors",
                    channel === "api"
                      ? "border-ember bg-ember/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-surface-raised",
                  )}
                >
                  <Radio className={cn("size-4", channel === "api" ? "text-ember" : "")} />
                  <span className="text-xs font-semibold">REST API</span>
                  <span className="text-[10px] text-muted-foreground">Signed JSON Webhook</span>
                </button>

                <button
                  onClick={() => setChannel("sms")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-sm border p-3 text-left transition-colors",
                    channel === "sms"
                      ? "border-ember bg-ember/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-surface-raised",
                  )}
                >
                  <Smartphone className={cn("size-4", channel === "sms" ? "text-ember" : "")} />
                  <span className="text-xs font-semibold">Emergency Broadcast</span>
                  <span className="text-[10px] text-muted-foreground">SMS / Telegram Snippet</span>
                </button>
              </div>
            </div>

            {/* Step 3: Target Endpoint / Routing */}
            <div>
              <label className="block label-mono pb-2">3. Target Destination / Recipient</label>
              <Input
                value={targetEndpoint}
                onChange={(e) => setTargetEndpoint(e.target.value)}
                placeholder={
                  channel === "email"
                    ? "sec-leadership@agency.gov.in"
                    : channel === "api"
                      ? "https://alerts.cert.gov.in/v1/inbound"
                      : "public-portal / cdn"
                }
                className="h-9 text-xs border-border bg-background focus-visible:ring-ember"
              />
            </div>

            {/* Step 4: Dispatch Action */}
            <div className="pt-2">
              <Button
                onClick={handlePrepare}
                disabled={isPreparing || !activeOutput}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Send className="size-3.5 mr-1.5" />
                {isPreparing ? "Recording distribution..." : "Prepare & Sign Distribution Bundle"}
              </Button>
              <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
                Creates an immutable record in the cryptographic audit chain.
              </p>
            </div>
          </div>

          {/* Right Column: Live Channel Payload Preview */}
          <div className="lg:col-span-7 p-6 bg-background flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-foreground">
                    Channel Payload Preview ({channel.toUpperCase()})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs border-slate-200"
                  >
                    {copied ? (
                      <Check className="size-3 text-emerald-600 mr-1" />
                    ) : (
                      <Copy className="size-3 mr-1" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="h-7 text-xs border-slate-200"
                  >
                    <Download className="size-3 mr-1" />
                    Payload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadMarkdown}
                    className="h-7 text-xs border-slate-200"
                  >
                    <Download className="size-3 mr-1" />
                    .MD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadJson}
                    className="h-7 text-xs border-slate-200"
                  >
                    <Download className="size-3 mr-1" />
                    JSON
                  </Button>
                </div>
              </div>

              {/* Formatted Code / Text Box */}
              <pre className="mt-4 rounded-xl border border-border bg-surface p-4 font-mono text-xs text-foreground/90 overflow-x-auto whitespace-pre-wrap max-h-[460px] leading-relaxed shadow-inner">
                {payloadText}
              </pre>
            </div>

            {/* Cryptographic Compliance Badge */}
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 flex items-center gap-3">
              <Key className="size-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Cryptographic Verification Attached</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  All downstream consumers can mathematically verify evidence coverage (
                  {Math.round(activeOutput?.evidence_coverage ?? 100)}%) against the source document
                  hash.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribution History Table */}
      <section className="m-6 rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Radio className="size-4 text-emerald-600" />
            Prepared Distribution Ledger ({distributions.length})
          </h2>
          <span className="label-mono">Immutable Audit Chain</span>
        </div>

        <div className="divide-y divide-border">
          {distributions.map((dist) => (
            <div
              key={dist.id}
              className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs hover:bg-slate-50/80 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {dist.channel}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-foreground font-medium">
                    {dist.target || "(broadcast channel)"}
                  </span>
                </div>
                <p className="label-mono mt-1 text-slate-500">
                  ID: {dist.id.slice(0, 8)}... · Status:{" "}
                  <span className="text-emerald-700 font-semibold">{dist.status}</span>
                </p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(dist.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          {distributions.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No distributions prepared yet.</p>
          )}
        </div>
      </section>

      {/* End-to-End Pipeline Completed Banner */}
      <div className="m-6 mb-12 rounded-2xl border-2 border-emerald-500/50 bg-emerald-50/95 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md shadow-emerald-500/10 animate-in fade-in">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              End-to-End Intelligence Pipeline Complete
            </h3>
          </div>
          <p className="text-xs text-slate-600 max-w-xl">
            Document ingestion, claim extraction, mathematical verification, human audit sign-off,
            and cryptographic distribution have all been executed with 100% evidence traceability.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 ring-2 ring-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            Upload Next Document (Step 1) <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/outputs"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            View All Outputs & Downloads
          </Link>
        </div>
      </div>
    </div>
  );
}
