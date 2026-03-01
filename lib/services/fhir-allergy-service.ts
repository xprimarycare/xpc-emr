import { FhirAllergyIntoleranceBundle } from "@/lib/types/fhir";
import { AppAllergy } from "@/lib/types/allergy";
import {
  mapFhirBundleToAllergies,
  mapAppAllergyToFhirAllergy,
} from "@/lib/phenoml/fhir-mapper";

export interface ResolvedAllergyCode {
  code: string;
  description: string;
  system: string;
}

// Common allergy abbreviations → expanded terms for semantic search
// Medication allergens use RxNorm; non-medication allergens use SNOMED CT
const ALLERGY_ABBREVIATIONS: Record<string, { term: string; isMed: boolean }> = {
  // Medication allergens (RxNorm)
  pcn: { term: "penicillin", isMed: true },
  asa: { term: "aspirin", isMed: true },
  nsaid: { term: "nonsteroidal anti-inflammatory drug", isMed: true },
  nsaids: { term: "nonsteroidal anti-inflammatory drug", isMed: true },
  sulfa: { term: "sulfonamide antibiotic", isMed: true },
  abx: { term: "antibiotic", isMed: true },
  ace: { term: "ACE inhibitor", isMed: true },
  arb: { term: "angiotensin receptor blocker", isMed: true },
  statin: { term: "statin", isMed: true },
  amox: { term: "amoxicillin", isMed: true },
  augmentin: { term: "amoxicillin clavulanate", isMed: true },
  bactrim: { term: "sulfamethoxazole trimethoprim", isMed: true },
  codeine: { term: "codeine", isMed: true },
  morphine: { term: "morphine", isMed: true },
  iodine: { term: "iodine contrast", isMed: true },
  contrast: { term: "contrast dye", isMed: true },
  heparin: { term: "heparin", isMed: true },
  latex: { term: "latex", isMed: false },
  // Food allergens (SNOMED)
  peanut: { term: "peanut allergy", isMed: false },
  peanuts: { term: "peanut allergy", isMed: false },
  shellfish: { term: "shellfish allergy", isMed: false },
  treenut: { term: "tree nut allergy", isMed: false },
  egg: { term: "egg allergy", isMed: false },
  eggs: { term: "egg allergy", isMed: false },
  milk: { term: "milk allergy", isMed: false },
  dairy: { term: "dairy allergy", isMed: false },
  soy: { term: "soy allergy", isMed: false },
  wheat: { term: "wheat allergy", isMed: false },
  gluten: { term: "gluten allergy", isMed: false },
  fish: { term: "fish allergy", isMed: false },
  // Environmental allergens (SNOMED)
  dust: { term: "dust mite allergy", isMed: false },
  pollen: { term: "pollen allergy", isMed: false },
  mold: { term: "mold allergy", isMed: false },
  cat: { term: "cat dander allergy", isMed: false },
  dog: { term: "dog dander allergy", isMed: false },
  bee: { term: "bee venom allergy", isMed: false },
};

interface ParsedAllergyTerm {
  /** The substance/allergen name (expanded from abbreviations) */
  term: string;
  /** Whether this is a medication allergen (RxNorm) vs food/environmental (SNOMED) */
  isMed: boolean;
  /** Reaction parsed from user input (e.g. "swelling", "rash") */
  reaction: string;
}

// Known reaction terms that can appear after the substance name
const REACTION_TERMS = new Set([
  // Skin reactions
  "rash", "hives", "urticaria", "itching", "itchy", "pruritus", "flushing",
  // Swelling
  "swelling", "angioedema", "edema",
  // Respiratory
  "wheezing", "dyspnea", "bronchospasm", "cough",
  // Severe
  "anaphylaxis", "anaphylactic",
  // GI
  "nausea", "vomiting", "diarrhea", "gi upset", "abdominal pain",
  // Other
  "headache", "dizziness", "throat tightness", "tongue swelling",
]);

/**
 * Split a segment into substance words and reaction words.
 * Scans from the end — any trailing words that are known reactions get separated.
 * e.g. "lisinopril swelling" → substance="lisinopril", reaction="swelling"
 * e.g. "pcn rash" → substance="pcn", reaction="rash"
 * e.g. "shellfish" → substance="shellfish", reaction=""
 */
function splitSubstanceAndReaction(words: string[]): { substanceWords: string[]; reactionWords: string[] } {
  // Scan from the end to find where reaction words start
  let reactionStart = words.length;
  for (let i = words.length - 1; i >= 1; i--) {
    if (REACTION_TERMS.has(words[i].toLowerCase())) {
      reactionStart = i;
    } else {
      break;
    }
  }
  return {
    substanceWords: words.slice(0, reactionStart),
    reactionWords: words.slice(reactionStart),
  };
}

function resolveSubstance(substanceText: string): { term: string; isMed: boolean } {
  // Check if entire substance is a known abbreviation
  const abbrev = ALLERGY_ABBREVIATIONS[substanceText.toLowerCase()];
  if (abbrev) return { term: abbrev.term, isMed: abbrev.isMed };
  // Single word — try abbreviation expansion
  const words = substanceText.split(/\s+/);
  if (words.length === 1) {
    const entry = ALLERGY_ABBREVIATIONS[words[0].toLowerCase()];
    if (entry) return { term: entry.term, isMed: entry.isMed };
  }
  // Default: use SNOMED (covers both substances and non-meds).
  // RxNorm is only used when we positively matched a medication abbreviation.
  return { term: substanceText, isMed: false };
}

/**
 * Parse free text into individual allergy terms with reactions.
 * Splits on commas, newlines, and the word "and".
 * Format: "<substance> [reaction]" e.g. "lisinopril swelling", "pcn rash", "shellfish"
 */
export function parseAllergyText(text: string): ParsedAllergyTerm[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const words = segment.split(/\s+/);
      const { substanceWords, reactionWords } = splitSubstanceAndReaction(words);
      const substanceText = substanceWords.join(" ");
      const reaction = reactionWords.join(" ");
      const { term, isMed } = resolveSubstance(substanceText);
      return { term, isMed, reaction };
    });
}

/**
 * Search allergen codes via PhenoML construe semantic search.
 * Uses RxNorm for medication allergens, SNOMED CT for others.
 */
export async function searchAllergyCodes(
  text: string,
  isMed: boolean
): Promise<{ codes: ResolvedAllergyCode[]; error?: string }> {
  try {
    const codesystem = isMed ? "RXNORM" : "SNOMEDCT";
    const params = new URLSearchParams({
      codesystem,
      text,
      limit: "5",
    });
    const response = await fetch(`/api/fhir/construe/semantic?${params}`);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { codes: [], error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { codes: [], error: data.error || "Failed to search allergy codes" };
    }

    const systemUrl = isMed
      ? "http://www.nlm.nih.gov/research/umls/rxnorm"
      : "http://snomed.info/sct";

    const codes: ResolvedAllergyCode[] = (data.results || []).map(
      (r: any) => ({
        code: r.code,
        description: r.description || r.code,
        system: systemUrl,
      })
    );

    return { codes };
  } catch (error) {
    return {
      codes: [],
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ResolvedAllergyEntry {
  /** Original term the user typed (substance only, after parsing) */
  term: string;
  /** Whether this is a medication allergen */
  isMed: boolean;
  /** Reaction parsed from user input */
  reaction: string;
  /** Best code match (if resolved) */
  code?: ResolvedAllergyCode;
}

export interface BatchAllergyResolveResult {
  entries: ResolvedAllergyEntry[];
  error?: string;
}

/**
 * Parse free text into terms, resolve each to RxNorm/SNOMED code in parallel.
 * Supports "<substance> <reaction>" format (e.g. "lisinopril swelling").
 */
export async function batchResolveAllergies(
  text: string
): Promise<BatchAllergyResolveResult> {
  const parsed = parseAllergyText(text);
  if (parsed.length === 0) {
    return { entries: [], error: "No allergens found in text" };
  }

  try {
    const results = await Promise.all(
      parsed.map(async ({ term, isMed, reaction }): Promise<ResolvedAllergyEntry> => {
        const result = await searchAllergyCodes(term, isMed);
        return {
          term,
          isMed,
          reaction,
          code: result.codes[0],
        };
      })
    );
    return { entries: results };
  } catch (error) {
    return {
      entries: parsed.map(({ term, isMed, reaction }) => ({ term, isMed, reaction })),
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AllergySearchResult {
  allergies: AppAllergy[];
  total: number;
  error?: string;
}

/**
 * Fetch a patient's allergies from Medplum via PhenoML
 */
export async function searchFhirAllergies(
  patientFhirId: string
): Promise<AllergySearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/allergy?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        allergies: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        allergies: [],
        total: 0,
        error: data.error || "Failed to fetch allergies",
      };
    }

    const bundle = data as FhirAllergyIntoleranceBundle;
    const allergies = mapFhirBundleToAllergies(bundle);

    return {
      allergies,
      total: bundle.total ?? allergies.length,
    };
  } catch (error) {
    return {
      allergies: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AllergyUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Write an allergy back to Medplum via PUT upsert.
 */
export async function upsertFhirAllergy(
  allergy: AppAllergy,
  patientFhirId: string
): Promise<AllergyUpsertResult> {
  if (!allergy.fhirId) {
    return {
      success: false,
      error: "Allergy has no FHIR ID - cannot write back to Medplum",
    };
  }

  try {
    const fhirResource = mapAppAllergyToFhirAllergy(allergy, patientFhirId);

    const response = await fetch("/api/fhir/allergy", {
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
      return {
        success: false,
        error: data.error || "Failed to save allergy to Medplum",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AllergyDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Delete an allergy from Medplum via DELETE.
 */
export async function deleteFhirAllergy(
  allergyFhirId: string
): Promise<AllergyDeleteResult> {
  try {
    const response = await fetch(
      `/api/fhir/allergy?id=${encodeURIComponent(allergyFhirId)}`,
      { method: "DELETE" }
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to delete allergy from Medplum",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AllergyCreateResult {
  success: boolean;
  allergyFhirId?: string;
  error?: string;
}

/**
 * Create a new allergy in Medplum via POST.
 */
export async function createFhirAllergy(
  allergy: AppAllergy,
  patientFhirId: string
): Promise<AllergyCreateResult> {
  try {
    const fhirResource = mapAppAllergyToFhirAllergy(allergy, patientFhirId);
    // Remove id for creation (let Medplum assign it)
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/allergy", {
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
      return {
        success: false,
        error: data.error || "Failed to create allergy in Medplum",
      };
    }

    return { success: true, allergyFhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
