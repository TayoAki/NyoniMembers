import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { AvatarsSettings } from "@/components/settings/avatars-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { requireSignedIn } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your photos, styling preferences, theme and account data.",
};

export default async function SettingsPage() {
  await requireSignedIn();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Who you are on screen, how outfits get styled, and what happens to your data."
      />
      <AvatarsSettings />
      <PreferencesForm />
      <AppearanceSettings />
      <DangerZone />
    </div>
  );
}
