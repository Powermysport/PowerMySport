"use client";

import { Collapsible } from "@/modules/planner/components/Collapsible";
import { LinkRankingPrompt } from "@/modules/planner/components/LinkRankingPrompt";
import { ExpectedLater } from "@/modules/planner/components/ExpectedLater";
import { PlannerTour } from "@/modules/planner/components/PlannerTour";
import { SeasonIntake } from "@/modules/planner/components/SeasonIntake";
import { DEFAULT_PREFERENCES, setupSummary } from "@/modules/planner/components/SeasonSetupForm";
import { SeasonSummary } from "@/modules/planner/components/SeasonSummary";
import { SeasonWorkspace, type WorkspaceTab } from "@/modules/planner/components/SeasonWorkspace";
import { useCosts } from "@/modules/planner/hooks/useCosts";
import { useRecommendations } from "@/modules/planner/hooks/useRecommendations";
import { usePlanner } from "@/modules/planner/hooks/usePlanner";
import { usePlannerTour } from "@/modules/planner/hooks/usePlannerTour";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { splitByEntryState } from "@/modules/planner/utils/timeline";
import { rankClause, standingSentence } from "@/modules/planner/utils/standingText";
import { BLOCK, BOARD } from "@/modules/planner/utils/motion";
import { rankedSportFor } from "@/modules/player/services/rankingClaim";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { MotionConfig, motion } from "framer-motion";
import { useRef, useState } from "react";
import type { PlanPreferences } from "@/modules/planner/services/seasonPlan";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ArrowRight, CircleHelp } from "lucide-react";
import Link from "next/link";

/**
 * One child's planner. It owns the four states a child can be in, because each
 * says something different and none of them is an error:
 *
 *   - loading
 *   - no ranking linked: ask for it, here
 *   - linked, but on no junior ranking: say so, and why that means no verdicts
 *   - ready: the standing, the plan, and the calendar
 */

export function PlannerBoard({
  dependentId,
  dependentName,
  sport,
}: {
  dependentId: string;
  dependentName: string;
  /** The child's chosen sport, if they have one. Null means not chosen yet. */
  sport: string | null;
}) {
  const { data, isPending, isError, refetch } = usePlanner(dependentId);
  const {
    entries,
    preferences,
    plannedSlugs,
    add,
    setStatus,
    remove,
    savePreferences,
    isLoading: planLoading,
    isError: planFailed,
  } = useSeasonPlan(dependentId);
  const tour = usePlannerTour();
  // The panel on show. A plan to look at if there is one; otherwise the suggestions,
  // which are what a parent with an empty plan has come for.
  const [tab, setTab] = useState<WorkspaceTab | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  // The questions are the first screen until a season exists. A parent who skips them,
  // or who comes back to change their answers, is tracked here.
  const [skippedSetup, setSkippedSetup] = useState(false);
  const [changingSetup, setChangingSetup] = useState(false);
  const browseRef = useRef<HTMLDivElement>(null);
  // The event open on the calendar. It lives here because opening one asks for its
  // estimate, and the estimates are fetched here.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // The suggestions on screen are priced alongside the plan. These hooks sit above
  // the early returns below so they run on every render.
  const {
    recommendations,
    suggest,
    isLoading: recommendationsLoading,
  } = useRecommendations(dependentId);
  const suggestedSlugs = recommendations?.items.map((item) => item.slug) ?? [];
  const pricedSlugs = selectedSlug ? [...suggestedSlugs, selectedSlug] : suggestedSlugs;
  const {
    costs,
    isLoading: costsLoading,
    isError: costsFailed,
    saveHomeCity,
  } = useCosts(dependentId, pricedSlugs);

  // Saving the answers and building the season are one action to the parent: the button
  // stays locked from the first request to the last, and a failure of either leaves them on
  // the questions with the server's message already toasted by the mutation.
  const [building, setBuilding] = useState(false);
  const build = async (next: PlanPreferences, city: string | null) => {
    setBuilding(true);
    try {
      await savePreferences.mutateAsync(next);
      if (city) await saveHomeCity.mutateAsync(city);
      await suggest.mutateAsync(false);
      setTab("suggested");
      setChangingSetup(false);
    } catch {
      // Each mutation reports its own error.
    } finally {
      setBuilding(false);
    }
  };

  // Whether a season exists is only known once the plan and the saved suggestions have
  // each answered once. Wait for that, but only once: a plan that failed goes back to
  // "loading" every time something re-reads it, and gating on that would unmount the page
  // that re-reads it, over and over.
  const [planEverFailed, setPlanEverFailed] = useState(false);
  if (planFailed && !planEverFailed) setPlanEverFailed(true);
  const [answered, setAnswered] = useState(false);
  if (!answered && !planLoading && !recommendationsLoading) setAnswered(true);

  if (isPending || !answered) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">We could not load this planner just now.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  // A child whose chosen sport has no mirrored ranking list cannot be helped, whether
  // or not a ranking is linked: a linked tennis ranking on a badminton player is stale or
  // test data, and planning tennis events for them would contradict their own profile.
  if (sport && !rankedSportFor([sport])) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-editorial text-lg font-normal text-slate-900">
          The planner covers tennis for now
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          {dependentName} plays {sport}, and we do not yet hold a ranking list or entry rules for
          it. You can still browse its calendar on the tournaments page.
        </p>
        <Link
          href="/tournaments"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
        >
          See tournaments
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }
  if (data.linkState === "not-linked") {
    return <LinkRankingPrompt dependentId={dependentId} dependentName={dependentName} />;
  }

  if (data.linkState === "no-junior-standing" || !data.standing || !data.shortlist) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-editorial text-lg font-normal text-slate-900">
          {dependentName} is not on a junior ranking right now
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Their ranking is linked, but they do not appear on a current Under-12 to Under-18 ranking.
          Juniors often drop off between age categories. The entry rules the planner uses are
          written for those lists, so there is nothing to judge against until they are published
          again.
        </p>
      </div>
    );
  }

  const { standing, shortlist } = data;

  const savedCity = costs?.origin.kind === "city" ? (costs.origin.city ?? null) : null;
  // A season exists once there are suggestions or a plan. Until then, or when the parent
  // asks to change their answers, the questions come first. Wait for the estimates to
  // report the saved city so the field starts filled in rather than blank.
  // If the plan could not be read we cannot tell, so the questions are not forced on them.
  const hasSeason = entries.length > 0 || recommendations !== null || planEverFailed;
  const showIntake = changingSetup || (!hasSeason && !skippedSetup);
  if (showIntake && !costs && costsLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (showIntake) {
    return (
      <MotionConfig reducedMotion="user">
        <SeasonIntake
          childName={dependentName}
          saved={preferences ?? DEFAULT_PREFERENCES}
          homeState={standing.state ?? null}
          savedCity={savedCity}
          building={building}
          onBuild={(next, city) => void build(next, city)}
          onSkip={hasSeason ? undefined : () => setSkippedSetup(true)}
          onCancel={changingSetup ? () => setChangingSetup(false) : undefined}
        />
        {tour.open && <PlannerTour onFinish={tour.finish} />}
      </MotionConfig>
    );
  }

  // Every event the page knows about, so a plan entry can borrow its end date
  // and venue from the live calendar.
  const calendar = new Map<string, PlannerEdition>();
  for (const entry of [
    ...shortlist.ownGroup,
    ...shortlist.playingUp,
    ...shortlist.unknown,
    ...shortlist.closed,
  ]) {
    if (entry.edition.slug) calendar.set(entry.edition.slug, entry.edition);
  }

  const openCount = splitByEntryState(shortlist.ownGroup).open.length;
  const activeTab: WorkspaceTab = tab ?? (entries.length > 0 ? "plan" : "suggested");

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-editorial text-xl font-normal text-slate-900">
              {dependentName}&apos;s season
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {standingSentence(standing, formatLongDate(standing.asOnDate))}
            </p>
            <p data-tour="setup" className="mt-1 text-sm text-slate-600">
              Built around: {setupSummary(preferences ?? DEFAULT_PREFERENCES, savedCity)}.
              <button
                type="button"
                onClick={() => setChangingSetup(true)}
                className="ml-2 font-semibold text-orange-700 hover:underline"
              >
                Change answers
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={tour.start}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
            How this works
          </button>
        </header>

        {/* One column. The next step and the cost are a level pair at the top; the plan and
          the season setup follow at full width, then the finder and what is not announced
          yet. An earlier two-column layout put the plan beside a tall rail, and whichever
          side was shorter was left with a blank slab. On a phone the pair splits and the
          parts are ordered by `order-*`: next step, plan, cost, setup, the lists. */}
        <motion.div className="grid gap-6" variants={BOARD} initial="hidden" animate="show">
          <SeasonSummary
            entries={entries}
            calendar={calendar}
            childName={dependentName}
            openCount={openCount}
            costs={costs}
            costsLoading={costsLoading}
            costsFailed={costsFailed}
            saveHomeCity={{
              saving: saveHomeCity.isPending,
              save: (city) => saveHomeCity.mutate(city),
            }}
            onOpenEvent={setSelectedSlug}
            onSuggest={() => {
              setTab("suggested");
              suggest.mutate(false);
            }}
            suggesting={suggest.isPending}
            onMarkEntered={(slug) => setStatus.mutate({ editionSlug: slug, status: "entered" })}
            onRemove={(slug) => remove.mutate(slug)}
            planBusy={setStatus.isPending || remove.isPending}
            budget={{
              value: preferences?.budget ?? null,
              saving: savePreferences.isPending,
              save: (budget) =>
                savePreferences.mutate({ ...(preferences ?? DEFAULT_PREFERENCES), budget }),
            }}
            onBrowse={() => {
              setBrowseOpen(true);
              // The full list is at the foot of the page, so bring it up.
              requestAnimationFrame(() =>
                browseRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
              );
            }}
          />

          <SeasonWorkspace
            dependentId={dependentId}
            yearlyLimit={{ cap: data.annualEntryCap, ageGroup: standing.subcategory }}
            tab={activeTab}
            onTabChange={setTab}
            shortlist={shortlist}
            planEntries={entries}
            preferences={preferences}
            recommendations={recommendations}
            calendar={calendar}
            costs={costs}
            costsLoading={costsLoading}
            plannedSlugs={plannedSlugs}
            isAdding={add.isPending}
            onAdd={(slug) => add.mutate(slug)}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
            reach={data.reach ?? {}}
            finder={{
              containerRef: browseRef,
              description: `Everything ${standing.category} ${standing.subcategory} (${rankClause(standing)}) can enter, and what is closed to them and why.`,
              open: browseOpen,
              onOpenChange: setBrowseOpen,
            }}
          />

          {data.expected && data.expected.length > 0 && (
            <motion.div variants={BLOCK} className="order-7 min-w-0 lg:order-none">
              <Collapsible
                title="Not announced yet"
                description="Events that ran about this time last year."
              >
                <ExpectedLater events={data.expected} />
              </Collapsible>
            </motion.div>
          )}
        </motion.div>

        {tour.open && <PlannerTour onFinish={tour.finish} />}
      </div>
    </MotionConfig>
  );
}
