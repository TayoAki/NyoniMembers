import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { clerkPublishableKey, isAuthLive } from "@/lib/config";
import { convex } from "@/lib/convex";
import { SessionProvider } from "@/lib/session";

/**
 * Everything the app needs above the router, arranged so that a build with no keys mounts none of
 * it and still runs. `SessionProvider` reads the same flags and picks its own implementation, so a
 * screen sees one `useSession()` whichever of these three shapes is in play.
 *
 * On a device the session token is kept in the secure enclave via expo-secure-store; on web Clerk
 * falls back to its own cookie handling, which is why `tokenCache` is undefined there.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!isAuthLive) return <SessionProvider>{children}</SessionProvider>;

  const session = <SessionProvider>{children}</SessionProvider>;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      {convex ? (
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {session}
        </ConvexProviderWithClerk>
      ) : (
        session
      )}
    </ClerkProvider>
  );
}
