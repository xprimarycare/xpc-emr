import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getConfig } from "@/lib/app-config"
import { EmrBackendToggle } from "./EmrBackendToggle"

export default async function SettingsPage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/")

  const currentBackend = (await getConfig("EMR_BACKEND")) || process.env.EMR_BACKEND || "medplum"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-16 px-4">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          &larr; Back to admin
        </Link>

        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">System configuration</p>
          </div>

          <hr className="border-gray-200" />

          <EmrBackendToggle initialValue={currentBackend} />
        </div>
      </div>
    </div>
  )
}
