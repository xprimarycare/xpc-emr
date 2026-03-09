import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { UserManagement } from "./UserManagement"

export default async function AdminPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto pt-16 px-4">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          &larr; Back to app
        </Link>

        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage user roles and access</p>
          </div>

          <hr className="border-gray-200" />

          <UserManagement currentUserId={session.user.id} />

        </div>

        <div className="mt-4">
          <Link
            href="/admin/settings"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            System Settings &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
