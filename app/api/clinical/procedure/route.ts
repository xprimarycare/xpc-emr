import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const procedureSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  status: z.string().optional(),
  performedDate: z.string().optional(),
  bodySite: z.string().optional(),
  outcome: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "procedure",
  schema: procedureSchema,
  label: "procedure",
})
