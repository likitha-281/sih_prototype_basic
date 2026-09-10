import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Activity,
  FileText,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  Send,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useLiveQuery } from "@/hooks/use-live-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ForgeCopilot } from "@/components/forge-copilot";
import { RecentTransformationsSidebar } from "@/components/recent-transformations-sidebar";
import { TopNavbar } from "@/components/navigation/top-navbar";
import { signOutAll } from "@/lib/auth-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

export function AuthenticatedLayout() {
  const { session, user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Live count of artefacts awaiting review
  const { data: pendingReviewData } = useLiveQuery(
    ["pending_review_count"] as never,
    async () => {
      const { data } = await supabase
        .from("outputs")
        .select("id, status")
        .in("status", ["generated", "edited"]);
      return (data ?? []).length;
    },
    ["outputs"],
  );

  const pendingReviewCount = pendingReviewData ?? 0;

  const NAV = [
    { to: "/", label: "Home", icon: Home },
    { to: "/upload", label: "Upload & Process", icon: Upload },
    { to: "/outputs", label: "Generated Outputs", icon: FileText },
    {
      to: "/review",
      label: "Review & Approve",
      icon: ListChecks,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined,
    },
    { to: "/distribution", label: "Distribute", icon: Send },
    { to: "/audit", label: "Analytics", icon: Activity },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", search: { redirect: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/80 px-6 py-4 shadow-lg backdrop-blur">
          <ShieldCheck className="size-5 animate-spin text-ember" />
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
              INTELLI-FORGE
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Authenticating operator session…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const userEmail = session.user?.email || "operator@intelliforge.ai";
  const userInitials = (session.user?.user_metadata?.name || userEmail.split("@")[0])
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar Navigation */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-sidebar/95 backdrop-blur-sm md:flex">
        {/* Brand Header */}
        <div className="border-b border-border/80 px-5 py-4">
          <Link to="/upload" className="group block">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <span className="text-sm font-bold tracking-tight text-foreground group-hover:text-blue-500 transition-colors block leading-tight">
                  ContentForge
                </span>
                <p className="text-[10px] tracking-wide text-muted-foreground font-sans leading-tight mt-0.5">
                  Verified Content. Real Impact.
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {NAV.map((item) => {
            const isHome = item.to === "/";
            const active = isHome ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all relative group",
                  active
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20 shadow-xs"
                    : "text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:scale-105",
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                <span className="truncate">{item.label}</span>
                {"badge" in item && item.badge != null && (
                  <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pipeline Status Indicator */}
        <div className="border-t border-border/80 p-3 bg-surface/20">
          <div className="rounded-lg border border-border/60 bg-surface/50 p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px] text-foreground">Pipeline Status</span>
              <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-1 text-[10px] font-mono text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Intake Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Processing Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Verification Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Identity & Logout Card */}
        <div className="border-t border-border/80 p-3 bg-surface/30">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md bg-surface/50 border border-border/40">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ember/20 text-ember font-mono text-xs font-bold ring-1 ring-ember/30">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {session.user?.user_metadata?.name || userEmail.split("@")[0]}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              await signOutAll();
              navigate({ to: "/" });
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-surface/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          >
            <LogOut className="size-3.5" />
            <span>{t("nav.signout", "Sign out")}</span>
          </button>
        </div>
      </aside>

      {/* Main App Canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Global Top Navbar */}
        <TopNavbar />

        {/* Mobile Horizontal Sub-nav Bar */}
        <div className="flex gap-2 border-b border-border bg-surface/90 backdrop-blur px-3 py-2 overflow-x-auto md:hidden">
          {NAV.map((item) => {
            const isHome = item.to === "/";
            const active = isHome ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                  active
                    ? "bg-ember/15 text-ember font-semibold border border-ember/30"
                    : "text-muted-foreground hover:text-foreground bg-surface-raised/40",
                )}
              >
                <item.icon className="size-3 text-ember" />
                <span>{item.label}</span>
                {"badge" in item && item.badge != null && (
                  <span className="rounded-full bg-ember px-1 text-[9px] text-ember-foreground font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Floating Grounded Intelligence Copilot */}
      <ForgeCopilot />

      {/* Persistent LocalStorage Recent Transformations Sidebar */}
      <RecentTransformationsSidebar />
    </div>
  );
}
