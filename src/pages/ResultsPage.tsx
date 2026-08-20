import { Button, PosBadge, Shell } from "../components/ui";
import { useDraft } from "../state/draftStore";
import { gradeDraft } from "../engine/grades";

export function ResultsPage() {
  const { draft, setScreen } = useDraft();
  if (!draft) {
    return (
      <Shell title="Results" actions={<Button onClick={() => setScreen("home")}>Home</Button>}>
        <p>No draft to grade.</p>
      </Shell>
    );
  }
  const grades = gradeDraft(draft);
  const mine = grades.find((g) => g.teamIndex === draft.settings.userPick);

  return (
    <Shell
      title="Draft results"
      actions={
        <>
          <Button variant="ghost" onClick={() => setScreen("draft")}>Back to room</Button>
          <Button onClick={() => setScreen("home")}>Home</Button>
        </>
      }
    >
      {mine && (
        <div className="mb-6 rounded-2xl border border-field-500/40 bg-field-500/10 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-field-500">Your team</p>
          <div className="mt-1 flex flex-wrap items-end gap-6">
            <p className="font-display text-5xl">{mine.grade}</p>
            <div>
              <p className="text-sm text-white/60">Projected starters</p>
              <p className="font-mono text-2xl">{mine.points.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Finish</p>
              <p className="font-mono text-2xl">{mine.rank} / {grades.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-ink-800 text-left text-xs uppercase text-white/45">
            <tr>
              <th className="p-3">Rk</th>
              <th className="p-3">Team</th>
              <th className="p-3">Grade</th>
              <th className="p-3">Starter pts</th>
              <th className="p-3">Build</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.teamIndex} className={`border-t border-white/5 ${g.teamIndex === draft.settings.userPick ? "bg-field-500/10" : ""}`}>
                <td className="p-3 font-mono">{g.rank}</td>
                <td className="p-3 font-semibold">{g.name}</td>
                <td className="p-3 font-display text-lg">{g.grade}</td>
                <td className="p-3 font-mono">{g.points.toFixed(1)}</td>
                <td className="p-3 text-white/60">
                  {Object.entries(g.posCounts).map(([pos, n]) => `${n} ${pos}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mine && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
            <h2 className="font-display text-lg uppercase">Starting lineup</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {mine.starters.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><PosBadge pos={p.pos} /> {p.name}</span>
                  <span className="font-mono text-white/60">{p.proj.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
            <h2 className="font-display text-lg uppercase">Bench</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {mine.bench.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><PosBadge pos={p.pos} /> {p.name}</span>
                  <span className="font-mono text-white/60">{p.proj.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </Shell>
  );
}
