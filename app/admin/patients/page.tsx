import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PatientLibrary } from "./PatientLibrary"

export default async function PatientsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto pt-8 px-4 pb-12">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
        >
          &larr; Back to admin
        </Link>

        <PatientLibrary />
      </div>
    </div>
  )
}
