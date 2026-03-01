export interface AppGoal {
  id: string;
  fhirId: string;
  name: string;
  lifecycleStatus:
    | "proposed"
    | "planned"
    | "accepted"
    | "active"
    | "on-hold"
    | "completed"
    | "cancelled"
    | "entered-in-error"
    | "rejected";
  expressedBy?: string;
  note?: string;
  startDate?: string;
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}
