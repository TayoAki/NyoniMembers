import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="bg-muted/30 flex min-h-svh items-center justify-center px-4 py-10">{children}</div>;
}
