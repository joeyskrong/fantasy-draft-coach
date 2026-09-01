import type { DraftType, Keeper, Player } from "../types";
import { PLAYER_POOL } from "./players";
import leagueJson from "../../config/league.json";

export type LeagueKeeperConfig = {
  name: string;
  team?: string;
  round?: number | null;
  teamIndex?: number;
};

export type LeagueConfigFile = {
  draftType?: DraftType;
  userPick?: number;
  teams?: number;
  keepers: LeagueKeeperConfig[];
};

export const LEAGUE_CONFIG = leagueJson as LeagueConfigFile;

export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findPlayerByKeeper(config: LeagueKeeperConfig, players: Player[] = PLAYER_POOL): Player | undefined {
  const name = normalizePlayerName(config.name);
  const team = config.team?.trim().toUpperCase();
  return players.find((p) => {
    if (normalizePlayerName(p.name) !== name) return false;
    if (team && p.team.toUpperCase() !== team) return false;
    return true;
  });
}

export function unresolvedKeepers(configs: LeagueKeeperConfig[] = LEAGUE_CONFIG.keepers, players: Player[] = PLAYER_POOL): string[] {
  return configs.filter((row) => !findPlayerByKeeper(row, players)).map((row) => row.name);
}

export function resolveKeepers(
  configs: LeagueKeeperConfig[],
  userPick: number,
  players: Player[] = PLAYER_POOL,
): Keeper[] {
  return configs.flatMap((row) => {
    const player = findPlayerByKeeper(row, players);
    if (!player) return [];
    return [
      {
        playerId: player.id,
        teamIndex: row.teamIndex ?? userPick,
        round: row.round ?? null,
      },
    ];
  });
}

export function keepersFromLeagueConfig(userPick: number, players: Player[] = PLAYER_POOL): Keeper[] {
  return resolveKeepers(LEAGUE_CONFIG.keepers, userPick, players);
}
