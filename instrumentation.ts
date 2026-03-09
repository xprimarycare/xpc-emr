export async function register() {
  // Load DB-backed config into process.env on server startup
  // so synchronous helpers like getEmrBackend() pick up the DB value.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { loadEmrBackendFromDb } = await import("@/lib/app-config")
      await loadEmrBackendFromDb()
    } catch (error) {
      // DB unavailable at startup — fall back to EMR_BACKEND env var.
      // getEmrBackend() defaults to "medplum" if unset.
      console.warn("[instrumentation] Failed to load EMR_BACKEND from DB, falling back to env var:", error)
    }
  }
}
