import type { FlexPosition, Player, Position, RosterSlots, Scoring } from "../types";
import { availability, pBestAvailable } from "./availability";
import { projectPoints } from "./scoring";

export type NeedSlot =
  | { kind: "starter"; pos: Position }
  | { kind: "flex"; id: "flex1" | "flex2"; eligible: FlexPosition[] }
  | { kind: "bench" };

export type PositionValue = {
  pos: Position;
  ev: number;
  bestId: string | null;
  bestProj: number;
};

export function remainingNeeds(
  roster: RosterSlots,
  draftedPos: Position[],
  lookAhead: number,
): NeedSlot[] {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  let flex1 = 0;
  let flex2 = 0;
  let bench = 0;

  const startersLeft = (pos: Position) => {
    const cap = slotCap(roster, pos);
    return Math.max(0, cap - counts[pos]);
  };

  for (const pos of draftedPos) {
    if (startersLeft(pos) > 0) {
      counts[pos] += 1;
      continue;
    }
    if (flex1 < roster.flex1 && roster.flex1Pos.includes(pos as FlexPosition)) {
      flex1 += 1;
      continue;
    }
    if (flex2 < roster.flex2 && roster.flex2Pos.includes(pos as FlexPosition)) {
      flex2 += 1;
      continue;
    }
    bench += 1;
  }

  const needs: NeedSlot[] = [];
  (["QB", "RB", "WR", "TE", "K", "DST"] as Position[]).forEach((pos) => {
    const left = Math.max(0, slotCap(roster, pos) - counts[pos]);
    for (let i = 0; i < left; i++) needs.push({ kind: "starter", pos });
  });
  for (let i = 0; i < Math.max(0, roster.flex1 - flex1); i++) {
    needs.push({ kind: "flex", id: "flex1", eligible: roster.flex1Pos });
  }
  for (let i = 0; i < Math.max(0, roster.flex2 - flex2); i++) {
    needs.push({ kind: "flex", id: "flex2", eligible: roster.flex2Pos });
  }
  const benchLeft = Math.max(0, roster.bench - bench);
  for (let i = 0; i < benchLeft; i++) needs.push({ kind: "bench" });

  // Original FDC gradually introduces bench after starters are mapped.
  const starterCount = needs.filter((n) => n.kind !== "bench").length;
  const benchToInclude = Math.min(
    benchLeft,
    Math.max(0, lookAhead - starterCount),
    Math.max(1, Math.floor(lookAhead / 3)),
  );
  const starters = needs.filter((n) => n.kind !== "bench");
  const benches = needs.filter((n) => n.kind === "bench").slice(0, benchToInclude);
  return [...starters, ...benches].slice(0, lookAhead);
}

function slotCap(roster: RosterSlots, pos: Position): number {
  if (pos === "QB") return roster.qb;
  if (pos === "RB") return roster.rb;
  if (pos === "WR") return roster.wr;
  if (pos === "TE") return roster.te;
  if (pos === "K") return roster.k;
  return roster.dst;
}

export function positionExpectedValue(
  pick: number,
  pos: Position,
  available: Player[],
  scoring: Scoring,
): PositionValue {
  const pool = available
    .filter((p) => p.pos === pos)
    .map((p) => ({ player: p, proj: projectPoints(p.stats, scoring) }))
    .sort((a, b) => b.proj - a.proj)
    .slice(0, 18);

  let ev = 0;
  let bestId: string | null = null;
  let bestProj = 0;
  const better: { adp: number; adpStd: number }[] = [];

  for (const row of pool) {
    const pBest = pBestAvailable(pick, row.player.adp, row.player.adpStd, better);
    ev += row.proj * pBest;
    if (!bestId) {
      bestId = row.player.id;
      bestProj = row.proj;
    }
    better.push({ adp: row.player.adp, adpStd: row.player.adpStd });
  }

  return { pos, ev, bestId, bestProj };
}

export function allPositionEVs(
  pick: number,
  available: Player[],
  scoring: Scoring,
): Record<Position, PositionValue> {
  const positions: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
  const out = {} as Record<Position, PositionValue>;
  for (const pos of positions) {
    out[pos] = positionExpectedValue(pick, pos, available, scoring);
  }
  return out;
}

type Plan = { total: number; firstKey: string; sequence: string[] };

const planCache = new Map<string, Plan>();

export function clearPlanCache() {
  planCache.clear();
}

export function bestNeedPlan(
  picks: number[],
  needs: NeedSlot[],
  evByPick: Record<number, Record<Position, PositionValue>>,
): Plan {
  planCache.clear();
  return search(picks, needs, evByPick);
}

function search(
  picks: number[],
  needs: NeedSlot[],
  evByPick: Record<number, Record<Position, PositionValue>>,
): Plan {
  if (picks.length === 0 || needs.length === 0) return { total: 0, firstKey: "", sequence: [] };
  const key = `${picks[0]}|${picks.length}|${needKey(needs)}`;
  const hit = planCache.get(key);
  if (hit) return hit;

  const pick = picks[0];
  const restPicks = picks.slice(1);
  const options = uniqueNeedKeys(needs);
  let best: Plan = { total: -Infinity, firstKey: options[0] ?? "", sequence: [] };

  for (const opt of options) {
    const ev = evForNeed(opt, evByPick[pick]);
    const nextNeeds = consumeNeed(needs, opt);
    const rest = search(restPicks, nextNeeds, evByPick);
    const total = ev + rest.total;
    if (total > best.total) {
      best = { total, firstKey: opt, sequence: [opt, ...rest.sequence] };
    }
  }

  planCache.set(key, best);
  return best;
}

function evForNeed(needKey: string, evs: Record<Position, PositionValue> | undefined): number {
  if (!evs) return 0;
  if (needKey.startsWith("flex:")) {
    const eligible = needKey.slice(5).split(",") as Position[];
    return Math.max(...eligible.map((p) => evs[p]?.ev ?? 0), 0);
  }
  if (needKey === "bench") {
    return Math.max(evs.RB.ev, evs.WR.ev, evs.TE.ev, evs.QB.ev * 0.55, evs.K.ev * 0.35, evs.DST.ev * 0.35);
  }
  return evs[needKey as Position]?.ev ?? 0;
}

function uniqueNeedKeys(needs: NeedSlot[]): string[] {
  const keys = needs.map(needSlotKey);
  return [...new Set(keys)];
}

function needSlotKey(n: NeedSlot): string {
  if (n.kind === "starter") return n.pos;
  if (n.kind === "bench") return "bench";
  return `flex:${[...n.eligible].sort().join(",")}`;
}

function consumeNeed(needs: NeedSlot[], key: string): NeedSlot[] {
  const idx = needs.findIndex((n) => needSlotKey(n) === key);
  if (idx < 0) return needs.slice(1);
  return [...needs.slice(0, idx), ...needs.slice(idx + 1)];
}

function needKey(needs: NeedSlot[]): string {
  return needs.map(needSlotKey).sort().join("+");
}

export function playerFitsNeed(pos: Position, needKey: string): boolean {
  if (needKey === pos) return true;
  if (needKey === "bench") return true;
  if (needKey.startsWith("flex:")) {
    const eligible = needKey.slice(5).split(",");
    return eligible.includes(pos);
  }
  return false;
}

export function survivalToPick(player: Player, pick: number): number {
  return availability(pick, player.adp, player.adpStd);
}
