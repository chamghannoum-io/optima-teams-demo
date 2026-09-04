import { useState } from "react";

import { DEFAULT_ROTATION_FREQUENCY } from "../constants.js";
import type { RotationFrequency } from "../types.js";
import { TeamRotationSettings } from "./team-rotation-settings.js";

export default {
  title: "MasterData/TeamRotationSettings",
  component: TeamRotationSettings,
};

/** Interactive panel with enough members to enable rotation. */
export function Default() {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<RotationFrequency>(DEFAULT_ROTATION_FREQUENCY);
  return (
    <TeamRotationSettings
      enabled={enabled}
      frequency={frequency}
      memberCount={3}
      onEnabledChange={setEnabled}
      onFrequencyChange={setFrequency}
    />
  );
}

/** Server-computed next rotation date takes precedence over the client-side estimate. */
export function WithServerNextRotationDate() {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<RotationFrequency>(DEFAULT_ROTATION_FREQUENCY);
  const nextRotationDate = new Date();
  nextRotationDate.setDate(nextRotationDate.getDate() + 3);
  return (
    <TeamRotationSettings
      enabled={enabled}
      frequency={frequency}
      memberCount={3}
      nextRotationDate={nextRotationDate}
      onEnabledChange={setEnabled}
      onFrequencyChange={setFrequency}
    />
  );
}

/** Fewer than two members in scope: toggle is disabled with an explanatory message. */
export function NotEnoughMembers() {
  return (
    <TeamRotationSettings
      enabled={false}
      frequency={DEFAULT_ROTATION_FREQUENCY}
      memberCount={1}
      onEnabledChange={() => undefined}
      onFrequencyChange={() => undefined}
    />
  );
}
