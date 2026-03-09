import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const encounterSchema = z.object({
  patientId: z.string().min(1),
  status: z.string().optional(),
  classCode: z.string().optional(),
  classDisplay: z.string().optional(),
  date: z.string().optional(),
  endDate: z.string().optional(),
  noteText: z.string().optional(),
  isSigned: z.boolean().optional(),
  signedAt: z.string().optional(),
  signedBy: z.string().optional(),
  signedById: z.string().optional(),
})

const handlers = createClinicalCrudHandlers({
  model: "encounter",
  schema: encounterSchema,
  label: "encounter",
})

export const { GET, POST, PUT } = handlers
