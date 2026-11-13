// ─── One sport's ranking lists ──────────────────────────────────────────────
//
// Was `/rankings` when tennis was the only sport this could mean. The lists,
// grouping and federation attribution all come off the sport's registry entry,
// so a second federation renders here without a new page.

import { PageHeader } from "@/modules/shared/ui/PageHeader";
import { PlayerFinder } from "@/modules/rankings/components/PlayerFinder";
import { breadcrumbJsonLd } from "@/lib/seo";
import { fetchRankingMeta, formatAsOn } from "@/modules/rankings/services/api";
import {
  RANKING_SPORTS,
  comboHref,
  comboLabel,
  getRankingSport,
} from "@/modules/rankings/config/rankings";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return RANKING_SPORTS.map((s) => ({ sport: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const sport = getRankingSport((await params).sport);
  if (!sport) return {};
  const { acronym, name } = sport.federation;
  return {
    // The root layout appends " | PowerMySport"; repeating it here doubled it.
    title: `${acronym} ${sport.name} Rankings: Search by State, Age Group & Player`,
    description: `Official ${name} rankings, made searchable. Filter every list by state, look up a player by name or registration number, and follow a rank week by week.`,
    alternates: { canonical: `/rankings/${sport.slug}` },
    openGraph: {
      title: `${acronym} ${sport.name} Rankings: searchable, by state and age group`,
      description: `Every ${acronym} ranking list, filterable by state and searchable by name, with each player's week-by-week history.`,
      url: `/rankings/${sport.slug}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

export default async function SportRankingsPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const sport = getRankingSport((await params).sport);
  if (!sport) notFound();

  const meta = await fetchRankingMeta(sport.slug);
  const availability = new Map(
    (meta?.combos ?? []).map((c) => [`${c.category}/${c.subcategory}`, c])
  );

  // The one date every published list shares, or null when they differ.
  const dates = new Set(
    (meta?.combos ?? []).filter((c) => c.available && c.asOnDate).map((c) => c.asOnDate)
  );
  const commonDate = dates.size === 1 ? ([...dates][0] ?? null) : null;

  return (
    <>
      <script
        id="sport-rankings-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Rankings", path: "/rankings" },
              { name: sport.name, path: `/rankings/${sport.slug}` },
            ])
          ),
        }}
      />
      <PageHeader
        breadcrumbs={[{ label: "Rankings", href: "/rankings" }, { label: sport.name }]}
        title={`${sport.federation.acronym} ${sport.name} rankings`}
        description={`The official ${sport.federation.name} lists, made searchable. Filter by state, look up a player by name or registration number, and see how a ranking has moved week by week, something the source PDFs cannot show you.`}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-12">
          <PlayerFinder sport={sport.slug} />
        </div>

        {/* Twelve lists, but really two questions: whose list (boys, girls, men,
            women) and which age. Each group is a ruled list, and Boys sits beside
            Girls, Men beside Women, so the same age brackets line up across the
            page. When every list was published on the same date, that date is said
            once here instead of twelve times. */}
        {commonDate && (
          <p className="text-muted-foreground mb-8 text-sm">
            All lists as on {formatAsOn(commonDate)}.
          </p>
        )}
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
          {sport.groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{group.blurb}</p>

              <ul className="divide-border border-border mt-4 divide-y border-y">
                {group.combos.map((combo) => {
                  const info = availability.get(`${combo.category}/${combo.subcategory}`);
                  const available = info?.available ?? false;
                  return (
                    <li key={comboHref(sport.slug, combo)}>
                      <Link
                        href={comboHref(sport.slug, combo)}
                        className="hover:bg-paper-deep focus-visible:ring-power-orange group flex min-h-14 items-center justify-between gap-4 px-1 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        <span className="font-medium">{comboLabel(combo)}</span>
                        <span className="text-muted-foreground flex items-center gap-3 text-sm tabular-nums">
                          {available ? (
                            <span>
                              {info?.rowCount?.toLocaleString("en-IN")} players
                              {!commonDate && <> · as on {formatAsOn(info?.asOnDate)}</>}
                            </span>
                          ) : (
                            <span>Not published yet</span>
                          )}
                          <ArrowRight
                            className="group-hover:text-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/*
        Attribution is not decoration. We are republishing another body's data,
        and a parent checking a rank they disagree with should be one click from
        the official source rather than stuck arguing with us.
      */}
        <footer className="border-border text-muted-foreground mt-16 border-t pt-6 text-sm">
          <p>
            Rankings are published by the{" "}
            <span className="text-foreground font-medium">
              {meta?.source.federation ?? sport.federation.name}
            </span>{" "}
            and mirrored here for search and history. PowerMySport is not affiliated with{" "}
            {sport.federation.acronym}. Always treat the official list as authoritative.
          </p>
          <a
            href={meta?.source.url ?? sport.federation.officialUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-power-orange-solid mt-2 inline-flex items-center gap-1.5 font-medium hover:underline"
          >
            View the official {sport.federation.acronym} rankings page
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </footer>
      </div>
    </>
  );
}
