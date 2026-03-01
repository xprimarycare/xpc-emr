export interface AppFamilyCondition {
  name: string;
  outcome?: string;
  onsetAge?: string;
  contributedToDeath?: boolean;
  note?: string;
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}

export interface AppFamilyMemberHistory {
  id: string;
  fhirId: string;
  name: string;
  relationship: string;
  relationshipDisplay: string;
  status: "partial" | "completed" | "entered-in-error" | "health-unknown";
  deceased?: boolean;
  deceasedAge?: string;
  conditions: AppFamilyCondition[];
  note?: string;
}
