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
import { availability } from "./availability";
import { userPickOveralls } from "./draftOrder";
import {
  currentRound,
  extraordinaryQbValue,
  fillsFlex,
  K_DST_MIN_ROUND,
  matchesPosFilter,
  QB_BACKUP_MIN_ROUND,
  QB_WAIT_UNTIL_ROUND,
  qbCount,
  rosterNeedCounts,
  scarcityBoost,
  starterNeedFor,
  strategyWeight,
} from "./strategy";

export { matchesPosFilter };

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
  const drafted = teamPositions(state, state.settings.userPick);
  const haveQb = qbCount(drafted);
  const needs = remainingNeeds(state.settings.roster, drafted, lookAhead);
  const needCounts = rosterNeedCounts(state.settings.roster, drafted);
  const round = currentRound(state.currentOverall, state.settings.teams);

  const evByPick: Record<number, ReturnType<typeof allPositionEVs>> = {};
  for (const pick of picks) {
    const raw = allPositionEVs(pick, available, scoring);
    const weighted = { ...raw };
    (Object.keys(weighted) as Position[]).forEach((pos) => {
      const w = strategyWeight(pos, pick, state.settings.teams, drafted, available);
      weighted[pos] = { ...weighted[pos], ev: weighted[pos].ev * w };
    });
    evByPick[pick] = weighted;
  }

  const plan = picks.length && needs.length ? bestNeedPlan(picks, needs, evByPick) : null;
  const targetKey = plan?.firstKey ?? "bench";
  const myPick = userPicks[0] ?? state.currentOverall;
  const onTheClock = state.currentOverall === myPick;
  const nextUserPick = userPicks[1];

  const scored = ranked.map((p) => {
    const vor = p.vor;
    const fits = playerFitsNeed(p.pos, targetKey);
    const survive = nextUserPick ? survivalToPick(p, nextUserPick) : 0;
    const arrive = onTheClock ? 1 : availability(myPick, p.adp, p.adpStd);
    const starterNeed = starterNeedFor(p.pos, needCounts);
    const flexNeed = fillsFlex(p.pos, needCounts);
    const needBoost =
      starterNeed > 0 ? 22 + starterNeed * 8 : flexNeed ? 12 : p.pos === "RB" || p.pos === "WR" || p.pos === "TE" ? 2 : 0;
    const zeroRbBoost = p.pos === "RB" && drafted.filter((x) => x === "RB").length === 0 ? 18 : 0;
    const scarce = scarcityBoost(p.pos, available, myPick, nextUserPick, starterNeed + (flexNeed ? 1 : 0));
    const waitPenalty = survive * 14;
    const ghostPenalty = onTheClock ? 0 : (1 - arrive) * 90;
    const weight = strategyWeight(p.pos, myPick, state.settings.teams, drafted, available);
    const earlyKdst =
      (p.pos === "K" || p.pos === "DST") && round < K_DST_MIN_ROUND ? 220 : 0;
    const qbWait =
      p.pos === "QB" && weight < 0.8 && !extraordinaryQbValue(p, myPick, state.settings.teams, available)
        ? 36 * (1 - weight)
        : 0;
    const extraQb =
      p.pos === "QB" &&
      haveQb === 0 &&
      extraordinaryQbValue(p, myPick, state.settings.teams, available)
        ? 28
        : 0;
    const backupQbPenalty =
      p.pos === "QB" && haveQb >= 1 ? (round < QB_BACKUP_MIN_ROUND ? 240 : 90) : 0;
    const pdr =
      vor * Math.min(1, 0.35 + weight) +
      (fits ? 16 : 0) +
      needBoost +
      zeroRbBoost +
      scarce -
      waitPenalty -
      ghostPenalty -
      earlyKdst -
      qbWait -
      backupQbPenalty +
      extraQb +
      reachAdj(p, myPick);
    const reason = buildReason({
      p,
      fits,
      targetKey,
      survive,
      nextUserPick,
      starterNeed,
      flexNeed,
      round,
      draftedRbs: drafted.filter((x) => x === "RB").length,
      haveQb,
      extraQb: extraQb > 0,
      arrive,
      onTheClock,
    });
    return { ...p, pdr: Math.round(pdr * 10) / 10, tier: 3 as const, reason, nextPickSurvive: survive, recommended: false };
  });

  scored.sort((a, b) => b.pdr - a.pdr || b.vor - a.vor);
  const eligible = scored.filter((p) => {
    if ((p.pos === "K" || p.pos === "DST") && round < K_DST_MIN_ROUND) return false;
    if (p.pos === "QB" && haveQb >= 1 && round < QB_BACKUP_MIN_ROUND) return false;
    if (p.pos === "QB" && haveQb === 0 && round < 3 && !extraordinaryQbValue(p, myPick, state.settings.teams, available)) {
      return false;
    }
    if (!onTheClock && availability(myPick, p.adp, p.adpStd) < 0.2) return false;
    return true;
  });
  const board = eligible.length ? eligible : scored.filter((p) => !(p.pos === "QB" && haveQb >= 1 && round < QB_BACKUP_MIN_ROUND));
  const top = board.find((p) => !(p.pos === "QB" && haveQb >= 1)) ?? board[0];
  const recs = board.map((p) => {
    let tier: 1 | 2 | 3 = 3;
    if (top && (p.id === top.id || p.pdr >= top.pdr - 4) && !(p.pos === "QB" && haveQb >= 1)) tier = 1;
    else if (top && p.pdr >= top.pdr - 12 && !(p.pos === "QB" && haveQb >= 1)) tier = 2;
    return { ...p, tier, recommended: Boolean(top && p.id === top.id) };
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

function buildReason(opts: {
  p: RankedPlayer;
  fits: boolean;
  targetKey: string;
  survive: number;
  nextUserPick?: number;
  starterNeed: number;
  flexNeed: boolean;
  round: number;
  draftedRbs: number;
  haveQb: number;
  extraQb: boolean;
  arrive: number;
  onTheClock: boolean;
}): string {
  const { p, fits, targetKey, survive, nextUserPick, starterNeed, flexNeed, round, draftedRbs, haveQb, extraQb, arrive, onTheClock } = opts;
  if (!onTheClock && arrive < 0.2) {
    return `Likely gone before your pick (ADP ${p.adp.toFixed(1)}).`;
  }
  if ((p.pos === "K" || p.pos === "DST") && round < K_DST_MIN_ROUND) {
    return `Wait until round ${K_DST_MIN_ROUND} for ${p.pos}.`;
  }
  if (p.pos === "QB" && haveQb >= 1) {
    return round < QB_BACKUP_MIN_ROUND
      ? `You already have a QB. Do not take a second one before round ${QB_BACKUP_MIN_ROUND}.`
      : `Second QB is optional — skip unless you specifically want a bye-week stash.`;
  }
  if (extraQb) {
    return `Extraordinary QB value — elite option falling well past ADP ${p.adp.toFixed(0)}.`;
  }
  if (p.pos === "QB" && round < QB_WAIT_UNTIL_ROUND) {
    return `Good QB, but wait unless a top option falls. Skill-position need is higher.`;
  }
  if (p.pos === "RB" && draftedRbs === 0) {
    return `Zero RBs on the roster. RB scarcity makes this the priority over WR/QB.`;
  }
  if (starterNeed > 0 && survive < 0.35 && nextUserPick) {
    return `Still need ${p.pos}. Only ${(survive * 100).toFixed(0)}% chance he lasts to pick ${nextUserPick}.`;
  }
  if (starterNeed > 0) {
    return `Fills a starting ${p.pos} hole (${starterNeed} left) and plays the scarcity.`;
  }
  if (flexNeed) {
    return `Best FLEX (RB/WR/TE) fit given current lineup construction.`;
  }
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
