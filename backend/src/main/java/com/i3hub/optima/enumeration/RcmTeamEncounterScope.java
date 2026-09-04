package com.i3hub.optima.enumeration;

/**
 * Encounter scope for a team or one of its groups.
 *
 * A facility may either run one team covering BOTH, or two teams split OP / IP.
 * A group's scope must be compatible with its team's: a team scoped OP cannot
 * hold an IP group.
 */
public enum RcmTeamEncounterScope {
	OP,
	IP,
	BOTH;

	/**
	 * True when this scope fully contains {@code other} — i.e. a team with this
	 * scope may hold a group scoped {@code other}. BOTH contains everything;
	 * OP and IP contain only themselves.
	 */
	public boolean covers(RcmTeamEncounterScope other) {
		if (other == null) {
			return false;
		}
		return this == BOTH || this == other;
	}
}
