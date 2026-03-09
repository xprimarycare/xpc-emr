import { z } from "zod"
import { createClinicalCrudHandlers } from "@/lib/clinical-crud-factory"

const referralSchema = z.object({
  patientId: z.string().min(1),
  referralType: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  referredTo: z.string().optional(),
  reason: z.string().optional(),
  authoredOn: z.string().optional(),
  note: z.string().optional(),
})

export const { GET, POST, PUT, DELETE } = createClinicalCrudHandlers({
  model: "referral",
  schema: referralSchema,
  label: "referral",
})
