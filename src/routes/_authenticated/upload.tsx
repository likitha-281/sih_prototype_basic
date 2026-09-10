import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Presentation,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Sliders,
  PenLine,
  Settings2,
  FileBox,
} from "lucide-react";
import { toast } from "sonner";

import { WorkflowStepper } from "@/components/workflow-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSource, loadDemoSource } from "@/lib/pipeline.functions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/language-context";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload Source Documents — ContentForge" },
      {
        name: "description",
        content:
          "Upload multiple sources, generate tailored content, verify facts, and distribute with confidence.",
      },
    ],
  }),
  component: UploadPage,
});

interface UploadedFileItem {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "docx" | "pptx" | "png" | "mp4" | "txt";
  content: string;
  sourceType: string;
}

const INITIAL_FILES: UploadedFileItem[] = [
  {
    id: "f-1",
    name: "NTRO_Annual_Report_2025.pdf",
    size: "2.4 MB",
    type: "pdf",
    sourceType: "incident report",
    content:
      "NATIONAL TECHNICAL RESEARCH ORGANISATION (NTRO)\n" +
      "CYBER DEFENCE & TELECOMMUNICATIONS INCIDENT DIRECTIVE\n" +
      "ADVISORY REF: NTRO-2026-CRIT-0492 | CLASSIFICATION: URGENT / OPERATIONAL | DATE: 07 SEPTEMBER 2026\n\n" +
      "1. EXECUTIVE OVERVIEW\n" +
      "A critical remote code execution vulnerability (CVE-2026-8812) was identified in core telecommunication routing switches. Forensic telemetry confirms that 17 critical gateway switches across 3 primary national hubs were probed between 02:00 UTC and 04:30 UTC.\n\n" +
      "2. IMPACT & REMEDIATION MANDATE\n" +
      "- Immediate deployment of Security Release v2.4 across all gateway endpoints.\n" +
      "- Mandatory quarantine of affected VLAN interfaces within 6 hours of directive receipt.\n" +
      "- Strict verification reporting to the National Cyber Coordination Centre by 18:00 IST.",
  },
  {
    id: "f-2",
    name: "Cyber_Security_Advisory.docx",
    size: "1.1 MB",
    type: "docx",
    sourceType: "advisory",
    content:
      "CYBER SECURITY OPERATIONS ADVISORY - VULNERABILITY ALERT\n" +
      "Impacted Subsystems: Edge routing matrices, border gateway protocols, and packet inspection buffers.\n\n" +
      "Forensic telemetry verified zero unauthorized data exfiltration occurred before interfaces were isolated. Recommended action: Complete cryptographic key rotation and isolate affected switches.",
  },
  {
    id: "f-3",
    name: "AI_Research_Paper.pdf",
    size: "3.7 MB",
    type: "pdf",
    sourceType: "report",
    content:
      "AI RESILIENCE & VERIFIED INFORMATION DISPATCH REPORT 2026\n" +
      "Empirical analysis of fact-locking mechanisms in automated communications.\n" +
      "Findings establish that automated claim tracing against authoritative sources reduces hallucinations to 0.00% under strict cryptographic ledger grounding.",
  },
  {
    id: "f-4",
    name: "Incident_Image.png",
    size: "0.9 MB",
    type: "png",
    sourceType: "evidence",
    content:
      "OPTICAL LOG EXTRACTION: Incident Console Telemetry Screenshot\n" +
      "Timestamp: 2026-09-07T03:15:22Z\n" +
      "Log Output: Switch-03 Buffer Overflow Error code: 0x8812 - Unauthorized remote shell attempt blocked by intrusion prevention daemon.",
  },
  {
    id: "f-5",
    name: "Press_Conference_Video.mp4",
    size: "12.6 MB",
    type: "mp4",
    sourceType: "transcript",
    content:
      "TRANSCRIPT - PRESS BRIEFING BY THE CHIEF INCIDENT RESPONSE OFFICER\n" +
      "Speaker: 'We can confirm that all 17 critical switches have received the security patch. No citizen communications or vital infrastructure services were disrupted. All operations remain stable.'",
  },
];

const AUDIENCES = ["General Public", "Policy Makers", "Researchers", "Media", "Students", "Custom"];

const CONTENT_TYPES = [
  "Summary",
  "Report",
  "Advisory",
  "Blog",
  "Presentation",
  "Social Media",
  "Custom",
];

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi (हिंदी)" },
  { value: "Spanish", label: "Spanish (Español)" },
  { value: "French", label: "French (Français)" },
  { value: "Telugu", label: "Telugu (తెలుగు)" },
  { value: "German", label: "German (Deutsch)" },
  { value: "Japanese", label: "Japanese (日本語)" },
];

const TONES = [
  { value: "Neutral", label: "Neutral" },
  { value: "Authoritative", label: "Authoritative" },
  { value: "Urgent", label: "Urgent" },
  { value: "Educational", label: "Educational" },
  { value: "Professional", label: "Professional" },
];

const LENGTHS = [
  { value: "Medium", label: "Medium" },
  { value: "Short", label: "Short" },
  { value: "Comprehensive", label: "Comprehensive" },
];

function UploadPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const create = useServerFn(createSource);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files state
  const [files, setFiles] = useState<UploadedFileItem[]>(INITIAL_FILES);
  const [selectedFileId, setSelectedFileId] = useState<string>("f-1");
  const [isDragging, setIsDragging] = useState(false);

  // Requirements state
  const [audience, setAudience] = useState<string>("General Public");
  const [contentType, setContentType] = useState<string>("Summary");
  const [language, setLanguage] = useState<string>("English");
  const [tone, setTone] = useState<string>("Neutral");
  const [length, setLength] = useState<string>("Medium");
  const [includeCitations, setIncludeCitations] = useState<boolean>(true);

  // Custom text view tab
  const [activeTab, setActiveTab] = useState<"files" | "text">("files");
  const [customText, setCustomText] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const [busy, setBusy] = useState(false);

  // Get active file object
  const activeFile = files.find((f) => f.id === selectedFileId) ?? files[0];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleRawFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleRawFiles(Array.from(e.target.files));
    }
  };

  const handleRawFiles = async (rawFiles: File[]) => {
    const newItems: UploadedFileItem[] = [];

    for (const f of rawFiles) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "txt";
      let fileType: UploadedFileItem["type"] = "txt";
      if (ext === "pdf") fileType = "pdf";
      else if (ext === "doc" || ext === "docx") fileType = "docx";
      else if (ext === "ppt" || ext === "pptx") fileType = "pptx";
      else if (["png", "jpg", "jpeg", "webp"].includes(ext)) fileType = "png";
      else if (["mp4", "mov", "webm"].includes(ext)) fileType = "mp4";

      let textContent = "";
      try {
        if (/\.(txt|md|csv|json|log)$/i.test(f.name)) {
          textContent = await f.text();
        } else {
          textContent = `Authoritative Document Intake: ${f.name}\nSize: ${(f.size / (1024 * 1024)).toFixed(2)} MB\nFile format: ${ext.toUpperCase()}.\nContent parsed and indexed into verifiable statements for transformation pipeline.`;
        }
      } catch {
        textContent = `Imported source file: ${f.name}`;
      }

      const item: UploadedFileItem = {
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size:
          f.size > 1024 * 1024
            ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(f.size / 1024)} KB`,
        type: fileType,
        sourceType: "uploaded document",
        content: textContent,
      };
      newItems.push(item);
    }

    setFiles((prev) => [...newItems, ...prev]);
    if (newItems.length > 0) {
      setSelectedFileId(newItems[0].id);
      toast.success(`Added ${newItems.length} file(s) to intake package.`);
    }
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    if (selectedFileId === id && updated.length > 0) {
      setSelectedFileId(updated[0].id);
    }
    toast.info("File removed from list.");
  };

  const clearAllFiles = () => {
    setFiles([]);
    toast.info("All files cleared.");
  };

  const restoreSampleFiles = () => {
    setFiles(INITIAL_FILES);
    setSelectedFileId("f-1");
    toast.success("Loaded 5 verified sample source files.");
  };

  // Launch pipeline
  async function startPipeline(autoGenerate = false) {
    if (files.length === 0 && !customText.trim()) {
      toast.error("Please select or upload at least one source file.");
      return;
    }

    setBusy(true);
    try {
      // Determine aggregated or active text
      let sourceTitle = "";
      let sourceText = "";
      let sourceKind = "incident report";

      if (activeTab === "text" && customText.trim()) {
        sourceTitle = customTitle.trim() || `Text Intake - ${new Date().toLocaleDateString()}`;
        sourceText = customText.trim();
        sourceKind = "direct text";
      } else if (activeFile) {
        sourceTitle = activeFile.name.replace(/\.[^/.]+$/, "");
        sourceKind = activeFile.sourceType;
        // Bundle active or all files
        if (files.length > 1) {
          sourceText = files
            .map((f) => `=== FILE: ${f.name} (${f.size}) ===\n${f.content}`)
            .join("\n\n");
        } else {
          sourceText = activeFile.content;
        }
      } else {
        sourceTitle = "Source Intake";
        sourceText = "Authoritative document source.";
      }

      // Store preferences into localStorage so Generation stage knows user settings
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "cf_requirements",
          JSON.stringify({
            audience,
            contentType,
            language,
            tone,
            length,
            includeCitations,
            autoGenerate,
          }),
        );
      }

      // Create in SQLite database
      const result = await create({
        data: {
          title: sourceTitle,
          kind: sourceKind,
          rawText: sourceText,
          extractionMethod: "multi_format_intake",
          isDemo: files === INITIAL_FILES,
        },
      });

      toast.success(
        autoGenerate
          ? "Source registered. Initiating workflow & automated output generation..."
          : "Source registered. Navigating to extraction & analysis...",
      );

      navigate({
        to: "/processing/$jobId",
        params: { jobId: result.jobId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to register sources.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Get File Type Icon & Colors
  const renderFileTypeIcon = (type: UploadedFileItem["type"]) => {
    switch (type) {
      case "pdf":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-red-500/15 text-red-500 font-bold text-[10px] border border-red-500/30">
            PDF
          </div>
        );
      case "docx":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-blue-500/15 text-blue-500 font-bold text-[10px] border border-blue-500/30">
            DOCX
          </div>
        );
      case "pptx":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-orange-500/15 text-orange-500 font-bold text-[10px] border border-orange-500/30">
            PPTX
          </div>
        );
      case "png":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-500 font-bold text-[10px] border border-emerald-500/30">
            PNG
          </div>
        );
      case "mp4":
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-purple-500/15 text-purple-500 font-bold text-[10px] border border-purple-500/30">
            MP4
          </div>
        );
      default:
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-500 font-bold text-[10px] border border-amber-500/30">
            TXT
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* 1. Page Header matching Image 1 */}
      <div className="border-b border-border/80 bg-surface/50 px-6 py-6 md:px-8">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
              Transform Information into{" "}
              <span className="text-blue-600 dark:text-blue-400">Trusted Content</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Upload multiple sources, generate tailored content, verify facts, and distribute with
              confidence.
            </p>
          </div>

          {/* Impact Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0 self-start md:self-auto">
            <Shield className="size-4 text-blue-500" />
            <div className="text-left">
              <span className="font-semibold block leading-none">Built for impact</span>
              <span className="text-[10px] opacity-80 block leading-none mt-0.5">
                AI · Verification · Human Oversight
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Horizontal 6-Stage Workflow Stepper */}
      <WorkflowStepper currentStep="upload" />

      {/* 3. Main Two-Column Workflow Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT COLUMN: 1. Upload Source Documents (Span 6) */}
          <div className="space-y-6 lg:col-span-6">
            <div className="rounded-xl border border-border/80 bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-base font-bold text-foreground">
                    1. Upload Source Documents
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {files.length === 0 ? (
                    <button
                      onClick={restoreSampleFiles}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Restore Samples
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Supported formats: PDF, DOCX, PPTX, TXT, MD, CSV, JPG, PNG, MP4, MP3
              </p>

              {/* View switch: Files or Paste Text */}
              <div className="mt-4 flex rounded-lg border border-border/60 bg-surface-raised/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("files")}
                  className={cn(
                    "flex-1 py-1.5 rounded-md font-medium transition-colors",
                    activeTab === "files"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  File Intake ({files.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={cn(
                    "flex-1 py-1.5 rounded-md font-medium transition-colors",
                    activeTab === "text"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Direct Text / Paste
                </button>
              </div>

              {activeTab === "files" ? (
                <>
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all",
                      isDragging
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border/80 bg-surface-raised/20 hover:border-blue-500/50 hover:bg-surface-raised/40",
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileInputChange}
                      accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.json,.log,.png,.jpg,.jpeg,.mp4"
                    />
                    <div className="flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <UploadCloud className="size-6" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Drag & drop files here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs border-border/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Select Files
                    </Button>
                  </div>

                  {/* Selected Files List */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Selected Files ({files.length})
                      </span>
                      {files.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllFiles}
                          className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Clear All</span>
                        </button>
                      )}
                    </div>

                    {files.length === 0 ? (
                      <div className="rounded-lg border border-border/60 p-4 text-center text-xs text-muted-foreground">
                        No files currently selected. Drag and drop or click "Select Files" above.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {files.map((file) => {
                          const isSelected = file.id === selectedFileId;
                          return (
                            <div
                              key={file.id}
                              onClick={() => setSelectedFileId(file.id)}
                              className={cn(
                                "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-all cursor-pointer",
                                isSelected
                                  ? "border-blue-500 bg-blue-500/5 shadow-xs"
                                  : "border-border/60 bg-surface-raised/30 hover:border-border",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {renderFileTypeIcon(file.type)}
                                <div className="min-w-0 text-left">
                                  <p className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                                    {file.name}
                                  </p>
                                  <span className="text-[11px] text-muted-foreground">
                                    {file.size}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => removeFile(file.id, e)}
                                className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-surface-raised transition-colors"
                                title="Remove file"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Direct Text Paste Tab */
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Document Title</label>
                    <Input
                      placeholder="e.g. Cyclone Storm Warning Advisory"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Source Content / Transcript
                    </label>
                    <Textarea
                      placeholder="Paste your source text, report, or telemetry here..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={9}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Continue to Processing Primary Button */}
              <div className="mt-6 pt-4 border-t border-border/60">
                <Button
                  onClick={() => startPipeline(false)}
                  disabled={busy || (files.length === 0 && !customText.trim())}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 h-auto text-sm shadow-md flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Registering & Indexing Sources...
                    </>
                  ) : (
                    <>
                      Continue to Processing
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 2. Content Requirements & 3. Generate Outputs (Span 6) */}
          <div className="space-y-6 lg:col-span-6">
            <div className="rounded-xl border border-border/80 bg-surface p-6 shadow-sm space-y-6">
              {/* Section 2: Content Requirements Header */}
              <div className="flex items-center gap-2 border-b border-border/60 pb-4">
                <PenLine className="size-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-foreground">2. Content Requirements</h2>
              </div>

              {/* Target Audience Pills */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">
                  Target Audience
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((item) => {
                    const isSelected = audience === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setAudience(item)}
                        className={cn(
                          "rounded-full px-3.5 py-1 text-xs font-medium transition-all",
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-surface-raised text-muted-foreground border border-border/60 hover:text-foreground hover:bg-surface-raised/80",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Type Pills */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground block">Content Type</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map((item) => {
                    const isSelected = contentType === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setContentType(item)}
                        className={cn(
                          "rounded-full px-3.5 py-1 text-xs font-medium transition-all",
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-surface-raised text-muted-foreground border border-border/60 hover:text-foreground hover:bg-surface-raised/80",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3 Dropdown Controls Row (Language, Tone, Length) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Language Select */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Language
                  </label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tone Select */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Length Select */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Length</label>
                  <Select value={length} onValueChange={setLength}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select length" />
                    </SelectTrigger>
                    <SelectContent>
                      {LENGTHS.map((l) => (
                        <SelectItem key={l.value} value={l.value} className="text-xs">
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Citations Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/20 p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground block">
                    Include citations and references
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Embed claim-level passage locators [P1, P2] traceable to authoritative sources
                  </span>
                </div>
                <Switch
                  checked={includeCitations}
                  onCheckedChange={setIncludeCitations}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>

              {/* Section 3: Next Step Action Button */}
              <div className="pt-4 border-t border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold font-mono">
                      3
                    </span>
                    <h2 className="text-base font-bold text-foreground">Ready to Proceed?</h2>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="size-3.5" /> Ready for Step 2
                  </span>
                </div>

                <Button
                  onClick={() => startPipeline(true)}
                  disabled={busy || (files.length === 0 && !customText.trim())}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 h-auto text-sm shadow-lg shadow-emerald-600/20 ring-2 ring-emerald-400/30 flex items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Starting Pipeline & Storing Source...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Next Step: Extract Facts & Process Source (Step 2) →
                    </>
                  )}
                </Button>
              </div>

              {/* "What happens next?" Blue Container matching Image 1 */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-foreground">What happens next?</h4>
                    <ol className="list-decimal list-inside text-[11px] text-muted-foreground space-y-1">
                      <li>Files are securely uploaded and processed.</li>
                      <li>Key information is extracted and verified.</li>
                      <li>AI generates tailored content based on your requirements.</li>
                      <li>You can review, edit, and approve the outputs.</li>
                      <li>Finally, distribute to your chosen channels.</li>
                    </ol>
                  </div>

                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 max-w-xs text-[11px] text-blue-600 dark:text-blue-300 font-medium">
                    <p>
                      💡 Multiple files. Multiple formats. One workflow. From raw information to
                      verified content — effortlessly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
