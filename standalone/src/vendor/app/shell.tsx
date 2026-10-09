/**
 * App chrome around the Teams page: the real AppShell (icon rail + flyout submenu)
 * plus the header row with breadcrumbs, matching the live app.
 */
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  BarChart3,
  ShieldCheck,
  CheckSquare,
  FileText,
  ClipboardList,
  TrendingUp,
  UserPlus,
  Building2,
  Bell,
  Moon,
  Repeat,
  Sun,
} from "lucide-react";
import { AppShell as UiAppShell, Breadcrumbs } from "../ui/index.js";
import { ACCOUNTS, setAccount, useAuth } from "./auth.js";

/**
 * Theme, copied from apps/taskboard/src/app/app.tsx.
 *
 * Tailwind is configured here with a class-based dark variant and the dark
 * tokens are already in cortex.css, but nothing ever set the class, so every
 * `dark:` utility in the app was dead. The ported dashboard's charts watch the
 * same class, which is why they pick this up with no extra wiring.
 */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    // Fall back to the OS preference the first time, rather than assuming light.
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/assistant", label: "Optima Assistant", icon: <Sparkles size={20} /> },
  { to: "/queries", label: "Queries Dashboard", icon: <BarChart3 size={20} /> },
  { to: "/eligibility", label: "Eligibility", icon: <ShieldCheck size={20} />, children: [] },
  { to: "/authorizations", label: "Authorizations", icon: <CheckSquare size={20} />, children: [] },
  { to: "/claims", label: "Claims", icon: <FileText size={20} />, children: [] },
  {
    to: "/master-data",
    label: "Master Data",
    icon: <ClipboardList size={20} />,
    children: [
      { to: "/master-data/facilities", label: "Facilities" },
      { to: "/master-data/teams", label: "Teams" },
      { to: "/master-data/contracts", label: "Contracts" },
      { to: "/master-data/price-lists", label: "Price Lists" },
      { to: "/master-data/query-templates", label: "Query Templates" },
      { to: "/master-data/payer-credentials", label: "Payer Credentials" },
    ],
  },
  { to: "/analytics", label: "Analytics & Insights", icon: <TrendingUp size={20} />, children: [] },
  { to: "/users", label: "User Management", icon: <UserPlus size={20} /> },
];

/** Breadcrumb trail per route, matching the live app's header. */
const CRUMBS: Record<string, { label: string; to?: string }[]> = {
  "/dashboard": [{ label: "Dashboard", to: "/dashboard" }, { label: "RCM Supervisor Dashboard" }],
  "/master-data/teams": [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Master Data", to: "/master-data" },
    { label: "Teams" },
  ],
};

/**
 * Who is signed in, and the only control in the demo that changes what you
 * are allowed to do.
 *
 * It exists for the high-cost amounts. The supervisor decides what is on that
 * list; everyone else picks from it. That rule is invisible with one login,
 * because the person showing it can always do both halves. Signing in as the
 * team lead and finding the amounts read-only is the demonstration.
 */
function AccountSwitcher() {
  const { user } = useAuth();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const supervisor = String(user.vendorUserType).toUpperCase().includes("SUPERVISOR");
  const other = ACCOUNTS.find((a) => a.id !== user.id);
  return (
    <div className="flex items-center gap-2">
      <div
        className={cx(
          "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white",
          supervisor ? "bg-primary" : "bg-slate-500",
        )}
      >
        {initials}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {user.firstName} {user.lastName}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{user.role}</div>
      </div>
      {other && (
        <button
          type="button"
          onClick={() => setAccount(other.id)}
          title={other.blurb}
          className="ml-1 flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-dark-border dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-slate-200"
        >
          <Repeat size={11} /> Sign in as {other.role.toLowerCase()}
        </button>
      )}
    </div>
  );
}

/** Local join, so the shell does not reach into the UI package for one helper. */
const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

export function AppShell({
  children,
  onNavigate,
  initialPath = "/master-data/teams",
}: {
  children: React.ReactNode;
  /** Lets main.tsx swap the page, so the rail actually navigates. */
  onNavigate?: (path: string) => void;
  initialPath?: string;
}) {
  const [path, setPath] = useState(initialPath);
  const { theme, toggle } = useTheme();
  const go = (p: string) => {
    setPath(p);
    onNavigate?.(p);
  };
  return (
    <UiAppShell navItems={NAV} currentPath={path} onNavigate={go} appName="Optima">
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-dark-border dark:bg-dark-surface">
          <Breadcrumbs items={CRUMBS[path] ?? CRUMBS["/master-data/teams"]} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-dark-hover dark:hover:text-slate-200"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Building2 size={15} /> ASH Hospital HQ
            </span>
            <Bell size={17} className="text-slate-400" />
            <AccountSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </UiAppShell>
  );
}
