import { WorkspaceProvider } from "@/lib/workspace-provider";
import { Toaster } from "sonner";
import { CommandPalette } from "./_components/command-palette";
import { Sidebar } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function Layout({
  children,
}: { children: React.ReactNode }) {

  return (
    <WorkspaceProvider>
      <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#090d14] md:flex">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col h-full w-full">
          <Topbar />
          <div className="min-h-0 flex-1 flex flex-col h-full w-full overflow-y-auto">{children}</div>
        </main>
      </div>
      <Toaster richColors position="top-right" />
      <CommandPalette />
    </WorkspaceProvider>
  );
}
