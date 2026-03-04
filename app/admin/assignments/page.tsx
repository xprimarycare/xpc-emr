import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { AssignmentManagement } from "./AssignmentManagement"

export default async function AssignmentsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto pt-16 px-4">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          &larr; Back to app
        </Link>

        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Case Assignments</h1>
            <p className="text-sm text-gray-500 mt-1">Assign patients to clinicians and manage assignments</p>
          </div>

          <hr className="border-gray-200" />

          <AssignmentManagement />
        </div>
      </div>
    </div>
  )
}
