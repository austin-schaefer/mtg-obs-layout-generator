import { useState } from "preact/hooks";

/**
 * Tiny interactive island that proves the Preact integration hydrates on the
 * deployed site. Restyled with brand tokens in #8; replaced by real builder UI
 * in Phase 1 (#12).
 */
export default function StageBadge() {
  const [ticks, setTicks] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setTicks((n) => n + 1)}
      class="rounded-md border border-gray-400 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-gray-600"
    >
      Island online — clicked {ticks} {ticks === 1 ? "time" : "times"}
    </button>
  );
}
