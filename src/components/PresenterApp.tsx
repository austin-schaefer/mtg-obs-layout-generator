/**
 * PresenterApp — the client entry that feeds the presenter. Defaults to the mock
 * recipe; if the URL carries a permalink (`?r=…`) it decodes that instead and
 * resolves its card identities against the mock catalog. This is what proves the
 * permalink (#13) round-trips into a real render.
 *
 * The `?r=` read happens in an effect (not during render) so the hydrated markup
 * matches the server-rendered mock and there's no hydration mismatch.
 */

import { useEffect, useState } from "preact/hooks";
import Presenter from "./Presenter.tsx";
import { decodeRecipe } from "../lib/permalink.ts";
import { MOCK_RECIPE, resolveCards } from "../lib/mock-cards.ts";
import type { LayoutRecipe } from "../lib/recipe.ts";

export default function PresenterApp() {
  const [recipe, setRecipe] = useState<LayoutRecipe>(MOCK_RECIPE);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("r");
    if (!encoded) return;
    try {
      setRecipe(decodeRecipe(encoded));
    } catch (err) {
      console.warn("permalink decode failed; using mock recipe", err);
    }
  }, []);

  return <Presenter recipe={recipe} cards={resolveCards(recipe)} />;
}
