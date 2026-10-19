"use client";

import { Component, type ReactNode } from "react";

type Props = { fallback: ReactNode; children: ReactNode };
type State = { error: Error | null };

/**
 * `orders.get` validates `orderId` as an id of its table, so a well-formed id of another table is
 * refused by the server rather than read as null. That refusal renders the not-found copy; any other
 * error is rethrown to the route's error boundary.
 */
export class OrderBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (/ArgumentValidationError/.test(error.message)) return this.props.fallback;
      throw error;
    }
    return this.props.children;
  }
}
