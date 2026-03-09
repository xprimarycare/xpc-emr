import { faker } from "@faker-js/faker";
import { getPhenomlClient } from "@/lib/phenoml/client";
import { CLONEABLE_RESOURCE_TYPES } from "@/lib/data/cloneable-resource-types";
import { isLocalBackendClient } from "@/lib/emr-backend";

function getProviderId() {
  return process.env.PHENOML_FHIR_PROVIDER_ID;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function generateFakePatientName(gender: string): { given: string[]; family: string } {
  const sex =
    gender === "male" ? "male" :
    gender === "female" ? "female" :
    undefined;
  const given = [sex ? faker.person.firstName(sex) : faker.person.firstName()];
  const family = faker.person.lastName();
  return { given, family };
}

export function generateFakePatientDob(sourceBirthDate: string): string {
  const now = Date.now();
  const birthMs = new Date(sourceBirthDate).getTime();
  if (isNaN(birthMs)) return sourceBirthDate; // guard: return original if unparseable
  const currentAge = Math.floor((now - birthMs) / MS_PER_YEAR);
  const latestMs = now - currentAge * MS_PER_YEAR;
  const earliestMs = now - (currentAge + 1) * MS_PER_YEAR + 86_400_000;
  const randomMs = earliestMs + Math.random() * (latestMs - earliestMs);
  return new Date(randomMs).toISOString().split("T")[0];
}

const ENCOUNTER_SIGNATURE_EXT =
  "http://phenoml.com/fhir/StructureDefinition/encounter-signature";

// Build RESOURCE_TYPE_MAP from the shared definition (excludes special-cased types like "encounters")
const RESOURCE_TYPE_MAP: Record<
  string,
  { resourceType: string; searchParam: string; extraParams?: Record<string, string> }
> = Object.fromEntries(
  CLONEABLE_RESOURCE_TYPES
    .filter((rt) => rt.fhir)
    .map((rt) => [rt.key, rt.fhir!])
);

export interface CloneEncounterOptions {
  sourcePatientFhirId: string;
  sourceEncounterFhirId: string;
  targetPatientFhirId: string;
  includeNoteText: boolean;
}

export interface CloneEncounterResult {
  encounterFhirId?: string;
  clinicalImpressionFhirId?: string;
  error?: string;
}

function prepareEncounterClone(sourceEnc: any, targetPatientFhirId: string): any {
  const cloned = JSON.parse(JSON.stringify(sourceEnc));
  delete cloned.id;
  delete cloned.meta;
  cloned.status = "planned";
  cloned.subject = { reference: `Patient/${targetPatientFhirId}` };
  cloned.extension = (cloned.extension || []).filter(
    (ext: any) => ext.url !== ENCOUNTER_SIGNATURE_EXT
  );
  if (cloned.extension.length === 0) delete cloned.extension;
  return cloned;
}

/**
 * Clone an Encounter + its ClinicalImpression for a target patient.
 * Strips IDs, removes signing extension, sets status to "planned",
 * optionally clears note text.
 */
export async function cloneEncounter(
  options: CloneEncounterOptions
): Promise<CloneEncounterResult> {
  if (isLocalBackendClient()) {
    return { error: "Single encounter cloning not supported in local mode yet" };
  }

  const providerId = getProviderId();
  if (!providerId) return { error: "FHIR provider not configured" };
  const client = getPhenomlClient();

  try {
    // Fetch source encounter
    const encBundle = await client.fhir.search(providerId, "Encounter", {}, {
      queryParams: { _id: options.sourceEncounterFhirId, _count: "1" },
    });
    const sourceEnc = (encBundle as any)?.entry?.[0]?.resource;
    if (!sourceEnc) return { error: "Source encounter not found" };

    // Clone encounter: strip ID, remove signing ext, update patient ref, set status
    const clonedEnc = prepareEncounterClone(sourceEnc, options.targetPatientFhirId);

    const newEnc = (await client.fhir.create(providerId, "Encounter", {
      body: clonedEnc,
    })) as any;
    const encounterFhirId = newEnc?.id;
    if (!encounterFhirId) return { error: "Failed to create cloned encounter" };

    // Fetch ClinicalImpressions for this specific encounter
    const ciBundle = await client.fhir.search(
      providerId,
      "ClinicalImpression",
      {},
      {
        queryParams: {
          subject: `Patient/${options.sourcePatientFhirId}`,
          encounter: `Encounter/${options.sourceEncounterFhirId}`,
          _count: "100",
        },
      }
    );
    const clinicalImpressions = ((ciBundle as any)?.entry || [])
      .map((e: any) => e.resource)
      .filter(Boolean);

    let clinicalImpressionFhirId: string | undefined;
    for (const sourceCI of clinicalImpressions) {
      const clonedCI = JSON.parse(JSON.stringify(sourceCI));
      delete clonedCI.id;
      delete clonedCI.meta;
      clonedCI.status = "in-progress";
      clonedCI.subject = { reference: `Patient/${options.targetPatientFhirId}` };
      clonedCI.encounter = { reference: `Encounter/${encounterFhirId}` };

      // Optionally clear note text
      if (!options.includeNoteText && clonedCI.note) {
        clonedCI.note = clonedCI.note.map((n: any) => ({ ...n, text: "" }));
      }

      const newCI = (await client.fhir.create(
        providerId,
        "ClinicalImpression",
        { body: clonedCI }
      )) as any;
      if (newCI?.id) clinicalImpressionFhirId = newCI.id;
    }

    return { encounterFhirId, clinicalImpressionFhirId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to clone encounter",
    };
  }
}

export interface ClonePatientOptions {
  sourcePatientFhirId: string;
  resourceTypes: string[]; // keys from RESOURCE_TYPE_MAP
  overrideName?: { given: string[]; family: string };
  overrideBirthDate?: string;
  overrideGender?: string;
}

export interface ClonePatientResult {
  newPatientFhirId?: string;
  clonedCounts: Record<string, number>;
  errors: string[];
}

/**
 * Clone a Patient and selected associated resources.
 * Creates a new Patient, then for each selected resource type,
 * searches all resources for the source patient, clones them with
 * updated subject references to the new patient.
 */
export async function clonePatient(
  options: ClonePatientOptions
): Promise<ClonePatientResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePatientId: options.sourcePatientFhirId,
          newName: options.overrideName
            ? options.overrideName.given[0] + " " + options.overrideName.family
            : undefined,
          newDob: options.overrideBirthDate,
          newSex: options.overrideGender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { clonedCounts: {}, errors: [data.error || "Failed to clone patient"] };
      }
      return {
        newPatientFhirId: data.id,
        clonedCounts: data.clonedCounts || {},
        errors: [],
      };
    } catch (error) {
      return {
        clonedCounts: {},
        errors: [error instanceof Error ? error.message : "Network error"],
      };
    }
  }

  const clonedCounts: Record<string, number> = {};
  const errors: string[] = [];

  const providerId = getProviderId();
  if (!providerId) return { errors: ["FHIR provider not configured"], clonedCounts };
  const client = getPhenomlClient();

  try {
    // Fetch source patient
    const patBundle = await client.fhir.search(providerId, "Patient", {}, {
      queryParams: { _id: options.sourcePatientFhirId, _count: "1" },
    });
    const sourcePatient = (patBundle as any)?.entry?.[0]?.resource;
    if (!sourcePatient) return { errors: ["Source patient not found"], clonedCounts };

    // Clone patient with a generated name + DOB to avoid duplicate names
    const clonedPatient = JSON.parse(JSON.stringify(sourcePatient));
    delete clonedPatient.id;
    delete clonedPatient.meta;

    const { given, family } = options.overrideName ?? generateFakePatientName(sourcePatient.gender ?? "unknown");
    clonedPatient.name = [{ given, family }];
    if (options.overrideBirthDate) {
      clonedPatient.birthDate = options.overrideBirthDate;
    } else if (sourcePatient.birthDate) {
      clonedPatient.birthDate = generateFakePatientDob(sourcePatient.birthDate);
    }
    if (options.overrideGender) {
      clonedPatient.gender = options.overrideGender;
    }

    const newPatient = (await client.fhir.create(providerId, "Patient", {
      body: clonedPatient,
    })) as any;
    const newPatientFhirId = newPatient?.id;
    if (!newPatientFhirId) {
      return { errors: ["Failed to create cloned patient"], clonedCounts };
    }

    // Separate encounters (special handling) from normal resource types
    const normalTypes = options.resourceTypes.filter((t) => t !== "encounters");
    const includeEncounters = options.resourceTypes.includes("encounters");

    // Clone normal resource types in parallel
    await Promise.all(
      normalTypes.map(async (typeKey) => {
        const mapping = RESOURCE_TYPE_MAP[typeKey];
        if (!mapping) {
          errors.push(`Unknown resource type: ${typeKey}`);
          return;
        }

        try {
          const queryParams: Record<string, string> = {
            [mapping.searchParam]: `Patient/${options.sourcePatientFhirId}`,
            _count: "200",
            ...mapping.extraParams,
          };

          const bundle = await client.fhir.search(
            providerId!,
            mapping.resourceType,
            {},
            { queryParams }
          );
          const entries = ((bundle as any)?.entry || [])
            .map((e: any) => e.resource)
            .filter(Boolean);

          const created = await Promise.all(
            entries.map(async (resource: any) => {
              const cloned = JSON.parse(JSON.stringify(resource));
              delete cloned.id;
              delete cloned.meta;

              if (cloned.subject?.reference) {
                cloned.subject.reference = `Patient/${newPatientFhirId}`;
              }
              if (cloned.patient?.reference) {
                cloned.patient.reference = `Patient/${newPatientFhirId}`;
              }

              return client.fhir.create(providerId!, mapping.resourceType, {
                body: cloned,
              });
            })
          );

          clonedCounts[typeKey] = created.filter(Boolean).length;
        } catch (err) {
          errors.push(
            `Failed to clone ${typeKey}: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      })
    );

    // Clone encounters (+ their ClinicalImpressions) if selected
    if (includeEncounters) {
      try {
        const encBundle = await client.fhir.search(providerId!, "Encounter", {}, {
          queryParams: {
            subject: `Patient/${options.sourcePatientFhirId}`,
            _count: "200",
          },
        });
        const encounters = ((encBundle as any)?.entry || [])
          .map((e: any) => e.resource)
          .filter(Boolean);

        const results = await Promise.all(
          encounters.map(async (sourceEnc: any) => {
            const clonedEnc = prepareEncounterClone(sourceEnc, newPatientFhirId);
            const newEnc = (await client.fhir.create(providerId!, "Encounter", {
              body: clonedEnc,
            })) as any;
            if (!newEnc?.id) return false;

            // Clone ClinicalImpressions for this encounter
            const ciBundle = await client.fhir.search(
              providerId!,
              "ClinicalImpression",
              {},
              {
                queryParams: {
                  subject: `Patient/${options.sourcePatientFhirId}`,
                  encounter: `Encounter/${sourceEnc.id}`,
                  _count: "100",
                },
              }
            );
            const impressions = ((ciBundle as any)?.entry || [])
              .map((e: any) => e.resource)
              .filter(Boolean);

            await Promise.all(
              impressions.map(async (sourceCI: any) => {
                const clonedCI = JSON.parse(JSON.stringify(sourceCI));
                delete clonedCI.id;
                delete clonedCI.meta;
                clonedCI.status = "in-progress";
                clonedCI.subject = { reference: `Patient/${newPatientFhirId}` };
                clonedCI.encounter = { reference: `Encounter/${newEnc.id}` };
                await client.fhir.create(providerId!, "ClinicalImpression", {
                  body: clonedCI,
                });
              })
            );
            return true;
          })
        );
        clonedCounts["encounters"] = results.filter(Boolean).length;
      } catch (err) {
        errors.push(
          `Failed to clone encounters: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    return { newPatientFhirId, clonedCounts, errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to clone patient");
    return { clonedCounts, errors };
  }
}
