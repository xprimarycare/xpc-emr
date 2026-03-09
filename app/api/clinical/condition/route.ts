import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const conditionSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  clinicalStatus: z.string().optional(),
  verificationStatus: z.string().optional(),
  severity: z.string().optional(),
  onsetDate: z.string().optional(),
  abatementDate: z.string().optional(),
  recordedDate: z.string().optional(),
  bodySite: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "condition",
  schema: conditionSchema,
  label: "condition",
})
