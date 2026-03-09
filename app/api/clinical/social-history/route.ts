import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const socialHistorySchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  status: z.string().optional(),
  value: z.string().optional(),
  effectiveDate: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  valueCodingSystem: z.string().optional(),
  valueCodingCode: z.string().optional(),
  valueCodingDisplay: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "socialHistory",
  schema: socialHistorySchema,
  label: "social history",
})
