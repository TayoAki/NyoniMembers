/** The save scope, in the exact words of the state-language table (contract §6). */
export function savedScopeWords(ownedByAccount: boolean): string {
  return ownedByAccount ? "Saved to your account" : "Saved to this browser";
}
