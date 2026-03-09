import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const imagingOrderSchema = z.object({
  patientId: z.string().min(1),
  studyName: z.string().optional(),
  loincCode: z.string().optional(),
  loincDisplay: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  authoredOn: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "imagingOrder",
  schema: imagingOrderSchema,
  label: "imaging order",
})
