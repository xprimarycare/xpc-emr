export interface AppProcedure {
  id: string;
  fhirId: string;
  name: string;
  status:
    | "preparation"
    | "in-progress"
    | "not-done"
    | "on-hold"
    | "stopped"
    | "completed"
    | "entered-in-error"
    | "unknown";
  performedDate: string;
  bodySite: string;
  outcome: string;
  note?: string;
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}
