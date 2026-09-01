import type { Player, Position, RosterSlots } from "../types";

/** Earliest round this league will take a kicker or DST. */
export const K_DST_MIN_ROUND = 9;

/** Default 1QB leagues wait on QB unless a top option is falling. */
export const QB_WAIT_UNTIL_ROUND = 6;

/** Never take a second QB before this round; even then it is optional. */
export const QB_BACKUP_MIN_ROUND = 11;

export function qbCount(drafted: Position[]): number {
  return drafted.filter((p) => p === "QB").length;
}

export function currentRound(overall: number, teams: number): number {
  return Math.max(1, Math.ceil(overall / teams));
}

export function isEliteQb(player: Player, available: Player[]): boolean {
  if (player.pos !== "QB") return false;
  const qbs = available.filter((p) => p.pos === "QB").sort((a, b) => a.adp - b.adp);
  const rank = qbs.findIndex((p) => p.id === player.id) + 1;
  return rank > 0 && rank <= 3;
}

/** True when a top-3 QB has fallen at least a round past ADP. */
export function extraordinaryQbValue(player: Player, overall: number, teams: number, available: Player[]): boolean {
  if (!isEliteQb(player, available)) return false;
  const round = currentRound(overall, teams);
  if (round < 3) return false;
  return overall >= player.adp + 8;
}

export function strategyWeight(
  pos: Position,
  overall: number,
  teams: number,
  drafted: Position[],
  available: Player[],
): number {
  const round = currentRound(overall, teams);
  if (pos === "K" || pos === "DST") return round >= K_DST_MIN_ROUND ? 1 : 0.02;

  if (pos === "QB") {
    if (qbCount(drafted) >= 1) return round >= QB_BACKUP_MIN_ROUND ? 0.06 : 0.02;
    const bestQb = available.filter((p) => p.pos === "QB").sort((a, b) => a.adp - b.adp)[0];
    if (bestQb && extraordinaryQbValue(bestQb, overall, teams, available)) return 1.2;
    if (round <= 2) return 0.12;
    if (round <= 4) return 0.28;
    if (round < QB_WAIT_UNTIL_ROUND) return 0.5;
    if (round <= 7) return 0.85;
    return 1;
  }

  return 1;
}

export type RosterNeedCounts = {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  k: number;
  dst: number;
  flex: number;
  bench: number;
};

export function rosterNeedCounts(roster: RosterSlots, drafted: Position[]): RosterNeedCounts {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  let flex = 0;
  let bench = 0;
  const cap = (pos: Position) =>
    pos === "QB" ? roster.qb : pos === "RB" ? roster.rb : pos === "WR" ? roster.wr : pos === "TE" ? roster.te : pos === "K" ? roster.k : roster.dst;
  const flexEligible = new Set([...roster.flex1Pos, ...roster.flex2Pos]);
  const flexCap = roster.flex1 + roster.flex2;

  for (const pos of drafted) {
    if (counts[pos] < cap(pos)) {
      counts[pos] += 1;
      continue;
    }
    if (flex < flexCap && flexEligible.has(pos as "QB" | "RB" | "TE" | "WR")) {
      flex += 1;
      continue;
    }
    bench += 1;
  }

  return {
    qb: Math.max(0, roster.qb - counts.QB),
    rb: Math.max(0, roster.rb - counts.RB),
    wr: Math.max(0, roster.wr - counts.WR),
    te: Math.max(0, roster.te - counts.TE),
    k: Math.max(0, roster.k - counts.K),
    dst: Math.max(0, roster.dst - counts.DST),
    flex: Math.max(0, flexCap - flex),
    bench: Math.max(0, roster.bench - bench),
  };
}

export function starterNeedFor(pos: Position, needs: RosterNeedCounts): number {
  if (pos === "QB") return needs.qb;
  if (pos === "RB") return needs.rb;
  if (pos === "WR") return needs.wr;
  if (pos === "TE") return needs.te;
  if (pos === "K") return needs.k;
  return needs.dst;
}

export function fillsFlex(pos: Position, needs: RosterNeedCounts): boolean {
  return needs.flex > 0 && (pos === "RB" || pos === "WR" || pos === "TE");
}

export function scarcityBoost(
  pos: Position,
  available: Player[],
  overall: number,
  nextUserPick: number | undefined,
  needCount: number,
): number {
  if (needCount <= 0 || pos === "K" || pos === "DST") return 0;
  const horizon = nextUserPick ?? overall + 12;
  const imminent = available.filter((p) => p.pos === pos && p.adp < horizon + 4).length;
  if (pos === "RB") {
    if (imminent <= 2) return 24;
    if (imminent <= 5) return 14;
    if (imminent <= 8) return 8;
    return 4;
  }
  if (pos === "TE") {
    if (imminent <= 2) return 16;
    if (imminent <= 4) return 8;
    return 0;
  }
  if (pos === "WR") {
    if (imminent <= 3) return 12;
    if (imminent <= 6) return 6;
    return 0;
  }
  return 0;
}

export function matchesPosFilter(playerPos: Position, filter: Position | "ALL" | "FLEX"): boolean {
  if (filter === "ALL") return true;
  if (filter === "FLEX") return playerPos === "RB" || playerPos === "WR" || playerPos === "TE";
  return playerPos === filter;
}
