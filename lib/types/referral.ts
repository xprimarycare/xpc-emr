export interface AppReferral {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId?: string;
  /** Type of referral (e.g., "Cardiology consultation") */
  referralType: string;
  /** Order status */
  status: 'draft' | 'active' | 'completed' | 'revoked';
  /** Order priority */
  priority: 'routine' | 'urgent' | 'asap' | 'stat';
  /** Who the patient is being referred to */
  referredTo?: string;
  /** Reason for referral */
  reason?: string;
  /** When the referral was created (ISO date) */
  authoredOn?: string;
  /** Patient FHIR ID */
  patientFhirId: string;
  /** Any notes */
  note?: string;
}
