import { Upload, Cpu, Sparkles, ShieldCheck, ClipboardCheck, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStepId = "upload" | "process" | "generate" | "verify" | "review" | "distribute";

interface WorkflowStepperProps {
  currentStep: WorkflowStepId;
  className?: string;
  sourceId?: string;
  jobId?: string;
  outputId?: string;
}

export const WORKFLOW_STEPS: Array<{
  id: WorkflowStepId;
  stepNumber: number;
  label: string;
  sublabel: string;
  icon: typeof Upload;
}> = [
  {
    id: "upload",
    stepNumber: 1,
    label: "Upload",
    sublabel: "Add your sources",
    icon: Upload,
  },
  {
    id: "process",
    stepNumber: 2,
    label: "Process",
    sublabel: "Extract & analyze",
    icon: Cpu,
  },
  {
    id: "generate",
    stepNumber: 3,
    label: "Generate",
    sublabel: "Create content",
    icon: Sparkles,
  },
  {
    id: "verify",
    stepNumber: 4,
    label: "Verify",
    sublabel: "Fact-check & trust",
    icon: ShieldCheck,
  },
  {
    id: "review",
    stepNumber: 5,
    label: "Review",
    sublabel: "Human oversight",
    icon: ClipboardCheck,
  },
  {
    id: "distribute",
    stepNumber: 6,
    label: "Distribute",
    sublabel: "Share & publish",
    icon: Send,
  },
];

export function WorkflowStepper({
  currentStep,
  className,
  sourceId,
  jobId,
  outputId,
}: WorkflowStepperProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  const getStepHref = (stepId: WorkflowStepId) => {
    switch (stepId) {
      case "upload":
        return "/upload";
      case "process":
        return jobId ? `/processing/${jobId}` : undefined;
      case "generate":
        return sourceId ? `/workspace/${sourceId}` : undefined;
      case "verify":
        return outputId ? `/outputs/${outputId}` : undefined;
      case "review":
        return "/review";
      case "distribute":
        return "/distribution";
      default:
        return undefined;
    }
  };

  return (
    <div
      className={cn(
        "w-full bg-white border-b border-slate-200/90 px-4 py-3 sm:px-6 shadow-2xs",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 md:gap-3">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isCurrent = step.id === currentStep;
            const isCompleted = idx < currentIndex;
            const Icon = step.icon;
            const href = getStepHref(step.id);

            const content = (
              <div
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg p-2.5 transition-all text-left w-full",
                  isCurrent
                    ? "bg-emerald-50/90 border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-400/20"
                    : isCompleted
                      ? "bg-slate-50/80 border border-slate-200 hover:border-emerald-400/60 hover:bg-emerald-50/30 text-slate-700"
                      : "bg-white border border-slate-200/80 text-slate-400 opacity-80",
                )}
              >
                {/* Step Icon / Number Indicator */}
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all",
                    isCurrent
                      ? "bg-emerald-600 text-white shadow-xs scale-105"
                      : isCompleted
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                        : "bg-slate-100 text-slate-500 border border-slate-200",
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4 text-emerald-700 stroke-[3]" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>

                {/* Step Labels */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-xs font-bold truncate",
                        isCurrent
                          ? "text-emerald-700 font-bold"
                          : isCompleted
                            ? "text-slate-800 font-semibold"
                            : "text-slate-400 font-medium",
                      )}
                    >
                      {step.stepNumber}. {step.label}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "truncate text-[10px] leading-tight",
                      isCurrent ? "text-emerald-600/90 font-medium" : "text-slate-500",
                    )}
                  >
                    {step.sublabel}
                  </p>
                </div>
              </div>
            );

            if (href && (isCompleted || isCurrent)) {
              return (
                <a
                  key={step.id}
                  href={href}
                  className="block transition-transform hover:scale-[1.01]"
                >
                  {content}
                </a>
              );
            }

            return (
              <div key={step.id} className="block">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
