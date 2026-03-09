import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const taskSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  status: z.string().optional(),
  intent: z.string().optional(),
  priority: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  authoredOn: z.string().optional(),
})

const handlers = createClinicalCrudHandlers({
  model: "task",
  schema: taskSchema,
  label: "task",
})

export const { GET, POST, PUT } = handlers
