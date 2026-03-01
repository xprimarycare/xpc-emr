import { FhirCareTeamBundle } from "@/lib/types/fhir";
import { AppCareTeamMember } from "@/lib/types/care-team";
import {
  mapFhirBundleToCareTeamMembers,
  mapAppCareTeamMemberToFhirCareTeam,
} from "@/lib/phenoml/fhir-mapper";

export interface ResolvedSpecialtyCode {
  code: string;
  description: string;
  system: string;
}

// Common specialist abbreviations → expanded terms for SNOMED semantic search
const SPECIALIST_ABBREVIATIONS: Record<string, string> = {
  pcp: 'primary care provider',
  gi: 'gastroenterologist',
  ent: 'otorhinolaryngologist',
  psych: 'psychiatrist',
  neuro: 'neurologist',
  ortho: 'orthopedic surgeon',
  derm: 'dermatologist',
  uro: 'urologist',
  pulm: 'pulmonologist',
  rheum: 'rheumatologist',
  onc: 'oncologist',
  endo: 'endocrinologist',
  nephro: 'nephrologist',
  ophtho: 'ophthalmologist',
  ob: 'obstetrician',
  gyn: 'gynecologist',
  obgyn: 'obstetrician gynecologist',
  id: 'infectious disease specialist',
  cards: 'cardiologist',
  cardio: 'cardiologist',
  hem: 'hematologist',
  hemonc: 'hematologist oncologist',
  pt: 'physical therapist',
  ot: 'occupational therapist',
  slp: 'speech language pathologist',
  sw: 'social worker',
  lcsw: 'licensed clinical social worker',
  np: 'nurse practitioner',
  pa: 'physician assistant',
  rn: 'registered nurse',
  rd: 'registered dietitian',
};

// Set of known role terms (both abbreviation keys and their expanded values, plus
// common single-word specialties) so trailing-word detection works with full words too.
const KNOWN_ROLE_TERMS: Set<string> = new Set([
  ...Object.keys(SPECIALIST_ABBREVIATIONS),
  ...Object.values(SPECIALIST_ABBREVIATIONS).flatMap(v => v.split(/\s+/).length === 1 ? [v] : []),
  // Common single-word specialties that users might type without a dash
  'cardiology', 'neurology', 'psychiatry', 'dermatology', 'urology',
  'pulmonology', 'rheumatology', 'oncology', 'endocrinology', 'nephrology',
  'ophthalmology', 'hematology', 'gastroenterology', 'pediatrics', 'radiology',
  'anesthesiology', 'pathology', 'surgery', 'ortho', 'orthopedics',
  'cardiologist', 'neurologist', 'psychiatrist', 'dermatologist', 'urologist',
  'pulmonologist', 'rheumatologist', 'oncologist', 'endocrinologist', 'nephrologist',
  'ophthalmologist', 'hematologist', 'gastroenterologist', 'pediatrician', 'radiologist',
  'anesthesiologist', 'pathologist', 'surgeon', 'orthopedist',
]);

interface ParsedCareTeamEntry {
  /** Provider name */
  name: string;
  /** Role/specialty (expanded from abbreviations) */
  role: string;
}

/**
 * Parse free text into care team entries.
 * Splits on newlines/commas, then splits each segment on " - " to separate name from role.
 * Format: "Dr. Smith - Cardiology" or "Jane Doe - PCP"
 */
export function parseCareTeamText(text: string): ParsedCareTeamEntry[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const dashIdx = segment.indexOf(' - ');
      let name: string;
      let rawRole: string;

      if (dashIdx !== -1) {
        name = segment.slice(0, dashIdx).trim();
        rawRole = segment.slice(dashIdx + 3).trim();
      } else {
        // No dash — check if the last word is a known role/specialty term
        const words = segment.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (words.length > 1 && KNOWN_ROLE_TERMS.has(lastWord.toLowerCase())) {
          name = words.slice(0, -1).join(' ');
          rawRole = lastWord;
        } else {
          name = segment;
          rawRole = '';
        }
      }

      // Expand abbreviation if the role is a known abbreviation
      const role = rawRole
        ? (SPECIALIST_ABBREVIATIONS[rawRole.toLowerCase()] || rawRole)
        : '';

      return { name, role };
    });
}

/**
 * Search specialty codes via PhenoML construe semantic search (SNOMED CT).
 */
export async function searchSpecialtyCodes(
  text: string
): Promise<{ codes: ResolvedSpecialtyCode[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      codesystem: 'SNOMEDCT',
      text,
      limit: '5',
    });
    const response = await fetch(`/api/fhir/construe/semantic?${params}`);

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { codes: [], error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { codes: [], error: data.error || 'Failed to search specialty codes' };
    }

    const codes: ResolvedSpecialtyCode[] = (data.results || []).map(
      (r: any) => ({
        code: r.code,
        description: r.description || r.code,
        system: 'http://snomed.info/sct',
      })
    );

    return { codes };
  } catch (error) {
    return {
      codes: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export interface ResolvedCareTeamEntry {
  /** Provider name */
  name: string;
  /** Role/specialty text */
  role: string;
  /** Best SNOMED code match (if resolved) */
  code?: ResolvedSpecialtyCode;
}

export interface BatchCareTeamResolveResult {
  entries: ResolvedCareTeamEntry[];
  error?: string;
}

/**
 * Parse free text into care team entries, resolve each role to SNOMED code in parallel.
 */
export async function batchResolveCareTeamMembers(
  text: string
): Promise<BatchCareTeamResolveResult> {
  const parsed = parseCareTeamText(text);
  if (parsed.length === 0) {
    return { entries: [], error: 'No care team members found in text' };
  }

  try {
    const results = await Promise.all(
      parsed.map(async ({ name, role }): Promise<ResolvedCareTeamEntry> => {
        if (!role) {
          return { name, role };
        }
        const result = await searchSpecialtyCodes(role);
        return {
          name,
          role,
          code: result.codes[0],
        };
      })
    );
    return { entries: results };
  } catch (error) {
    return {
      entries: parsed.map(({ name, role }) => ({ name, role })),
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// --- CRUD functions ---

export interface CareTeamSearchResult {
  members: AppCareTeamMember[];
  total: number;
  error?: string;
}

export async function searchFhirCareTeamMembers(
  patientFhirId: string
): Promise<CareTeamSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/care-team?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { members: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { members: [], total: 0, error: data.error || 'Failed to fetch care team' };
    }

    const bundle = data as FhirCareTeamBundle;
    const members = mapFhirBundleToCareTeamMembers(bundle);

    return { members, total: bundle.total ?? members.length };
  } catch (error) {
    return {
      members: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export interface CareTeamUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirCareTeamMember(
  member: AppCareTeamMember,
  patientFhirId: string
): Promise<CareTeamUpsertResult> {
  if (!member.fhirId) {
    return { success: false, error: 'Care team member has no FHIR ID - cannot write back' };
  }

  try {
    const fhirResource = mapAppCareTeamMemberToFhirCareTeam(member, patientFhirId);

    const response = await fetch('/api/fhir/care-team', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to save care team member' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export interface CareTeamDeleteResult {
  success: boolean;
  error?: string;
}

export async function deleteFhirCareTeamMember(
  fhirId: string
): Promise<CareTeamDeleteResult> {
  try {
    const response = await fetch(
      `/api/fhir/care-team?id=${encodeURIComponent(fhirId)}`,
      { method: 'DELETE' }
    );

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete care team member' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export interface CareTeamCreateResult {
  success: boolean;
  careTeamFhirId?: string;
  error?: string;
}

export async function createFhirCareTeamMember(
  member: AppCareTeamMember,
  patientFhirId: string
): Promise<CareTeamCreateResult> {
  try {
    const fhirResource = mapAppCareTeamMemberToFhirCareTeam(member, patientFhirId);
    delete (fhirResource as any).id;

    const response = await fetch('/api/fhir/care-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to create care team member' };
    }

    return { success: true, careTeamFhirId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}
