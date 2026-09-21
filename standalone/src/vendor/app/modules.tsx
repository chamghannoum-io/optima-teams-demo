/**
 * Stands in for the @optima/module-* workspace packages.
 *
 * The ported rcm-dashboard is byte-identical to upstream, so it imports a
 * handful of things that live in sibling feature modules rather than in the
 * dashboard itself. Those modules are whole features (claim detail, prior
 * authorisation, query management) and are not in scope for a Teams and
 * allocation demo.
 *
 * What is shimmed here is only ever a leaf: a detail drawer opened by clicking
 * a row, or a KPI query that feeds one card. Every dashboard panel that
 * matters for allocation is the real upstream component reading real local
 * data. A shim says so on screen rather than rendering something plausible,
 * because a demo that silently invents a claim detail is worse than one that
 * admits the drawer is out of scope.
 */
import { gql, useQuery } from "@apollo/client";
import { Sheet, SheetContent, EmptyState } from "@optima/ui";
import { PanelRightClose } from "lucide-react";

interface DrawerProps {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  [key: string]: unknown;
}

/** One drawer body for both, since they differ only in what they would show. */
function OutOfScopeDrawer({ what, ...props }: DrawerProps & { what: string }) {
  const open = props.open ?? props.isOpen ?? false;
  const close = () => {
    props.onClose?.();
    props.onOpenChange?.(false);
  };
  return (
    <Sheet open={open} onOpenChange={(v: boolean) => !v && close()}>
      <SheetContent className="w-[480px] max-w-full">
        <EmptyState
          icon={<PanelRightClose size={28} className="text-slate-400" />}
          title={`${what} is not part of this module`}
          description={
            `The Teams module was extracted on its own, so ${what.toLowerCase()} ` +
            "lives in a feature that was not brought across. Everything on the " +
            "dashboard behind this drawer is real."
          }
          className="py-16"
        />
      </SheetContent>
    </Sheet>
  );
}

export const ClaimDetailsDrawer = (props: DrawerProps) => (
  <OutOfScopeDrawer what="Claim detail" {...props} />
);

export const SubmissionAuthDrawer = (props: DrawerProps) => (
  <OutOfScopeDrawer what="Authorisation detail" {...props} />
);

/**
 * Prior-authorisation approval stats, one KPI card on the dashboard header.
 * Upstream this lives in module-authorization; here it reads the same
 * allocation model everything else does.
 */
const PRIOR_AUTH_STATS = gql`
  query GetPriorAuthStats {
    optimaLatestAllocationRun {
      totals {
        ranked
        assigned
        unmatched
      }
    }
  }
`;

/**
 * Approval rate. Upstream this counts authorisation decisions from the payer,
 * which standalone has no data for: nothing here talks to a payer. The local
 * stand-in is the allocation outcome, so the card reads "how much of the queue
 * found a home" rather than "how much the payer approved". Same shape, and the
 * number moves with the configuration, which is the point of the demo.
 */
export const useGetPriorAuthStatsQuery = (opts?: any) => {
  const r = useQuery(PRIOR_AUTH_STATS, opts);
  const t = r.data?.optimaLatestAllocationRun?.totals;
  return {
    ...r,
    data: t
      ? {
          approved: { totalCount: t.assigned },
          rejected: { totalCount: t.unmatched },
          partially: { totalCount: 0 },
        }
      : undefined,
  };
};
