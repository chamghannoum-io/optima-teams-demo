package com.i3hub.optima.enumeration;

/**
 * The axis a team's groups split work on.
 *
 * Declared once on the team and inherited by every group: a team splits by
 * DEPARTMENT or by PAYER, never both. When the axis is DEPARTMENT, payers are
 * implicitly "all" and no payer values are stored on the groups (and vice versa).
 */
public enum RcmTeamLogicAxis {
	DEPARTMENT,
	PAYER
}
