/**
 * Single source of truth for cloneable resource types.
 *
 * Order matches the sidebar page order in default-tabs.ts.
 * "Patient Info" is excluded because patient demographics are always
 * cloned as part of duplication.
 *
 * When adding a new page to default-tabs.ts, add a corresponding
 * entry here so it automatically appears in the Duplicate Patient dialog
 * and is handled by the clone service.
 */

export interface CloneableResourceType {
  /** Unique key used by the clone service and API */
  key: string;
  /** Display label shown in the Duplicate Patient dialog */
  label: string;
  /**
   * FHIR clone config. Omit for special-cased types (e.g. "encounters")
   * that require custom clone logic in fhir-clone-service.ts.
   */
  fhir?: {
    resourceType: string;
    searchParam: string;
    extraParams?: Record<string, string>;
  };
}

export const CLONEABLE_RESOURCE_TYPES: CloneableResourceType[] = [
  // --- Pages (matches default-tabs.ts sidebar order) ---
  {
    key: "goalsOfCare",
    label: "Goals of Care",
    fhir: { resourceType: "Goal", searchParam: "patient" },
  },
  {
    key: "careTeam",
    label: "Care Team",
    fhir: { resourceType: "CareTeam", searchParam: "subject" },
  },
  {
    key: "medications",
    label: "Medications",
    fhir: { resourceType: "MedicationRequest", searchParam: "subject" },
  },
  {
    key: "allergies",
    label: "Allergies",
    fhir: { resourceType: "AllergyIntolerance", searchParam: "patient" },
  },
  {
    key: "vitals",
    label: "Vitals",
    fhir: {
      resourceType: "Observation",
      searchParam: "subject",
      extraParams: { category: "vital-signs" },
    },
  },
  {
    key: "labs",
    label: "Labs",
    fhir: {
      resourceType: "ServiceRequest",
      searchParam: "subject",
      extraParams: { category: "108252007" },
    },
  },
  {
    key: "imaging",
    label: "Imaging",
    fhir: {
      resourceType: "ServiceRequest",
      searchParam: "subject",
      extraParams: { category: "363679005" },
    },
  },
  {
    key: "referrals",
    label: "Referrals",
    fhir: {
      resourceType: "ServiceRequest",
      searchParam: "subject",
      extraParams: { category: "3457005" },
    },
  },
  {
    key: "conditions",
    label: "Conditions",
    fhir: { resourceType: "Condition", searchParam: "subject" },
  },
  {
    key: "surgicalHistory",
    label: "Surgical History",
    fhir: { resourceType: "Procedure", searchParam: "patient" },
  },
  {
    key: "familyHistory",
    label: "Family History",
    fhir: { resourceType: "FamilyMemberHistory", searchParam: "patient" },
  },
  {
    key: "socialHistory",
    label: "Social History",
    fhir: {
      resourceType: "Observation",
      searchParam: "subject",
      extraParams: { category: "social-history" },
    },
  },

  // --- Encounters & Tasks (separate sidebar sections) ---
  {
    key: "encounters",
    label: "Encounters",
    // Special-cased in clonePatient() — clones Encounter + ClinicalImpressions
  },
  {
    key: "tasks",
    label: "Tasks",
    fhir: { resourceType: "Task", searchParam: "subject" },
  },
];
