import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { PatientListPanel } from "@/components/panels/PatientListPanel";
import { CaseLibraryPanel } from "@/components/panels/CaseLibraryPanel";
import { EditorContainer } from "@/components/layout/EditorContainer";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingComplete: true },
  });
  if (!user?.onboardingComplete) redirect("/onboarding");

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <PatientListPanel />
        <CaseLibraryPanel />
        <EditorContainer />
        <RightSidebar />
      </div>
    </div>
  );
}
