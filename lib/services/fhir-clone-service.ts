import { phenomlClient } from "@/lib/phenoml/client";
import { CLONEABLE_RESOURCE_TYPES } from "@/lib/data/cloneable-resource-types";

const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

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

/**
 * Clone an Encounter + its ClinicalImpression for a target patient.
 * Strips IDs, removes signing extension, sets status to "planned",
 * optionally clears note text.
 */
export async function cloneEncounter(
  options: CloneEncounterOptions
): Promise<CloneEncounterResult> {
  if (!providerId) return { error: "FHIR provider not configured" };

  try {
    // Fetch source encounter
    const encBundle = await phenomlClient.fhir.search(providerId, "Encounter", {}, {
      queryParams: { _id: options.sourceEncounterFhirId, _count: "1" },
    });
    const sourceEnc = (encBundle as any)?.entry?.[0]?.resource;
    if (!sourceEnc) return { error: "Source encounter not found" };

    // Clone encounter: strip ID, remove signing ext, update patient ref, set status
    const clonedEnc = JSON.parse(JSON.stringify(sourceEnc));
    delete clonedEnc.id;
    delete clonedEnc.meta;
    clonedEnc.status = "planned";
    clonedEnc.subject = { reference: `Patient/${options.targetPatientFhirId}` };
    clonedEnc.extension = (clonedEnc.extension || []).filter(
      (ext: any) => ext.url !== ENCOUNTER_SIGNATURE_EXT
    );
    if (clonedEnc.extension.length === 0) delete clonedEnc.extension;

    const newEnc = (await phenomlClient.fhir.create(providerId, "Encounter", {
      body: clonedEnc,
    })) as any;
    const encounterFhirId = newEnc?.id;
    if (!encounterFhirId) return { error: "Failed to create cloned encounter" };

    // Fetch ClinicalImpressions for this specific encounter
    const ciBundle = await phenomlClient.fhir.search(
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

      const newCI = (await phenomlClient.fhir.create(
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
  const clonedCounts: Record<string, number> = {};
  const errors: string[] = [];

  if (!providerId) return { errors: ["FHIR provider not configured"], clonedCounts };

  try {
    // Fetch source patient
    const patBundle = await phenomlClient.fhir.search(providerId, "Patient", {}, {
      queryParams: { _id: options.sourcePatientFhirId, _count: "1" },
    });
    const sourcePatient = (patBundle as any)?.entry?.[0]?.resource;
    if (!sourcePatient) return { errors: ["Source patient not found"], clonedCounts };

    // Clone patient
    const clonedPatient = JSON.parse(JSON.stringify(sourcePatient));
    delete clonedPatient.id;
    delete clonedPatient.meta;

    const newPatient = (await phenomlClient.fhir.create(providerId, "Patient", {
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

          const bundle = await phenomlClient.fhir.search(
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

              await phenomlClient.fhir.create(providerId!, mapping.resourceType, {
                body: cloned,
              });
            })
          );

          clonedCounts[typeKey] = created.length;
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
        const encBundle = await phenomlClient.fhir.search(providerId!, "Encounter", {}, {
          queryParams: {
            subject: `Patient/${options.sourcePatientFhirId}`,
            _count: "200",
          },
        });
        const encounters = ((encBundle as any)?.entry || [])
          .map((e: any) => e.resource)
          .filter(Boolean);

        let encounterCount = 0;
        for (const sourceEnc of encounters) {
          const clonedEnc = JSON.parse(JSON.stringify(sourceEnc));
          delete clonedEnc.id;
          delete clonedEnc.meta;
          clonedEnc.status = "planned";
          clonedEnc.subject = { reference: `Patient/${newPatientFhirId}` };
          clonedEnc.extension = (clonedEnc.extension || []).filter(
            (ext: any) => ext.url !== ENCOUNTER_SIGNATURE_EXT
          );
          if (clonedEnc.extension.length === 0) delete clonedEnc.extension;

          const newEnc = (await phenomlClient.fhir.create(providerId!, "Encounter", {
            body: clonedEnc,
          })) as any;
          if (!newEnc?.id) continue;
          encounterCount++;

          // Clone ClinicalImpressions for this encounter
          const ciBundle = await phenomlClient.fhir.search(
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

          for (const sourceCI of impressions) {
            const clonedCI = JSON.parse(JSON.stringify(sourceCI));
            delete clonedCI.id;
            delete clonedCI.meta;
            clonedCI.status = "in-progress";
            clonedCI.subject = { reference: `Patient/${newPatientFhirId}` };
            clonedCI.encounter = { reference: `Encounter/${newEnc.id}` };
            await phenomlClient.fhir.create(providerId!, "ClinicalImpression", {
              body: clonedCI,
            });
          }
        }
        clonedCounts["encounters"] = encounterCount;
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
