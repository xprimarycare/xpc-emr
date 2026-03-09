export type EmrBackend = "local" | "medplum";

/** Server-side: reads from EMR_BACKEND env var. Defaults to "medplum". */
export function getEmrBackend(): EmrBackend {
  const backend = process.env.EMR_BACKEND?.toLowerCase();
  if (backend === "local") return "local";
  return "medplum";
}

export function isLocalBackend(): boolean {
  return getEmrBackend() === "local";
}

export function isMedplumBackend(): boolean {
  return getEmrBackend() === "medplum";
}

/** Client-side: reads from NEXT_PUBLIC_EMR_BACKEND (exposed via next.config.ts). */
export function getEmrBackendClient(): EmrBackend {
  const backend = (
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_EMR_BACKEND
      : process.env.EMR_BACKEND
  )?.toLowerCase();
  if (backend === "local") return "local";
  return "medplum";
}

export function isLocalBackendClient(): boolean {
  return getEmrBackendClient() === "local";
}
