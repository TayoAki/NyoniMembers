import type { Metadata } from "next";
import { GroupsPage } from "@/components/atelier/groups/groups-page";

export const metadata: Metadata = {
  title: "Groups",
  description:
    "Coordinate a wedding party or another group with Nyoni Couture: one shared brief and design, each participant designing and fitted privately, the house reviewing the whole.",
};

export default function AtelierGroupsPage() {
  return <GroupsPage />;
}
