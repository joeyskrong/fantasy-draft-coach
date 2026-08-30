import { useMemo, useState } from "react";
import type { FlexPosition, LeagueSettings, ScoringPreset } from "../types";
import { Button, NumberField, Segmented, Shell } from "../components/ui";
import { useDraft } from "../state/draftStore";
import { scoringPreset } from "../engine/scoring";
import { defaultCustomOrder } from "../engine/draftOrder";
import { defaultTeamNames } from "../data/defaults";
import { keepersFromLeagueConfig } from "../data/leagueConfig";
import { PLAYER_POOL } from "../data/players";
import { projectPoints } from "../engine/scoring";

const FLEX_OPTS: FlexPosition[] = ["QB", "RB", "WR", "TE"];

export function SetupPage() {
  const { settings, setSettings, setScreen, startDraft } = useDraft();
  const [tab, setTab] = useState<"league" | "scoring" | "keepers" | "order" | "projections">("league");
  const [query, setQuery] = useState("");

  const rounds =
    settings.roster.qb +
    settings.roster.rb +
    settings.roster.wr +
    settings.roster.te +
    settings.roster.k +
    settings.roster.dst +
    settings.roster.flex1 +
    settings.roster.flex2 +
    settings.roster.bench;

  const patch = (partial: Partial<LeagueSettings>) => setSettings({ ...settings, ...partial });

  const setPreset = (preset: ScoringPreset) => {
    if (preset === "custom") {
      patch({ scoringPreset: "custom" });
      return;
    }
    patch({ scoringPreset: preset, scoring: scoringPreset(preset) });
  };

  const keepersEnabled = settings.draftType === "keeper";
  const customOrderEnabled = settings.orderType === "custom";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLAYER_POOL.filter((p) => !q || `${p.name} ${p.team} ${p.pos}`.toLowerCase().includes(q)).slice(0, 40);
  }, [query]);

  return (
    <Shell
      title="Draft setup"
      actions={
        <>
          <Button variant="ghost" onClick={() => setScreen("home")}>
            Back
          </Button>
          <Button onClick={() => startDraft(settings)}>Start draft</Button>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["league", "League"],
            ["scoring", "Scoring"],
            ["keepers", "Keepers"],
            ["order", "Draft order"],
            ["projections", "Projections"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`rounded-full px-3 py-1 text-sm ${tab === id ? "bg-field-500 text-ink-950" : "bg-white/5 text-white/70"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "league" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
            <h2 className="font-display text-xl uppercase">League settings</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <NumberField label="Teams" min={4} max={16} value={settings.teams} onChange={(teams) => {
                const teamNames = defaultTeamNames(teams, Math.min(settings.userPick, teams));
                patch({
                  teams,
                  userPick: Math.min(settings.userPick, teams),
                  teamNames,
                  customOrder: defaultCustomOrder(teams, rounds),
                });
              }} />
              <NumberField label="Your pick" min={1} max={settings.teams} value={settings.userPick} onChange={(userPick) => {
                const keepers = settings.keepers.map((k) =>
                  k.teamIndex === settings.userPick ? { ...k, teamIndex: userPick } : k,
                );
                patch({ userPick, teamNames: defaultTeamNames(settings.teams, userPick), keepers });
              }} />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-white/60">Draft type</p>
                <Segmented value={settings.draftType} onChange={(draftType) => patch({
                  draftType,
                  keepers: draftType === "redraft" ? [] : (settings.keepers.length ? settings.keepers : keepersFromLeagueConfig(settings.userPick)),
                })} options={[{ id: "redraft", label: "Redraft" }, { id: "keeper", label: "Keeper" }]} />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-white/60">Draft order</p>
                <Segmented value={settings.orderType} onChange={(orderType) => patch({ orderType })} options={[{ id: "snake", label: "Snake" }, { id: "linear", label: "Linear" }, { id: "custom", label: "Custom" }]} />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-white/60">Scoring</p>
                <Segmented value={settings.scoringPreset} onChange={setPreset} options={[{ id: "std", label: "Std" }, { id: "half", label: "0.5 PPR" }, { id: "ppr", label: "PPR" }, { id: "custom", label: "Custom" }]} />
              </div>
            </div>
            {keepersEnabled && settings.keepers.length > 0 && (
              <div className="mt-4 rounded-xl border border-field-500/30 bg-field-500/10 p-3">
                <p className="text-xs uppercase tracking-wide text-field-400">Pre-filled keepers</p>
                <div className="mt-2 max-h-64 space-y-2 overflow-auto text-sm">
                  {Array.from({ length: settings.teams }, (_, i) => i + 1).map((teamIndex) => {
                    const rows = settings.keepers.filter((k) => k.teamIndex === teamIndex);
                    if (!rows.length) return null;
                    return (
                      <div key={teamIndex}>
                        <p className="text-xs font-semibold text-white/70">{settings.teamNames[teamIndex - 1]}</p>
                        <ul className="mt-1 space-y-0.5">
                          {rows.map((k) => {
                            const p = PLAYER_POOL.find((x) => x.id === k.playerId);
                            return (
                              <li key={k.playerId} className="flex justify-between gap-2">
                                <span>{p?.name} <span className="text-white/45">{p?.team}</span></span>
                                <span className="font-mono text-white/70">Rd {k.round ?? "start"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
            <h2 className="font-display text-xl uppercase">Roster</h2>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {(["qb", "rb", "wr", "te", "k", "dst", "flex1", "flex2", "bench"] as const).map((key) => (
                <NumberField
                  key={key}
                  label={key}
                  min={0}
                  max={key === "bench" ? 12 : 5}
                  value={settings.roster[key]}
                  onChange={(n) => patch({ roster: { ...settings.roster, [key]: n }, customOrder: defaultCustomOrder(settings.teams, rounds) })}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FlexPicker label="Flex 1 eligible" value={settings.roster.flex1Pos} onChange={(flex1Pos) => patch({ roster: { ...settings.roster, flex1Pos } })} />
              <FlexPicker label="Flex 2 eligible" value={settings.roster.flex2Pos} onChange={(flex2Pos) => patch({ roster: { ...settings.roster, flex2Pos } })} />
            </div>
            <p className="mt-4 text-xs text-white/50">{rounds} rounds · {settings.teams * rounds} total picks</p>
          </section>
        </div>
      )}

      {tab === "scoring" && (
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl uppercase">Custom scoring</h2>
            <Button variant="ghost" onClick={() => setPreset("ppr")}>Reset to PPR</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(
              [
                ["passYd", "Pass yard"],
                ["passTd", "Pass TD"],
                ["passInt", "INT"],
                ["rushYd", "Rush yard"],
                ["rushTd", "Rush TD"],
                ["rec", "Reception"],
                ["recYd", "Rec yard"],
                ["recTd", "Rec TD"],
                ["fumLost", "Fumble lost"],
                ["twoPt", "2-pt"],
                ["fg40_49", "FG 40-49"],
                ["fg50", "FG 50+"],
                ["xp", "XP"],
                ["defSack", "Def sack"],
                ["defInt", "Def INT"],
                ["defTd", "Def TD"],
              ] as const
            ).map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                value={settings.scoring[key]}
                onChange={(n) => patch({ scoringPreset: "custom", scoring: { ...settings.scoring, [key]: n } })}
              />
            ))}
          </div>
        </section>
      )}

      {tab === "keepers" && (
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <h2 className="font-display text-xl uppercase">Keepers</h2>
          {!keepersEnabled && <p className="mt-2 text-sm text-white/60">Switch draft type to Keeper to add players.</p>}
          {keepersEnabled && (
            <>
              <p className="mt-2 text-sm text-white/60">
                Loaded from <span className="font-mono text-field-400">config/league.json</span>. Leave round blank to keep the player at the beginning of the draft (consumes that team&apos;s next open pick).
              </p>
              <input
                className="mt-4 w-full rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-field-500"
                placeholder="Search players to keep"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/10">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                    onClick={() => {
                      if (settings.keepers.some((k) => k.playerId === p.id)) return;
                      patch({ keepers: [...settings.keepers, { playerId: p.id, teamIndex: settings.userPick, round: null }] });
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="text-white/50">{p.pos} · {p.team}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {settings.keepers.map((k, i) => {
                  const p = PLAYER_POOL.find((x) => x.id === k.playerId);
                  return (
                    <div key={`${k.playerId}-${i}`} className="grid grid-cols-12 items-center gap-2 rounded-lg bg-ink-900 p-2 text-sm">
                      <div className="col-span-4">{p?.name} <span className="text-white/45">{p?.team}</span></div>
                      <label className="col-span-3 text-xs text-white/50">
                        Team
                        <input type="number" min={1} max={settings.teams} className="ml-2 w-16 rounded bg-ink-800 px-1 py-0.5 font-mono text-white" value={k.teamIndex} onChange={(e) => {
                          const keepers = settings.keepers.map((row, idx) => idx === i ? { ...row, teamIndex: Number(e.target.value) } : row);
                          patch({ keepers });
                        }} />
                      </label>
                      <label className="col-span-3 text-xs text-white/50">
                        Round
                        <input type="number" min={1} max={rounds} className="ml-2 w-16 rounded bg-ink-800 px-1 py-0.5 font-mono text-white" value={k.round ?? ""} placeholder="start" onChange={(e) => {
                          const keepers = settings.keepers.map((row, idx) => idx === i ? { ...row, round: e.target.value === "" ? null : Number(e.target.value) } : row);
                          patch({ keepers });
                        }} />
                      </label>
                      <button className="col-span-2 text-rose-300" onClick={() => patch({ keepers: settings.keepers.filter((_, idx) => idx !== i) })}>Remove</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "order" && (
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <h2 className="font-display text-xl uppercase">Custom draft order</h2>
          {!customOrderEnabled && <p className="mt-2 text-sm text-white/60">Select Custom draft order to edit pick owners. Snake is used by default.</p>}
          {customOrderEnabled && (
            <>
              <p className="mt-2 text-sm text-white/60">Each cell is the team number on the clock for that overall pick. Reset restores a snake.</p>
              <Button variant="ghost" className="mt-3" onClick={() => patch({ customOrder: defaultCustomOrder(settings.teams, rounds) })}>Reset to snake</Button>
              <div className="mt-4 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-left text-white/50">Rd</th>
                      {Array.from({ length: settings.teams }, (_, i) => (
                        <th key={i} className="p-1 text-white/50">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rounds }, (_, r) => (
                      <tr key={r}>
                        <td className="p-1 text-white/50">{r + 1}</td>
                        {Array.from({ length: settings.teams }, (_, s) => {
                          const idx = r * settings.teams + s;
                          return (
                            <td key={s} className="p-1">
                              <input
                                type="number"
                                min={1}
                                max={settings.teams}
                                className="w-12 rounded bg-ink-900 px-1 py-0.5 font-mono"
                                value={settings.customOrder[idx] ?? 1}
                                onChange={(e) => {
                                  const customOrder = [...settings.customOrder];
                                  customOrder[idx] = Number(e.target.value);
                                  patch({ customOrder });
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "projections" && (
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <h2 className="font-display text-xl uppercase">Consensus projections</h2>
          <p className="mt-2 text-sm text-white/60">
            Built from August 2026 ADP. After the draft starts you can edit any player&apos;s projection and ADP in the draft room.
            Sample PPR values for the current scoring preset:
          </p>
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-900 text-left text-xs uppercase text-white/50">
                <tr>
                  <th className="p-2">Player</th>
                  <th className="p-2">Pos</th>
                  <th className="p-2">ADP</th>
                  <th className="p-2">Proj</th>
                </tr>
              </thead>
              <tbody>
                {PLAYER_POOL.slice(0, 80).map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.pos}</td>
                    <td className="p-2 font-mono">{p.adp.toFixed(1)}</td>
                    <td className="p-2 font-mono">{projectPoints(p.stats, settings.scoring).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}

function FlexPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FlexPosition[];
  onChange: (v: FlexPosition[]) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-white/60">{label}</p>
      <div className="flex flex-wrap gap-1">
        {FLEX_OPTS.map((pos) => {
          const on = value.includes(pos);
          return (
            <button
              key={pos}
              type="button"
              className={`rounded-md px-2 py-1 text-xs font-semibold ${on ? "bg-field-500 text-ink-950" : "bg-white/5 text-white/60"}`}
              onClick={() => onChange(on ? value.filter((p) => p !== pos) : [...value, pos])}
            >
              {pos}
            </button>
          );
        })}
      </div>
    </div>
  );
}
