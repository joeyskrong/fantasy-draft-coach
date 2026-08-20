import type { Player, Position, Scoring } from "../types";
import { projectPoints } from "./scoring";

export type RankedPlayer = Player & {
  proj: number;
  vor: number;
  posRank: number;
};

const REPLACEMENT_RANKS: Record<Position, number> = {
  QB: 12,
  RB: 30,
  WR: 36,
  TE: 12,
  K: 12,
  DST: 12,
};

export function rankPlayers(players: Player[], scoring: Scoring, teams = 12): RankedPlayer[] {
  const withProj = players.map((p) => ({ ...p, proj: projectPoints(p.stats, scoring), vor: 0, posRank: 0 }));
  const byPos: Record<Position, RankedPlayer[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DST: [],
  };
  for (const p of withProj) byPos[p.pos].push(p);
  for (const pos of Object.keys(byPos) as Position[]) {
    byPos[pos].sort((a, b) => b.proj - a.proj || a.adp - b.adp);
    const replacementRank = Math.max(1, Math.round((REPLACEMENT_RANKS[pos] / 12) * teams));
    const replacement = byPos[pos][replacementRank - 1]?.proj ?? 0;
    byPos[pos].forEach((p, i) => {
      p.posRank = i + 1;
      p.vor = Math.round((p.proj - replacement) * 10) / 10;
    });
  }
  return withProj.sort((a, b) => b.vor - a.vor || b.proj - a.proj);
}

export function replacementLevel(ranked: RankedPlayer[], pos: Position): number {
  const list = ranked.filter((p) => p.pos === pos).sort((a, b) => b.proj - a.proj);
  const idx = Math.min(REPLACEMENT_RANKS[pos] - 1, list.length - 1);
  return list[Math.max(0, idx)]?.proj ?? 0;
}
