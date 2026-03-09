"use client"

import { useState } from "react"

export function EmrBackendToggle({ initialValue }: { initialValue: string }) {
  const [backend, setBackend] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")

  async function handleToggle(value: string) {
    setSaving(true)
    setStatus("idle")
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "EMR_BACKEND", value }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setBackend(value)
      setStatus("saved")
    } catch {
      setStatus("error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-gray-900">EMR Backend</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Choose where clinical data is stored. Changes take effect immediately for new requests.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleToggle("local")}
          disabled={saving}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            backend === "local"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Local Database
        </button>
        <button
          onClick={() => handleToggle("medplum")}
          disabled={saving}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            backend === "medplum"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Medplum (FHIR)
        </button>
      </div>

      {saving && <p className="text-xs text-gray-500">Saving...</p>}
      {status === "saved" && (
        <p className="text-xs text-green-600">Saved. New requests will use the {backend} backend.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-600">Failed to save. Please try again.</p>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600">
          <strong>Local Database</strong>: Uses your own PostgreSQL database for all clinical data (encounters, medications, labs, etc). No external API calls.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          <strong>Medplum (FHIR)</strong>: Uses Medplum&apos;s FHIR server for clinical data. Requires Medplum credentials and PhenoML configuration.
        </p>
      </div>
    </div>
  )
}
