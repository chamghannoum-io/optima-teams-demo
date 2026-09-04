import { MemberUnavailabilityList } from "./member-unavailability-list.js";

export default {
  title: "MasterData/MemberUnavailabilityList",
  component: MemberUnavailabilityList,
};

const today = new Date();
const inAWeek = new Date();
inAWeek.setDate(inAWeek.getDate() + 7);
const nextMonthStart = new Date();
nextMonthStart.setDate(nextMonthStart.getDate() + 30);
const nextMonthEnd = new Date();
nextMonthEnd.setDate(nextMonthEnd.getDate() + 37);

/** Two scheduled windows, each cancellable. */
export function Default() {
  return (
    <MemberUnavailabilityList
      unavailabilities={[
        { id: "w1", startDate: today, endDate: inAWeek, reason: "Annual leave" },
        { id: "w2", startDate: nextMonthStart, endDate: nextMonthEnd },
      ]}
      onCancel={() => undefined}
    />
  );
}

/** Read-only: no cancel action provided. */
export function ReadOnly() {
  return (
    <MemberUnavailabilityList
      unavailabilities={[{ id: "w1", startDate: today, endDate: inAWeek, reason: "Training" }]}
    />
  );
}
