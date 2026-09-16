import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { OnboardingGate } from "./onboarding-gate";
import { Topbar } from "./topbar";

/** Sidebar + topbar frame for every signed-in screen. Content gets a 16px gutter on phones. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Topbar />
        <main className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <OnboardingGate>{children}</OnboardingGate>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
