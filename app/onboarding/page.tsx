import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { OnboardingForm } from "./OnboardingForm"

export default async function OnboardingPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.onboardingComplete) {
    redirect("/")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-lg w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Welcome, {session.user.name}! Please provide your clinical details.
          </p>
        </div>
        <OnboardingForm
          userName={session.user.name || ""}
          userEmail={session.user.email}
        />
      </div>
    </div>
  )
}
