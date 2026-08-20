import type { Player, PlayerStats, Position } from "../types";
import { EMPTY_STATS } from "../engine/scoring";
import { RAW_PLAYERS } from "./rawPlayers";

function slug(name: string, team: string, pos: Position): string {
  return `${name}-${team}-${pos}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lerp(rank: number, anchors: [number, number][]): number {
  if (rank <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (rank >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [r0, v0] = anchors[i - 1];
    const [r1, v1] = anchors[i];
    if (rank <= r1) {
      const t = (rank - r0) / (r1 - r0);
      return v0 + (v1 - v0) * t;
    }
  }
  return last[1];
}

function pprTarget(pos: Position, rank: number): number {
  if (pos === "QB") return lerp(rank, [[1, 378], [3, 352], [6, 328], [12, 286], [18, 248], [24, 218], [32, 180]]);
  if (pos === "RB") return lerp(rank, [[1, 328], [3, 300], [6, 262], [12, 218], [18, 188], [24, 162], [36, 122], [48, 92], [72, 58]]);
  if (pos === "WR") return lerp(rank, [[1, 336], [3, 312], [6, 278], [12, 236], [18, 208], [24, 184], [36, 154], [48, 128], [72, 96], [96, 72]]);
  if (pos === "TE") return lerp(rank, [[1, 272], [2, 258], [4, 198], [8, 156], [12, 136], [18, 112], [24, 90]]);
  if (pos === "K") return lerp(rank, [[1, 158], [6, 142], [12, 130], [24, 112]]);
  return lerp(rank, [[1, 148], [4, 132], [8, 118], [16, 102], [32, 82]]);
}

function statsFor(pos: Position, rank: number): PlayerStats {
  const s = { ...EMPTY_STATS };
  const pts = pprTarget(pos, rank);
  if (pos === "QB") {
    const rushShare = lerp(rank, [[1, 0.22], [4, 0.16], [12, 0.1], [24, 0.05]]);
    s.rushYds = Math.round(pts * rushShare * 8);
    s.rushTd = Math.max(0, Math.round(lerp(rank, [[1, 7], [6, 4], [12, 2], [24, 1]])));
    s.passTd = Math.round(lerp(rank, [[1, 34], [6, 28], [12, 24], [24, 18]]));
    s.passInt = Math.round(lerp(rank, [[1, 10], [12, 12], [24, 14]]));
    s.fumLost = 3;
    const leftover = pts - (s.rushYds * 0.1 + s.rushTd * 6 + s.passTd * 4 + s.passInt * -2 + s.fumLost * -2);
    s.passYds = Math.max(1800, Math.round(leftover / 0.04));
    return s;
  }
  if (pos === "RB") {
    s.rec = Math.round(lerp(rank, [[1, 72], [6, 52], [12, 40], [24, 28], [36, 18], [60, 10]]));
    s.recYds = Math.round(s.rec * lerp(rank, [[1, 8.2], [12, 7.4], [36, 6.6]]));
    s.recTd = Math.max(1, Math.round(lerp(rank, [[1, 5], [12, 3], [24, 2], [48, 1]])));
    s.rushTd = Math.max(1, Math.round(lerp(rank, [[1, 13], [6, 10], [12, 8], [24, 5], [36, 3], [60, 2]])));
    s.fumLost = rank <= 24 ? 2 : 1;
    const leftover = pts - (s.rec * 1 + s.recYds * 0.1 + s.recTd * 6 + s.rushTd * 6 + s.fumLost * -2);
    s.rushYds = Math.max(200, Math.round(leftover / 0.1));
    s.rushAtt = Math.round(s.rushYds / lerp(rank, [[1, 4.8], [12, 4.4], [36, 4.0]]));
    return s;
  }
  if (pos === "WR" || pos === "TE") {
    s.rec = Math.round(
      pos === "TE"
        ? lerp(rank, [[1, 96], [4, 72], [8, 58], [16, 42], [24, 32]])
        : lerp(rank, [[1, 118], [6, 96], [12, 82], [24, 68], [48, 52], [72, 40]]),
    );
    s.recYds = Math.round(s.rec * (pos === "TE" ? lerp(rank, [[1, 11.4], [8, 10.4], [16, 9.6]]) : lerp(rank, [[1, 13.4], [12, 12.6], [36, 11.6]])));
    s.recTd = Math.max(1, Math.round(pos === "TE" ? lerp(rank, [[1, 10], [4, 6], [12, 4], [20, 3]]) : lerp(rank, [[1, 11], [6, 8], [12, 7], [24, 5], [48, 3]])));
    s.rushYds = pos === "WR" && rank <= 20 ? Math.round(lerp(rank, [[1, 40], [20, 10]])) : 0;
    s.fumLost = 1;
    return s;
  }
  if (pos === "K") {
    s.xp = Math.round(lerp(rank, [[1, 48], [12, 38], [24, 30]]));
    s.fg30_39 = Math.round(lerp(rank, [[1, 10], [12, 8], [24, 6]]));
    s.fg40_49 = Math.round(lerp(rank, [[1, 10], [12, 8], [24, 6]]));
    s.fg50 = Math.round(lerp(rank, [[1, 8], [12, 5], [24, 3]]));
    s.fg20_29 = Math.round(lerp(rank, [[1, 6], [12, 5], [24, 4]]));
    s.fg0_19 = 1;
    return s;
  }
  s.defSack = Math.round(lerp(rank, [[1, 48], [8, 40], [16, 32], [32, 24]]));
  s.defInt = Math.round(lerp(rank, [[1, 18], [8, 14], [16, 11], [32, 8]]));
  s.defFum = Math.round(lerp(rank, [[1, 14], [8, 11], [16, 8], [32, 6]]));
  s.defTd = Math.round(lerp(rank, [[1, 5], [8, 3], [16, 2], [32, 1]]));
  s.defSafety = rank <= 8 ? 1 : 0;
  s.defBlockedKick = rank <= 12 ? 1 : 0;
  s.defPtsAllowed = Math.round(lerp(rank, [[1, 300], [8, 340], [16, 380], [32, 430]]));
  return s;
}

export function buildPlayerPool(): Player[] {
  const ranks: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  const players: Player[] = RAW_PLAYERS.map((raw) => {
    ranks[raw.pos] += 1;
    const adpStd = raw.adpStd > 0 ? raw.adpStd : Math.max(6, raw.adp * 0.12);
    return {
      id: slug(raw.name, raw.team, raw.pos),
      name: raw.name,
      team: raw.team,
      pos: raw.pos,
      bye: raw.bye,
      adp: raw.adp,
      adpStd,
      stats: statsFor(raw.pos, ranks[raw.pos]),
      handcuffIds: [],
    };
  });

  const rbsByTeam = new Map<string, Player[]>();
  for (const p of players) {
    if (p.pos !== "RB") continue;
    const list = rbsByTeam.get(p.team) ?? [];
    list.push(p);
    rbsByTeam.set(p.team, list);
  }
  for (const group of rbsByTeam.values()) {
    group.sort((a, b) => a.adp - b.adp);
    const starter = group[0];
    if (!starter) continue;
    starter.handcuffIds = group.slice(1).map((p) => p.id);
    for (const cuff of group.slice(1)) cuff.handcuffIds = [starter.id];
  }
  return players;
}

export const PLAYER_POOL = buildPlayerPool();
