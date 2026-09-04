import type { RotationFrequency } from "./types.js";

/** Rotation cadences selectable in the Team Info step, in display order. */
export const ROTATION_FREQUENCIES: readonly RotationFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

/** Default cadence pre-selected when rotation is first enabled. */
export const DEFAULT_ROTATION_FREQUENCY: RotationFrequency = "WEEKLY";

/** Minimum members in scope for rotation to be performable. */
export const MIN_ROTATION_MEMBERS = 2;