/**
 * The amounts a high-cost group may be set to, tenant-wide.
 *
 * This is the supervisor's half of the high-cost switch and the reason the
 * amount is a dropdown rather than a box you type into. A threshold is a
 * decision about money that one person owns; letting every team lead type
 * their own means the estate ends up with 3,000 here and 30,000 there and no
 * way to tell which was deliberate. Worse, 500 typed where 5,000 was meant
 * reroutes a day's expensive claims and nothing says so.
 *
 * So: the supervisor edits this list, and everyone else picks off it. A team
 * lead sees the same dialog read-only, which is how they find out the number
 * is somebody's decision rather than a blank.
 *
 * Removing an amount does not disturb a group already set to it. The group's
 * rule holds the number; this list only governs what can be chosen next.
 */
import { useEffect, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { Plus, X } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@optima/ui";

const SET_OPTIONS = gql`
  mutation SetDimensionAmounts($dimension: String!, $numericOptions: [Float!]!) {
    allocationDimensionOptionsSet(dimension: $dimension, numericOptions: $numericOptions) {
      code
      numericOptions
    }
  }
`;

export interface HighCostAmountsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Registry dimension the amounts belong to. ITEM_VALUE, in practice. */
  dimension: string;
  unit?: string | null;
  amounts: number[];
  /** Only a supervisor may edit. Everyone else gets the same list, read-only. */
  canEdit: boolean;
  /** Amounts currently in use by some group, so removing one can warn. */
  inUse?: number[];
  onSaved: (amounts: number[]) => void;
}

export function HighCostAmountsDialog({
  open,
  onClose,
  dimension,
  unit,
  amounts,
  canEdit,
  inUse = [],
  onSaved,
}: HighCostAmountsDialogProps) {
  const [draft, setDraft] = useState<number[]>(amounts);
  const [entry, setEntry] = useState("");
  const [save, { loading }] = useMutation(SET_OPTIONS);

  // Reopening after someone else changed the list must show the new list, not
  // the one captured the first time this mounted.
  useEffect(() => {
    if (open) {
      setDraft(amounts);
      setEntry("");
    }
  }, [open, amounts]);

  const add = () => {
    const n = Number(entry.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0 || draft.includes(n)) return;
    setDraft([...draft, n].sort((a, b) => a - b));
    setEntry("");
  };

  const commit = async () => {
    const { data } = await save({ variables: { dimension, numericOptions: draft } });
    onSaved(data?.allocationDimensionOptionsSet?.numericOptions ?? draft);
    onClose();
  };

  const dropped = inUse.filter((n) => !draft.includes(n));

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      {/*
        * Wider than the default, and laid out like the other dialogs in this
        * feature: body sections carry their own `px-6`, because DialogContent
        * is `p-0` and the header and footer bring their own padding.
        *
        * `max-w-xl` rather than the `max-w-md` this started at, so the amounts
        * sit four to a row. At `md` they wrapped after three and the add row
        * was squeezed into half the width, which made a seven-item list read
        * as a problem rather than a list.
        */}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>High-cost amounts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {canEdit
              ? "Every high-cost group in the estate picks its threshold from this list. Changing it changes what can be chosen next; groups already set to an amount keep it."
              : "These are set by an RCM supervisor. Groups pick a threshold from this list rather than typing one, so the figure is a decision somebody owns."}
          </p>

          <div className="flex flex-wrap gap-2">
            {draft.map((n) => (
              <span
                key={n}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1.5 pl-3.5 pr-2.5 text-xs text-slate-700 dark:bg-dark-bg dark:text-slate-300"
              >
                <span className="whitespace-nowrap font-medium">
                  {n.toLocaleString()}
                  {unit ? ` ${unit}` : ""}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${n}`}
                    onClick={() => setDraft(draft.filter((x) => x !== n))}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {!draft.length && (
              <span className="text-xs italic text-slate-400">
                No amounts. No group can be made high cost until one is added.
              </span>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={entry}
                onChange={(e: any) => setEntry(e.target.value)}
                onKeyDown={(e: any) => e.key === "Enter" && (e.preventDefault(), add())}
                placeholder={`Add an amount${unit ? ` in ${unit}` : ""}`}
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                onClick={add}
                disabled={!entry.trim()}
                className="shrink-0"
              >
                <Plus size={13} /> Add
              </Button>
            </div>
          )}

          {canEdit && dropped.length > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                {dropped.map((n) => n.toLocaleString()).join(", ")}
                {dropped.length === 1 ? " is" : " are"} in use by a group. Removing{" "}
                {dropped.length === 1 ? "it" : "them"} leaves those groups filtering at the
                same amount; it only stops anyone choosing{" "}
                {dropped.length === 1 ? "it" : "them"} again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button onClick={commit} disabled={loading}>
              {loading ? "Saving…" : "Save amounts"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
