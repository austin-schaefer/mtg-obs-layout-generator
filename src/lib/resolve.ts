/**
 * Builder card resolution — turns a mode + input into renderable cards.
 *
 * "Generate" in the builder calls `resolveDeck(mode, input)`:
 *   - `scry`  → a browser-side Scryfall search (#14).
 *   - `boost` → a faithful booster roll for the set code (#17), frozen to
 *     concrete card identities so the permalink reproduces the exact pack.
 *   - `custom` → not wired yet ("coming soon").
 *
 * The returned `ResolvedDeck` (cards + title, plus an optional suggested grid) is
 * the contract the builder consumes; resolution is async because both live paths
 * are rate-limited network calls (see `scryfall.ts`).
 */

import type { Mode } from "./recipe.ts";
import { ResolveError, searchDeck, type ResolvedDeck } from "./scryfall.ts";
import { rollBooster } from "./booster.ts";

export { ResolveError, type ResolvedDeck };

/** Resolve a mode + input into a deck of renderable cards. */
export async function resolveDeck(mode: Mode, input: string): Promise<ResolvedDeck> {
  switch (mode) {
    case "scry":
      return searchDeck(input);
    case "boost":
      return rollBooster(input);
    case "custom":
      // Custom (paired images) is intentionally not wired yet — "coming soon".
      throw new ResolveError("Custom mode is coming soon.");
  }
}
