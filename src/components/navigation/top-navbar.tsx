import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  Home,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  ListChecks,
  FileText,
  Activity,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { signOutAll } from "@/lib/auth-service";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/context/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TopNavbar() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSignOut = async () => {
    await signOutAll();
    toast.info("Signed out of operator console.");
    navigate({ to: "/" });
  };

  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Operator";
  const userEmail = user?.email || "pavan@test.com";
  const userInitials =
    (user?.user_metadata?.name || userEmail.split("@")[0]).slice(0, 2).toUpperCase() || "PA";
  const userRole = user?.user_metadata?.role || "Operator";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/outputs" });
      toast.info(`Filtering for: "${searchQuery}"`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/70 bg-background/80 px-4 md:px-6 backdrop-blur-md">
      {/* Left: Brand/Logo & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs font-medium text-foreground hover:text-blue-500 transition-colors"
        >
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <ShieldCheck className="size-4" />
          </div>
          <div className="hidden sm:block text-left">
            <span className="font-bold tracking-tight text-foreground text-sm leading-tight block">
              ContentForge
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight block">
              Verified Content. Real Impact.
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources, outputs, claims..."
            className="pl-9 pr-4 h-9 w-full rounded-full bg-surface-raised/60 border-border/60 text-xs focus-visible:ring-blue-500"
          />
        </form>
      </div>

      {/* Right: Actions, Notifications, and Operator Identity */}
      <div className="flex items-center gap-2.5">
        {/* Quick Upload Action */}
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-all"
        >
          <Upload className="size-3.5" />
          <span>{t("topbar.newIntake", "Upload & Process")}</span>
        </Link>

        {/* Notifications Icon Button */}
        <button
          onClick={() => toast.info("No unread alerts. Verification pipelines operational.")}
          className="relative p-2 rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors"
          title="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-blue-500" />
        </button>

        {/* Screen Language Switcher */}
        <div className="hidden lg:block">
          <LanguageSwitcher />
        </div>

        {/* User Identity Avatar Circle */}
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 pl-2 pr-1.5 py-1 text-xs">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-bold font-mono">
            {userInitials}
          </div>
          <div className="hidden xl:block text-left mr-1">
            <p className="text-[11px] font-medium leading-none text-foreground truncate max-w-[100px]">
              {displayName}
            </p>
            <p className="text-[9px] font-mono text-muted-foreground leading-none mt-0.5 truncate max-w-[100px]">
              {userEmail}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title={t("nav.signout", "Sign out")}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
