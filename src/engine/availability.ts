export function normalCdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

/** Probability a player with the given ADP is still on the board at `pick`. */
export function availability(pick: number, adp: number, adpStd: number): number {
  const sd = Math.max(adpStd, 0.8);
  return 1 - normalCdf((pick - adp) / sd);
}

/** Probability this player is the best remaining option at `pick` given higher-ranked players. */
export function pBestAvailable(
  pick: number,
  playerAdp: number,
  playerSd: number,
  better: { adp: number; adpStd: number }[],
): number {
  const pHere = availability(pick, playerAdp, playerSd);
  let pBetterGone = 1;
  for (const b of better) {
    pBetterGone *= 1 - availability(pick, b.adp, b.adpStd);
  }
  return pHere * pBetterGone;
}
