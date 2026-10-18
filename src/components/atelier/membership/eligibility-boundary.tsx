"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: ReactNode; children: ReactNode };
type State = { failed: boolean };

/**
 * Keeps the membership page truthful when the eligibility read is not available (the function is not
 * deployed yet, or the account check fails): the fallback says so instead of claiming a benefit.
 */
export class EligibilityBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
