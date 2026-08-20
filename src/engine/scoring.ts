import type { PlayerStats, Scoring, ScoringPreset } from "../types";

export const EMPTY_STATS: PlayerStats = {
  passYds: 0,
  passTd: 0,
  passInt: 0,
  sack: 0,
  rushAtt: 0,
  rushYds: 0,
  rushTd: 0,
  rec: 0,
  recYds: 0,
  recTd: 0,
  fumLost: 0,
  twoPt: 0,
  fg0_19: 0,
  fg20_29: 0,
  fg30_39: 0,
  fg40_49: 0,
  fg50: 0,
  xp: 0,
  defSack: 0,
  defInt: 0,
  defFum: 0,
  defTd: 0,
  defSafety: 0,
  defBlockedKick: 0,
  defPtsAllowed: 0,
};

export function scoringPreset(preset: ScoringPreset): Scoring {
  const base: Scoring = {
    passYd: 0.04,
    passTd: 4,
    passInt: -2,
    sack: 0,
    rushYd: 0.1,
    rushTd: 6,
    rec: preset === "ppr" ? 1 : preset === "half" ? 0.5 : 0,
    recYd: 0.1,
    recTd: 6,
    recFirstDown: 0,
    rushFirstDown: 0,
    fumLost: -2,
    twoPt: 2,
    bonusPass300: 0,
    bonusPass350: 0,
    bonusPass400: 0,
    bonusRush100: 0,
    bonusRush150: 0,
    bonusRush200: 0,
    bonusRec100: 0,
    bonusRec150: 0,
    bonusRec200: 0,
    fg0_19: 3,
    fg20_29: 3,
    fg30_39: 3,
    fg40_49: 4,
    fg50: 5,
    xp: 1,
    defSack: 1,
    defInt: 2,
    defFum: 2,
    defTd: 6,
    defSafety: 2,
    defBlockedKick: 2,
  };
  return base;
}

export function projectPoints(stats: PlayerStats, scoring: Scoring): number {
  let pts =
    stats.passYds * scoring.passYd +
    stats.passTd * scoring.passTd +
    stats.passInt * scoring.passInt +
    stats.sack * scoring.sack +
    stats.rushYds * scoring.rushYd +
    stats.rushTd * scoring.rushTd +
    stats.rec * scoring.rec +
    stats.recYds * scoring.recYd +
    stats.recTd * scoring.recTd +
    stats.fumLost * scoring.fumLost +
    stats.twoPt * scoring.twoPt +
    stats.fg0_19 * scoring.fg0_19 +
    stats.fg20_29 * scoring.fg20_29 +
    stats.fg30_39 * scoring.fg30_39 +
    stats.fg40_49 * scoring.fg40_49 +
    stats.fg50 * scoring.fg50 +
    stats.xp * scoring.xp +
    stats.defSack * scoring.defSack +
    stats.defInt * scoring.defInt +
    stats.defFum * scoring.defFum +
    stats.defTd * scoring.defTd +
    stats.defSafety * scoring.defSafety +
    stats.defBlockedKick * scoring.defBlockedKick;

  if (stats.passYds >= 400) pts += scoring.bonusPass400;
  else if (stats.passYds >= 350 * 17) pts += scoring.bonusPass350;
  else if (stats.passYds >= 300 * 17) pts += scoring.bonusPass300;

  // Season-long bonuses: apply a modest expected count of weekly bonuses.
  const rushWeeks100 = clamp((stats.rushYds - 400) / 220, 0, 10);
  const recWeeks100 = clamp((stats.recYds - 400) / 220, 0, 10);
  pts += rushWeeks100 * scoring.bonusRush100;
  pts += recWeeks100 * scoring.bonusRec100;

  pts += defensePointsAllowed(stats.defPtsAllowed, scoring);
  return round1(pts);
}

function defensePointsAllowed(pa: number, scoring: Scoring): number {
  if (pa <= 0) return 0;
  const perGame = pa / 17;
  let weekly = 0;
  if (perGame === 0) weekly = 10;
  else if (perGame < 7) weekly = 8;
  else if (perGame < 14) weekly = 5;
  else if (perGame < 21) weekly = 2;
  else if (perGame < 28) weekly = 0;
  else if (perGame < 35) weekly = -1;
  else weekly = -4;
  // Standard DST PA scoring isn't always configured; keep a small built-in curve
  // so DST projections stay differentiated even with default scoring.
  void scoring;
  return weekly * 17 * 0.35;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
