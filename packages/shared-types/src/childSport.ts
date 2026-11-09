/**
 * Which sport a child plays, decided in one place.
 *
 * A child has exactly one current sport, stored as `chosenSport`. The assessment's
 * recommendations (`sportMatches`) are separate and are never "the sport". `sportsFocus`
 * is a legacy list kept only as a mirror, `[chosenSport]`, so screens and apps that still
 * read `sportsFocus[0]` agree with everything else.
 *
 * Before this existed the answer was worked out inline in about nine places
 * (`chosenSport || sportsFocus[0]`), while the edit form wrote only `sportsFocus`, so a
 * child could be "Badminton" on the dashboard and "Tennis" in the form.
 */

/** What either side of the wire may hold of a child's sport. Both fields are optional. */
export interface ChildSportFields {
  chosenSport?: string | null | undefined;
  sportsFocus?: readonly string[] | null | undefined;
}

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The child's sport: the committed one, or for a row that predates the single-sport
 * rule, the first entry of the old list. Null when neither is set.
 */
export const primarySport = (child: ChildSportFields): string | null =>
  clean(child.chosenSport) ?? clean(child.sportsFocus?.[0]) ?? null;

/**
 * The legacy list for a given sport: `[sport]`, or empty. The server writes this on every
 * save, and nothing writes the list any other way.
 */
export const sportsFocusFor = (sport: string | null | undefined): string[] => {
  const cleaned = clean(sport);
  return cleaned ? [cleaned] : [];
};
