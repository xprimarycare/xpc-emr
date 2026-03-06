import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { RegisterForm } from "./RegisterForm"

export default async function RegisterPage() {
  const session = await auth()
  if (session) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">XPC EMR</h1>
          <p className="mt-2 text-sm text-gray-500">
            Create an account
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
