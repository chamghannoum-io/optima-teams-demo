/**
 * Stands in for @optima/auth.
 *
 * Two logins, not one.
 *
 * The demo used to sign in as a single admin with every permission, which was
 * fine while every control on the page was for the same person. It stopped
 * being fine with the high-cost amounts: the whole point of a dropdown rather
 * than a text box is that someone decides what is ON the list and everyone
 * else picks from it. With one login you cannot see that rule, because the
 * person demonstrating it is always allowed to do both.
 *
 * So there are two: an RCM supervisor, who owns the amounts, and a team lead,
 * who configures teams and picks from them. Everything else stays permitted
 * for both, because nothing else in this module is actually role-gated and
 * pretending otherwise would make the demo about permissions.
 *
 * The choice lives in localStorage so a reload keeps it, and the switcher is
 * in the app header.
 */
import { useEffect, useState } from "react";

export const Permission = {
  ManageProgramTeams: "manage_program_teams",
  ViewProgramTeams: "view_program_teams",
  ViewRcmTeam: "view_rcm_team",
  ManageRcmTeam: "manage_rcm_team",
} as const;

export interface DemoAccount {
  id: string;
  firstName: string;
  lastName: string;
  appRole: string;
  vendorUserType: string;
  vendorId: number;
  /** How the switcher names this account, e.g. "supervisor". */
  role: string;
  /** What this account is for, shown in the switcher. */
  blurb: string;
}

export const ACCOUNTS: DemoAccount[] = [
  {
    id: "demo-supervisor",
    firstName: "Manager",
    lastName: "Provider",
    appRole: "Admin",
    vendorUserType: "RCM_SUPERVISOR",
    vendorId: 3,
    role: "RCM supervisor",
    blurb: "Sets the high-cost amounts every team then picks from.",
  },
  {
    id: "demo-lead",
    firstName: "Team",
    lastName: "Lead",
    appRole: "RcmUser",
    vendorUserType: "RCM_USER",
    vendorId: 3,
    role: "Team lead",
    blurb: "Configures teams and groups, and picks an amount off the list.",
  },
];

const KEY = "demo-account";

const read = (): DemoAccount => {
  try {
    const id = localStorage.getItem(KEY);
    return ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
  } catch {
    // Private windows and blocked site data both throw here. Falling back to
    // the supervisor keeps the demo in the state it opens in.
    return ACCOUNTS[0];
  }
};

/**
 * One event, so every `useAuth` on the page re-renders when the account
 * changes. `storage` only fires in OTHER tabs, which is exactly the tab this
 * does not need to tell.
 */
const CHANGED = "demo-account-changed";

export function setAccount(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not fatal: the switch still applies for this page's lifetime.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function useAccount(): DemoAccount {
  const [account, setLocal] = useState<DemoAccount>(read);
  useEffect(() => {
    const sync = () => setLocal(read());
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return account;
}

/**
 * Still always true. Nothing in this module is permission-gated, and making
 * the team lead unable to edit teams would turn the demo into a tour of an
 * access-control matrix rather than of allocation.
 */
export const usePermission = (_p?: unknown) => true;

export const useAuth = () => ({ user: useAccount() });

/** Whether the signed-in account owns tenant-wide settings. */
export const useIsRcmSupervisor = (): boolean =>
  isRcmSupervisor(useAccount().vendorUserType);

export const isRcmSupervisor = (t?: unknown): boolean =>
  String(t ?? "").toUpperCase().replace(/[^A-Z]/g, "") === "RCMSUPERVISOR";
