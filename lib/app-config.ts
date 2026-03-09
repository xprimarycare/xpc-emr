import { prisma } from "@/lib/prisma"

/** Read a config value from the app_config table. */
export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } })
  return row?.value ?? null
}

/** Write a config value to the app_config table. */
export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/** Read all config key-value pairs. */
export async function getAllConfig(): Promise<Record<string, string>> {
  const rows = await prisma.appConfig.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

/**
 * Load EMR_BACKEND from DB into process.env so the existing
 * synchronous getEmrBackend() picks it up without refactoring.
 */
export async function loadEmrBackendFromDb(): Promise<void> {
  const value = await getConfig("EMR_BACKEND")
  if (value) {
    process.env.EMR_BACKEND = value
    process.env.NEXT_PUBLIC_EMR_BACKEND = value
  }
}
