import { ArrowUpRight } from "lucide-react";

import { SELECTION_LABELS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { hasFollowableDates, primaryAction, whenAnswer } from "../utils/atAGlance";
import { amountParts, costLine, formatDay } from "../utils/format";
import { FollowButton } from "./FollowButton";

// ─── The decision panel at the top of an entry ──────────────────────────────
//
// The three answers a parent acts on, set large, with the one thing to do next:
//   what your child gets   (the figure, when there is one, is the biggest text)
//   when                   (with the days left)
//   how players are chosen (apply, trials, nominated...)
// and the official link as the page's single orange button. Who it is for is
// NOT repeated here: the section right under the panel answers it in full.
//
// On a phone the answers stack and the button comes straight after them, so the
// next step is never more than a scroll away from the title.

const kicker = "text-ink-muted text-sm font-medium";

export function AtAGlance({ opportunity, today }: { opportunity: Opportunity; today: string }) {
  const amount = amountParts(opportunity.benefit?.amount);
  const summary = opportunity.benefit?.summary?.trim();
  const when = whenAnswer(opportunity, today);
  const selection = opportunity.selection ? SELECTION_LABELS[opportunity.selection] : null;
  // Said only when the entry states it: a missing cost is not "free".
  const cost = costLine(opportunity.cost);
  const action = primaryAction(opportunity);

  return (
    <section
      aria-label="Quick summary"
      className="border-hairline overflow-hidden rounded-2xl border bg-white"
    >
      <div className="divide-hairline grid divide-y md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:divide-x md:divide-y-0">
        <div className="p-6 sm:p-8">
          <h2 className={kicker}>What your child gets</h2>
          {amount ? (
            <>
              <p className="font-editorial text-ink mt-2 text-4xl font-light tabular-nums leading-tight tracking-tight sm:text-5xl">
                {amount.money}
              </p>
              {amount.note && (
                <p className="text-ink-muted mt-1 text-pretty text-sm">{amount.note}</p>
              )}
              {summary && (
                <p className="text-ink-body mt-4 max-w-[56ch] text-pretty leading-relaxed">
                  {summary}
                </p>
              )}
            </>
          ) : (
            summary && (
              <p className="font-editorial text-ink mt-2 max-w-[40ch] text-pretty text-2xl font-light leading-snug sm:text-[1.75rem]">
                {summary}
              </p>
            )
          )}
        </div>

        <dl className="space-y-6 p-6 sm:p-8">
          <div>
            <dt className={kicker}>When</dt>
            <dd className="text-ink mt-1 text-xl font-medium tabular-nums">{when.headline}</dd>
            {when.detail && (
              <dd
                className={`mt-1 text-pretty text-sm ${when.urgent ? "text-ink font-semibold" : "text-ink-body"}`}
              >
                {when.detail}
              </dd>
            )}
          </div>
          {selection && (
            <div>
              <dt className={kicker}>How players are chosen</dt>
              <dd className="text-ink mt-1 text-xl font-medium">{selection.label}</dd>
              <dd className="text-ink-body mt-1 text-pretty text-sm leading-relaxed">
                {selection.explain}
              </dd>
            </div>
          )}
          {cost && (
            <div>
              <dt className={kicker}>Cost</dt>
              <dd className="text-ink-body mt-1 text-pretty text-sm leading-relaxed">{cost}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="border-hairline bg-paper-deep/50 flex flex-col gap-4 border-t px-6 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-8">
        {action && (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-motion bg-power-orange-solid focus-visible:ring-ink inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-white transition-colors hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {action.label}
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </a>
        )}
        <div className="flex flex-col gap-3 sm:items-end">
          {hasFollowableDates(opportunity) && <FollowButton slug={opportunity.slug} />}
          {opportunity.lastVerifiedOn && (
            <p className="text-ink-muted text-sm">
              Last checked by PowerMySport on {formatDay(opportunity.lastVerifiedOn)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
