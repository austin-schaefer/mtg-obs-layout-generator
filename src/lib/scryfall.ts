/**
 * Browser-side Scryfall client — no API key, no backend.
 *
 * Three jobs, all from the browser:
 *   1. `searchDeck(query)`  — Scryfall search → a deck of resolved cards (#14).
 *   2. `searchAll(query)`   — the paginated primitive booster rolls draw from (#17).
 *   3. `resolveRefs(refs)`  — card *identities* → image URLs, via the batch
 *      `/cards/collection` endpoint. This is what lets a permalink (which stores
 *      only `{set, collector}`) re-hydrate into a real render.
 *
 * Rate limiting: Scryfall asks for ~50–100ms between requests and we follow the
 * design skill's `API_DELAY = 0.11s`. Every request goes through one shared
 * throttle (`schedule`) that serializes calls and spaces their *starts* by
 * `MIN_SPACING_MS`, so search pagination, collection batches, and concurrent
 * booster-rarity queries can never burst past the guideline.
 *
 * We don't set `User-Agent` (browsers forbid it); `Accept: application/json` is
 * what Scryfall wants and is allowed. Card art is © Wizards of the Coast and is
 * hotlinked from Scryfall's CDN at render time — never downloaded or committed.
 */

import { placeholderCard, type Card, type CardRef } from "./recipe.ts";

const API_BASE = "https://api.scryfall.com";

/** Spacing between request *starts*, per the design skill (`API_DELAY = 0.11s`). */
const MIN_SPACING_MS = 110;

/** `/cards/collection` accepts at most 75 identifiers per request. */
const COLLECTION_BATCH = 75;

/**
 * Upper bound on cards pulled from a single search, keeping the permalink within
 * its ~100-card budget (`docs/permalink-scheme.md`) and the preview from fetching
 * thousands of images. A broader search is truncated to the first page(s) up to
 * this many; the editor (#15) trims further.
 */
const MAX_SEARCH_CARDS = 100;

/** Raised when an input can't be resolved (empty query, no matches, thin set, …). */
export class ResolveError extends Error {
  /** The HTTP status, when the failure came from a Scryfall response. */
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface ResolvedDeck {
  /** Resolved, renderable cards in their natural resolved order. */
  cards: Card[];
  /** A sensible default title for the layout; the host can edit it. */
  title: string;
  /** Optional grid arrangement `WxH` the mode suggests (booster packs set this). */
  grid?: string;
}

// ── Rate-limited request scheduler ──────────────────────────────────────────
// A single promise chain serializes every Scryfall call and spaces successive
// starts by MIN_SPACING_MS, regardless of how many callers fire concurrently.

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const gap = MIN_SPACING_MS - (performance.now() - lastStart);
    if (gap > 0) await wait(gap);
    lastStart = performance.now();
    return task();
  });
  // Keep the chain alive whether or not this task settled successfully.
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

interface ScryfallList {
  data: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
  not_found?: unknown[];
}

interface ImageUris {
  png?: string;
  art_crop?: string;
}

interface ScryfallCard {
  set: string;
  collector_number: string;
  name: string;
  image_uris?: ImageUris;
  card_faces?: { image_uris?: ImageUris }[];
}

/** Throttled JSON GET. Returns the parsed body; throws on network/HTTP error. */
async function getJson<T>(url: string): Promise<T> {
  const res = await schedule(() =>
    fetch(url, { headers: { Accept: "application/json" } }),
  );
  const body = (await res.json().catch(() => null)) as
    | (T & { object?: string; details?: string })
    | null;
  if (!res.ok || !body) {
    const detail =
      (body && typeof body === "object" && body.details) ||
      `Scryfall request failed (${res.status})`;
    throw new ResolveError(String(detail), res.status);
  }
  return body;
}

/** Throttled JSON POST (used by the collection endpoint). */
async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await schedule(() =>
    fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !body) {
    throw new ResolveError(`Scryfall request failed (${res.status})`);
  }
  return body;
}

/** The front-face image URIs of a card (handles double-faced cards). */
function frontImageUris(card: ScryfallCard): ImageUris | undefined {
  return card.image_uris ?? card.card_faces?.[0]?.image_uris;
}

/**
 * Map a raw Scryfall card to our renderable `Card`, or `null` if it lacks the
 * images we need (both the full-card PNG and the art crop).
 */
function toCard(card: ScryfallCard): Card | null {
  const uris = frontImageUris(card);
  if (!uris?.png || !uris.art_crop) return null;
  return {
    set: card.set,
    collector: card.collector_number,
    name: card.name,
    cardImage: uris.png,
    artImage: uris.art_crop,
  };
}

/**
 * Run a Scryfall search and return every renderable card, following pagination
 * up to `max`. A search that matches nothing (Scryfall answers 404) yields `[]`
 * rather than throwing, so callers can phrase their own error.
 */
export async function searchAll(
  query: string,
  max: number = MAX_SEARCH_CARDS,
): Promise<Card[]> {
  const cards: Card[] = [];
  let url: string | undefined =
    `${API_BASE}/cards/search?unique=cards&q=${encodeURIComponent(query)}`;

  while (url && cards.length < max) {
    let page: ScryfallList;
    try {
      page = await getJson<ScryfallList>(url);
    } catch (err) {
      // Scryfall answers a search that matches nothing with HTTP 404 — a normal
      // empty result here, so callers can phrase their own error.
      if (err instanceof ResolveError && err.status === 404) break;
      throw err;
    }
    for (const raw of page.data) {
      const card = toCard(raw);
      if (card) cards.push(card);
      if (cards.length >= max) break;
    }
    url = page.has_more ? page.next_page : undefined;
  }

  return cards;
}

/**
 * Resolve a Scryfall search query into a deck (#14). Throws `ResolveError` for an
 * empty query or a search that matches no renderable cards.
 */
export async function searchDeck(query: string): Promise<ResolvedDeck> {
  const trimmed = query.trim();
  if (!trimmed) throw new ResolveError("Enter a Scryfall search query.");

  const cards = await searchAll(trimmed);
  if (cards.length === 0) {
    throw new ResolveError(`No cards matched “${trimmed}”.`);
  }
  return { cards, title: `Clock Spinning — ${trimmed}` };
}

/**
 * Search Scryfall for cards to add to a deck (#26), capped to a small preview set
 * the host picks from. Unlike `searchDeck`, an empty query or no matches yields
 * `[]` rather than throwing — the add-card picker phrases its own empty state.
 */
export async function searchCards(
  query: string,
  limit: number = 12,
): Promise<Card[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return searchAll(trimmed, limit);
}

/**
 * Resolve compact card identities to renderable cards via `/cards/collection`
 * (POST, ≤75 per request). The result aligns with `refs` by index; any identity
 * Scryfall can't find — or that lacks usable images — becomes a placeholder so
 * the deck still renders in order. Used by the presenter to re-hydrate a
 * permalink whose URL carries only identities.
 */
export async function resolveRefs(refs: CardRef[]): Promise<Card[]> {
  const found = new Map<string, Card>();
  const key = (set: string, collector: string) =>
    `${set.toLowerCase()}/${collector}`;

  for (let i = 0; i < refs.length; i += COLLECTION_BATCH) {
    const batch = refs.slice(i, i + COLLECTION_BATCH);
    const payload = {
      identifiers: batch.map((r) => ({
        set: r.set.toLowerCase(),
        collector_number: r.collector,
      })),
    };
    const list = await postJson<ScryfallList>(
      `${API_BASE}/cards/collection`,
      payload,
    );
    for (const raw of list.data) {
      const card = toCard(raw);
      if (card) found.set(key(card.set, card.collector), card);
    }
  }

  return refs.map(
    (ref) => found.get(key(ref.set, ref.collector)) ?? placeholderCard(ref),
  );
}
