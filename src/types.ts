export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type FlexPosition = "QB" | "RB" | "WR" | "TE";
export type ScoringPreset = "std" | "half" | "ppr" | "custom";
export type DraftType = "redraft" | "keeper";
export type DraftOrderType = "snake" | "linear" | "custom";
export type Screen = "home" | "setup" | "draft" | "results";

export type PlayerStats = {
  passYds: number;
  passTd: number;
  passInt: number;
  sack: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  fumLost: number;
  twoPt: number;
  fg0_19: number;
  fg20_29: number;
  fg30_39: number;
  fg40_49: number;
  fg50: number;
  xp: number;
  defSack: number;
  defInt: number;
  defFum: number;
  defTd: number;
  defSafety: number;
  defBlockedKick: number;
  defPtsAllowed: number;
};

export type Player = {
  id: string;
  name: string;
  team: string;
  pos: Position;
  bye: number;
  adp: number;
  adpStd: number;
  stats: PlayerStats;
  handcuffIds: string[];
};

export type Scoring = {
  passYd: number;
  passTd: number;
  passInt: number;
  sack: number;
  rushYd: number;
  rushTd: number;
  rec: number;
  recYd: number;
  recTd: number;
  recFirstDown: number;
  rushFirstDown: number;
  fumLost: number;
  twoPt: number;
  bonusPass300: number;
  bonusPass350: number;
  bonusPass400: number;
  bonusRush100: number;
  bonusRush150: number;
  bonusRush200: number;
  bonusRec100: number;
  bonusRec150: number;
  bonusRec200: number;
  fg0_19: number;
  fg20_29: number;
  fg30_39: number;
  fg40_49: number;
  fg50: number;
  xp: number;
  defSack: number;
  defInt: number;
  defFum: number;
  defTd: number;
  defSafety: number;
  defBlockedKick: number;
};

export type RosterSlots = {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  k: number;
  dst: number;
  flex1: number;
  flex2: number;
  flex1Pos: FlexPosition[];
  flex2Pos: FlexPosition[];
  bench: number;
};

export type Keeper = {
  playerId: string;
  teamIndex: number;
  round: number | null;
};

export type LeagueSettings = {
  teams: number;
  userPick: number;
  draftType: DraftType;
  orderType: DraftOrderType;
  scoringPreset: ScoringPreset;
  scoring: Scoring;
  roster: RosterSlots;
  keepers: Keeper[];
  customOrder: number[];
  teamNames: string[];
};

export type DraftPick = {
  overall: number;
  round: number;
  slot: number;
  teamIndex: number;
  playerId: string | null;
  keeper: boolean;
};

export type HighlightColor = "green" | "gold" | "red" | "blue" | "purple";

export type DraftState = {
  id: string;
  settings: LeagueSettings;
  players: Player[];
  picks: DraftPick[];
  currentOverall: number;
  highlights: Record<string, HighlightColor>;
  createdAt: string;
};
