import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
import type { ReactNode } from "react";

import { TRACKS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { ownerLine, whoLine } from "../utils/atAGlance";
import { formatDay, sportsLabel, whereLabel } from "../utils/format";
import { AtAGlance } from "./AtAGlance";
import { EligibilityChecklist } from "./EligibilityChecklist";

// ─── One admission route or scholarship ─────────────────────────────────────
//
// Ordered by the questions a parent asks, in the order they ask them, and
// weighted by how much each answer matters:
//   1. What is this?            title, who runs it, a two-line summary
//   2. Is it worth it, by when, and what do I do?
//                               the decision panel: the figure set largest,
//                               the deadline with days left, the one button
//   3. Can my child apply?      the rules, checkable against the child
//   4. How do we apply?         numbered steps
//   5. Dates, then good-to-know facts
//   6. Where this came from     quiet, last, never hidden
// Every other line was cut: each fact is said once, in the place it answers.

/** India's date ("2026-11-10"), so "6 days left" is counted the way the server counts. */
function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-hairline border-t pt-10">
      <h2 className="font-editorial text-ink text-balance text-3xl font-light tracking-tight">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function stepsTitle(selection: Opportunity["selection"]): string {
  if (selection === "scouted" || selection === "nominated") return "How players are chosen";
  if (selection === "apply" || selection === "trials") return "How to apply";
  return "What to do";
}

export function OpportunityDetail({ opportunity }: { opportunity: Opportunity }) {
  const track = TRACKS[opportunity.track];
  const keyDates = [...(opportunity.cycle?.keyDates ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const steps = opportunity.steps ?? [];
  const facts = opportunity.keyFacts ?? [];
  const sources = opportunity.sources ?? [];
  const who = whoLine(opportunity.eligibility);
  const context = [
    sportsLabel(opportunity),
    whereLabel(opportunity.geography),
    opportunity.cycle?.label ? `Rules for ${opportunity.cycle.label}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-paper min-h-screen">
      <PageHeader
        width="5xl"
        breadcrumbs={[{ label: track.title, href: track.path }, { label: opportunity.title }]}
        eyebrow={ownerLine(opportunity.owner) ?? undefined}
        title={opportunity.title}
        description={opportunity.summary}
        meta={<span className="text-ink-body">{context.join(" · ")}</span>}
      />

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {opportunity.stale && (
          <p className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We last checked this more than a year ago, so the rules may have changed. Go by what
              the official website says.
            </span>
          </p>
        )}

        <AtAGlance opportunity={opportunity} today={todayInIndia()} />

        {/* One reading column: long lines across the full width are hard to follow. */}
        <article className="mt-16 max-w-3xl space-y-14">
          <Section title="Can your child apply?">
            {who && (
              <p className="text-ink mb-6 max-w-[60ch] text-pretty text-lg leading-relaxed">
                {who}
              </p>
            )}
            <EligibilityChecklist opportunity={opportunity} />
          </Section>

          {steps.length > 0 && (
            <Section title={stepsTitle(opportunity.selection)}>
              <ol className="space-y-5">
                {steps.map((step, index) => (
                  <li key={step} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
                    <span
                      aria-hidden
                      className="font-editorial text-ink text-3xl font-light tabular-nums leading-none"
                    >
                      {index + 1}
                    </span>
                    <p className="text-ink-body text-pretty leading-relaxed">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {keyDates.length > 0 && (
            <Section title="Important dates">
              <ul className="divide-hairline border-hairline divide-y border-y">
                {keyDates.map((d) => (
                  <li
                    key={`${d.label}-${d.date}`}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6"
                  >
                    <span className="text-ink w-32 shrink-0 font-medium tabular-nums">
                      {formatDay(d.date)}
                    </span>
                    <span className="text-ink-body">{d.label}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {facts.length > 0 && (
            <Section title="Good to know">
              <ul className="space-y-3">
                {facts.map((fact) => (
                  <li key={fact} className="text-ink-body flex gap-3 leading-relaxed">
                    <span
                      aria-hidden
                      className="bg-ink/40 mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span className="text-pretty">{fact}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Last and quiet, but never hidden: every figure above is only as good as these. */}
          {(sources.length > 0 || opportunity.verificationNote) && (
            <section className="border-hairline border-t pt-8">
              <h2 className="text-ink text-base font-medium">Where this information comes from</h2>
              {opportunity.verificationNote && (
                <p className="text-ink-body mt-2 max-w-[60ch] text-pretty text-sm leading-relaxed">
                  {opportunity.verificationNote}
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {sources.map((source) => (
                  <li key={source.url} className="text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink decoration-ink/30 hover:decoration-ink inline-flex items-start gap-1 font-medium underline underline-offset-4"
                    >
                      {source.label}
                      <ArrowUpRight aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    </a>
                    {source.publishedOn && (
                      <span className="text-ink-muted ml-2">{formatDay(source.publishedOn)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
