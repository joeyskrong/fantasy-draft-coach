import { describe, expect, it } from "vitest";
import { availability, normalCdf } from "../engine/availability";
import { formatPick, ownerForPick, snakeOwner, buildBoard, totalPicks } from "../engine/draftOrder";
import { scoringPreset, projectPoints } from "../engine/scoring";
import { rankPlayers } from "../engine/vor";
import { remainingNeeds, positionExpectedValue, bestNeedPlan, allPositionEVs } from "../engine/pdr";
import { recommend } from "../engine/recommend";
import { gradeDraft } from "../engine/grades";
import { createDraft } from "../state/draftStore";
import { defaultSettings } from "../data/defaults";
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
    const names = settings.keepers.map((k) => PLAYER_POOL.find((p) => p.id === k.playerId));
    expect(names.map((p) => p?.name)).toEqual(["George Pickens", "Jameson Williams", "Tucker Kraft"]);
    expect(names.map((p) => p?.team)).toEqual(["PIT", "DET", "GB"]);
    expect(settings.keepers.map((k) => k.round)).toEqual([4, 7, 11]);
    expect(settings.keepers.every((k) => k.teamIndex === settings.userPick)).toBe(true);

    const board = buildBoard(settings);
    const pickens = names[0]!;
    const kraft = names[2]!;
    expect(board.find((p) => p.round === 4 && p.teamIndex === settings.userPick)?.playerId).toBe(pickens.id);
    expect(board.find((p) => p.round === 11 && p.teamIndex === settings.userPick)?.playerId).toBe(kraft.id);
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
