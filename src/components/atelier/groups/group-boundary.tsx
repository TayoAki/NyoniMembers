"use client";

import { Component, type ReactNode } from "react";
import { toClientError } from "@/lib/errors";

type Props = {
  /** Shown when the server refuses the id itself (a well-formed id of another table) — the not-found copy. */
  notFound: ReactNode;
  /** Shown when the account's token is not accepted — the sign-in copy, never a dead end. */
  signedOut: ReactNode;
  children: ReactNode;
};
type State = { error: Error | null };

/**
 * `groups.get` validates `groupId` as an id of its table, so a malformed id is refused by the server
 * rather than read as null; that refusal renders the not-found copy. An UNAUTHENTICATED refusal renders
 * the sign-in copy. Anything else is rethrown to the route's error boundary.
 */
export class GroupBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (/ArgumentValidationError/.test(error.message)) return this.props.notFound;
      if (toClientError(error).code === "UNAUTHENTICATED") return this.props.signedOut;
      throw error;
    }
    return this.props.children;
  }
}
