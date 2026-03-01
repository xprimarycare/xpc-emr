export interface AppVital {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR Observation ID for write-back */
  fhirId?: string;
  /** Vital sign type (e.g., "Blood Pressure", "Heart Rate") */
  name: string;
  /** LOINC code for the vital sign */
  loincCode: string;
  /** LOINC display name */
  loincDisplay: string;
  /** Observation status */
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'cancelled';
  /** Effective date/time of the observation (ISO string) */
  effectiveDateTime: string;
  /** Patient FHIR ID */
  patientFhirId: string;
  /** Optional linked encounter FHIR ID */
  encounterFhirId?: string;
  /** Primary value (e.g., heart rate, temperature, weight) */
  value?: number;
  /** Unit for the primary value */
  unit?: string;
  /** Systolic blood pressure (only for BP observations) */
  systolic?: number;
  /** Diastolic blood pressure (only for BP observations) */
  diastolic?: number;
  /** Any notes */
  note?: string;
}
