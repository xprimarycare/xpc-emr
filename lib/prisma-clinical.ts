import { PrismaClient } from "@/app/generated/prisma-clinical/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { isLocalBackend } from "@/lib/emr-backend"

const globalForPrisma = globalThis as unknown as {
  prismaClinical: PrismaClient | undefined
}

function createClinicalClient(): PrismaClient {
  const connectionString = process.env.CLINICAL_DATABASE_URL
  if (!connectionString) {
    throw new Error("Missing CLINICAL_DATABASE_URL environment variable")
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

function getClinicalClient(): PrismaClient {
  if (!globalForPrisma.prismaClinical) {
    if (!process.env.CLINICAL_DATABASE_URL && !isLocalBackend()) {
      throw new Error(
        "prismaClinical was accessed but CLINICAL_DATABASE_URL is not set. " +
        "This client should only be used when EMR_BACKEND=local."
      )
    }
    globalForPrisma.prismaClinical = createClinicalClient()
  }
  return globalForPrisma.prismaClinical
}

export const prismaClinical = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClinicalClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})
