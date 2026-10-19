"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { FitProfilePanel } from "@/components/atelier/fit/fit-profile";
import { FitRoutes } from "@/components/atelier/fit/fit-routes";
import { ProfileSkeleton } from "@/components/atelier/fit/fit-skeleton";
import { FIT_TAB_LABELS, FIT_TABS, fitTabHref, isFitTab, type FitTab } from "@/components/atelier/fit/fit-words";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import type { FitProfileView } from "@convex/atelier/fit";

/** The sheet reads the browser's storage in its first render, so it is rendered on the client only. */
const MeasurementForm = dynamic(
  () => import("@/components/atelier/fit/measurement-form").then((module) => module.MeasurementForm),
  {
    ssr: false,
    loading: () => <ProfileSkeleton rows={8} />,
  },
);

/**
 * /atelier/fit: S19 routes, S20 the account's fit profile, S21 the guided measurement sheet, as three
 * panels under one heading. `?tab=` names the panel so the studio and the profile can link straight
 * to the sheet; a revision opens the sheet prefilled from the chosen version.
 */
export function FitPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const viewer = useAtelierViewer();
  const requested = searchParams.get("tab");
  const [tab, setTabState] = useState<FitTab>(isFitTab(requested) ? requested : "routes");
  const [revisionFrom, setRevisionFrom] = useState<FitProfileView | null>(null);

  const setTab = useCallback(
    (next: FitTab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const startRevision = (profile: FitProfileView) => {
    setRevisionFrom(profile);
    setTab("measure");
  };
  const measureFresh = () => {
    setRevisionFrom(null);
    setTab("measure");
  };
  const backToProfile = () => {
    setRevisionFrom(null);
    setTab("profile");
  };

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your fit."
        description="How the house measures you: at a showroom, or at home with the guide. A fitter approves every profile before anything is cut against it."
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = String(value);
          if (isFitTab(next)) setTab(next);
        }}
        className="gap-8"
      >
        <TabsList
          variant="line"
          aria-label="Fit"
          className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-foreground/15 p-0 group-data-horizontal/tabs:h-auto"
        >
          {FIT_TABS.map((entry) => (
            <TabsTrigger
              key={entry}
              value={entry}
              className="h-11 flex-none px-0 text-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]"
            >
              {FIT_TAB_LABELS[entry]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="routes">
          <FitRoutes onMeasure={measureFresh} />
        </TabsContent>
        <TabsContent value="profile">
          <FitProfilePanel
            viewer={viewer}
            returnTo={fitTabHref("profile")}
            onStartRevision={startRevision}
            onMeasure={measureFresh}
          />
        </TabsContent>
        <TabsContent value="measure">
          <MeasurementForm
            key={revisionFrom?._id ?? "fresh"}
            viewer={viewer}
            source={revisionFrom}
            returnTo={fitTabHref("measure")}
            onSubmitted={backToProfile}
            onCancelRevision={backToProfile}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
