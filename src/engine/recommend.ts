import type { DraftState, Player, Position, Scoring } from "../types";
import { projectPoints } from "./scoring";
import { rankPlayers, type RankedPlayer } from "./vor";
import {
  allPositionEVs,
  bestNeedPlan,
  playerFitsNeed,
  remainingNeeds,
  survivalToPick,
} from "./pdr";
import { userPickOveralls } from "./draftOrder";

export type Recommendation = RankedPlayer & {
  pdr: number;
  tier: 1 | 2 | 3;
  reason: string;
  nextPickSurvive: number;
  recommended: boolean;
};

export function availablePlayers(state: DraftState): Player[] {
  const taken = new Set(state.picks.filter((p) => p.playerId).map((p) => p.playerId as string));
  return state.players.filter((p) => !taken.has(p.id));
}

export function teamPositions(state: DraftState, teamIndex: number): Position[] {
  const ids = new Set(
    state.picks.filter((p) => p.teamIndex === teamIndex && p.playerId).map((p) => p.playerId as string),
  );
  return state.players.filter((p) => ids.has(p.id)).map((p) => p.pos);
}

export function recommend(state: DraftState): Recommendation[] {
  const available = availablePlayers(state);
  const scoring = state.settings.scoring;
  const ranked = rankPlayers(available, scoring, state.settings.teams);
  const userPicks = userPickOveralls(state.settings, state.picks.length).filter(
    (n) => n >= state.currentOverall,
  );
  const lookAhead = Math.min(12, userPicks.length);
  const picks = userPicks.slice(0, lookAhead);
  const needs = remainingNeeds(
    state.settings.roster,
    teamPositions(state, state.settings.userPick),
    lookAhead,
  );

  const evByPick: Record<number, ReturnType<typeof allPositionEVs>> = {};
  for (const pick of picks) {
    evByPick[pick] = allPositionEVs(pick, available, scoring);
  }

  const plan = picks.length && needs.length ? bestNeedPlan(picks, needs, evByPick) : null;
  const targetKey = plan?.firstKey ?? "bench";
  const nextUserPick = userPicks[1];

  const scored = ranked.map((p) => {
    const vor = p.vor;
    const fits = playerFitsNeed(p.pos, targetKey);
    const survive = nextUserPick ? survivalToPick(p, nextUserPick) : 0;
    const scarcityBoost = fits ? 18 : 0;
    const waitPenalty = survive * 14;
    const earlyKickerPenalty = p.pos === "K" || p.pos === "DST" ? Math.max(0, 90 - state.currentOverall) * 0.35 : 0;
    const pdr = vor + scarcityBoost - waitPenalty - earlyKickerPenalty + reachAdj(p, state.currentOverall);
    const reason = buildReason(p, fits, targetKey, survive, nextUserPick);
    return { ...p, pdr: Math.round(pdr * 10) / 10, tier: 3 as const, reason, nextPickSurvive: survive, recommended: false };
  });

  scored.sort((a, b) => b.pdr - a.pdr || b.vor - a.vor);
  const top = scored[0];
  const recs = scored.map((p, i) => {
    let tier: 1 | 2 | 3 = 3;
    if (i === 0 || (top && p.pdr >= top.pdr - 4)) tier = 1;
    else if (p.pdr >= (top?.pdr ?? 0) - 12) tier = 2;
    return { ...p, tier, recommended: i === 0 };
  });
  return recs;
}

function reachAdj(p: RankedPlayer, pick: number): number {
  const delta = p.adp - pick;
  if (delta > 18) return -8;
  if (delta > 10) return -3;
  if (delta < -8) return 6;
  return 0;
}

function buildReason(
  p: RankedPlayer,
  fits: boolean,
  targetKey: string,
  survive: number,
  nextUserPick?: number,
): string {
  const posLabel = targetKey.startsWith("flex") ? "FLEX" : targetKey === "bench" ? "depth" : targetKey;
  if (fits && survive < 0.35 && nextUserPick) {
    return `${p.pos} is the PDR target. Only ${(survive * 100).toFixed(0)}% chance he lasts to pick ${nextUserPick}.`;
  }
  if (fits) {
    return `Fills ${posLabel} while keeping future-round expected value high.`;
  }
  if (p.vor > 20) {
    return `Elite VOR (${p.vor.toFixed(1)}) even if the board wants ${posLabel}.`;
  }
  return `Solid ${p.pos} value if you fade the primary recommendation.`;
}

export function cpuPick(available: Player[], scoring: Scoring, noise = 0.35): Player {
  const ranked = [...available].sort((a, b) => {
    const jitter = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return ((h % 1000) / 1000 - 0.5) * noise * 12;
    };
    return a.adp + jitter(a.id) - (b.adp + jitter(b.id));
  });
  void scoring;
  return ranked[0];
}

export function starterLineup(
  players: Player[],
  roster: DraftState["settings"]["roster"],
  scoring: Scoring,
): { starters: Player[]; bench: Player[]; points: number } {
  const byPos: Record<Position, Player[]> = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] };
  for (const p of players) byPos[p.pos].push(p);
  (Object.keys(byPos) as Position[]).forEach((pos) => {
    byPos[pos].sort((a, b) => projectPoints(b.stats, scoring) - projectPoints(a.stats, scoring));
  });

  const used = new Set<string>();
  const take = (pos: Position, n: number) => {
    const out: Player[] = [];
    for (const p of byPos[pos]) {
      if (out.length >= n) break;
      if (used.has(p.id)) continue;
      used.add(p.id);
      out.push(p);
    }
    return out;
  };

  const starters: Player[] = [
    ...take("QB", roster.qb),
    ...take("RB", roster.rb),
    ...take("WR", roster.wr),
    ...take("TE", roster.te),
    ...take("K", roster.k),
    ...take("DST", roster.dst),
  ];

  const flexPool = players
    .filter((p) => !used.has(p.id) && (["RB", "WR", "TE", "QB"] as Position[]).includes(p.pos))
    .sort((a, b) => projectPoints(b.stats, scoring) - projectPoints(a.stats, scoring));

  const takeFlex = (eligible: typeof roster.flex1Pos, n: number) => {
    const out: Player[] = [];
    for (const p of flexPool) {
      if (out.length >= n) break;
      if (used.has(p.id)) continue;
      if (!eligible.includes(p.pos as "QB" | "RB" | "WR" | "TE")) continue;
      used.add(p.id);
      out.push(p);
    }
    return out;
  };

  starters.push(...takeFlex(roster.flex1Pos, roster.flex1));
  starters.push(...takeFlex(roster.flex2Pos, roster.flex2));

  const bench = players.filter((p) => !used.has(p.id));
  const points = starters.reduce((s, p) => s + projectPoints(p.stats, scoring), 0);
  return { starters, bench, points: Math.round(points * 10) / 10 };
}
