import type {
  PlayerCurrentEntry,
  PlayerHistoryPoint,
  PlayerResult,
  RankingProjection,
} from "../services/api";

/**
 * Dev-only fixtures for stress-testing the player page (`?data=worst|one|empty`).
 *
 * Every value is something a real list can hold. The name pattern is the long
 * southern-Indian given-name run plus a family name that real juniors carry; the
 * state is the longest of the 36 names the server accepts; ranks and list sizes
 * are the largest real lists (Boys U-14 is 1,749). Nothing here is random text.
 *
 * Shaped exactly like `fetchPlayer`'s result and swapped in at the same boundary
 * (the route), never inside a component. Used only when NODE_ENV is not
 * "production"; see `devPlayerFixture`.
 */

const weeklyDates = (count: number, end = Date.UTC(2026, 9, 19)): string[] =>
  Array.from({ length: count }, (_, i) =>
    new Date(end - (count - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10)
  );

const LONG_STATE = "Dadra and Nagar Haveli and Daman and Diu";

const projection: RankingProjection = {
  window: {
    from: "2024-10-21",
    to: "2026-10-19",
    listsHeld: 104,
    weeksCovered: 104,
    coversFullCycle: true,
  },
  movement: {
    fourWeeks: { points: -1204.5, rank: -1312, from: "2026-09-21" },
    twelveWeeks: { points: 0, rank: 0, from: "2026-07-27" },
    fiftyTwoWeeks: { points: 9876.5, rank: 1411, from: "2025-10-20" },
  },
  activity: {
    improvingWeeks: 1,
    decliningWeeks: 52,
    pointsGained: 9876.5,
    pointsLost: 1204.5,
    averageRise: 1204.5,
    lastRiseAt: "2025-01-06",
    weeksSinceLastRise: 91,
  },
  atRisk: { nextFourWeeks: 1204.5, nextTwelveWeeks: 3456.5, isComplete: false },
  toNextTier: { rank: 1000, points: 12345.5, gap: 11111.5, estimatedWeeks: null, weeklyRate: 0 },
};

const longEntry = (
  subcategory: string,
  rank: number,
  listSize: number,
  extra: Partial<PlayerCurrentEntry> = {}
): PlayerCurrentEntry => ({
  _id: `worst-${subcategory}`,
  rank,
  regNo: "12345678",
  givenName: "Venkata Sai Krishna Chaitanya",
  familyName: "Pemmaraju",
  fullName: "Venkata Sai Krishna Chaitanya Pemmaraju",
  birthYear: 2011,
  state: LONG_STATE,
  stateCode: "DN",
  stateRank: 1,
  stateSize: 1,
  points: [
    { label: "Best-eight singles points", value: 1234.5 },
    { label: "Doubles points (25%)", value: 12.25 },
    { label: "Total", value: 1246.75 },
  ],
  totalPoints: 12345.5,
  category: "Boys",
  subcategory,
  asOnDate: "2026-10-19",
  prevRank: rank + 1412,
  rankDelta: -1412,
  nextTier: { rank: 1000, points: 12345.5, gap: 11111.5 },
  insight: {
    listSize,
    stateSize: 1,
    percentile: 99,
    nextTier: { rank: 1000, points: 12345.5, gap: 11111.5 },
    careerHigh: { rank: 1, asOnDate: "2025-01-06" },
    weeksTracked: 104,
    weeksInTop100: 0,
  },
  projection,
  ...extra,
});

const swing = (count: number): number[] =>
  // Climbs from the foot of the list to the top and falls back: a real career arc
  // with the extremes the y-axis has to hold.
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return Math.max(1, Math.round(1749 - 1748 * Math.sin(Math.PI * Math.min(1, t * 1.15))));
  });

const history = (): PlayerHistoryPoint[] => {
  const u16 = weeklyDates(104);
  const ranks = swing(104);
  return [
    ...u16.map((asOnDate, i) => ({
      category: "Boys",
      subcategory: "U-16",
      asOnDate,
      rank: ranks[i]!,
      totalPoints: 12345.5 - ranks[i]! * 3.25,
    })),
    // Played up for one week only: a list with a single point, which is not a trend.
    { category: "Boys", subcategory: "U-18", asOnDate: "2026-10-19", rank: 1130, totalPoints: 1.5 },
  ];
};

const WORST: PlayerResult = {
  player: {
    regNo: "12345678",
    fullName: "Venkata Sai Krishna Chaitanya Pemmaraju",
    givenName: "Venkata Sai Krishna Chaitanya",
    familyName: "Pemmaraju",
    birthYear: 2011,
    state: LONG_STATE,
  },
  current: [longEntry("U-16", 1749, 1749), longEntry("U-18", 1130, 1130, { projection: null })],
  history: history(),
};

/** One list, one week, rank 1 of 1: every "of N" and every comparison at its floor. */
const ONE: PlayerResult = {
  player: { regNo: "1001", fullName: "Xi", birthYear: null, state: null },
  current: [
    {
      _id: "one",
      rank: 1,
      regNo: "1001",
      givenName: "Xi",
      familyName: "",
      fullName: "Xi",
      points: [],
      totalPoints: 0,
      category: "Girls",
      subcategory: "U-12",
      asOnDate: "2026-10-19",
      rankDelta: null,
      insight: {
        listSize: 1,
        stateSize: null,
        percentile: 100,
        nextTier: null,
        careerHigh: null,
        weeksTracked: 1,
        weeksInTop100: null,
      },
      projection: null,
    },
  ],
  history: [
    { category: "Girls", subcategory: "U-12", asOnDate: "2026-10-19", rank: 1, totalPoints: 0 },
  ],
};

/** A registered player on no current list and with no history. */
const EMPTY: PlayerResult = {
  player: { regNo: "1002", fullName: "Aarav Sharma", birthYear: 2014, state: "Goa" },
  current: [],
  history: [],
};

export const PLAYER_FIXTURES = { worst: WORST, one: ONE, empty: EMPTY } as const;
export type PlayerFixtureName = keyof typeof PLAYER_FIXTURES;

/** The fixture a `?data=` value names, and only outside production. */
export function devPlayerFixture(name: string | undefined): PlayerResult | null {
  if (process.env.NODE_ENV === "production") return null;
  return name && name in PLAYER_FIXTURES ? PLAYER_FIXTURES[name as PlayerFixtureName] : null;
}
