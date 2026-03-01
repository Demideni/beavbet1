export type BeavRankTier = "Bronze" | "Silver" | "Gold" | "Diamond" | "Elite";

export type BeavRankMeta = {
  points: number;
  tier: BeavRankTier;
  division: "III" | "II" | "I" | "";
  label: string; // e.g. "Silver II"
  nextLabel: string | null; // e.g. "Silver I" or "Gold III"
  // Progress inside the current division (0..1)
  progress: number;
  // Bounds of the current division [min, max)
  min: number;
  max: number;
};

/**
 * BeavRank is a points system (we reuse existing arena_ratings.dam_rank as points).
 * Tiers:
 *  - Bronze:   0..999
 *  - Silver:   1000..1399
 *  - Gold:     1400..1699
 *  - Diamond:  1700..1999
 *  - Elite:    2000+
 *
 * Each tier (except Elite) has 3 divisions: III (low), II, I (high).
 */
export function getBeavRankMeta(pointsRaw: number): BeavRankMeta {
  const points = Number.isFinite(pointsRaw) ? Math.max(0, Math.round(pointsRaw)) : 0;

  const tiers: Array<{ tier: BeavRankTier; min: number; max: number | null }> = [
    { tier: "Bronze", min: 0, max: 1000 },
    { tier: "Silver", min: 1000, max: 1400 },
    { tier: "Gold", min: 1400, max: 1700 },
    { tier: "Diamond", min: 1700, max: 2000 },
    { tier: "Elite", min: 2000, max: null },
  ];

  const t = tiers.find((x) => (x.max === null ? points >= x.min : points >= x.min && points < x.max)) ?? tiers[0];

  // Elite has no divisions
  if (t.tier === "Elite") {
    return {
      points,
      tier: "Elite",
      division: "",
      label: "Elite",
      nextLabel: null,
      progress: 1,
      min: 2000,
      max: Infinity,
    };
  }

  const tierSpan = (t.max as number) - t.min; // e.g. 400 for Silver
  const divSpan = tierSpan / 3;

  const offset = points - t.min;
  const divIdx = Math.min(2, Math.max(0, Math.floor(offset / divSpan))); // 0..2

  const divisions: Array<"III" | "II" | "I"> = ["III", "II", "I"];
  const division = divisions[divIdx];

  const divMin = Math.round(t.min + divIdx * divSpan);
  const divMax = divIdx === 2 ? (t.max as number) : Math.round(t.min + (divIdx + 1) * divSpan);

  const progress =
    divMax > divMin ? Math.min(1, Math.max(0, (points - divMin) / (divMax - divMin))) : 0;

  const label = `${t.tier} ${division}`;

  let nextLabel: string | null = null;
  if (divIdx < 2) {
    nextLabel = `${t.tier} ${divisions[divIdx + 1]}`;
  } else {
    const nextTierIndex = tiers.findIndex((x) => x.tier === t.tier) + 1;
    const nextTier = tiers[nextTierIndex];
    if (nextTier) nextLabel = nextTier.tier === "Elite" ? "Elite" : `${nextTier.tier} III`;
  }

  return { points, tier: t.tier, division, label, nextLabel, progress, min: divMin, max: divMax };
}