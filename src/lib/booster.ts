/**
 * Booster mode (#17) — a faithful TypeScript port of `booster_builder.py`.
 *
 * `boosterConfig(setCode)` mirrors the Python's set tables and odds exactly
 * (Arabian/Antiquities, The Dark/Fallen Empires/Homelands, Alliances/Chronicles,
 * Unglued, early core sets, Time Spiral's timeshifted sheet, the pre-mythic
 * standard structure, and the modern 1-in-8 mythic slot). `rollBooster` then
 * draws real cards for each slot from Scryfall and returns them as a resolved
 * deck of **concrete identities** — so the permalink freezes the exact cards
 * rolled (#16/#17) and reopening it re-renders them rather than re-rolling.
 *
 * Randomness uses `Math.random` (the host's machine, one pack at a time); there's
 * no need for the seeded determinism the permalink already provides by freezing.
 */

import { ResolveError, searchAll, type ResolvedDeck } from "./scryfall.ts";
import type { Card } from "./recipe.ts";

/** Card counts and grid layout for one booster, mirroring Python's `BoosterConfig`. */
export interface BoosterConfig {
  commons: number;
  uncommons: number;
  rares: number;
  mythics: number;
  /** Cards drawn from the Time Spiral timeshifted sheet (`tsb`). */
  tsbCards: number;
  /** Grid arrangement `WxH`, `0` = auto. */
  layout: string;
}

// 1 in 8 packs contains a mythic; 1 in 3 odd-slot rare for The Dark-era sets.
const MYTHIC_RARE_ODDS = 8;
const DARK_FALLEN_RARE_ODDS = 3;

const ARABIAN_ANTIQUITIES = new Set(["ARN", "ATQ"]);
const DARK_FALLEN_HOMELANDS = new Set(["DRK", "FEM", "HML"]);
const ALLIANCES_CHRONICLES = new Set(["ALL", "CHR"]);
const UNGLUED = new Set(["UGL"]);
const EARLY_CORE_SETS = new Set(["7ED", "8ED", "9ED"]);
const TIME_SPIRAL = new Set(["TSP"]);

// Pre-mythic standard boosters — 15 cards, no mythics.
const PRE_MYTHIC_SETS = new Set([
  "LEA", "LEB", "2ED", "3ED", "ICE", "MIR", "VIS", "WTH", "TMP", "STH",
  "EXO", "USG", "ULG", "UDS", "MMQ", "NMS", "PCY", "INV", "PLS", "APC",
  "ONS", "LGN", "SCG", "MRD", "DST", "5DN", "CHK", "BOK", "SOK", "RAV",
  "GPT", "DIS", "CSP", "PLC", "FUT", "10E", "POR", "PO2", "P3K", "PTK",
  "UNH",
]);

/** `random.randint(0, n-1) == 0` — a 1-in-`n` event. */
const oneIn = (n: number) => Math.floor(Math.random() * n) === 0;

/**
 * Determine a booster's composition from its set code (uppercased). A faithful
 * port of `BoosterBuilder.build_booster_config`; the random slots (The Dark-era
 * rare-or-uncommon, modern rare-or-mythic) are rolled here, exactly as Python does.
 */
export function boosterConfig(setCode: string): BoosterConfig {
  const code = setCode.toUpperCase();

  // Arabian Nights, Antiquities — 8 cards.
  if (ARABIAN_ANTIQUITIES.has(code)) {
    return { commons: 6, uncommons: 2, rares: 0, mythics: 0, tsbCards: 0, layout: "4x0" };
  }

  // The Dark, Fallen Empires, Homelands — 8 cards, two slots each 1/3 rare.
  if (DARK_FALLEN_HOMELANDS.has(code)) {
    let uncommons = 0;
    let rares = 0;
    for (let i = 0; i < 2; i++) {
      if (oneIn(DARK_FALLEN_RARE_ODDS)) rares++;
      else uncommons++;
    }
    return { commons: 6, uncommons, rares, mythics: 0, tsbCards: 0, layout: "5x0" };
  }

  // Alliances, Chronicles — 12 cards.
  if (ALLIANCES_CHRONICLES.has(code)) {
    return { commons: 8, uncommons: 3, rares: 1, mythics: 0, tsbCards: 0, layout: "6x0" };
  }

  // Unglued — 10 cards.
  if (UNGLUED.has(code)) {
    return { commons: 6, uncommons: 2, rares: 1, mythics: 0, tsbCards: 0, layout: "5x0" };
  }

  // Early core sets — 14 non-land cards (a basic land replaces 1 common).
  if (EARLY_CORE_SETS.has(code)) {
    return { commons: 10, uncommons: 3, rares: 1, mythics: 0, tsbCards: 0, layout: "7x0" };
  }

  // Time Spiral — adds one timeshifted card.
  if (TIME_SPIRAL.has(code)) {
    return { commons: 10, uncommons: 3, rares: 1, mythics: 0, tsbCards: 1, layout: "5x0" };
  }

  // Pre-mythic standard boosters — 15 cards, no mythics.
  if (PRE_MYTHIC_SETS.has(code)) {
    return { commons: 11, uncommons: 3, rares: 1, mythics: 0, tsbCards: 0, layout: "5x0" };
  }

  // Default modern draft booster — rare slot is mythic 1 in 8.
  const mythic = oneIn(MYTHIC_RARE_ODDS);
  return {
    commons: 10,
    uncommons: 3,
    rares: mythic ? 0 : 1,
    mythics: mythic ? 1 : 0,
    tsbCards: 0,
    layout: "7x0",
  };
}

/** Pick `count` distinct items at random (Python's `random.sample`). */
function sample<T>(pool: T[], count: number): T[] {
  const copy = pool.slice();
  const out: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const j = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(j, 1)[0]);
  }
  return out;
}

/**
 * Draw `count` random cards of a rarity from a set, mirroring
 * `get_cards_by_rarity` (basics excluded, no duplicates). Throws a helpful
 * `ResolveError` when the set is too thin to fill the slot.
 */
async function drawRarity(
  setCode: string,
  rarity: string,
  count: number,
): Promise<Card[]> {
  if (count === 0) return [];
  // Pull the whole rarity pool (no MAX cap — packs need the full set to sample).
  const pool = await searchAll(`e:${setCode.toLowerCase()} r:${rarity} -t:basic`, Infinity);
  if (pool.length < count) {
    throw new ResolveError(
      pool.length === 0
        ? `No ${rarity}s found for set “${setCode.toUpperCase()}” — check the set code.`
        : `Set “${setCode.toUpperCase()}” has only ${pool.length} ${rarity}(s); need ${count}.`,
    );
  }
  return sample(pool, count);
}

/** Draw timeshifted (`tsb`) cards for Time Spiral, mirroring `get_tsb_cards`. */
async function drawTimeshifted(count: number) {
  if (count === 0) return [];
  const pool = await searchAll("e:tsb", Infinity);
  if (pool.length < count) {
    throw new ResolveError(`Not enough timeshifted cards: need ${count}.`);
  }
  return sample(pool, count);
}

/**
 * Roll a structurally-valid booster for a set code (#17) and return it as a
 * resolved deck in pack order (commons, uncommons, rares, mythics, timeshifted).
 * The cards are concrete identities, so a permalink freezes this exact pack.
 */
export async function rollBooster(setCode: string): Promise<ResolvedDeck> {
  const code = setCode.trim();
  if (!code) throw new ResolveError("Enter a set code.");

  const config = boosterConfig(code);
  const cards = [
    ...(await drawRarity(code, "common", config.commons)),
    ...(await drawRarity(code, "uncommon", config.uncommons)),
    ...(await drawRarity(code, "rare", config.rares)),
    ...(await drawRarity(code, "mythic", config.mythics)),
    ...(await drawTimeshifted(config.tsbCards)),
  ];

  return { cards, title: `Booster — ${code.toUpperCase()}`, grid: config.layout };
}
