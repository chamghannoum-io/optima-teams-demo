/**
 * App chrome around the Teams page: the real AppShell (icon rail + flyout submenu)
 * plus the header row with breadcrumbs, matching the live app.
 */
import { useState } from "react";
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
} from "lucide-react";
import { AppShell as UiAppShell, Breadcrumbs } from "../ui/index.js";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState("/master-data/teams");
  return (
    <UiAppShell navItems={NAV} currentPath={path} onNavigate={setPath} appName="Optima">
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-dark-border dark:bg-dark-surface">
          <Breadcrumbs
            items={[
              { label: "Dashboard", to: "/dashboard" },
              { label: "Master Data", to: "/master-data" },
              { label: "Teams" },
            ]}
          />
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Building2 size={15} /> ASH Hospital HQ
            </span>
            <Bell size={17} className="text-slate-400" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
                MP
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Manager Provider
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </UiAppShell>
  );
}
