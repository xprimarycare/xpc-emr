import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { SignOutButton } from "./SignOutButton"
import { ProfileForm } from "./ProfileForm"

export default async function AccountPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const { user } = session

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto pt-16 px-4">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          &larr; Back to app
        </Link>

        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div className="flex items-center gap-4">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || ""}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-lg font-medium text-gray-600">
                  {user.name?.[0] || "?"}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {user.name || "Unknown"}
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="inline-block mt-1 text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                {user.role === 'admin' ? 'Admin' : 'Clinician'}
              </span>
            </div>
          </div>

          <hr className="border-gray-200" />

          <ProfileForm institution={user.institution} npi={user.npi} />

          {user.role === "admin" && (
            <>
              <hr className="border-gray-200" />
              <Link
                href="/admin"
                className="block text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                User Management &rarr;
              </Link>
            </>
          )}

          <hr className="border-gray-200" />

          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
