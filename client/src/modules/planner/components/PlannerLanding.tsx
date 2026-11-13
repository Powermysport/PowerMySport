import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * What a signed-out visitor sees at /planner.
 *
 * The way in comes first, because it is the one thing this page asks of them;
 * the three points under it are the reasons to take it. There is no sample plan
 * with made-up players, ranks or costs on purpose: an invented example on a page
 * about reliability would be the one dishonest thing on it. The points are what
 * the tool actually does today.
 *
 * Structure is the warm-paper system's: a hairline and open space, no boxed
 * cards and no icon wells. The points are plain text, so they read as one
 * argument rather than three tiles.
 */

const POINTS = [
  {
    title: "Only events your child can enter",
    body: "Each junior event is checked against AITA's entry rules for their age group and rank. Closed events stay visible, with the reason.",
  },
  {
    title: "A plan that spots clashes",
    body: "Pick events and they line up by date. Overlaps, tight gaps and deadlines about to pass are flagged.",
  },
  {
    title: "Straight into your calendar",
    body: "Add an event to Google Calendar, or download the whole plan as a calendar file.",
  },
] as const;

const focus =
  "focus-visible:ring-power-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export function PlannerLanding() {
  return (
    <div className="space-y-12">
      <section aria-labelledby="planner-start-heading" className="max-w-2xl">
        <h2
          id="planner-start-heading"
          className="font-editorial text-3xl font-normal text-slate-900 sm:text-4xl"
        >
          Plan your child&apos;s tennis season
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          Sign in so we can use your child&apos;s profile and linked ranking. Tennis only for now.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href="/login?redirect=/planner"
            className={`bg-power-orange-solid inline-flex min-h-11 items-center rounded-md px-6 text-sm font-semibold text-white hover:bg-orange-800 ${focus}`}
          >
            Sign in
          </Link>
          <Link
            href="/register?redirect=/planner"
            className={`inline-flex min-h-11 items-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-900 hover:border-slate-900 hover:bg-white ${focus}`}
          >
            Create an account
          </Link>
          <Link
            href="/tournaments"
            className={`inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-orange-700 underline-offset-4 hover:underline ${focus}`}
          >
            Browse tournaments without an account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="planner-does-heading">
        <h2 id="planner-does-heading" className="sr-only">
          What the planner does
        </h2>
        <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {POINTS.map(({ title, body }) => (
            <li key={title} className="border-t border-slate-300 pt-4">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
