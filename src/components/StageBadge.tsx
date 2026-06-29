import { useState } from "preact/hooks";

/**
 * Tiny interactive island that proves the Preact integration hydrates on the
 * deployed site. Replaced by real builder UI in Phase 1 (#12).
 */
export default function StageBadge() {
  const [ticks, setTicks] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setTicks((n) => n + 1)}
      class="rounded-md border border-rule-strong bg-paper px-3 py-2 font-sans text-[14px] text-ink-soft shadow-sm transition-colors hover:border-gold"
    >
      Island online — clicked {ticks} {ticks === 1 ? "time" : "times"}
    </button>
  );
}
