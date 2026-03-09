import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const careTeamSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  pcpUserId: z.string().optional(),
  codingSystem: z.string().optional(),
  codingCode: z.string().optional(),
  codingDisplay: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "careTeamMember",
  schema: careTeamSchema,
  label: "care team member",
})
