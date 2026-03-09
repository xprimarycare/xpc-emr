import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const labOrderSchema = z.object({
  patientId: z.string().min(1),
  testName: z.string().optional(),
  loincCode: z.string().optional(),
  loincDisplay: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  authoredOn: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "labOrder",
  schema: labOrderSchema,
  label: "lab order",
})
