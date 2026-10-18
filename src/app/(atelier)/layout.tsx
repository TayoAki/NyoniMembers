import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AtelierShell } from "@/components/atelier/shell/atelier-shell";

export const metadata: Metadata = {
  title: { default: "The Atelier", template: "%s · Nyoni Atelier" },
  description:
    "Design a made-to-measure suit with Nyoni Couture: choose the cloth, the cut and the details, see it illustrated, then ask the house to make it.",
};

/** The Atelier is open to guests: no sign-in, no onboarding gate. Ownership is resolved per draft. */
export default function AtelierLayout({ children }: { children: ReactNode }) {
  return <AtelierShell>{children}</AtelierShell>;
}
