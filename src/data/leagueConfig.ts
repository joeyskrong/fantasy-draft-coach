import type { DraftType, Keeper, Player } from "../types";
import { PLAYER_POOL } from "./players";
import leagueJson from "../../config/league.json";

export type LeagueKeeperConfig = {
  name: string;
  team?: string;
  round: number;
  teamIndex?: number;
};

export type LeagueConfigFile = {
  draftType?: DraftType;
  keepers: LeagueKeeperConfig[];
};

export const LEAGUE_CONFIG = leagueJson as LeagueConfigFile;

export function findPlayerByKeeper(config: LeagueKeeperConfig, players: Player[] = PLAYER_POOL): Player | undefined {
  const name = config.name.trim().toLowerCase();
  const team = config.team?.trim().toUpperCase();
  return players.find((p) => {
    if (p.name.toLowerCase() !== name) return false;
    if (team && p.team.toUpperCase() !== team) return false;
    return true;
  });
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
        round: row.round,
      },
    ];
  });
}

export function keepersFromLeagueConfig(userPick: number, players: Player[] = PLAYER_POOL): Keeper[] {
  return resolveKeepers(LEAGUE_CONFIG.keepers, userPick, players);
}
