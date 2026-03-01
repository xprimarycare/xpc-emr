export interface AppSocialHistoryObservation {
  id: string;
  fhirId: string;
  name: string;
  status:
    | "registered"
    | "preliminary"
    | "final"
    | "amended"
    | "corrected"
    | "cancelled"
    | "entered-in-error"
    | "unknown";
  value: string;
  effectiveDate: string;
  note?: string;
  coding?: {
    system: string;
    code: string;
    display: string;
  };
  valueCoding?: {
    system: string;
    code: string;
    display: string;
  };
}
