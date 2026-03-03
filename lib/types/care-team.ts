export interface AppCareTeamMember {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId: string;
  /** Provider name from participant.member.display */
  name: string;
  /** Role/specialty display text (e.g., "Cardiologist") */
  role: string;
  /** CareTeam status */
  status: 'proposed' | 'active' | 'suspended' | 'inactive' | 'entered-in-error';
  /** Free-text note */
  note?: string;
  /** Database User ID when this care team member is a system user (e.g. PCP) */
  pcpUserId?: string;
  /** SNOMED CT code for the role/specialty */
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}
