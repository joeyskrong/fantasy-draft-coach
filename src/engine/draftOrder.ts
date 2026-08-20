import type { DraftOrderType, DraftPick, Keeper, LeagueSettings } from "../types";

export function snakeOwner(overall: number, teams: number): number {
  const round = Math.ceil(overall / teams);
  const posInRound = ((overall - 1) % teams) + 1;
  if (round % 2 === 1) return posInRound;
  return teams - posInRound + 1;
}

export function linearOwner(overall: number, teams: number): number {
  return ((overall - 1) % teams) + 1;
}

export function ownerForPick(
  overall: number,
  teams: number,
  orderType: DraftOrderType,
  customOrder: number[],
): number {
  if (orderType === "linear") return linearOwner(overall, teams);
  if (orderType === "custom") {
    const idx = overall - 1;
    const owner = customOrder[idx];
    if (owner && owner >= 1 && owner <= teams) return owner;
    return snakeOwner(overall, teams);
  }
  return snakeOwner(overall, teams);
}

export function totalPicks(settings: LeagueSettings): number {
  const r = settings.roster;
  const starters =
    r.qb + r.rb + r.wr + r.te + r.k + r.dst + r.flex1 + r.flex2 + r.bench;
  return settings.teams * starters;
}

export function buildBoard(settings: LeagueSettings): DraftPick[] {
  const n = totalPicks(settings);
  const picks: DraftPick[] = [];
  for (let overall = 1; overall <= n; overall++) {
    const round = Math.ceil(overall / settings.teams);
    const slot = ((overall - 1) % settings.teams) + 1;
    picks.push({
      overall,
      round,
      slot,
      teamIndex: ownerForPick(overall, settings.teams, settings.orderType, settings.customOrder),
      playerId: null,
      keeper: false,
    });
  }
  applyKeepers(picks, settings);
  return picks;
}

function applyKeepers(picks: DraftPick[], settings: LeagueSettings) {
  for (const k of settings.keepers) {
    if (k.round == null) {
      const next = picks.find((p) => p.teamIndex === k.teamIndex && p.playerId == null);
      if (next) {
        next.playerId = k.playerId;
        next.keeper = true;
      }
    } else {
      const target = picks.find(
        (p) => p.teamIndex === k.teamIndex && p.round === k.round && p.playerId == null,
      );
      if (target) {
        target.playerId = k.playerId;
        target.keeper = true;
      }
    }
  }
}

export function firstOpenOverall(picks: DraftPick[]): number {
  const open = picks.find((p) => p.playerId == null);
  return open ? open.overall : picks.length + 1;
}

export function userPickOveralls(settings: LeagueSettings, total: number): number[] {
  const out: number[] = [];
  for (let overall = 1; overall <= total; overall++) {
    if (
      ownerForPick(overall, settings.teams, settings.orderType, settings.customOrder) ===
      settings.userPick
    ) {
      out.push(overall);
    }
  }
  return out;
}

export function formatPick(overall: number, teams: number): string {
  const round = Math.ceil(overall / teams);
  const slot = ((overall - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, "0")}`;
}

export function defaultCustomOrder(teams: number, rounds: number): number[] {
  const order: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    if (round % 2 === 1) {
      for (let t = 1; t <= teams; t++) order.push(t);
    } else {
      for (let t = teams; t >= 1; t--) order.push(t);
    }
  }
  return order;
}

export function isKeeperTaken(keepers: Keeper[], playerId: string): boolean {
  return keepers.some((k) => k.playerId === playerId);
}
