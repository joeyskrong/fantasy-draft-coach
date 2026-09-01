import { useMemo, useState } from "react";
import type { HighlightColor, Player, Position } from "../types";
import { Button, PosBadge, Shell } from "../components/ui";
import { useDraft } from "../state/draftStore";
import { availablePlayers, recommend, teamPositions } from "../engine/recommend";
import { formatPick } from "../engine/draftOrder";
import { projectPoints } from "../engine/scoring";
import { rankPlayers } from "../engine/vor";
import { K_DST_MIN_ROUND, matchesPosFilter, rosterNeedCounts } from "../engine/strategy";

type PosFilter = Position | "ALL" | "FLEX";
const POS_FILTERS: PosFilter[] = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
const COLORS: HighlightColor[] = ["green", "gold", "red", "blue", "purple"];

export function DraftRoom() {
  const { draft, setScreen, pickPlayer, undo, resetDraft, mockToMe, mockRest, highlight, updatePlayer } = useDraft();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosFilter>("ALL");
  const [tab, setTab] = useState<"board" | "roster" | "queue">("board");
  const [editId, setEditId] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const recs = useMemo(() => (draft ? recommend(draft) : []), [draft]);
  const available = useMemo(() => (draft ? availablePlayers(draft) : []), [draft]);

  if (!draft) {
    return (
      <Shell title="Draft room" actions={<Button onClick={() => setScreen("setup")}>Setup</Button>}>
        <p>No draft in progress.</p>
      </Shell>
    );
  }

  const current = draft.picks.find((p) => p.overall === draft.currentOverall);
  const onTheClock = current?.teamIndex === draft.settings.userPick;
  const done = !current;
  const teamName = (i: number) => draft.settings.teamNames[i - 1] ?? `Team ${i}`;
  const filtered = available.filter((p) => {
    if (!matchesPosFilter(p.pos, pos)) return false;
    if (q && !`${p.name} ${p.team}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const needCounts = rosterNeedCounts(draft.settings.roster, teamPositions(draft, draft.settings.userPick));
  const rankedAvail = rankPlayers(filtered, draft.settings.scoring, draft.settings.teams);
  const myPlayers = draft.players.filter((p) =>
    draft.picks.some((pk) => pk.teamIndex === draft.settings.userPick && pk.playerId === p.id),
  );
  const editPlayer = draft.players.find((p) => p.id === editId) ?? null;

  return (
    <Shell
      title={`Room ${draft.id}`}
      actions={
        <>
          <Button variant="ghost" onClick={() => setScreen("setup")}>Settings</Button>
          <Button variant="ghost" onClick={undo}>Undo</Button>
          <Button variant="ghost" onClick={resetDraft}>Reset</Button>
          <Button variant="ghost" onClick={mockToMe}>Mock to me</Button>
          <Button variant="gold" onClick={mockRest}>Auto-pick rest</Button>
          <Button variant="ghost" onClick={() => setScreen("results")}>Results</Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-800/80 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">On the clock</p>
          <p className="font-display text-2xl uppercase">
            {done ? "Draft complete" : `${formatPick(draft.currentOverall, draft.settings.teams)} · ${current ? teamName(current.teamIndex) : ""}`}
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-semibold ${onTheClock ? "bg-field-500 text-ink-950" : "bg-white/10 text-white/70"}`}>
          {done ? "Final" : onTheClock ? "Your pick" : "Log the pick"}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_280px]">
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
          <h2 className="font-display text-lg uppercase">PDR board</h2>
          <p className="mb-3 text-xs text-white/50">
            Recs follow team need and scarcity. Wait on QB unless he falls; K/DST from round {K_DST_MIN_ROUND}.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
            {(
              [
                ["RB", needCounts.rb],
                ["WR", needCounts.wr],
                ["TE", needCounts.te],
                ["FLEX", needCounts.flex],
                ["QB", needCounts.qb],
                ["K", needCounts.k],
                ["DST", needCounts.dst],
              ] as const
            ).map(([label, n]) => (
              <span
                key={label}
                className={`rounded-md border px-1.5 py-0.5 font-mono ${
                  n > 0 ? "border-field-500/40 bg-field-500/10 text-field-400" : "border-white/10 text-white/35"
                }`}
              >
                {label} {n}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {recs.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => pickPlayer(r.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  r.tier === 1
                    ? "border-field-500/50 bg-field-500/10 shadow-glow"
                    : r.tier === 2
                      ? "border-gold-400/30 bg-gold-400/5"
                      : "border-white/10 bg-ink-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PosBadge pos={r.pos} />
                    <span className="font-semibold">{r.name}</span>
                  </div>
                  <span className="font-mono text-xs text-white/60">PDR {r.pdr.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-xs text-white/55">{r.reason}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search available"
              className="min-w-40 flex-1 rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-field-500"
            />
            {POS_FILTERS.map((p) => (
              <button key={p} onClick={() => setPos(p)} className={`rounded-md px-2 py-1 text-xs font-semibold ${pos === p ? "bg-white text-ink-950" : "bg-white/5 text-white/60"}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-800 text-left text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="p-2">Player</th>
                  <th className="p-2">Pos</th>
                  <th className="p-2">ADP</th>
                  <th className="p-2">Proj</th>
                  <th className="p-2">VOR</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rankedAvail.slice(0, 120).map((p) => {
                  const hi = draft.highlights[p.id];
                  const cuff = p.handcuffIds.length > 0 && p.pos === "RB";
                  return (
                    <tr key={p.id} className={`border-t border-white/5 hover:bg-white/5 ${hi ? highlightClass(hi) : ""}`}>
                      <td className="p-2">
                        <button className="text-left font-medium hover:underline" onClick={() => setEditId(p.id)}>
                          {p.name}
                        </button>
                        <span className="ml-2 text-xs text-white/40">{p.team}{cuff ? " · cuff" : ""}</span>
                      </td>
                      <td className="p-2"><PosBadge pos={p.pos} /></td>
                      <td className="p-2 font-mono text-white/70">{p.adp.toFixed(1)}</td>
                      <td className="p-2 font-mono">{p.proj.toFixed(1)}</td>
                      <td className="p-2 font-mono">{p.vor.toFixed(1)}</td>
                      <td className="p-2 text-right">
                        <Button className="px-2 py-1 text-xs" onClick={() => pickPlayer(p.id)}>Draft</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
            <div className="mb-2 flex gap-2 text-xs">
              {(["board", "roster", "queue"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-1 capitalize ${tab === t ? "bg-white text-ink-950" : "text-white/50"}`}>{t}</button>
              ))}
            </div>
            {tab === "roster" && (
              <ul className="space-y-1 text-sm">
                {myPlayers.length === 0 && <li className="text-white/40">No players yet.</li>}
                {myPlayers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><PosBadge pos={p.pos} /> {p.name}</span>
                    <span className="font-mono text-xs text-white/50">{projectPoints(p.stats, draft.settings.scoring).toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            )}
            {tab === "queue" && (
              <div className="space-y-2 text-xs text-white/60">
                <p>Click a color on a player editor to highlight targets. Green = must draft, red = do not draft.</p>
                {Object.entries(draft.highlights).map(([id, color]) => {
                  const p = draft.players.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between">
                      <span className={highlightClass(color)}>{p?.name}</span>
                      <button onClick={() => highlight(id, null)}>clear</button>
                    </div>
                  );
                })}
              </div>
            )}
            {tab === "board" && (
              <>
                <label className="mb-2 flex items-center gap-2 text-xs text-white/60">
                  <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                  Only my picks
                </label>
                <div className="max-h-[58vh] overflow-auto text-xs">
                  {draft.picks.filter((pk) => !onlyMine || pk.teamIndex === draft.settings.userPick).map((pk) => {
                    const p = draft.players.find((x) => x.id === pk.playerId);
                    const mine = pk.teamIndex === draft.settings.userPick;
                    return (
                      <div key={pk.overall} className={`flex items-center justify-between border-b border-white/5 py-1 ${mine ? "text-field-400" : "text-white/70"}`}>
                        <span className="font-mono text-white/40">{formatPick(pk.overall, draft.settings.teams)}</span>
                        <span className="flex-1 px-2 truncate">{p ? p.name : pk.overall === draft.currentOverall ? "—" : ""}</span>
                        <span className="text-white/30">{teamName(pk.teamIndex).replace("Team ", "T")}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      {editPlayer && (
        <PlayerEditor
          player={editPlayer}
          color={draft.highlights[editPlayer.id]}
          scoringPts={projectPoints(editPlayer.stats, draft.settings.scoring)}
          onClose={() => setEditId(null)}
          onHighlight={(c) => highlight(editPlayer.id, c)}
          onSave={(patch) => {
            updatePlayer(editPlayer.id, patch);
            setEditId(null);
          }}
        />
      )}
    </Shell>
  );
}

function highlightClass(c: HighlightColor): string {
  return {
    green: "bg-emerald-500/20",
    gold: "bg-amber-400/20",
    red: "bg-rose-500/20",
    blue: "bg-sky-500/20",
    purple: "bg-violet-500/20",
  }[c];
}

function PlayerEditor({
  player,
  color,
  scoringPts,
  onClose,
  onHighlight,
  onSave,
}: {
  player: Player;
  color?: HighlightColor;
  scoringPts: number;
  onClose: () => void;
  onHighlight: (c: HighlightColor | null) => void;
  onSave: (patch: Partial<Player>) => void;
}) {
  const [adp, setAdp] = useState(player.adp);
  const [adpStd, setAdpStd] = useState(player.adpStd);
  const [rec, setRec] = useState(player.stats.rec);
  const [recYds, setRecYds] = useState(player.stats.recYds);
  const [rushYds, setRushYds] = useState(player.stats.rushYds);
  const [passYds, setPassYds] = useState(player.stats.passYds);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-800 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl uppercase">{player.name}</h3>
        <p className="text-sm text-white/50">{player.pos} · {player.team} · Bye {player.bye} · {scoringPts.toFixed(1)} pts</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label>ADP<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={adp} onChange={(e) => setAdp(Number(e.target.value))} /></label>
          <label>ADP SD<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={adpStd} onChange={(e) => setAdpStd(Number(e.target.value))} /></label>
          <label>Rec<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={rec} onChange={(e) => setRec(Number(e.target.value))} /></label>
          <label>Rec yds<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={recYds} onChange={(e) => setRecYds(Number(e.target.value))} /></label>
          <label>Rush yds<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={rushYds} onChange={(e) => setRushYds(Number(e.target.value))} /></label>
          <label>Pass yds<input className="mt-1 w-full rounded bg-ink-900 px-2 py-1 font-mono" type="number" value={passYds} onChange={(e) => setPassYds(Number(e.target.value))} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          {COLORS.map((c) => (
            <button key={c} className={`h-7 w-7 rounded-full border ${color === c ? "ring-2 ring-white" : ""} ${highlightClass(c)}`} onClick={() => onHighlight(color === c ? null : c)} />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ adp, adpStd, stats: { ...player.stats, rec, recYds, rushYds, passYds } })}>Save</Button>
        </div>
      </div>
    </div>
  );
}
