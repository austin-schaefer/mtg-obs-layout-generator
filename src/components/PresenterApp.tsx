/**
 * PresenterApp — the client entry that feeds the presenter.
 *
 * With no permalink it renders the built-in mock demo reel (resolved locally, so
 * the demo needs no network). When the URL carries a permalink (`?r=…`) it decodes
 * the recipe and re-hydrates its card *identities* into real artwork through the
 * browser-side Scryfall client (`resolveRefs`) — the recipe stores only
 * `{set, collector}`, so this fetch is what turns a shared link back into a render.
 *
 * The `?r=` read and fetch happen in an effect (not during render) so the hydrated
 * markup matches the server-rendered mock and there's no hydration mismatch.
 */

import { useEffect, useMemo, useState } from "preact/hooks";
import Presenter from "./Presenter.tsx";
import Builder from "./Builder.tsx";
import { decodeRecipe } from "../lib/permalink.ts";
import { MOCK_CARDS, MOCK_RECIPE } from "../lib/mock-cards.ts";
import { resolveRefs } from "../lib/scryfall.ts";
import {
  cardMapFrom,
  cardRefs,
  type Card,
  type LayoutRecipe,
} from "../lib/recipe.ts";

type Status = "ready" | "loading" | "error";

export default function PresenterApp() {
  const [recipe, setRecipe] = useState<LayoutRecipe>(MOCK_RECIPE);
  const [byId, setById] = useState<Map<string, Card>>(() =>
    cardMapFrom(MOCK_CARDS),
  );
  const [status, setStatus] = useState<Status>("ready");
  // A shared /present link is otherwise a dead end — no way back to editing. Esc
  // hands the loaded deck to the builder (its cards already resolved, so no
  // refetch), turning "watch this layout" into "edit this layout" in place.
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("r");
    if (!encoded) return; // keep the local mock demo reel

    let decoded: LayoutRecipe;
    try {
      decoded = decodeRecipe(encoded);
    } catch (err) {
      console.warn("permalink decode failed; using mock recipe", err);
      return;
    }

    setRecipe(decoded);
    setStatus("loading");

    let cancelled = false;
    resolveRefs(cardRefs(decoded))
      .then((resolved) => {
        if (cancelled) return;
        setById(cardMapFrom(resolved));
        setStatus("ready");
      })
      .catch((err) => {
        console.warn("permalink card resolution failed", err);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The resolved cards as a catalog, to hand off to the builder for editing.
  const catalog = useMemo(() => [...byId.values()], [byId]);

  if (editing) {
    // The presenter shell is a fixed full-bleed stage; the builder is a tall,
    // scrolling surface. Give it its own scrollable, marble-backed page container
    // (matching the homepage `main`), above the shell's "← back" link.
    return (
      <div class="fixed inset-0 z-20 overflow-y-auto bg-marble">
        <main class="mx-auto w-full max-w-6xl px-4 py-10 tablet:px-6 desktop:px-8">
          <Builder initialRecipe={recipe} initialCatalog={catalog} />
        </main>
      </div>
    );
  }

  if (status !== "ready") {
    return <ResolveScreen status={status} />;
  }

  return (
    <Presenter recipe={recipe} byId={byId} onExit={() => setEditing(true)} />
  );
}

/** A minimal, broadcast-clean overlay while cards resolve (or if resolution fails). */
function ResolveScreen({ status }: { status: Exclude<Status, "ready"> }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: "0",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "rgba(255,255,255,0.82)",
        fontSize: "16px",
        letterSpacing: "0.02em",
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      {status === "loading"
        ? "Resolving cards from Scryfall…"
        : "Couldn’t load this layout’s cards. Check your connection and reload."}
    </div>
  );
}
