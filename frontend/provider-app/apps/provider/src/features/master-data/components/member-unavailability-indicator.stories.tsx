import { MemberUnavailabilityIndicator } from "./member-unavailability-indicator.js";

export default {
  title: "MasterData/MemberUnavailabilityIndicator",
  component: MemberUnavailabilityIndicator,
};

const today = new Date();
const inAWeek = new Date();
inAWeek.setDate(inAWeek.getDate() + 7);
const nextMonthStart = new Date();
nextMonthStart.setDate(nextMonthStart.getDate() + 30);
const nextMonthEnd = new Date();
nextMonthEnd.setDate(nextMonthEnd.getDate() + 37);

/** Member is unavailable today: amber badge with the window's end date. */
export function UnavailableToday() {
  return (
    <MemberUnavailabilityIndicator
      unavailability={{ id: "w1", startDate: today, endDate: inAWeek, reason: "Annual leave" }}
      unavailableToday
    />
  );
}

/** Upcoming window: neutral badge with the full period. */
export function UpcomingWindow() {
  return (
    <MemberUnavailabilityIndicator
      unavailability={{ id: "w2", startDate: nextMonthStart, endDate: nextMonthEnd }}
      unavailableToday={false}
    />
  );
}
