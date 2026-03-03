import { TopBar } from "@/components/layout/TopBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { PatientListPanel } from "@/components/panels/PatientListPanel";
import { CaseLibraryPanel } from "@/components/panels/CaseLibraryPanel";
import { EditorContainer } from "@/components/layout/EditorContainer";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default function Home() {
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
