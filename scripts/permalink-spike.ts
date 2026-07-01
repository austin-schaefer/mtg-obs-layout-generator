/**
 * Permalink encoding spike (issue #13) — de-risks the URL scheme before the
 * editor and full permalink are built on top of it.
 *
 * Run:  node --experimental-strip-types scripts/permalink-spike.ts
 *
 * It builds representative recipes (best case: one set; worst case: many sets +
 * full edits) at the 100-card cap, measures the encoded URL length against a
 * naive baseline, and asserts a lossless round-trip. All data here is synthetic /
 * generic — no card list of substance is embedded.
 */

import {
  encodeRecipe,
  decodeRecipe,
} from "../src/lib/permalink.ts";
import {
  FACE_BOTH,
  SCHEMA_VERSION,
  type LayoutRecipe,
  type SlideSpec,
} from "../src/lib/recipe.ts";

// A generic pool of real set codes (public knowledge), used only to make the
// worst-case measurement realistic. Not an episode idea list.
const SET_POOL = [
  "neo", "mom", "dmu", "bro", "one", "war", "eld", "m21",
  "khm", "stx", "afr", "mid", "vow", "snc", "ltr", "woe",
];

function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function baseUrl(encoded: string): string {
  return `https://obs-layouts.netlify.app/present?r=${encoded}`;
}

function naiveBase64Len(recipe: LayoutRecipe): number {
  const json = JSON.stringify(recipe);
  return Buffer.from(json, "utf8").toString("base64url").length;
}

function cardCount(recipe: LayoutRecipe): number {
  return recipe.slides.filter((s) => s.kind === "card").length;
}

function report(label: string, recipe: LayoutRecipe): boolean {
  const encoded = encodeRecipe(recipe);
  const decoded = decodeRecipe(encoded);
  const lossless = canonical(decoded) === canonical(recipe);

  const url = baseUrl(encoded);
  console.log(`\n## ${label} (${cardCount(recipe)} cards, ${recipe.slides.length} slides)`);
  console.log(`  naive base64url payload : ${naiveBase64Len(recipe)} chars`);
  console.log(`  encoded (lz-string)     : ${encoded.length} chars`);
  console.log(`  full /present URL        : ${url.length} chars`);
  console.log(`  round-trip lossless      : ${lossless ? "yes ✓" : "NO ✗"}`);
  return lossless;
}

// --- Best case: a single set, 100 card slides, no per-card edits -----------
const bestCase: LayoutRecipe = {
  v: SCHEMA_VERSION,
  slides: [
    { kind: "title", text: "Triple-Pip Creatures" },
    ...Array.from(
      { length: 100 },
      (_, i): SlideSpec => ({
        kind: "card",
        set: "neo",
        collector: String(i + 1),
        face: FACE_BOTH,
      }),
    ),
    { kind: "grid", arrangement: "10x0" },
  ],
};

// --- Worst case: many sets, alnum collectors, cycling faces, extra title/grid
// slides scattered through the deck ----------------------------------------
const worstCase: LayoutRecipe = {
  v: SCHEMA_VERSION,
  slides: [
    { kind: "title", text: "Clock Spinning Podcast — Episode 100 Spectacular Showcase" },
    ...Array.from({ length: 100 }, (_, i): SlideSpec[] => {
      const card: SlideSpec = {
        kind: "card",
        set: SET_POOL[i % SET_POOL.length],
        collector: `${i + 1}${"abc"[i % 3]}`, // promos / variants
        face: i % 3, // cycle card-only / art-only / both
      };
      // Sprinkle a divider title + a grid every 25 cards.
      return i > 0 && i % 25 === 0
        ? [{ kind: "title", text: `Act ${i / 25}` }, { kind: "grid", arrangement: "8x0" }, card]
        : [card];
    }).flat(),
    { kind: "grid", arrangement: "10x0" },
  ],
};

console.log("# Permalink spike — measured at the 100-card cap");
const ok = [
  report("Best case — single set, no edits", bestCase),
  report("Worst case — 16 sets, alnum collectors, full edits", worstCase),
].every(Boolean);

// Rough URL-length sanity budget. Browsers handle far more, but staying under a
// conservative ceiling keeps the links shareable/pasteable everywhere.
const URL_BUDGET = 2000;
const worstUrlLen = baseUrl(encodeRecipe(worstCase)).length;
console.log(`\nBudget: worst-case URL ${worstUrlLen} / ${URL_BUDGET} chars — ${
  worstUrlLen <= URL_BUDGET ? "within budget ✓" : "OVER budget ✗"
}`);

if (!ok || worstUrlLen > URL_BUDGET) {
  console.error("\nSPIKE FAILED");
  process.exit(1);
}
console.log("\nSPIKE PASSED ✓");
