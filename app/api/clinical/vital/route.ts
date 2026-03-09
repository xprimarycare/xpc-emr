import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const vitalSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  name: z.string().optional(),
  loincCode: z.string().optional(),
  loincDisplay: z.string().optional(),
  status: z.string().optional(),
  effectiveDateTime: z.string().optional(),
  value: z.string().optional(),
  unit: z.string().optional(),
  systolic: z.string().optional(),
  diastolic: z.string().optional(),
  note: z.string().optional(),
})

const handlers = createClinicalCrudHandlers({
  model: "vital",
  schema: vitalSchema,
  label: "vital",
})

export const { GET, POST, PUT } = handlers
