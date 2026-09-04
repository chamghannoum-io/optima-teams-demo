package com.i3hub.optima.enumeration;

/**
 * Claim worklist division a team belongs to.
 *
 * A team handles exactly one division — AUTH and CLAIM work must never be mixed
 * on the same team. Enforced in RcmTeamServiceImpl when validating groups.
 */
public enum RcmTeamDivision {
	AUTH,
	CLAIM
}
