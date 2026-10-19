"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: ReactNode; children: ReactNode };
type State = { failed: boolean };

/**
 * Keeps the fit page truthful when the account-only reads fail (the token is not held yet, or the
 * function is unavailable): the fallback says the profile cannot be read instead of showing nothing.
 */
export class FitBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
