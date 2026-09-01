import { describe, expect, it } from "vitest";
import { availability, normalCdf } from "../engine/availability";
import { formatPick, ownerForPick, snakeOwner, buildBoard, totalPicks, refreshKeeperPicks } from "../engine/draftOrder";
import { scoringPreset, projectPoints } from "../engine/scoring";
import { rankPlayers } from "../engine/vor";
import { remainingNeeds, positionExpectedValue, bestNeedPlan, allPositionEVs } from "../engine/pdr";
import { recommend, matchesPosFilter } from "../engine/recommend";
import { gradeDraft } from "../engine/grades";
import { createDraft } from "../state/draftStore";
import { defaultSettings } from "../data/defaults";
import { LEAGUE_CONFIG, unresolvedKeepers } from "../data/leagueConfig";
import { PLAYER_POOL } from "../data/players";
import { EMPTY_STATS } from "../engine/scoring";
import type { Player } from "../types";

describe("availability", () => {
  it("matches the Golden Tate example (~84% at pick 60, ADP 66, SD 6.1)", () => {
    const p = availability(60, 66, 6.1);
    expect(p).toBeGreaterThan(0.8);
    expect(p).toBeLessThan(0.9);
  });

  it("is near 1 well before ADP and near 0 well after", () => {
    expect(availability(1, 50, 8)).toBeGreaterThan(0.99);
    expect(availability(80, 20, 6)).toBeLessThan(0.01);
  });

  it("normalCdf is symmetric", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1) + normalCdf(-1)).toBeCloseTo(1, 5);
  });
});

describe("draft order", () => {
  it("snakes odd and even rounds", () => {
    expect(snakeOwner(1, 12)).toBe(1);
    expect(snakeOwner(12, 12)).toBe(12);
    expect(snakeOwner(13, 12)).toBe(12);
    expect(snakeOwner(24, 12)).toBe(1);
    expect(ownerForPick(3, 12, "snake", [])).toBe(3);
    expect(formatPick(14, 12)).toBe("2.02");
  });

  it("pre-fills keepers from config/league.json", () => {
    const settings = defaultSettings();
    expect(settings.draftType).toBe("keeper");
    expect(settings.userPick).toBe(7);
    expect(unresolvedKeepers()).toEqual([]);
    expect(settings.keepers).toHaveLength(LEAGUE_CONFIG.keepers.length);

    const yours = settings.keepers.filter((k) => k.teamIndex === 7);
    expect(yours.map((k) => PLAYER_POOL.find((p) => p.id === k.playerId)?.name)).toEqual([
      "George Pickens",
      "Jameson Williams",
      "Tucker Kraft",
    ]);
    expect(yours.map((k) => k.round)).toEqual([4, 7, 10]);

    const monty = settings.keepers.find((k) => PLAYER_POOL.find((p) => p.id === k.playerId)?.name === "David Montgomery");
    expect(monty?.teamIndex).toBe(1);
    expect(monty?.round).toBe(5);

    const board = buildBoard(settings);
    const pickens = PLAYER_POOL.find((p) => p.name === "George Pickens")!;
    const chase = PLAYER_POOL.find((p) => p.name === "Ja'Marr Chase")!;
    expect(board.find((p) => p.round === 4 && p.teamIndex === 7)?.playerId).toBe(pickens.id);
    expect(board.find((p) => p.round === 10 && p.teamIndex === 7)?.playerId).toBe(
      PLAYER_POOL.find((p) => p.name === "Tucker Kraft")!.id,
    );
    expect(board.find((p) => p.round === 1 && p.teamIndex === 4)?.playerId).toBe(chase.id);
    expect(board.find((p) => p.round === 5 && p.teamIndex === 1)?.playerId).toBe(
      PLAYER_POOL.find((p) => p.name === "David Montgomery")!.id,
    );
    expect(board.find((p) => p.round === 1 && p.teamIndex === 1)?.playerId).toBeNull();

    const stale = buildBoard({
      ...settings,
      keepers: settings.keepers.map((k) =>
        k.playerId === PLAYER_POOL.find((p) => p.name === "David Montgomery")!.id ? { ...k, round: null } : k,
      ),
    });
    expect(stale.find((p) => p.round === 1 && p.teamIndex === 1)?.keeper).toBe(true);
    const refreshed = refreshKeeperPicks(stale, settings);
    expect(refreshed.find((p) => p.round === 1 && p.teamIndex === 1)?.playerId).toBeNull();
    expect(refreshed.find((p) => p.round === 5 && p.teamIndex === 1)?.playerId).toBe(
      PLAYER_POOL.find((p) => p.name === "David Montgomery")!.id,
    );
  });

  it("builds a full board with keepers", () => {
    const settings = defaultSettings();
    settings.draftType = "keeper";
    settings.keepers = [{ playerId: PLAYER_POOL[0].id, teamIndex: 1, round: 3 }];
    const board = buildBoard(settings);
    expect(board).toHaveLength(totalPicks(settings));
    const kept = board.find((p) => p.round === 3 && p.teamIndex === 1);
    expect(kept?.playerId).toBe(PLAYER_POOL[0].id);
    expect(kept?.keeper).toBe(true);
  });
});

describe("scoring and VOR", () => {
  it("awards a point per reception in PPR", () => {
    const stats = { ...EMPTY_STATS, rec: 10, recYds: 100 };
    expect(projectPoints(stats, scoringPreset("ppr"))).toBeCloseTo(20, 5);
    expect(projectPoints(stats, scoringPreset("half"))).toBeCloseTo(15, 5);
    expect(projectPoints(stats, scoringPreset("std"))).toBeCloseTo(10, 5);
  });

  it("ranks elite RBs with large VOR", () => {
    const ranked = rankPlayers(PLAYER_POOL, scoringPreset("ppr"));
    const gibbs = ranked.find((p) => p.name === "Jahmyr Gibbs");
    const replacementRb = ranked.filter((p) => p.pos === "RB").at(-10);
    expect(gibbs).toBeTruthy();
    expect(gibbs!.vor).toBeGreaterThan(80);
    expect(gibbs!.proj).toBeGreaterThan(replacementRb!.proj);
  });
});

describe("PDR engine", () => {
  it("gives higher early-round EV to RB than K", () => {
    const rb = positionExpectedValue(1, "RB", PLAYER_POOL, scoringPreset("ppr"));
    const k = positionExpectedValue(1, "K", PLAYER_POOL, scoringPreset("ppr"));
    expect(rb.ev).toBeGreaterThan(k.ev + 80);
  });

  it("plans RB before kicker when both are needed", () => {
    const available = PLAYER_POOL;
    const scoring = scoringPreset("ppr");
    const picks = [3, 22, 27];
    const evByPick = Object.fromEntries(picks.map((n) => [n, allPositionEVs(n, available, scoring)]));
    const plan = bestNeedPlan(
      picks,
      [
        { kind: "starter", pos: "RB" },
        { kind: "starter", pos: "WR" },
        { kind: "starter", pos: "K" },
      ],
      evByPick,
    );
    expect(plan.sequence[0]).not.toBe("K");
    expect(plan.total).toBeGreaterThan(400);
  });

  it("remaining needs fill flex after starters", () => {
    const needs = remainingNeeds(defaultSettings().roster, ["RB", "RB", "WR", "WR", "TE", "QB"], 6);
    expect(needs.some((n) => n.kind === "flex")).toBe(true);
  });
});

describe("recommendations and grades", () => {
  it("recommends a skill player at pick 1", () => {
    const draft = createDraft(defaultSettings());
    const recs = recommend(draft);
    expect(recs[0].recommended).toBe(true);
    expect(["RB", "WR", "TE", "QB"]).toContain(recs[0].pos);
    expect(recs[0].tier).toBe(1);
  });

  it("prioritizes RB and will not take QB, K, or DST on the first pick", () => {
    const draft = createDraft(defaultSettings());
    const recs = recommend(draft);
    expect(recs[0].pos).toBe("RB");
    expect(recs.slice(0, 8).some((r) => r.pos === "QB" || r.pos === "K" || r.pos === "DST")).toBe(false);
  });

  it("holds K and DST until round 9", () => {
    const draft = createDraft(defaultSettings());
    const round8 = draft.picks.find((p) => p.teamIndex === draft.settings.userPick && p.round === 8)!;
    draft.currentOverall = round8.overall;
    const recs = recommend(draft);
    expect(recs[0].pos !== "K" && recs[0].pos !== "DST").toBe(true);
    expect(recs.some((r) => r.recommended && (r.pos === "K" || r.pos === "DST"))).toBe(false);
  });

  it("will take an elite QB who has fallen well past ADP once RB/FLEX holes are filled", () => {
    const draft = createDraft(defaultSettings());
    const rbs = PLAYER_POOL.filter((p) => p.pos === "RB").sort((a, b) => a.adp - b.adp);
    const wrs = PLAYER_POOL.filter((p) => p.pos === "WR").sort((a, b) => a.adp - b.adp);
    const userIds = [rbs[4].id, rbs[5].id, wrs[8].id];
    const already = new Set(draft.picks.filter((p) => p.playerId).map((p) => p.playerId as string));
    const filler = PLAYER_POOL.filter(
      (p) => !already.has(p.id) && !userIds.includes(p.id) && p.name !== "Josh Allen" && p.pos !== "K" && p.pos !== "DST",
    ).sort((a, b) => a.adp - b.adp);
    let fi = 0;
    let ui = 0;
    draft.picks = draft.picks.map((p) => {
      if (p.playerId) return p;
      if (p.overall >= 55) return p;
      if (p.teamIndex === draft.settings.userPick && ui < userIds.length) {
        return { ...p, playerId: userIds[ui++] };
      }
      const next = filler[fi++];
      return next ? { ...p, playerId: next.id } : p;
    });
    const round5 = draft.picks.find((p) => p.teamIndex === draft.settings.userPick && p.round === 5)!;
    draft.currentOverall = round5.overall;
    const recs = recommend(draft);
    expect(recs[0].pos).toBe("QB");
    expect(["Josh Allen", "Lamar Jackson", "Drake Maye", "Joe Burrow", "Dak Prescott"]).toContain(recs[0].name);
  });

  it("filters FLEX to RB/WR/TE", () => {
    expect(matchesPosFilter("RB", "FLEX")).toBe(true);
    expect(matchesPosFilter("WR", "FLEX")).toBe(true);
    expect(matchesPosFilter("TE", "FLEX")).toBe(true);
    expect(matchesPosFilter("QB", "FLEX")).toBe(false);
    expect(matchesPosFilter("K", "FLEX")).toBe(false);
  });

  it("will not recommend a second QB before round 11, and will not make one the pick even later", () => {
    const draft = createDraft(defaultSettings());
    const qb = PLAYER_POOL.find((p) => p.pos === "QB" && p.name === "Drake Maye")!;
    const firstOpen = draft.picks.find((p) => p.teamIndex === draft.settings.userPick && !p.playerId)!;
    draft.picks = draft.picks.map((p) => (p.overall === firstOpen.overall ? { ...p, playerId: qb.id } : p));

    const round10 = draft.picks.find((p) => p.teamIndex === draft.settings.userPick && p.round === 10)!;
    draft.currentOverall = round10.overall;
    const recs10 = recommend(draft);
    expect(recs10.slice(0, 8).some((r) => r.pos === "QB")).toBe(false);
    expect(recs10.some((r) => r.recommended && r.pos === "QB")).toBe(false);

    const round11 = draft.picks.find((p) => p.teamIndex === draft.settings.userPick && p.round === 11)!;
    draft.currentOverall = round11.overall;
    const recs11 = recommend(draft);
    expect(recs11[0].recommended).toBe(true);
    expect(recs11[0].pos).not.toBe("QB");
    expect(recs11.some((r) => r.recommended && r.pos === "QB")).toBe(false);
  });

  it("grades a completed mock", () => {
    const draft = createDraft(defaultSettings());
    const taken = new Set<string>();
    draft.picks = draft.picks.map((pick) => {
      const next = PLAYER_POOL.find((p) => !taken.has(p.id));
      if (!next) return pick;
      taken.add(next.id);
      return { ...pick, playerId: next.id };
    });
    draft.currentOverall = draft.picks.length + 1;
    const grades = gradeDraft(draft);
    expect(grades).toHaveLength(12);
    expect(grades[0].points).toBeGreaterThan(grades[grades.length - 1].points);
    expect(grades[0].grade).toMatch(/A/);
  });

  it("builds a realistic player pool", () => {
    const qbs = PLAYER_POOL.filter((p: Player) => p.pos === "QB");
    expect(PLAYER_POOL.length).toBeGreaterThan(200);
    expect(qbs.length).toBeGreaterThan(20);
    expect(PLAYER_POOL.find((p) => p.name === "Jahmyr Gibbs")?.handcuffIds.length).toBeGreaterThan(0);
  });
});
