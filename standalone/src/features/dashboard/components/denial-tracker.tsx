import { OutOfScopePanel } from "./_out-of-scope.js";

/** Upstream: features/dashboard/components/denial-tracker.tsx. Out of scope, see _out-of-scope.tsx. */
export function DenialTracker() {
  return (
    <OutOfScopePanel
      title="Your denials"
      note="My Day is the signed-in user's own queue. The Teams module was extracted on its own, so this panel's feature did not come with it. My Team, the supervisor view, is the real upstream dashboard."
    />
  );
}
export default DenialTracker;
