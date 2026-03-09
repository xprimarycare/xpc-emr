import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const medicationSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  dose: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().optional(),
  status: z.string().optional(),
  authoredOn: z.string().optional(),
  dosageText: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

const handlers = createClinicalCrudHandlers({
  model: "medication",
  schema: medicationSchema,
  label: "medication",
})

export const { GET, POST, PUT } = handlers
