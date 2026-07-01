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

import {
  ResolveError,
  searchCards,
  searchDeck,
  searchPrintings,
  type CardOption,
  type ResolvedDeck,
} from "./scryfall.ts";
import { rollBooster } from "./booster.ts";

/**
 * How the builder seeds a deck's initial cards. This is a *generate-time* input
 * (which source to draw from), not part of the deck itself — the deck is just an
 * ordered list of slides once seeded (`recipe.ts`).
 */
export type Mode = "scry" | "boost" | "custom";

export {
  ResolveError,
  searchCards,
  searchPrintings,
  type CardOption,
  type ResolvedDeck,
};

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
