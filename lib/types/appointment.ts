export interface AppAppointment {
  /** App-level ID for React keys/state management */
  id: string;
  /** FHIR Appointment resource ID for write-back */
  fhirId?: string;
  /** Appointment status */
  status: "proposed" | "booked" | "arrived" | "fulfilled" | "cancelled" | "noshow";
  /** Human-readable description */
  description: string;
  /** Start time (ISO datetime string) */
  start: string;
  /** End time (ISO datetime string) */
  end: string;
  /** Appointment type for display styling */
  appointmentType: "patient-visit" | "telehealth" | "meeting";
  /** Patient FHIR ID (optional — meetings don't have a patient) */
  patientFhirId?: string;
  /** Patient display name */
  patientName?: string;
}
