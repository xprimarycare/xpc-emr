export async function register() {
  // Load DB-backed config into process.env on server startup
  // so synchronous helpers like getEmrBackend() pick up the DB value.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEmrBackendFromDb } = await import("@/lib/app-config")
    await loadEmrBackendFromDb()
  }
}
