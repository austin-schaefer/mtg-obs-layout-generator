/**
 * Mock card catalog — the built-in demo reel.
 *
 * The live modes (Scryfall search #14, booster #17) resolve real card identities
 * to image URLs through `scryfall.ts`. This hand-authored catalog of generic,
 * iconic cards (nothing from any episode plan) backs the default `/present` demo
 * reel so it renders with no network. Card art is © Wizards of the Coast and is
 * hotlinked from Scryfall's image CDN at runtime, exactly as the live modes do —
 * not committed.
 */

import { placeholderCard, type Card, type CardRef, type LayoutRecipe } from "./recipe.ts";

export const MOCK_CARDS: Card[] = [
  {
    set: "fdn",
    collector: "227",
    name: "Llanowar Elves",
    cardImage:
      "https://cards.scryfall.io/png/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.png?1782689070",
    artImage:
      "https://cards.scryfall.io/art_crop/front/6/a/6a0b230b-d391-4998-a3f7-7b158a0ec2cd.jpg?1782689070",
  },
  {
    set: "fdn",
    collector: "763",
    name: "Shivan Dragon",
    cardImage:
      "https://cards.scryfall.io/png/front/7/0/702c4781-670b-49ae-b511-90ed119841b0.png?1782683456",
    artImage:
      "https://cards.scryfall.io/art_crop/front/7/0/702c4781-670b-49ae-b511-90ed119841b0.jpg?1782683456",
  },
  {
    set: "fdn",
    collector: "740",
    name: "Serra Angel",
    cardImage:
      "https://cards.scryfall.io/png/front/b/8/b8c5e74c-96e7-4a1f-93b7-14d776fe4b2d.png?1775599758",
    artImage:
      "https://cards.scryfall.io/art_crop/front/b/8/b8c5e74c-96e7-4a1f-93b7-14d776fe4b2d.jpg?1775599758",
  },
  {
    set: "msc",
    collector: "806",
    name: "Lightning Bolt",
    cardImage:
      "https://cards.scryfall.io/png/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.png?1782681059",
    artImage:
      "https://cards.scryfall.io/art_crop/front/7/6/7673784e-db4b-43a1-8d55-1bb9fc1e284f.jpg?1782681059",
  },
  {
    set: "msc",
    collector: "170",
    name: "Birds of Paradise",
    cardImage:
      "https://cards.scryfall.io/png/front/4/9/492c2f9a-51e7-4e0f-9899-23bf43ea988b.png?1782682523",
    artImage:
      "https://cards.scryfall.io/art_crop/front/4/9/492c2f9a-51e7-4e0f-9899-23bf43ea988b.jpg?1782682523",
  },
  {
    set: "dsc",
    collector: "114",
    name: "Counterspell",
    cardImage:
      "https://cards.scryfall.io/png/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.png?1782689884",
    artImage:
      "https://cards.scryfall.io/art_crop/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1782689884",
  },
  {
    set: "cmm",
    collector: "70",
    name: "Wrath of God",
    cardImage:
      "https://cards.scryfall.io/png/front/5/3/537d2b05-3f52-45d6-8fe3-26282085d0c6.png?1782733262",
    artImage:
      "https://cards.scryfall.io/art_crop/front/5/3/537d2b05-3f52-45d6-8fe3-26282085d0c6.jpg?1782733262",
  },
  {
    set: "msc",
    collector: "211",
    name: "Sol Ring",
    cardImage:
      "https://cards.scryfall.io/png/front/9/1/91fdb56b-54d5-4272-8319-505ff987fe9b.png?1782682494",
    artImage:
      "https://cards.scryfall.io/art_crop/front/9/1/91fdb56b-54d5-4272-8319-505ff987fe9b.jpg?1782682494",
  },
];

/** A demo recipe: title slide, then every card as both a full-card and an art
 *  slide (the default), with a 4-wide grid overview. */
export const MOCK_RECIPE: LayoutRecipe = {
  v: 1,
  mode: "scry",
  title: "Clock Spinning — Demo Reel",
  cards: MOCK_CARDS.map(({ set, collector }) => ({ set, collector })),
  grid: "4x0",
};

/**
 * Resolve a recipe's card identities to renderable cards against a catalog.
 * Identities not in the catalog get a placeholder. The live path (Scryfall /
 * booster) supplies a real catalog of resolved cards; the default mock catalog
 * backs the demo reel. Returned array aligns with `recipe.cards` by index.
 */
export function resolveCards(
  recipe: LayoutRecipe,
  catalog: Card[] = MOCK_CARDS,
): Card[] {
  const byId = new Map(catalog.map((c) => [`${c.set}/${c.collector}`, c]));
  return recipe.cards.map(
    (ref: CardRef) => byId.get(`${ref.set}/${ref.collector}`) ?? placeholderCard(ref),
  );
}
