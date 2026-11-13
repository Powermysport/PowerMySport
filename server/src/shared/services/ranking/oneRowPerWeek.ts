interface WeekRow {
  category: string;
  subcategory: string;
  asOnDate: Date | string;
  snapshot?: unknown;
}

const weekKey = (row: WeekRow): string =>
  `${row.category}|${row.subcategory}|${new Date(row.asOnDate).getTime()}`;

/**
 * One row per list per week, the live one.
 *
 * The federation re-uploads a corrected list under the same as-on date, and both
 * sets of rows survive (see resolveSnapshotVersions in rankingController). A
 * player's history can therefore hold two entries for one week, which drew two
 * dots on the chart, counted the week twice, and gave a table two rows with the
 * same date.
 *
 * `versions` maps a snapshot id to its version number (a snapshot that never
 * published is below every published one). The highest wins; with no duplicates
 * the map is empty and the history is returned untouched. Order is preserved.
 */
export function oneRowPerWeek<T extends WeekRow>(
  history: readonly T[],
  versions: ReadonlyMap<string, number>
): T[] {
  if (versions.size === 0) return [...history];

  const versionOf = (row: WeekRow) => versions.get(String(row.snapshot)) ?? 0;
  const winner = new Map<string, T>();
  for (const row of history) {
    const key = weekKey(row);
    const current = winner.get(key);
    if (!current || versionOf(row) > versionOf(current)) winner.set(key, row);
  }
  return history.filter((row) => winner.get(weekKey(row)) === row);
}
