import { useState } from "react";

import { Button } from "@optima/ui";

import { MemberUnavailabilityDialog } from "./member-unavailability-dialog.js";

export default {
  title: "MasterData/MemberUnavailabilityDialog",
  component: MemberUnavailabilityDialog,
};

/** Full flow: pick a range on the calendar, then choose unassign vs redistribute. */
export function Default() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Manage Unavailability</Button>
      <MemberUnavailabilityDialog
        open={open}
        memberName="Sara Ahmed"
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

/** Member with scheduled windows: shown as a cancellable list; overlapping dates block Continue. */
export function WithExistingWindows() {
  const [open, setOpen] = useState(true);
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const nextStart = new Date();
  nextStart.setDate(nextStart.getDate() + 20);
  const nextEnd = new Date();
  nextEnd.setDate(nextEnd.getDate() + 24);
  return (
    <MemberUnavailabilityDialog
      open={open}
      memberName="Sara Ahmed"
      existing={[
        { id: "window-1", startDate, endDate, reason: "Annual leave" },
        { id: "window-2", startDate: nextStart, endDate: nextEnd },
      ]}
      onClose={() => setOpen(false)}
      onConfirm={() => setOpen(false)}
      onCancelWindow={() => undefined}
    />
  );
}
