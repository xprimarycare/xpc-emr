export interface AppTask {
  /** App-level ID for React keys/state management */
  id: string;
  /** FHIR Task resource ID for write-back */
  fhirId?: string;
  /** Task status (4 supported values) */
  status: "requested" | "in-progress" | "completed" | "cancelled";
  /** Task intent - always 'order' for clinician-created tasks */
  intent: "order";
  /** Task priority */
  priority: "routine" | "urgent" | "asap" | "stat";
  /** Human-readable task description (plain text) */
  description: string;
  /** Due date (ISO date string, maps to FHIR restriction.period.end) */
  dueDate?: string;
  /** When the task was created (ISO datetime) */
  authoredOn: string;
  /** Patient FHIR ID this task belongs to */
  patientFhirId: string;
  /** Optional encounter FHIR ID if task was created during a visit */
  encounterFhirId?: string;
}

export const TASK_STATUS_OPTIONS: Array<{
  code: AppTask["status"];
  display: string;
}> = [
  { code: "requested", display: "Requested" },
  { code: "in-progress", display: "In Progress" },
  { code: "completed", display: "Completed" },
  { code: "cancelled", display: "Cancelled" },
];
