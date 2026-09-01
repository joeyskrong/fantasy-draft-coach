import { Button } from "../components/ui";
import { useDraft } from "../state/draftStore";

const FEATURES = [
  "Probabilistic Drafting Ratings looking up to 12 rounds ahead",
  "Live recommendations that re-run after every pick",
  "Custom scoring, roster, snake or custom draft order",
  "Keeper leagues (pre-draft or specific rounds)",
  "ADP, VOR, tiers, handcuffs, and player highlighting",
  "Mock the room to your pick, then grade every team",
];

export function HomePage() {
  const { setScreen, draft } = useDraft();
  return (
    <div className="min-h-screen field-grid">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-5 py-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.35em] text-field-500">2026 Draft Prep</p>
            <h1 className="mt-2 font-display text-5xl uppercase leading-none tracking-wide sm:text-7xl">
              Fantasy
              <br />
              Draft Coach
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/70">
              Stop drafting the highest VOR on the board. This rebuild uses Probabilistic Drafting Ratings
              to plan your remaining roster against who will actually be there at your next picks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => setScreen("setup")} className="px-5 py-3 text-base">
                Start draft setup
              </Button>
              {draft && (
                <Button variant="ghost" onClick={() => setScreen("draft")}>
                  Resume draft {draft.id}
                </Button>
              )}
            </div>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f} className="rounded-2xl border border-white/10 bg-ink-800/70 p-4 text-sm text-white/80">
              {f}
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-ink-800/60 p-6">
            <h2 className="font-display text-2xl uppercase">What is PDR?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Value Based Drafting ranks everyone by points above replacement. That misses scarcity. If the
              board wants four straight receivers, you can still leave the draft without a usable RB2.
              Probabilistic Drafting uses ADP and ADP standard deviation to estimate who survives to each of
              your future picks, then searches roster permutations to find the pick that maximizes expected
              starting-lineup value.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-ink-800/60 p-6">
            <h2 className="font-display text-2xl uppercase">How to use it</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/70">
              <li>Set league size, your slot, scoring, and roster.</li>
              <li>Optional: add keepers or paste custom projections/ADP.</li>
              <li>Click players as they come off the board. Recs follow your roster holes and position scarcity — smash RB if you have none, wait on QB unless a top option falls, skip a second QB (not before round 11, maybe never), and hold K/DST until round 9.</li>
              <li>Use Mock to me between picks. Open Results when the draft is done.</li>
            </ol>
          </article>
        </section>
      </div>
    </div>
  );
}
