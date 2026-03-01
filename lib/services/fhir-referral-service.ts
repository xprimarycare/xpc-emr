import { FhirServiceRequestBundle } from "@/lib/types/fhir";
import { AppReferral } from "@/lib/types/referral";
import {
  mapFhirBundleToReferrals,
  mapAppReferralToFhirServiceRequest,
} from "@/lib/phenoml/fhir-mapper";

// Abbreviation → full specialty name
const REFERRAL_SPECIALTIES: Record<string, string> = {
  cards: "Cardiology",
  cardiology: "Cardiology",
  gi: "Gastroenterology",
  gastro: "Gastroenterology",
  gastroenterology: "Gastroenterology",
  neuro: "Neurology",
  neurology: "Neurology",
  pulm: "Pulmonology",
  pulmonology: "Pulmonology",
  derm: "Dermatology",
  dermatology: "Dermatology",
  endo: "Endocrinology",
  endocrinology: "Endocrinology",
  rheum: "Rheumatology",
  rheumatology: "Rheumatology",
  onc: "Oncology",
  oncology: "Oncology",
  heme: "Hematology",
  hematology: "Hematology",
  nephro: "Nephrology",
  nephrology: "Nephrology",
  uro: "Urology",
  urology: "Urology",
  ortho: "Orthopedics",
  orthopedics: "Orthopedics",
  ent: "Otolaryngology (ENT)",
  otolaryngology: "Otolaryngology (ENT)",
  ophtho: "Ophthalmology",
  ophthalmology: "Ophthalmology",
  psych: "Psychiatry",
  psychiatry: "Psychiatry",
  pt: "Physical Therapy",
  "physical therapy": "Physical Therapy",
  ot: "Occupational Therapy",
  "occupational therapy": "Occupational Therapy",
  sw: "Social Work",
  "social work": "Social Work",
  "pain": "Pain Management",
  "pain management": "Pain Management",
  palliative: "Palliative Care",
  "palliative care": "Palliative Care",
  id: "Infectious Disease",
  "infectious disease": "Infectious Disease",
  allergy: "Allergy & Immunology",
  immunology: "Allergy & Immunology",
  "sleep": "Sleep Medicine",
  nutrition: "Nutrition",
  dietitian: "Nutrition",
};

/**
 * Strip command prefix ("refer", "referral", "consult", "to") and expand specialty abbreviation.
 * Returns { specialty } with the resolved full name, or the raw remainder if not found.
 */
export function parseReferralCommand(text: string): { specialty: string } {
  // Strip command words from the start
  const stripped = text
    .replace(/^(refer(?:ral)?|consult(?:ation)?)\s*/i, "")
    .replace(/^to\s+/i, "")
    .trim();

  const key = stripped.toLowerCase();
  const specialty = REFERRAL_SPECIALTIES[key];

  if (specialty) {
    return { specialty };
  }

  // Not in map — capitalize the raw text
  return {
    specialty: stripped.charAt(0).toUpperCase() + stripped.slice(1),
  };
}

export interface ReferralSearchResult {
  referrals: AppReferral[];
  total: number;
  error?: string;
}

export async function searchFhirReferrals(
  patientFhirId: string
): Promise<ReferralSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/referral?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { referrals: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { referrals: [], total: 0, error: data.error || "Failed to fetch referrals" };
    }

    const bundle = data as FhirServiceRequestBundle;
    const referrals = mapFhirBundleToReferrals(bundle);

    return { referrals, total: bundle.total ?? referrals.length };
  } catch (error) {
    return {
      referrals: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ReferralParseResult {
  resource: Record<string, unknown> | null;
  error?: string;
}

export async function parseReferralText(
  text: string
): Promise<ReferralParseResult> {
  try {
    const response = await fetch("/api/fhir/lang2fhir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, resource: "servicerequest" }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { resource: null, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { resource: null, error: data.error || "Failed to parse referral" };
    }

    return { resource: data };
  } catch (error) {
    return {
      resource: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ReferralCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

export async function createFhirReferral(
  fhirResource: Record<string, unknown>
): Promise<ReferralCreateResult> {
  try {
    const response = await fetch("/api/fhir/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: (data as any).error || "Failed to create referral" };
    }

    return { success: true, fhirId: (data as any).id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ReferralUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirReferral(
  referral: AppReferral
): Promise<ReferralUpsertResult> {
  if (!referral.fhirId) {
    return { success: false, error: "Referral has no FHIR ID — cannot write back to Medplum" };
  }

  try {
    const fhirResource = mapAppReferralToFhirServiceRequest(referral);

    const response = await fetch("/api/fhir/referral", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: (data as any).error || "Failed to save referral to Medplum" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
