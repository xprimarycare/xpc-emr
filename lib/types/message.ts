export interface AppMessage {
  /** App-level ID for React keys */
  id: string;
  /** FHIR Communication resource ID */
  fhirId: string;
  /** Thread header FHIR ID this message belongs to */
  threadId: string;
  /** 'patient' or 'provider' */
  senderType: 'patient' | 'provider';
  /** FHIR reference string (e.g., "Patient/abc123") */
  senderRef: string;
  /** Message text content */
  text: string;
  /** When the message was sent */
  sentAt: string;
  /** When the message was received (read receipt) */
  receivedAt?: string;
  /** FHIR status */
  status: 'preparation' | 'in-progress' | 'completed' | 'entered-in-error';
}

export interface AppThread {
  /** FHIR Communication ID of the thread header */
  id: string;
  /** Thread topic/subject */
  topic: string;
  /** Patient FHIR ID */
  patientRef: string;
  /** Messages in this thread, sorted by sentAt ascending */
  messages: AppMessage[];
}
