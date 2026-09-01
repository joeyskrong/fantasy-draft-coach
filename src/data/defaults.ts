import type { LeagueSettings, RosterSlots, Scoring } from "../types";
import { scoringPreset } from "../engine/scoring";
import { defaultCustomOrder } from "../engine/draftOrder";
import { keepersFromLeagueConfig, LEAGUE_CONFIG } from "./leagueConfig";

export const DEFAULT_ROSTER: RosterSlots = {
  qb: 1,
  rb: 2,
  wr: 2,
  te: 1,
  k: 1,
  dst: 1,
  flex1: 1,
  flex2: 0,
  flex1Pos: ["RB", "WR", "TE"],
  flex2Pos: ["RB", "WR", "TE"],
  bench: 6,
};

export function defaultTeamNames(n: number, userPick = 1): string[] {
  return Array.from({ length: n }, (_, i) => (i === userPick - 1 ? "You" : `Team ${i + 1}`));
}

export function defaultSettings(): LeagueSettings {
  const teams = LEAGUE_CONFIG.teams ?? 12;
  const userPick = LEAGUE_CONFIG.userPick ?? 7;
  const roster = { ...DEFAULT_ROSTER, flex1Pos: [...DEFAULT_ROSTER.flex1Pos], flex2Pos: [...DEFAULT_ROSTER.flex2Pos] };
  const rounds = roster.qb + roster.rb + roster.wr + roster.te + roster.k + roster.dst + roster.flex1 + roster.flex2 + roster.bench;
  return {
    teams,
    userPick,
    draftType: LEAGUE_CONFIG.draftType ?? "keeper",
    orderType: "snake",
    scoringPreset: "ppr",
    scoring: scoringPreset("ppr"),
    roster,
    keepers: keepersFromLeagueConfig(userPick),
    customOrder: defaultCustomOrder(teams, rounds),
    teamNames: defaultTeamNames(teams, userPick),
  };
}

export function withScoring(settings: LeagueSettings, scoring: Scoring, preset: LeagueSettings["scoringPreset"]): LeagueSettings {
  return { ...settings, scoring, scoringPreset: preset };
}

export function withLatestKeepers(settings: LeagueSettings): LeagueSettings {
  const latest = defaultSettings();
  return {
    ...settings,
    keepers: latest.keepers,
    userPick: latest.userPick,
    teams: latest.teams,
    draftType: latest.draftType,
  };
}
