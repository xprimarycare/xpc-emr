import { TopBar } from "@/components/layout/TopBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { PatientListPanel } from "@/components/panels/PatientListPanel";
import { EditorContainer } from "@/components/layout/EditorContainer";
import { RightSidebar } from "@/components/layout/RightSidebar";

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <PatientListPanel />
        <EditorContainer />
        <RightSidebar />
      </div>
    </div>
  );
}
