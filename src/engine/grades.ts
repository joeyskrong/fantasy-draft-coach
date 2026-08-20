import type { DraftState } from "../types";
import { projectPoints } from "./scoring";
import { starterLineup } from "./recommend";

export type TeamGrade = {
  teamIndex: number;
  name: string;
  points: number;
  grade: string;
  rank: number;
  starters: { id: string; name: string; pos: string; proj: number }[];
  bench: { id: string; name: string; pos: string; proj: number }[];
  posCounts: Record<string, number>;
};

export function gradeDraft(state: DraftState): TeamGrade[] {
  const teams: TeamGrade[] = [];
  for (let i = 1; i <= state.settings.teams; i++) {
    const ids = state.picks.filter((p) => p.teamIndex === i && p.playerId).map((p) => p.playerId as string);
    const players = state.players.filter((p) => ids.includes(p.id));
    const lineup = starterLineup(players, state.settings.roster, state.settings.scoring);
    const posCounts: Record<string, number> = {};
    for (const p of players) posCounts[p.pos] = (posCounts[p.pos] ?? 0) + 1;
    teams.push({
      teamIndex: i,
      name: state.settings.teamNames[i - 1] ?? `Team ${i}`,
      points: lineup.points,
      grade: "C",
      rank: 0,
      starters: lineup.starters.map((p) => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        proj: projectPoints(p.stats, state.settings.scoring),
      })),
      bench: lineup.bench.map((p) => ({
        id: p.id,
        name: p.name,
        pos: p.pos,
        proj: projectPoints(p.stats, state.settings.scoring),
      })),
      posCounts,
    });
  }
  teams.sort((a, b) => b.points - a.points);
  const best = teams[0]?.points ?? 1;
  const worst = teams[teams.length - 1]?.points ?? 0;
  const span = Math.max(1, best - worst);
  teams.forEach((t, idx) => {
    t.rank = idx + 1;
    const pct = (t.points - worst) / span;
    t.grade = letterGrade(pct, t.rank, teams.length);
  });
  return teams;
}

function letterGrade(pct: number, rank: number, n: number): string {
  if (rank === 1) return "A+";
  if (pct > 0.85) return "A";
  if (pct > 0.7) return "A-";
  if (pct > 0.55) return "B+";
  if (pct > 0.4) return "B";
  if (rank > n * 0.75) return pct > 0.2 ? "C" : "D";
  return "B-";
}
