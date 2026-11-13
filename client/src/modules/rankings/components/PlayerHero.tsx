import { PageHeader } from "@/modules/shared/ui/PageHeader";

/**
 * The top of a player's page: the shared PageHeader with the name as its title,
 * and the identity chips. The standing itself (the answer, best rank, points)
 * lives in PlayerSummary.
 *
 * No pronouns anywhere. These are real children whose pronouns we have never been
 * told: the list category is the name of a tournament bracket, not a statement
 * about the person on the row.
 */

export interface HistoryPoint {
  asOnDate: string;
  rank: number;
  category: string;
  subcategory: string;
}

/**
 * AITA publishes names in block capitals, sometimes only the surname
 * ("Vikrant KHANDELWAL"). Rendered verbatim that reads as shouting, so a word
 * that is entirely capitals is cased for display. A word already in mixed case
 * is left exactly as supplied, since people capitalise their own names in ways a
 * rule will get wrong, and so are single letters (initials) and roman numerals.
 */
export function displayName(raw: string): string {
  return raw
    .split(/(\s+)/)
    .map((word) => {
      const shouting = /[A-Z]{2,}/.test(word) && word === word.toUpperCase();
      if (!shouting || /^(II|III|IV)$/.test(word)) return word;
      return word
        .toLowerCase()
        .replace(
          /(^|['\-.])([a-z])/g,
          (_, boundary: string, char: string) => `${boundary}${char.toUpperCase()}`
        );
    })
    .join("");
}

export interface SeasonSummary {
  /** Largest improvement between a player's first and latest rank on one list. */
  bestClimb: { places: number; label: string; from: number; to: number } | null;
  /** Best rank ever held, across every list we hold. */
  careerBest: { rank: number; asOnDate: string } | null;
  /** Distinct published weeks this player appears in. */
  weeksTracked: number;
  /** How many separate lists they appear on. */
  listCount: number;
}

/**
 * Reduce the raw history into the few facts worth leading with.
 *
 * "Best climb" is measured per list rather than across the whole history,
 * because a player ages up between lists and comparing a U-14 rank against a
 * U-18 one would manufacture a climb that never happened.
 */
export function summariseSeason(
  history: HistoryPoint[],
  comboLabel: (c: { category: string; subcategory: string }) => string
): SeasonSummary {
  const byCombo = new Map<string, HistoryPoint[]>();
  for (const point of history) {
    const key = `${point.category}|${point.subcategory}`;
    const bucket = byCombo.get(key);
    if (bucket) bucket.push(point);
    else byCombo.set(key, [point]);
  }

  let bestClimb: SeasonSummary["bestClimb"] = null;
  let careerBest: SeasonSummary["careerBest"] = null;

  for (const [key, points] of byCombo) {
    const ordered = [...points].sort(
      (a, b) => new Date(a.asOnDate).getTime() - new Date(b.asOnDate).getTime()
    );
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const places = first.rank - last.rank;

    if (places > 0 && (!bestClimb || places > bestClimb.places)) {
      const [category, subcategory] = key.split("|");
      bestClimb = {
        places,
        label: comboLabel({
          category: category ?? "",
          subcategory: subcategory ?? "",
        }),
        from: first.rank,
        to: last.rank,
      };
    }

    for (const point of ordered) {
      if (!careerBest || point.rank < careerBest.rank) {
        careerBest = { rank: point.rank, asOnDate: point.asOnDate };
      }
    }
  }

  return {
    bestClimb,
    careerBest,
    weeksTracked: new Set(history.map((p) => p.asOnDate)).size,
    listCount: byCombo.size,
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background/60 text-muted-foreground inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

/**
 * The player page's header: the shared PageHeader, with the name as its title
 * and the identity chips (state, birth year, registration number) above it.
 * Lives here rather than in the route so the route stays inside its line budget.
 */
export function PlayerPageHeader({
  name,
  acronym,
  player,
  list,
}: {
  name: string;
  acronym: string;
  player: Omit<PlayerChipsProps, "federationAcronym">;
  /** The list this player is ranked on, so the way back is one click, not two. */
  list?: { label: string; href: string } | null;
}) {
  return (
    <PageHeader
      width="6xl"
      breadcrumbs={[
        { label: "Rankings", href: "/rankings" },
        ...(list ? [{ label: list.label, href: list.href }] : []),
        { label: name },
      ]}
      badges={<PlayerChips federationAcronym={acronym} {...player} />}
      title={name}
    />
  );
}

interface PlayerChipsProps {
  federationAcronym: string;
  regNo: string;
  // Nullable, not just optional: the API returns null for a player whose
  // registration row carries no state or birth year.
  state?: string | null | undefined;
  birthYear?: number | null | undefined;
}

function PlayerChips({ federationAcronym, regNo, state, birthYear }: PlayerChipsProps) {
  return (
    <>
      {state && <Chip>{state}</Chip>}
      {birthYear && <Chip>Born {birthYear}</Chip>}
      <Chip>
        {federationAcronym} #{regNo}
      </Chip>
    </>
  );
}
