import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const allergySchema = z.object({
  patientId: z.string().min(1),
  substance: z.string().optional(),
  clinicalStatus: z.string().optional(),
  verificationStatus: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  criticality: z.string().optional(),
  reaction: z.string().optional(),
  severity: z.string().optional(),
  recordedDate: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "allergy",
  schema: allergySchema,
  label: "allergy",
})
