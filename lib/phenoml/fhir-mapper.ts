import { FhirPatient, FhirPatientBundle, FhirMedicationRequest, FhirMedicationRequestBundle, FhirAllergyIntolerance, FhirAllergyIntoleranceBundle, FhirCodeableConcept, FhirCondition, FhirConditionBundle, FhirProcedure, FhirProcedureBundle, FhirFamilyMemberHistory, FhirFamilyMemberHistoryBundle, FhirEncounter, FhirEncounterBundle, FhirClinicalImpression, FhirClinicalImpressionBundle, FhirServiceRequest, FhirServiceRequestBundle, FhirTask, FhirTaskBundle, FhirAppointment, FhirAppointmentBundle, FhirObservation, FhirObservationBundle, FhirSocialHistoryObservation, FhirSocialHistoryObservationBundle, FhirCommunication, FhirCommunicationBundle, FhirCareTeam, FhirCareTeamBundle, FhirGoal, FhirGoalBundle } from "@/lib/types/fhir";
import { Patient, PatientData } from "@/lib/types/patient";
import { AppMedication } from "@/lib/types/medication";
import { AppAllergy } from "@/lib/types/allergy";
import { AppEncounter } from "@/lib/types/encounter";
import { AppLabOrder } from "@/lib/types/lab";
import { AppImagingOrder } from "@/lib/types/imaging";
import { AppCondition } from "@/lib/types/condition";
import { AppProcedure } from "@/lib/types/procedure";
import { AppFamilyMemberHistory, AppFamilyCondition } from "@/lib/types/family-history";
import { AppSocialHistoryObservation } from "@/lib/types/social-history";
import { AppTask } from "@/lib/types/task";
import { AppAppointment } from "@/lib/types/appointment";
import { AppVital } from "@/lib/types/vital";
import { AppMessage, AppThread } from "@/lib/types/message";
import { AppCareTeamMember } from "@/lib/types/care-team";
import { AppGoal } from "@/lib/types/goal";
import { AppReferral } from "@/lib/types/referral";
import { createDefaultTabs } from "@/lib/data/default-tabs";

/**
 * Extract display name from FHIR HumanName array
 */
function extractPatientName(fhirPatient: FhirPatient): string {
  const name = fhirPatient.name?.[0];
  if (!name) return "Unknown";

  // Use text if available
  if (name.text) return name.text;

  // Otherwise combine given + family
  const given = name.given?.join(" ") || "";
  const family = name.family || "";
  return `${given} ${family}`.trim() || "Unknown";
}

/**
 * Extract MRN from FHIR identifiers
 */
function extractMrn(fhirPatient: FhirPatient): string {
  // Look for MRN identifier
  const mrnIdentifier = fhirPatient.identifier?.find(
    (id) =>
      id.type?.coding?.some((c) => c.code === "MR") ||
      id.system?.toLowerCase().includes("mrn")
  );

  if (mrnIdentifier?.value) return mrnIdentifier.value;

  // Fallback to first identifier or FHIR ID
  return fhirPatient.identifier?.[0]?.value || fhirPatient.id;
}

/**
 * Map FHIR gender to app sex field
 */
function mapGender(gender?: string): string {
  if (!gender) return "Unknown";
  // FHIR uses lowercase, capitalize first letter
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

/**
 * Convert a single FHIR Patient to App PatientData
 */
export function mapFhirPatientToAppPatient(fhirPatient: FhirPatient): PatientData {
  const name = extractPatientName(fhirPatient);
  const mrn = extractMrn(fhirPatient);
  const dob = fhirPatient.birthDate || "Unknown";
  const sex = mapGender(fhirPatient.gender);

  return {
    id: `fhir-${fhirPatient.id}`,
    fhirId: fhirPatient.id,
    name,
    mrn,
    dob,
    sex,
    tabs: createDefaultTabs({ name, mrn, dob, sex }),
  };
}

/**
 * Reverse map: App sex field -> FHIR gender code
 */
function mapSexToGender(sex: string): string {
  const map: Record<string, string> = {
    Male: "male",
    Female: "female",
    Other: "other",
    Unknown: "unknown",
  };
  return map[sex] || "unknown";
}

/**
 * Convert App patient fields back to a FHIR Patient resource for upsert.
 * Caller must ensure patient.fhirId is set.
 */
export function mapAppPatientToFhirPatient(patient: Patient): FhirPatient {
  const nameParts = patient.name.trim().split(/\s+/);
  const family = nameParts.length > 1 ? nameParts.pop()! : "";
  const given = nameParts;

  return {
    resourceType: "Patient",
    id: patient.fhirId!,
    name: [
      {
        given: given.length > 0 ? given : undefined,
        family: family || undefined,
      },
    ],
    birthDate: patient.dob !== "Unknown" ? patient.dob : undefined,
    gender: mapSexToGender(patient.sex),
    identifier: patient.mrn
      ? [
          {
            type: {
              coding: [{ code: "MR", display: "Medical Record Number" }],
            },
            value: patient.mrn,
          },
        ]
      : undefined,
  };
}

/**
 * Convert a FHIR Bundle of Patients to App PatientData array
 */
export function mapFhirBundleToPatients(bundle: FhirPatientBundle): PatientData[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Patient")
    .map((entry) => mapFhirPatientToAppPatient(entry.resource));
}

// --- Medication Mappers ---

/**
 * Convert a FHIR MedicationRequest to an AppMedication
 */
export function mapFhirMedRequestToAppMedication(fhir: FhirMedicationRequest): AppMedication {
  const coding = fhir.medicationCodeableConcept?.coding?.[0];
  const dosage = fhir.dosageInstruction?.[0];
  const doseQuantity = dosage?.doseAndRate?.[0]?.doseQuantity;

  return {
    id: `med-${fhir.id}`,
    fhirId: fhir.id,
    name: fhir.medicationCodeableConcept?.text
      || coding?.display
      || "Unknown medication",
    dose: doseQuantity
      ? `${doseQuantity.value}${doseQuantity.unit || "mg"}`
      : "",
    route: dosage?.route?.text || dosage?.route?.coding?.[0]?.display || "",
    frequency: dosage?.timing?.code?.text
      || dosage?.timing?.code?.coding?.[0]?.display
      || "",
    status: fhir.status as AppMedication["status"],
    authoredOn: fhir.authoredOn,
    dosageText: dosage?.text || "",
    coding: coding ? {
      system: coding.system || "",
      code: coding.code || "",
      display: coding.display || "",
    } : undefined,
    note: fhir.note?.[0]?.text,
  };
}

/**
 * Convert an AppMedication back to a FHIR MedicationRequest for upsert.
 * Requires patientFhirId to set the subject reference.
 */
export function mapAppMedicationToFhirMedRequest(
  med: AppMedication,
  patientFhirId: string
): FhirMedicationRequest {
  const doseMatch = med.dose.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  const doseValue = doseMatch ? parseFloat(doseMatch[1]) : undefined;
  const doseUnit = doseMatch?.[2] || "mg";
  const dosageText = med.dosageText
    || `${med.dose} ${med.route} ${med.frequency}`.trim();

  return {
    resourceType: "MedicationRequest",
    id: med.fhirId,
    status: med.status,
    intent: "order",
    medicationCodeableConcept: {
      coding: med.coding ? [{
        system: med.coding.system,
        code: med.coding.code,
        display: med.coding.display,
      }] : undefined,
      text: med.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    dosageInstruction: [{
      text: dosageText,
      timing: med.frequency ? {
        code: { text: med.frequency },
      } : undefined,
      route: med.route ? { text: med.route } : undefined,
      doseAndRate: doseValue !== undefined ? [{
        doseQuantity: {
          value: doseValue,
          unit: doseUnit,
        },
      }] : undefined,
    }],
    authoredOn: med.authoredOn,
    note: med.note ? [{ text: med.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of MedicationRequests to AppMedication array
 */
export function mapFhirBundleToMedications(bundle: FhirMedicationRequestBundle): AppMedication[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "MedicationRequest")
    .map((entry) => mapFhirMedRequestToAppMedication(entry.resource));
}

// --- Allergy Mappers ---

/**
 * Extract a simple status string from a FHIR CodeableConcept status field.
 */
function extractStatusCode(concept: FhirCodeableConcept | undefined, fallback: string): string {
  return concept?.coding?.[0]?.code || concept?.text || fallback;
}

/**
 * Convert a FHIR AllergyIntolerance to an AppAllergy
 */
export function mapFhirAllergyToAppAllergy(fhir: FhirAllergyIntolerance): AppAllergy {
  const coding = fhir.code?.coding?.[0];
  const firstReaction = fhir.reaction?.[0];
  const firstManifestation = firstReaction?.manifestation?.[0];

  return {
    id: `allergy-${fhir.id}`,
    fhirId: fhir.id,
    substance: fhir.code?.text
      || coding?.display
      || "Unknown allergen",
    clinicalStatus: extractStatusCode(fhir.clinicalStatus, "active") as AppAllergy["clinicalStatus"],
    verificationStatus: extractStatusCode(fhir.verificationStatus, "unconfirmed") as AppAllergy["verificationStatus"],
    type: (fhir.type as AppAllergy["type"]) || "",
    category: (fhir.category?.[0] as AppAllergy["category"]) || "",
    criticality: (fhir.criticality as AppAllergy["criticality"]) || "",
    reaction: firstManifestation?.text
      || firstManifestation?.coding?.[0]?.display
      || firstReaction?.description
      || "",
    severity: (firstReaction?.severity as AppAllergy["severity"]) || "",
    recordedDate: fhir.recordedDate,
    coding: coding ? {
      system: coding.system || "",
      code: coding.code || "",
      display: coding.display || "",
    } : undefined,
    note: fhir.note?.[0]?.text,
  };
}

/**
 * Convert an AppAllergy back to a FHIR AllergyIntolerance for upsert.
 * Requires patientFhirId to set the patient reference.
 */
export function mapAppAllergyToFhirAllergy(
  allergy: AppAllergy,
  patientFhirId: string
): FhirAllergyIntolerance {
  return {
    resourceType: "AllergyIntolerance",
    id: allergy.fhirId,
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        code: allergy.clinicalStatus,
        display: allergy.clinicalStatus.charAt(0).toUpperCase() + allergy.clinicalStatus.slice(1),
      }],
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
        code: allergy.verificationStatus,
        display: allergy.verificationStatus.charAt(0).toUpperCase() + allergy.verificationStatus.slice(1),
      }],
    },
    type: allergy.type || undefined,
    category: allergy.category ? [allergy.category as "food" | "medication" | "environment" | "biologic"] : undefined,
    criticality: allergy.criticality || undefined,
    code: {
      coding: allergy.coding ? [{
        system: allergy.coding.system,
        code: allergy.coding.code,
        display: allergy.coding.display,
      }] : undefined,
      text: allergy.substance,
    },
    patient: {
      reference: `Patient/${patientFhirId}`,
    },
    recordedDate: allergy.recordedDate,
    reaction: allergy.reaction ? [{
      manifestation: [{
        text: allergy.reaction,
      }],
      severity: allergy.severity || undefined,
    }] : undefined,
    note: allergy.note ? [{ text: allergy.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of AllergyIntolerance resources to AppAllergy array
 */
export function mapFhirBundleToAllergies(bundle: FhirAllergyIntoleranceBundle): AppAllergy[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "AllergyIntolerance")
    .map((entry) => mapFhirAllergyToAppAllergy(entry.resource));
}

// --- Condition Mappers (Medical History) ---

/**
 * Convert a FHIR Condition to an AppCondition
 */
export function mapFhirConditionToAppCondition(fhir: FhirCondition): AppCondition {
  const coding = fhir.code?.coding?.[0];

  return {
    id: `condition-${fhir.id}`,
    fhirId: fhir.id,
    name: fhir.code?.text
      || coding?.display
      || "Unknown condition",
    clinicalStatus: extractStatusCode(fhir.clinicalStatus, "active") as AppCondition["clinicalStatus"],
    verificationStatus: extractStatusCode(fhir.verificationStatus, "unconfirmed") as AppCondition["verificationStatus"],
    severity: fhir.severity?.text
      || fhir.severity?.coding?.[0]?.display
      || "",
    onsetDate: fhir.onsetDateTime || fhir.onsetString || "",
    abatementDate: fhir.abatementDateTime || fhir.abatementString || "",
    recordedDate: fhir.recordedDate,
    bodySite: fhir.bodySite?.[0]?.text
      || fhir.bodySite?.[0]?.coding?.[0]?.display
      || "",
    note: fhir.note?.[0]?.text,
    coding: coding ? {
      system: coding.system || "",
      code: coding.code || "",
      display: coding.display || "",
    } : undefined,
  };
}

/**
 * Convert an AppCondition back to a FHIR Condition for upsert.
 * Requires patientFhirId to set the subject reference.
 */
export function mapAppConditionToFhirCondition(
  condition: AppCondition,
  patientFhirId: string
): FhirCondition {
  return {
    resourceType: "Condition",
    id: condition.fhirId,
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: condition.clinicalStatus,
        display: condition.clinicalStatus.charAt(0).toUpperCase() + condition.clinicalStatus.slice(1),
      }],
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-verificationstatus",
        code: condition.verificationStatus,
        display: condition.verificationStatus.charAt(0).toUpperCase() + condition.verificationStatus.slice(1),
      }],
    },
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-category",
        code: "problem-list-item",
        display: "Problem List Item",
      }],
    }],
    severity: condition.severity ? {
      text: condition.severity,
    } : undefined,
    code: {
      coding: condition.coding ? [{
        system: condition.coding.system,
        code: condition.coding.code,
        display: condition.coding.display,
      }] : undefined,
      text: condition.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    onsetDateTime: condition.onsetDate || undefined,
    abatementDateTime: condition.abatementDate || undefined,
    recordedDate: condition.recordedDate,
    bodySite: condition.bodySite ? [{
      text: condition.bodySite,
    }] : undefined,
    note: condition.note ? [{ text: condition.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of Condition resources to AppCondition array
 */
export function mapFhirBundleToConditions(bundle: FhirConditionBundle): AppCondition[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Condition")
    .map((entry) => mapFhirConditionToAppCondition(entry.resource));
}

// --- Procedure Mappers (Surgical History) ---

export function mapFhirProcedureToAppProcedure(fhir: FhirProcedure): AppProcedure {
  const coding = fhir.code?.coding?.[0];

  return {
    id: `procedure-${fhir.id}`,
    fhirId: fhir.id,
    name: fhir.code?.text || coding?.display || "Unknown procedure",
    status: (fhir.status || "completed") as AppProcedure["status"],
    performedDate: fhir.performedDateTime || fhir.performedString || "",
    bodySite: fhir.bodySite?.[0]?.text || fhir.bodySite?.[0]?.coding?.[0]?.display || "",
    outcome: fhir.outcome?.text || fhir.outcome?.coding?.[0]?.display || "",
    note: fhir.note?.[0]?.text,
    coding: coding
      ? {
          system: coding.system || "",
          code: coding.code || "",
          display: coding.display || "",
        }
      : undefined,
  };
}

export function mapAppProcedureToFhirProcedure(
  procedure: AppProcedure,
  patientFhirId: string
): FhirProcedure {
  return {
    resourceType: "Procedure",
    id: procedure.fhirId,
    status: procedure.status,
    category: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: "387713003",
          display: "Surgical procedure",
        },
      ],
    },
    code: {
      coding: procedure.coding
        ? [
            {
              system: procedure.coding.system,
              code: procedure.coding.code,
              display: procedure.coding.display,
            },
          ]
        : undefined,
      text: procedure.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    performedDateTime: procedure.performedDate || undefined,
    bodySite: procedure.bodySite
      ? [{ text: procedure.bodySite }]
      : undefined,
    outcome: procedure.outcome ? { text: procedure.outcome } : undefined,
    note: procedure.note ? [{ text: procedure.note }] : undefined,
  };
}

export function mapFhirBundleToProcedures(bundle: FhirProcedureBundle): AppProcedure[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Procedure")
    .map((entry) => mapFhirProcedureToAppProcedure(entry.resource));
}

// --- FamilyMemberHistory Mappers (Family History) ---

function formatOnsetAge(onset: { value?: number; unit?: string } | undefined): string {
  if (!onset?.value) return "";
  const unit = onset.unit || "years";
  return `${onset.value} ${unit}`;
}

export function mapFhirFamilyHistoryToAppFamilyHistory(
  fhir: FhirFamilyMemberHistory
): AppFamilyMemberHistory {
  const relCoding = fhir.relationship?.coding?.[0];

  const conditions: AppFamilyCondition[] = (fhir.condition || []).map((c) => {
    const coding = c.code?.coding?.[0];
    return {
      name: c.code?.text || coding?.display || "Unknown condition",
      outcome: c.outcome?.text || c.outcome?.coding?.[0]?.display,
      onsetAge: formatOnsetAge(c.onsetAge) || c.onsetString || undefined,
      contributedToDeath: c.contributedToDeath,
      note: c.note?.[0]?.text,
      coding: coding
        ? { system: coding.system || "", code: coding.code || "", display: coding.display || "" }
        : undefined,
    };
  });

  return {
    id: `family-${fhir.id}`,
    fhirId: fhir.id,
    name: fhir.name || relCoding?.display || "Unknown",
    relationship: relCoding?.code || "FAMMEMB",
    relationshipDisplay: relCoding?.display || fhir.relationship?.text || "Family Member",
    status: (fhir.status || "completed") as AppFamilyMemberHistory["status"],
    deceased: fhir.deceasedBoolean,
    deceasedAge: formatOnsetAge(fhir.deceasedAge) || fhir.deceasedString || undefined,
    conditions,
    note: fhir.note?.[0]?.text,
  };
}

export function mapAppFamilyHistoryToFhirFamilyHistory(
  member: AppFamilyMemberHistory,
  patientFhirId: string
): FhirFamilyMemberHistory {
  const conditions = member.conditions.map((c) => ({
    code: {
      coding: c.coding
        ? [{ system: c.coding.system, code: c.coding.code, display: c.coding.display }]
        : undefined,
      text: c.name,
    },
    outcome: c.outcome ? { text: c.outcome } : undefined,
    contributedToDeath: c.contributedToDeath,
    onsetAge: c.onsetAge
      ? { value: parseFloat(c.onsetAge), unit: "years", system: "http://unitsofmeasure.org", code: "a" }
      : undefined,
    note: c.note ? [{ text: c.note }] : undefined,
  }));

  return {
    resourceType: "FamilyMemberHistory",
    id: member.fhirId,
    status: member.status,
    patient: { reference: `Patient/${patientFhirId}` },
    name: member.name,
    relationship: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
          code: member.relationship,
          display: member.relationshipDisplay,
        },
      ],
    },
    deceasedBoolean: member.deceased,
    deceasedAge: member.deceasedAge
      ? { value: parseFloat(member.deceasedAge), unit: "years", system: "http://unitsofmeasure.org", code: "a" }
      : undefined,
    condition: conditions.length > 0 ? conditions : undefined,
    note: member.note ? [{ text: member.note }] : undefined,
  };
}

export function mapFhirBundleToFamilyHistories(
  bundle: FhirFamilyMemberHistoryBundle
): AppFamilyMemberHistory[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "FamilyMemberHistory")
    .map((entry) => mapFhirFamilyHistoryToAppFamilyHistory(entry.resource));
}

// --- Social History Observation Mappers ---

function extractObservationValue(obs: FhirSocialHistoryObservation): string {
  if (obs.valueCodeableConcept) {
    return obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display || "";
  }
  if (obs.valueQuantity) {
    return `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}`.trim();
  }
  if (obs.valueString) return obs.valueString;
  if (obs.valueBoolean !== undefined) return obs.valueBoolean ? "Yes" : "No";
  return "";
}

export function mapFhirObservationToAppSocialHistory(
  fhir: FhirSocialHistoryObservation
): AppSocialHistoryObservation {
  const coding = fhir.code?.coding?.[0];
  const valCoding = fhir.valueCodeableConcept?.coding?.[0];

  return {
    id: `social-${fhir.id}`,
    fhirId: fhir.id || "",
    name: fhir.code?.text || coding?.display || "Unknown observation",
    status: (fhir.status || "final") as AppSocialHistoryObservation["status"],
    value: extractObservationValue(fhir),
    effectiveDate: fhir.effectiveDateTime || "",
    note: fhir.note?.[0]?.text,
    coding: coding
      ? {
          system: coding.system || "",
          code: coding.code || "",
          display: coding.display || "",
        }
      : undefined,
    valueCoding: valCoding
      ? {
          system: valCoding.system || "",
          code: valCoding.code || "",
          display: valCoding.display || "",
        }
      : undefined,
  };
}

export function mapAppSocialHistoryToFhirObservation(
  obs: AppSocialHistoryObservation,
  patientFhirId: string
): FhirSocialHistoryObservation {
  return {
    resourceType: "Observation",
    id: obs.fhirId || undefined,
    status: obs.status,
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "social-history",
            display: "Social History",
          },
        ],
      },
    ],
    code: {
      coding: obs.coding
        ? [
            {
              system: obs.coding.system,
              code: obs.coding.code,
              display: obs.coding.display,
            },
          ]
        : undefined,
      text: obs.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    effectiveDateTime: obs.effectiveDate || undefined,
    valueCodeableConcept: obs.valueCoding
      ? {
          coding: [
            {
              system: obs.valueCoding.system,
              code: obs.valueCoding.code,
              display: obs.valueCoding.display,
            },
          ],
          text: obs.value,
        }
      : undefined,
    valueString: !obs.valueCoding && obs.value ? obs.value : undefined,
    note: obs.note ? [{ text: obs.note }] : undefined,
  };
}

export function mapFhirBundleToSocialHistories(
  bundle: FhirSocialHistoryObservationBundle
): AppSocialHistoryObservation[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Observation")
    .map((entry) => mapFhirObservationToAppSocialHistory(entry.resource));
}

// --- Encounter Mappers ---

const ENCOUNTER_SIGNATURE_EXT = "http://phenoml.com/fhir/StructureDefinition/encounter-signature";

const ENCOUNTER_CLASS_DISPLAY: Record<string, string> = {
  AMB: "Ambulatory",
  IMP: "Inpatient",
  EMER: "Emergency",
  VR: "Virtual",
  HH: "Home Health",
};

/**
 * Convert a FHIR Encounter + ClinicalImpression pair to an AppEncounter
 */
export function mapFhirEncounterToAppEncounter(
  encounter: FhirEncounter,
  impression?: FhirClinicalImpression
): AppEncounter {
  const classCode = (encounter.class?.code || "AMB") as AppEncounter["classCode"];

  // Parse signing extension
  const sigExt = encounter.extension?.find(e => e.url === ENCOUNTER_SIGNATURE_EXT);
  const isSigned = sigExt?.extension?.find(e => e.url === "signed")?.valueBoolean;
  const signedAt = sigExt?.extension?.find(e => e.url === "signedAt")?.valueDateTime;
  const signedBy = sigExt?.extension?.find(e => e.url === "signedBy")?.valueString;
  const signedById = sigExt?.extension?.find(e => e.url === "signedById")?.valueString;

  return {
    id: `enc-${encounter.id}`,
    encounterFhirId: encounter.id,
    noteFhirId: impression?.id,
    status: encounter.status as AppEncounter["status"],
    classCode,
    classDisplay: encounter.class?.display || ENCOUNTER_CLASS_DISPLAY[classCode] || classCode,
    date: encounter.period?.start || new Date().toISOString(),
    endDate: encounter.period?.end,
    noteText: impression?.note?.[0]?.text || impression?.summary || impression?.description || "",
    patientFhirId: encounter.subject?.reference?.replace("Patient/", "") || "",
    ...(isSigned ? { isSigned, signedAt, signedBy, signedById } : {}),
  };
}

/**
 * Convert an AppEncounter to a FHIR Encounter resource for create/upsert.
 */
export function mapAppEncounterToFhirEncounter(
  enc: AppEncounter
): FhirEncounter {
  const fhirEncounter: FhirEncounter = {
    resourceType: "Encounter",
    id: enc.encounterFhirId,
    status: enc.status,
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: enc.classCode,
      display: enc.classDisplay,
    },
    subject: {
      reference: `Patient/${enc.patientFhirId}`,
    },
    period: {
      start: enc.date,
      end: enc.endDate,
    },
  };

  if (enc.isSigned) {
    fhirEncounter.extension = [
      {
        url: ENCOUNTER_SIGNATURE_EXT,
        extension: [
          { url: "signed", valueBoolean: true },
          ...(enc.signedAt ? [{ url: "signedAt", valueDateTime: enc.signedAt }] : []),
          ...(enc.signedBy ? [{ url: "signedBy", valueString: enc.signedBy }] : []),
          ...(enc.signedById ? [{ url: "signedById", valueString: enc.signedById }] : []),
        ],
      },
    ];
  }

  return fhirEncounter;
}

/**
 * Convert an AppEncounter's note to a FHIR ClinicalImpression resource.
 */
export function mapAppEncounterToFhirClinicalImpression(
  enc: AppEncounter,
  encounterFhirId: string
): FhirClinicalImpression {
  return {
    resourceType: "ClinicalImpression",
    id: enc.noteFhirId,
    status: enc.status === "finished" ? "completed" : "in-progress",
    subject: {
      reference: `Patient/${enc.patientFhirId}`,
    },
    encounter: {
      reference: `Encounter/${encounterFhirId}`,
    },
    effectiveDateTime: enc.date,
    note: enc.noteText ? [{ text: enc.noteText }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of Encounters to AppEncounter array.
 * Note: ClinicalImpressions must be matched separately.
 */
export function mapFhirBundleToEncounters(
  encounterBundle: FhirEncounterBundle,
  impressionBundle?: FhirClinicalImpressionBundle
): AppEncounter[] {
  if (!encounterBundle.entry) return [];

  const impressionsByEncounter = new Map<string, FhirClinicalImpression>();
  if (impressionBundle?.entry) {
    for (const entry of impressionBundle.entry) {
      const encRef = entry.resource?.encounter?.reference;
      if (encRef) {
        impressionsByEncounter.set(encRef, entry.resource);
      }
    }
  }

  return encounterBundle.entry
    .filter((entry) => entry.resource?.resourceType === "Encounter")
    .map((entry) => {
      const encRef = `Encounter/${entry.resource.id}`;
      const impression = impressionsByEncounter.get(encRef);
      return mapFhirEncounterToAppEncounter(entry.resource, impression);
    });
}

// --- Lab Order (ServiceRequest) Mappers ---

/**
 * Convert a FHIR ServiceRequest to an AppLabOrder
 */
export function mapFhirServiceRequestToAppLabOrder(fhir: FhirServiceRequest): AppLabOrder {
  const coding = fhir.code?.coding?.[0];

  return {
    id: `lab-${fhir.id}`,
    fhirId: fhir.id,
    testName: fhir.code?.text || coding?.display || "Unknown test",
    loincCode: coding?.code || "",
    loincDisplay: coding?.display || "",
    status: fhir.status as AppLabOrder["status"],
    priority: (fhir.priority as AppLabOrder["priority"]) || "routine",
    authoredOn: fhir.authoredOn,
    patientFhirId: fhir.subject?.reference?.replace("Patient/", "") || "",
    note: fhir.note?.[0]?.text,
  };
}

/**
 * Convert an AppLabOrder to a FHIR ServiceRequest for create/upsert
 */
export function mapAppLabOrderToFhirServiceRequest(lab: AppLabOrder): FhirServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id: lab.fhirId,
    status: lab.status,
    intent: "order",
    category: [{
      coding: [{
        system: "http://snomed.info/sct",
        code: "108252007",
        display: "Laboratory procedure",
      }],
    }],
    code: {
      coding: lab.loincCode ? [{
        system: "http://loinc.org",
        code: lab.loincCode,
        display: lab.loincDisplay,
      }] : undefined,
      text: lab.testName,
    },
    subject: {
      reference: `Patient/${lab.patientFhirId}`,
    },
    priority: lab.priority,
    authoredOn: lab.authoredOn,
    note: lab.note ? [{ text: lab.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of ServiceRequests to AppLabOrder array.
 * Filters to lab category (108252007) or entries with no category (backward compat).
 */
export function mapFhirBundleToLabOrders(bundle: FhirServiceRequestBundle): AppLabOrder[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "ServiceRequest")
    .filter((entry) => {
      const cats = entry.resource?.category;
      if (!cats || cats.length === 0) return true;
      return cats.some((cat) =>
        cat.coding?.some((c) => c.code === "108252007")
      );
    })
    .map((entry) => mapFhirServiceRequestToAppLabOrder(entry.resource));
}

// --- Imaging Order (ServiceRequest) Mappers ---

/**
 * Convert a FHIR ServiceRequest to an AppImagingOrder
 */
export function mapFhirServiceRequestToAppImagingOrder(fhir: FhirServiceRequest): AppImagingOrder {
  const coding = fhir.code?.coding?.[0];

  return {
    id: `img-${fhir.id}`,
    fhirId: fhir.id,
    studyName: fhir.code?.text || coding?.display || "Unknown study",
    loincCode: coding?.code || "",
    loincDisplay: coding?.display || "",
    status: fhir.status as AppImagingOrder["status"],
    priority: (fhir.priority as AppImagingOrder["priority"]) || "routine",
    authoredOn: fhir.authoredOn,
    patientFhirId: fhir.subject?.reference?.replace("Patient/", "") || "",
    note: fhir.note?.[0]?.text,
  };
}

/**
 * Convert an AppImagingOrder to a FHIR ServiceRequest for create/upsert
 */
export function mapAppImagingOrderToFhirServiceRequest(img: AppImagingOrder): FhirServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id: img.fhirId,
    status: img.status,
    intent: "order",
    category: [{
      coding: [{
        system: "http://snomed.info/sct",
        code: "363679005",
        display: "Imaging",
      }],
    }],
    code: {
      coding: img.loincCode ? [{
        system: "http://loinc.org",
        code: img.loincCode,
        display: img.loincDisplay,
      }] : undefined,
      text: img.studyName,
    },
    subject: {
      reference: `Patient/${img.patientFhirId}`,
    },
    priority: img.priority,
    authoredOn: img.authoredOn,
    note: img.note ? [{ text: img.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of ServiceRequests to AppImagingOrder array.
 * Filters to imaging category (363679005).
 */
export function mapFhirBundleToImagingOrders(bundle: FhirServiceRequestBundle): AppImagingOrder[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "ServiceRequest")
    .filter((entry) => {
      const cats = entry.resource?.category;
      return cats?.some((cat) =>
        cat.coding?.some((c) => c.code === "363679005")
      );
    })
    .map((entry) => mapFhirServiceRequestToAppImagingOrder(entry.resource));
}

// --- Task Mappers ---

const VALID_APP_TASK_STATUSES = new Set<AppTask["status"]>([
  "requested",
  "in-progress",
  "completed",
  "cancelled",
]);

/**
 * Convert a FHIR Task to an AppTask
 */
export function mapFhirTaskToAppTask(task: FhirTask): AppTask {
  const status = VALID_APP_TASK_STATUSES.has(task.status as AppTask["status"])
    ? (task.status as AppTask["status"])
    : "requested";

  return {
    id: `task-${task.id}`,
    fhirId: task.id,
    status,
    intent: "order",
    priority: (task.priority as AppTask["priority"]) || "routine",
    description: task.description || task.note?.[0]?.text || "",
    dueDate: task.restriction?.period?.end,
    authoredOn: task.authoredOn || new Date().toISOString(),
    patientFhirId: task.for?.reference?.replace("Patient/", "") || "",
    encounterFhirId: task.encounter?.reference?.replace("Encounter/", ""),
  };
}

/**
 * Convert an AppTask to a FHIR Task for create/upsert
 */
export function mapAppTaskToFhirTask(task: AppTask): FhirTask {
  return {
    resourceType: "Task",
    id: task.fhirId,
    status: task.status,
    intent: "order",
    priority: task.priority || "routine",
    description: task.description,
    for: {
      reference: `Patient/${task.patientFhirId}`,
    },
    encounter: task.encounterFhirId
      ? { reference: `Encounter/${task.encounterFhirId}` }
      : undefined,
    authoredOn: task.authoredOn,
    lastModified: new Date().toISOString(),
    restriction: task.dueDate
      ? { period: { end: task.dueDate } }
      : undefined,
  };
}

/**
 * Convert a FHIR Bundle of Tasks to AppTask array
 */
export function mapFhirBundleToTasks(bundle: FhirTaskBundle): AppTask[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Task")
    .map((entry) => mapFhirTaskToAppTask(entry.resource));
}

// ── Appointment mappers ──

const APPOINTMENT_TYPE_MAP: Record<string, AppAppointment["appointmentType"]> = {
  "ROUTINE": "patient-visit",
  "FOLLOWUP": "patient-visit",
  "WALKIN": "patient-visit",
  "CHECKUP": "patient-visit",
  "VR": "telehealth",
  "TELECONSULT": "telehealth",
  "telehealth": "telehealth",
  "meeting": "meeting",
};

function resolveAppointmentType(
  fhir: FhirAppointment
): AppAppointment["appointmentType"] {
  const code = fhir.appointmentType?.coding?.[0]?.code;
  if (code && APPOINTMENT_TYPE_MAP[code]) return APPOINTMENT_TYPE_MAP[code];

  const display = (fhir.appointmentType?.coding?.[0]?.display || "").toLowerCase();
  if (display.includes("telehealth") || display.includes("virtual")) return "telehealth";
  if (display.includes("meeting") || display.includes("huddle") || display.includes("admin")) return "meeting";
  return "patient-visit";
}

export function mapFhirAppointmentToAppAppointment(
  apt: FhirAppointment
): AppAppointment {
  const patientParticipant = apt.participant?.find(
    (p) => p.actor?.reference?.startsWith("Patient/")
  );

  const status = (["proposed", "booked", "arrived", "fulfilled", "cancelled", "noshow"] as const)
    .includes(apt.status as any)
    ? (apt.status as AppAppointment["status"])
    : "booked";

  return {
    id: `apt-${apt.id}`,
    fhirId: apt.id,
    status,
    description: apt.description || "",
    start: apt.start || "",
    end: apt.end || "",
    appointmentType: resolveAppointmentType(apt),
    patientFhirId: patientParticipant?.actor?.reference?.replace("Patient/", ""),
    patientName: patientParticipant?.actor?.display,
  };
}

export function mapAppAppointmentToFhirAppointment(
  apt: AppAppointment
): FhirAppointment {
  const typeCodeMap: Record<AppAppointment["appointmentType"], { code: string; display: string }> = {
    "patient-visit": { code: "ROUTINE", display: "Routine" },
    "telehealth": { code: "VR", display: "Telehealth" },
    "meeting": { code: "meeting", display: "Meeting" },
  };
  const typeCode = typeCodeMap[apt.appointmentType];

  const participants: FhirAppointment["participant"] = [];
  if (apt.patientFhirId) {
    participants.push({
      actor: {
        reference: `Patient/${apt.patientFhirId}`,
        display: apt.patientName,
      },
      required: "required",
      status: "accepted",
    });
  }

  // FHIR instant requires timezone — append local offset if missing
  const ensureTimezone = (dt: string) => {
    if (/[Zz]$/.test(dt) || /[+-]\d{2}:\d{2}$/.test(dt)) return dt;
    const now = new Date();
    const offsetMin = now.getTimezoneOffset();
    const sign = offsetMin <= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offsetMin) % 60).padStart(2, "0");
    return `${dt}${sign}${absH}:${absM}`;
  };

  // FHIR constraint app-1: participant must have actor or type
  if (participants.length === 0) {
    participants.push({
      actor: { display: apt.patientName || "Unknown" },
      status: "accepted",
    });
  }

  return {
    resourceType: "Appointment",
    id: apt.fhirId,
    status: apt.status,
    description: apt.description,
    start: ensureTimezone(apt.start),
    end: ensureTimezone(apt.end),
    appointmentType: {
      coding: [{ code: typeCode.code, display: typeCode.display }],
    },
    participant: participants,
  };
}

export function mapFhirBundleToAppointments(
  bundle: FhirAppointmentBundle
): AppAppointment[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Appointment")
    .map((entry) => mapFhirAppointmentToAppAppointment(entry.resource));
}

// ── Vital Sign (Observation) mappers ──

const BP_LOINC = "85354-9";
const SYSTOLIC_LOINC = "8480-6";
const DIASTOLIC_LOINC = "8462-4";

/**
 * Convert a FHIR Observation (vital-signs category) to an AppVital
 */
export function mapFhirObservationToAppVital(fhir: FhirObservation): AppVital {
  const coding = fhir.code?.coding?.[0];
  const isBloodPressure = coding?.code === BP_LOINC;

  let systolic: number | undefined;
  let diastolic: number | undefined;

  if (isBloodPressure && fhir.component) {
    for (const comp of fhir.component) {
      const compCode = comp.code?.coding?.[0]?.code;
      if (compCode === SYSTOLIC_LOINC) systolic = comp.valueQuantity?.value;
      if (compCode === DIASTOLIC_LOINC) diastolic = comp.valueQuantity?.value;
    }
  }

  return {
    id: `vital-${fhir.id}`,
    fhirId: fhir.id,
    name: fhir.code?.text || coding?.display || "Unknown vital",
    loincCode: coding?.code || "",
    loincDisplay: coding?.display || "",
    status: fhir.status as AppVital["status"],
    effectiveDateTime: fhir.effectiveDateTime || "",
    patientFhirId: fhir.subject?.reference?.replace("Patient/", "") || "",
    encounterFhirId: fhir.encounter?.reference?.replace("Encounter/", "") || undefined,
    value: isBloodPressure ? undefined : fhir.valueQuantity?.value,
    unit: isBloodPressure ? "mmHg" : fhir.valueQuantity?.unit,
    systolic,
    diastolic,
    note: fhir.note?.[0]?.text,
  };
}

/**
 * Convert an AppVital to a FHIR Observation for create/upsert
 */
export function mapAppVitalToFhirObservation(
  vital: AppVital,
  patientFhirId: string
): FhirObservation {
  const isBloodPressure = vital.loincCode === BP_LOINC;

  return {
    resourceType: "Observation",
    id: vital.fhirId,
    status: vital.status,
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: "vital-signs",
        display: "Vital Signs",
      }],
    }],
    code: {
      coding: [{
        system: "http://loinc.org",
        code: vital.loincCode,
        display: vital.loincDisplay,
      }],
      text: vital.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    encounter: vital.encounterFhirId
      ? { reference: `Encounter/${vital.encounterFhirId}` }
      : undefined,
    effectiveDateTime: vital.effectiveDateTime,
    valueQuantity: !isBloodPressure && vital.value !== undefined ? {
      value: vital.value,
      unit: vital.unit || "",
      system: "http://unitsofmeasure.org",
    } : undefined,
    component: isBloodPressure ? [
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: SYSTOLIC_LOINC,
            display: "Systolic blood pressure",
          }],
        },
        valueQuantity: vital.systolic !== undefined ? {
          value: vital.systolic,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]",
        } : undefined,
      },
      {
        code: {
          coding: [{
            system: "http://loinc.org",
            code: DIASTOLIC_LOINC,
            display: "Diastolic blood pressure",
          }],
        },
        valueQuantity: vital.diastolic !== undefined ? {
          value: vital.diastolic,
          unit: "mmHg",
          system: "http://unitsofmeasure.org",
          code: "mm[Hg]",
        } : undefined,
      },
    ] : undefined,
    note: vital.note ? [{ text: vital.note }] : undefined,
  };
}

/**
 * Convert a FHIR Bundle of Observations to AppVital array.
 * Filters to vital-signs category.
 */
export function mapFhirBundleToVitals(bundle: FhirObservationBundle): AppVital[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Observation")
    .filter((entry) => {
      const cats = entry.resource?.category;
      if (!cats || cats.length === 0) return true;
      return cats.some((cat) =>
        cat.coding?.some((c) => c.code === "vital-signs")
      );
    })
    .map((entry) => mapFhirObservationToAppVital(entry.resource));
}

// ─── Communication / Message mappers ─────────────────────

/**
 * Map a single FHIR Communication (child message) to an AppMessage.
 */
export function mapFhirCommunicationToAppMessage(
  comm: FhirCommunication
): AppMessage | null {
  if (!comm.id) return null;

  const senderRef = comm.sender?.reference || '';
  const senderType: 'patient' | 'provider' = senderRef.startsWith('Patient/')
    ? 'patient'
    : 'provider';

  return {
    id: comm.id,
    fhirId: comm.id,
    threadId: comm.partOf?.[0]?.reference?.replace('Communication/', '') || '',
    senderType,
    senderRef,
    text: comm.payload?.[0]?.contentString || '',
    sentAt: comm.sent || '',
    receivedAt: comm.received,
    status: comm.status as AppMessage['status'],
  };
}

/**
 * Map an AppMessage to a FHIR Communication resource for creation.
 * Does NOT include `id` — caller must handle id for upsert vs create.
 */
export function mapAppMessageToFhirCommunication(
  message: { text: string; senderRef: string; recipientRef: string; patientRef: string; threadId: string }
): FhirCommunication {
  return {
    resourceType: 'Communication',
    status: 'completed',
    subject: { reference: message.patientRef },
    sender: { reference: message.senderRef },
    recipient: [{ reference: message.recipientRef }],
    sent: new Date().toISOString(),
    partOf: [{ reference: `Communication/${message.threadId}` }],
    payload: [{ contentString: message.text }],
    medium: [{ text: 'in-app' }],
  };
}

/**
 * Build a FHIR Communication thread header resource.
 */
export function buildFhirThreadHeader(
  patientRef: string,
  senderRef: string,
  topic: string = 'Patient conversation'
): FhirCommunication {
  return {
    resourceType: 'Communication',
    status: 'in-progress',
    topic: { text: topic },
    subject: { reference: patientRef },
    sender: { reference: senderRef },
    recipient: [{ reference: patientRef }],
    medium: [{ text: 'in-app' }],
  };
}

/**
 * Parse a FHIR bundle into thread headers and child messages.
 * Returns an array of AppThread objects.
 * When using _revinclude, both headers and children come in the same bundle.
 */
export function mapFhirBundleToThreads(
  bundle: FhirCommunicationBundle
): AppThread[] {
  const entries = bundle.entry || [];
  const headers: FhirCommunication[] = [];
  const children: FhirCommunication[] = [];

  for (const entry of entries) {
    const comm = entry.resource;
    if (comm.partOf && comm.partOf.length > 0) {
      children.push(comm);
    } else {
      headers.push(comm);
    }
  }

  return headers.map(header => {
    const threadId = header.id || '';
    const threadMessages = children
      .filter(c => c.partOf?.[0]?.reference === `Communication/${threadId}`)
      .map(mapFhirCommunicationToAppMessage)
      .filter((m): m is AppMessage => m !== null)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    return {
      id: threadId,
      topic: header.topic?.text || 'Patient conversation',
      patientRef: header.subject?.reference || '',
      messages: threadMessages,
    };
  });
}

// --- CareTeam Mappers ---

/**
 * Convert a FHIR CareTeam (with single participant) to an AppCareTeamMember
 */
export function mapFhirCareTeamToAppCareTeamMember(fhir: FhirCareTeam): AppCareTeamMember {
  const participant = fhir.participant?.[0];
  const roleCoding = participant?.role?.[0]?.coding?.[0];

  // Read pcpUserId from extension
  const pcpUserIdExt = fhir.extension?.find(
    (e) => e.url === 'https://app.phenoml.com/fhir/StructureDefinition/careteam-pcp-user-id'
  );

  return {
    id: `careteam-${fhir.id}`,
    fhirId: fhir.id,
    name: participant?.member?.display || 'Unknown provider',
    role: participant?.role?.[0]?.text
      || roleCoding?.display
      || '',
    status: (fhir.status as AppCareTeamMember['status']) || 'active',
    note: fhir.note?.[0]?.text,
    pcpUserId: pcpUserIdExt?.valueString,
    coding: roleCoding ? {
      system: roleCoding.system || '',
      code: roleCoding.code || '',
      display: roleCoding.display || '',
    } : undefined,
  };
}

/**
 * Convert an AppCareTeamMember back to a FHIR CareTeam for upsert.
 */
export function mapAppCareTeamMemberToFhirCareTeam(
  member: AppCareTeamMember,
  patientFhirId: string
): FhirCareTeam {
  // Build member reference: use Practitioner reference if available via pcpUserId context,
  // otherwise fall back to display-only
  const memberRef: { reference?: string; display?: string } = {
    display: member.name,
  };

  // Build extensions for pcpUserId
  const extensions: FhirCareTeam['extension'] = member.pcpUserId
    ? [{
        url: 'https://app.phenoml.com/fhir/StructureDefinition/careteam-pcp-user-id',
        valueString: member.pcpUserId,
      }]
    : undefined;

  return {
    resourceType: 'CareTeam',
    id: member.fhirId,
    status: member.status || 'active',
    category: [{
      coding: [{
        system: 'http://loinc.org',
        code: 'LA28865-6',
        display: 'Longitudinal care-coordination focused care team',
      }],
    }],
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    participant: [{
      role: member.role ? [{
        coding: member.coding ? [{
          system: member.coding.system,
          code: member.coding.code,
          display: member.coding.display,
        }] : undefined,
        text: member.role,
      }] : undefined,
      member: memberRef,
    }],
    note: member.note ? [{ text: member.note }] : undefined,
    extension: extensions,
  };
}

/**
 * Convert a FHIR Bundle of CareTeam resources to AppCareTeamMember array
 */
export function mapFhirBundleToCareTeamMembers(bundle: FhirCareTeamBundle): AppCareTeamMember[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === 'CareTeam')
    .map((entry) => mapFhirCareTeamToAppCareTeamMember(entry.resource));
}

// --- Goal Mappers (Goals of Care) ---

export function mapFhirGoalToAppGoal(fhir: FhirGoal): AppGoal {
  const coding = fhir.description?.coding?.[0];

  return {
    id: `goal-${fhir.id}`,
    fhirId: fhir.id || "",
    name: fhir.description?.text || coding?.display || "Unknown goal",
    lifecycleStatus: (fhir.lifecycleStatus || "active") as AppGoal["lifecycleStatus"],
    expressedBy: fhir.expressedBy?.display,
    note: fhir.note?.[0]?.text,
    startDate: fhir.startDate || "",
    coding: coding
      ? {
          system: coding.system || "",
          code: coding.code || "",
          display: coding.display || "",
        }
      : undefined,
  };
}

export function mapAppGoalToFhirGoal(
  goal: AppGoal,
  patientFhirId: string
): FhirGoal {
  return {
    resourceType: "Goal",
    id: goal.fhirId || undefined,
    lifecycleStatus: goal.lifecycleStatus,
    category: [{
      coding: [{
        system: "http://snomed.info/sct",
        code: "736366004",
        display: "Advance care plan",
      }],
    }],
    description: {
      coding: goal.coding
        ? [{
            system: goal.coding.system,
            code: goal.coding.code,
            display: goal.coding.display,
          }]
        : undefined,
      text: goal.name,
    },
    subject: {
      reference: `Patient/${patientFhirId}`,
    },
    startDate: goal.startDate || undefined,
    expressedBy: goal.expressedBy
      ? { display: goal.expressedBy }
      : undefined,
    note: goal.note ? [{ text: goal.note }] : undefined,
  };
}

export function mapFhirBundleToGoals(bundle: FhirGoalBundle): AppGoal[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "Goal")
    .map((entry) => mapFhirGoalToAppGoal(entry.resource));
}

// --- Referral (ServiceRequest) Mappers ---

export function mapFhirServiceRequestToAppReferral(fhir: FhirServiceRequest): AppReferral {
  return {
    id: `referral-${fhir.id}`,
    fhirId: fhir.id,
    referralType: fhir.code?.text || fhir.code?.coding?.[0]?.display || "Unknown referral",
    status: fhir.status as AppReferral["status"],
    priority: (fhir.priority as AppReferral["priority"]) || "routine",
    referredTo: fhir.performer?.[0]?.display,
    reason: fhir.reasonCode?.[0]?.text || fhir.reasonCode?.[0]?.coding?.[0]?.display,
    authoredOn: fhir.authoredOn,
    patientFhirId: fhir.subject?.reference?.replace("Patient/", "") || "",
    note: fhir.note?.[0]?.text,
  };
}

export function mapAppReferralToFhirServiceRequest(referral: AppReferral): FhirServiceRequest {
  return {
    resourceType: "ServiceRequest",
    id: referral.fhirId,
    status: referral.status,
    intent: "order",
    category: [{
      coding: [{
        system: "http://snomed.info/sct",
        code: "3457005",
        display: "Patient referral",
      }],
    }],
    code: {
      text: referral.referralType,
    },
    subject: {
      reference: `Patient/${referral.patientFhirId}`,
    },
    priority: referral.priority,
    authoredOn: referral.authoredOn,
    performer: referral.referredTo ? [{ display: referral.referredTo }] : undefined,
    reasonCode: referral.reason ? [{ text: referral.reason }] : undefined,
    note: referral.note ? [{ text: referral.note }] : undefined,
  };
}

export function mapFhirBundleToReferrals(bundle: FhirServiceRequestBundle): AppReferral[] {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter((entry) => entry.resource?.resourceType === "ServiceRequest")
    .filter((entry) => {
      const cats = entry.resource?.category;
      if (!cats || cats.length === 0) return false;
      return cats.some((cat) =>
        cat.coding?.some((c) => c.code === "3457005")
      );
    })
    .map((entry) => mapFhirServiceRequestToAppReferral(entry.resource));
}
