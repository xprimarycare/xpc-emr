// Simplified FHIR Patient types for search results
export interface FhirHumanName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

export interface FhirIdentifier {
  system?: string;
  value?: string;
  type?: {
    coding?: Array<{ code?: string; display?: string }>;
  };
}

export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  identifier?: FhirIdentifier[];
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: string;
}

export interface FhirBundle<T> {
  resourceType: "Bundle";
  type: string;
  total?: number;
  entry?: Array<{
    resource: T;
  }>;
}

export type FhirPatientBundle = FhirBundle<FhirPatient>;

// MedicationRequest types

export interface FhirCodeableConcept {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirDosageInstruction {
  text?: string;
  timing?: {
    code?: FhirCodeableConcept;
  };
  route?: FhirCodeableConcept;
  doseAndRate?: Array<{
    doseQuantity?: {
      value?: number;
      unit?: string;
    };
  }>;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "cancelled" | "completed" | "stopped" | "draft" | "on-hold" | "entered-in-error" | "unknown";
  intent: "proposal" | "plan" | "order" | "original-order" | "reflex-order" | "filler-order" | "instance-order" | "option";
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  requester?: FhirReference;
  dosageInstruction?: FhirDosageInstruction[];
  authoredOn?: string;
  note?: Array<{ text?: string }>;
}

export type FhirMedicationRequestBundle = FhirBundle<FhirMedicationRequest>;

// AllergyIntolerance types

export interface FhirAllergyIntoleranceReaction {
  substance?: FhirCodeableConcept;
  manifestation?: FhirCodeableConcept[];
  severity?: "mild" | "moderate" | "severe";
  description?: string;
}

export interface FhirAllergyIntolerance {
  resourceType: "AllergyIntolerance";
  id: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  type?: "allergy" | "intolerance";
  category?: ("food" | "medication" | "environment" | "biologic")[];
  criticality?: "low" | "high" | "unable-to-assess";
  code?: FhirCodeableConcept;
  patient?: FhirReference;
  recordedDate?: string;
  reaction?: FhirAllergyIntoleranceReaction[];
  note?: Array<{ text?: string }>;
}

export type FhirAllergyIntoleranceBundle = FhirBundle<FhirAllergyIntolerance>;

// Condition types (Medical History)

export interface FhirCondition {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  severity?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  bodySite?: FhirCodeableConcept[];
  subject?: FhirReference;
  onsetDateTime?: string;
  onsetString?: string;
  abatementDateTime?: string;
  abatementString?: string;
  recordedDate?: string;
  note?: Array<{ text?: string }>;
}

export type FhirConditionBundle = FhirBundle<FhirCondition>;

// Procedure types (Surgical History)

export interface FhirProcedure {
  resourceType: "Procedure";
  id: string;
  status?: string;
  category?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  performedDateTime?: string;
  performedString?: string;
  bodySite?: FhirCodeableConcept[];
  outcome?: FhirCodeableConcept;
  complication?: FhirCodeableConcept[];
  reasonCode?: FhirCodeableConcept[];
  note?: Array<{ text?: string }>;
}

export type FhirProcedureBundle = FhirBundle<FhirProcedure>;

// FamilyMemberHistory types (Family History)

export interface FhirFamilyMemberHistoryCondition {
  code?: FhirCodeableConcept;
  outcome?: FhirCodeableConcept;
  contributedToDeath?: boolean;
  onsetAge?: { value?: number; unit?: string; system?: string; code?: string };
  onsetString?: string;
  note?: Array<{ text?: string }>;
}

export interface FhirFamilyMemberHistory {
  resourceType: "FamilyMemberHistory";
  id: string;
  status?: string;
  patient?: FhirReference;
  name?: string;
  relationship?: FhirCodeableConcept;
  sex?: FhirCodeableConcept;
  deceasedBoolean?: boolean;
  deceasedAge?: { value?: number; unit?: string; system?: string; code?: string };
  deceasedString?: string;
  condition?: FhirFamilyMemberHistoryCondition[];
  note?: Array<{ text?: string }>;
  date?: string;
}

export type FhirFamilyMemberHistoryBundle = FhirBundle<FhirFamilyMemberHistory>;

// Encounter types

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirEncounter {
  resourceType: "Encounter";
  id?: string;
  status: "planned" | "arrived" | "triaged" | "in-progress" | "onleave" | "finished" | "cancelled" | "entered-in-error" | "unknown";
  class: FhirCoding;
  type?: FhirCodeableConcept[];
  subject?: FhirReference;
  participant?: Array<{
    individual?: FhirReference;
  }>;
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  serviceProvider?: FhirReference;
}

export type FhirEncounterBundle = FhirBundle<FhirEncounter>;

// ClinicalImpression types

export interface FhirClinicalImpression {
  resourceType: "ClinicalImpression";
  id?: string;
  status: "in-progress" | "completed" | "entered-in-error";
  subject: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  assessor?: FhirReference;
  description?: string;
  summary?: string;
  note?: Array<{ text?: string }>;
}

export type FhirClinicalImpressionBundle = FhirBundle<FhirClinicalImpression>;

// ServiceRequest types (lab orders, referrals)

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status: string;
  intent: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject: FhirReference;
  priority?: string;
  authoredOn?: string;
  requester?: FhirReference;
  performer?: FhirReference[];
  reasonCode?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
}

export type FhirServiceRequestBundle = FhirBundle<FhirServiceRequest>;

// Task types

export interface FhirTask {
  resourceType: "Task";
  id?: string;
  status:
    | "draft"
    | "requested"
    | "received"
    | "accepted"
    | "rejected"
    | "ready"
    | "cancelled"
    | "in-progress"
    | "on-hold"
    | "failed"
    | "completed"
    | "entered-in-error";
  intent:
    | "unknown"
    | "proposal"
    | "plan"
    | "order"
    | "original-order"
    | "reflex-order"
    | "filler-order"
    | "instance-order"
    | "option";
  priority?: "routine" | "urgent" | "asap" | "stat";
  description?: string;
  for?: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  lastModified?: string;
  note?: Array<{ text?: string }>;
  restriction?: {
    period?: FhirPeriod;
  };
}

export type FhirTaskBundle = FhirBundle<FhirTask>;

// Appointment types

export interface FhirAppointment {
  resourceType: "Appointment";
  id?: string;
  status:
    | "proposed"
    | "pending"
    | "booked"
    | "arrived"
    | "fulfilled"
    | "cancelled"
    | "noshow"
    | "entered-in-error"
    | "checked-in"
    | "waitlist";
  description?: string;
  start?: string;
  end?: string;
  minutesDuration?: number;
  appointmentType?: FhirCodeableConcept;
  serviceType?: FhirCodeableConcept[];
  participant: Array<{
    actor?: FhirReference;
    required?: "required" | "optional" | "information-only";
    status: "accepted" | "declined" | "tentative" | "needs-action";
    type?: FhirCodeableConcept[];
  }>;
}

export type FhirAppointmentBundle = FhirBundle<FhirAppointment>;

// Observation types (Vitals)

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FhirObservationComponent {
  code: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
}

export interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  component?: FhirObservationComponent[];
  note?: Array<{ text?: string }>;
}

export type FhirObservationBundle = FhirBundle<FhirObservation>;

// Social History Observation types

export interface FhirSocialHistoryObservation {
  resourceType: "Observation";
  id?: string;
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled" | "entered-in-error" | "unknown";
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueBoolean?: boolean;
  note?: Array<{ text?: string }>;
}

export type FhirSocialHistoryObservationBundle = FhirBundle<FhirSocialHistoryObservation>;

// Communication types (Messaging)

export interface FhirCommunicationPayload {
  contentString?: string;
  contentAttachment?: {
    url?: string;
    title?: string;
    contentType?: string;
  };
  contentReference?: FhirReference;
}

export interface FhirCommunication {
  resourceType: "Communication";
  id?: string;
  status: "preparation" | "in-progress" | "not-done" | "on-hold" | "stopped" | "completed" | "entered-in-error" | "unknown";
  category?: FhirCodeableConcept[];
  medium?: FhirCodeableConcept[];
  subject?: FhirReference;
  topic?: FhirCodeableConcept;
  encounter?: FhirReference;
  sent?: string;
  received?: string;
  recipient?: FhirReference[];
  sender?: FhirReference;
  payload?: FhirCommunicationPayload[];
  partOf?: FhirReference[];
  inResponseTo?: FhirReference[];
}

export type FhirCommunicationBundle = FhirBundle<FhirCommunication>;

// CareTeam types

export interface FhirCareTeamParticipant {
  role?: FhirCodeableConcept[];
  member?: FhirReference;
  onBehalfOf?: FhirReference;
  period?: { start?: string; end?: string };
}

export interface FhirCareTeam {
  resourceType: 'CareTeam';
  id: string;
  status?: 'proposed' | 'active' | 'suspended' | 'inactive' | 'entered-in-error';
  category?: FhirCodeableConcept[];
  name?: string;
  subject?: FhirReference;
  participant?: FhirCareTeamParticipant[];
  note?: Array<{ text?: string }>;
}

export type FhirCareTeamBundle = FhirBundle<FhirCareTeam>;

// Goal types (Goals of Care)

export interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus: "proposed" | "planned" | "accepted" | "active" | "on-hold" | "completed" | "cancelled" | "entered-in-error" | "rejected";
  category?: FhirCodeableConcept[];
  description: FhirCodeableConcept;
  subject: FhirReference;
  startDate?: string;
  expressedBy?: FhirReference;
  note?: Array<{ text?: string }>;
}

export type FhirGoalBundle = FhirBundle<FhirGoal>;
