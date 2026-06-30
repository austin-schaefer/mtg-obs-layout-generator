/**
 * Builder card resolution — the seam between the builder shell (#12) and the
 * real mode implementations (Scryfall #14, booster #17).
 *
 * "Generate" in the builder calls `resolveDeck(mode, input)` to turn a query or
 * set code into concrete, renderable cards. Until the real modes land, every
 * mode resolves against the Phase-1 mock catalog (`mock-cards.ts`) so the whole
 * surface — results strip, stage preview, and presenter handoff — is exercised
 * end to end. #14/#17 replace the per-mode branches with live resolution; the
 * builder doesn't change, because the shape returned here is the contract.
 *
 * Resolution is async on purpose: the real Scryfall/booster paths are network
 * calls (rate-limited per the design skill), so the builder already awaits a
 * promise and renders a pending state.
 */

import { MOCK_CARDS } from "./mock-cards.ts";
import type { Card, Mode } from "./recipe.ts";

export interface ResolvedDeck {
  /** Resolved, renderable cards in their natural resolved order. */
  cards: Card[];
  /** A sensible default title for the layout; the host can edit it. */
  title: string;
}

/** Raised when an input can't be resolved (empty query, no matches, …). */
export class ResolveError extends Error {}

/**
 * Resolve a mode + input into a deck of renderable cards.
 *
 * Mock behavior (Phase 1): any non-empty input yields the full mock catalog.
 * The title is derived from the input so the generated layout feels specific.
 * Replace each branch with live resolution in #14 (scry) / #17 (boost).
 */
export async function resolveDeck(mode: Mode, input: string): Promise<ResolvedDeck> {
  const trimmed = input.trim();
  if (mode !== "custom" && !trimmed) {
    throw new ResolveError(
      mode === "scry" ? "Enter a Scryfall search query." : "Enter a set code.",
    );
  }

  switch (mode) {
    case "scry":
      // #14 replaces this with a browser-side Scryfall search.
      return { cards: mockDeck(), title: `Clock Spinning — ${trimmed}` };
    case "boost":
      // #17 replaces this with a faithful booster roll for the set code.
      return {
        cards: mockDeck(),
        title: `Booster — ${trimmed.toUpperCase()}`,
      };
    case "custom":
      // Custom (paired images) is intentionally not wired yet — "coming soon".
      throw new ResolveError("Custom mode is coming soon.");
  }
}

/** A defensive copy of the mock catalog so callers can't mutate the source. */
function mockDeck(): Card[] {
  return MOCK_CARDS.map((c) => ({ ...c }));
}
