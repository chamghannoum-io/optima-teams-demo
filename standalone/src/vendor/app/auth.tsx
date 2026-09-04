/**
 * Stands in for @optima/auth.
 *
 * The demo is an admin view, so every permission check passes — the real page uses
 * these to gate editing, and we want editing fully enabled.
 */
export const Permission = {
  ManageProgramTeams: "manage_program_teams",
  ViewProgramTeams: "view_program_teams",
  ViewRcmTeam: "view_rcm_team",
  ManageRcmTeam: "manage_rcm_team",
} as const;

/** Admin demo: always permitted. */
export const usePermission = (_p?: unknown) => true;

export const useAuth = () => ({
  user: {
    id: "demo-admin",
    vendorId: 3,
    appRole: "Admin",
    vendorUserType: "RCM_SUPERVISOR",
    firstName: "Manager",
    lastName: "Provider",
  },
});

export const isRcmSupervisor = (_t?: unknown) => true;
