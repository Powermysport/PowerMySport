"use client";

import { Check, CheckCircle, ChevronDown, Info, RotateCcw } from "lucide-react";
import type { SavedStatus, SportFitResult, SportResult, WizardAnswers } from "../../types";
import {
  JourneyPipeline,
  trialWhatsAppUrl,
  WhatsAppIcon,
  WHATSAPP_BUTTON,
} from "../JourneyPipeline";
import { ChooseSportButton } from "./ChooseSportButton";
import { SaveResultsPrompt } from "./SaveResultsPrompt";
import { SportFitCard } from "./SportFitCard";
import { WhatsNextPanel } from "./WhatsNextPanel";

// ─── Portfolio roles ────────────────────────────────────────────────────────
// Not a similarity ranking (1st/2nd/3rd best) — three different jobs. Best-fit
// is the safest bet on the data; stretch is the higher-ceiling, more-demanding
// pick; easy-start is the cheapest, lowest-commitment way to test interest.

type PortfolioRole = "bestFit" | "stretch" | "easyStart";

const PORTFOLIO_META: Record<PortfolioRole, { label: string; watchFor: (name: string) => string }> =
  {
    bestFit: {
      label: "Best fit",
      watchFor: (name) => `Try it first. Watch for ${name} asking to go back without being asked.`,
    },
    stretch: {
      label: "Stretch pick",
      watchFor: (name) =>
        `Asks more of ${name}. A good sign is wanting more even after the hard parts.`,
    },
    easyStart: {
      label: "Easy start",
      watchFor: () =>
        "The cheapest, lowest-commitment way to test real interest before going further.",
    },
  };

// Rough demand ordering from data already on the sport profile — no scoring
// changes, just deciding which of the two non-best-fit picks reads as the
// pricier/more time-hungry "stretch" vs the cheaper "easy start".
const BUDGET_RANK: Record<string, number> = {
  "under-3k": 0,
  "3k-7k": 1,
  "7k-15k": 2,
  "15k-plus": 3,
};

function demandScore(result: SportResult): number {
  return BUDGET_RANK[result.sport.minBudgetTier] * 10 + result.sport.minWeeklyHours;
}

/** Assigns portfolio roles to the top-3 results without touching the scorer. */
function buildPortfolio(
  results: SportResult[]
): Array<{ result: SportResult; role: PortfolioRole }> {
  if (results.length === 0) return [];
  const [bestFit, ...rest] = results;
  const sortedRest = [...rest].sort((a, b) => demandScore(b) - demandScore(a));
  const [stretch, easyStart] = sortedRest;

  const out: Array<{ result: SportResult; role: PortfolioRole }> = [
    { result: bestFit, role: "bestFit" },
  ];
  if (stretch) out.push({ result: stretch, role: "stretch" });
  if (easyStart) out.push({ result: easyStart, role: "easyStart" });
  return out;
}

// The grid has to track how many cards actually survived the shortlist filter —
// a fixed 3-column track left a dead empty column whenever the parent had
// already shortlisted one of our own picks.
const PORTFOLIO_GRID: Record<number, string> = {
  1: "sm:grid-cols-1 sm:max-w-md",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

// ─── Key findings summary ─────────────────────────────────────────────────────
// A short, deterministic readout of the assessment answers themselves (distinct
// from the per-sport `reasons`, which explain why a specific sport was picked).
// Surfaced once, above the three cards, so parents see what shaped every pick
// before reading the individual justifications.

const BUDGET_LABEL: Record<NonNullable<WizardAnswers["budget"]>, string> = {
  "under-3k": "under ₹3k/month",
  "3k-7k": "₹3-7k/month",
  "7k-15k": "₹7-15k/month",
  "15k-plus": "₹15k+/month",
};

const HOURS_LABEL: Record<NonNullable<WizardAnswers["weeklyHours"]>, string> = {
  "1-3": "1-3 hours a week",
  "4-7": "4-7 hours a week",
  "8-12": "8-12 hours a week",
  "13-plus": "13+ hours a week",
};

const AMBITION_LABEL: Record<NonNullable<WizardAnswers["ambition"]>, string> = {
  fun: "Health & fun",
  competitive: "Competitive",
  national: "National",
  career: "Career in sport",
  professional: "Pro career", // legacy — no longer offered, still stored on older rows
};

// Pronoun helpers — resolve to he/she when gender is known, singular "they"
// only when the parent didn't specify (same fallback rule as the wizard's
// own question prompts).
function pronounsFor(gender: WizardAnswers["gender"]) {
  if (gender === "boy") return { poss: "his", obj: "him" };
  if (gender === "girl") return { poss: "her", obj: "her" };
  return { poss: "their", obj: "them" };
}

function buildKeyFindings(answers: WizardAnswers): string[] {
  const name = answers.childName || "Your child";
  const { poss, obj } = pronounsFor(answers.gender);
  const findings: string[] = [];

  if (answers.energyType === "explosive") {
    findings.push(
      `${name} has explosive, fast-twitch energy, built for short bursts of power, not long grinding effort.`
    );
  } else if (answers.energyType === "endurance") {
    findings.push(`${name} has real endurance, built to keep going, not for short bursts.`);
  }

  // The slider runs 1 = "Just me" → 5 = "Team, always" (see SpectrumSlider),
  // so 4–5 is the team end and 1–2 is the solo end.
  if (answers.teamIndividual !== null) {
    if (answers.teamIndividual >= 4) {
      findings.push(
        `Prefers team environments. Plays better with shared effort and shared momentum.`
      );
    } else if (answers.teamIndividual <= 2) {
      findings.push(
        `Prefers individual competition, wants the result to rest on ${poss} own performance alone.`
      );
    }
  }

  if (answers.pressureResponse === "thrives") {
    findings.push(
      `${name} gets better under pressure. Big moments bring out ${poss} best, not ${poss} worst.`
    );
  } else if (answers.pressureResponse === "avoids") {
    findings.push(
      `${name} plays better without pressure. High-stakes moments work against ${obj}, not for ${obj}.`
    );
  }

  if (answers.agility === "high") {
    findings.push(
      `High agility and flexibility, a real edge in any sport built on quick footwork.`
    );
  } else if (answers.agility === "low") {
    findings.push(
      `Agility isn't the strength here. Strategy and consistency matter more than raw speed.`
    );
  }

  if (answers.decisionStyle === "react") {
    findings.push(
      `${name} reacts fast and trusts instinct, built for sports with no time to think.`
    );
  } else if (answers.decisionStyle === "strategic") {
    findings.push(
      `${name} thinks ahead instead of reacting, built for sports that reward planning.`
    );
  }

  if (answers.budget && answers.weeklyHours) {
    findings.push(
      `${BUDGET_LABEL[answers.budget]} and ${HOURS_LABEL[answers.weeklyHours]} set the real limit on what's realistic below.`
    );
  }

  return findings.slice(0, 5);
}

// ─── Report context chips ────────────────────────────────────────────────────
// The wizard's left sidebar (which carried these) is hidden on the results
// step, so the constraints every score was measured against would otherwise
// vanish exactly when the parent starts questioning the numbers.

function buildContextChips(answers: WizardAnswers): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];
  if (answers.age !== null) chips.push({ label: "Age", value: `${answers.age} yrs` });
  if (answers.state) chips.push({ label: "State", value: answers.state });
  if (answers.budget) chips.push({ label: "Budget", value: BUDGET_LABEL[answers.budget] });
  if (answers.weeklyHours)
    chips.push({ label: "Training", value: `${answers.weeklyHours} hrs/wk` });
  if (answers.ambition) chips.push({ label: "Goal", value: AMBITION_LABEL[answers.ambition] });
  return chips;
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-editorial text-ink text-balance text-3xl font-light leading-tight">
        {title}
      </h2>
      <p className="text-ink-body mt-1.5 text-sm">{sub}</p>
    </div>
  );
}

function SportCard({
  result,
  answers,
  role,
  chosen,
  saving,
  onChoose,
  compact = false,
}: {
  result: SportResult;
  answers: WizardAnswers;
  role: PortfolioRole;
  /** Secondary suggestions under a shortlist: one reason and the cost, nothing else (F7). */
  compact?: boolean;
  chosen: boolean;
  saving: boolean;
  onChoose: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const meta = PORTFOLIO_META[role];

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white ${
        chosen ? "border-green-700/40 ring-1 ring-green-700/30" : "border-hairline"
      }`}
    >
      <div className="px-5 pb-4 pt-5">
        <p className="text-ink-muted flex items-center justify-between gap-2 text-sm font-medium">
          <span>{meta.label}</span>
          <span>{result.fitLabel}</span>
        </p>
        <h3 className="font-editorial text-ink mt-2 text-3xl font-light leading-tight">
          {result.sport.name}
        </h3>
        <p className="text-ink-body mt-1 text-sm">{result.sport.tagline}</p>
      </div>

      {/* Reasons, specific to this child's answers */}
      <ul className="border-hairline flex-1 space-y-2.5 border-t px-5 py-4">
        {result.reasons.slice(0, compact ? 1 : 3).map((reason, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check
              className="text-ink mt-1 h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <p className="text-ink-body text-sm leading-relaxed">{reason}</p>
          </li>
        ))}
      </ul>

      {/* What it costs, and what to watch for in a trial */}
      {compact ? (
        <p className="text-ink-body px-5 pb-4 text-sm">Cost to try: {result.sport.costRange}</p>
      ) : (
        <div className="bg-paper mx-5 mb-4 rounded-lg px-3.5 py-3">
          <p className="text-ink text-sm font-medium">Cost to try: {result.sport.costRange}</p>
          <p className="text-ink-body mt-1 text-sm leading-relaxed">{meta.watchFor(name)}</p>
        </div>
      )}

      <div className="px-5 pb-5">
        <ChooseSportButton
          sportName={result.sport.name}
          chosen={chosen}
          saving={saving}
          onChoose={onChoose}
          tone="subtle"
        />
      </div>
    </article>
  );
}

// ─── Shortlist summary ───────────────────────────────────────────────────────
// One deterministic sentence over the parent's own picks, so the page leads
// with a verdict instead of making them compare three numbers themselves.

function shortlistSummary(fits: SportFitResult[], name: string): string {
  const best = [...fits].sort((a, b) => b.score - a.score)[0];
  if (!best) return "";
  const blocked = fits.filter((f) => f.hasBlocker);

  if (fits.length === 1) {
    return best.hasBlocker
      ? `${best.sport.name} scores ${best.score}/100 for ${name}, but there's something to sort out first. It's under "Where it'll be harder" below.`
      : `${best.sport.name} scores ${best.score}/100 for ${name}. Here's exactly what's behind that number.`;
  }

  const lead = `Of the ${fits.length} you picked, ${best.sport.name} lines up best for ${name} at ${best.score}/100.`;
  if (blocked.length === 0)
    return `${lead} Every one of them has something that fits and something that doesn't. Both are below.`;
  if (blocked.length === fits.length)
    return `${lead} All of them have something to sort out first. See "Where it'll be harder" on each.`;
  return `${lead} ${blocked.length === 1 ? `${blocked[0].sport.name} has` : `${blocked.length} of them have`} something to sort out first.`;
}

export function ResultsView({
  results,
  chosenFits = [],
  answers,
  onRetake,
  savedStatus = "idle",
  isLoggedIn = false,
  savedForName,
  dependentId,
  chosenSport = null,
  choosingSport = false,
  onChooseSport,
  childrenOptions = [],
  suggestedChildId = null,
  onSaveTo,
}: {
  results: SportResult[];
  /** The parent's own shortlist, scored — leads the page when non-empty. */
  chosenFits?: SportFitResult[];
  answers: WizardAnswers;
  onRetake: () => void;
  savedStatus?: SavedStatus;
  /** The parent's children, offered when results are `unsaved`. */
  childrenOptions?: { _id?: string; name: string }[];
  suggestedChildId?: string | null;
  onSaveTo?: (childId: string | null) => Promise<boolean>;
  isLoggedIn?: boolean;
  savedForName?: string;
  dependentId?: string;
  /** The sport the parent committed to, once they've said so. */
  chosenSport?: string | null;
  choosingSport?: boolean;
  onChooseSport?: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const hasShortlist = chosenFits.length > 0;

  // Our own recommendations still run — but a sport the parent already
  // shortlisted is covered in full above, so repeating it as a "suggestion"
  // would just be the same sport twice with a thinner writeup.
  const chosenIds = new Set(chosenFits.map((f) => f.sport.id));
  const topResults = results.slice(0, 3);
  const portfolio = buildPortfolio(topResults).filter(
    ({ result }) => !chosenIds.has(result.sport.id)
  );

  const keyFindings = buildKeyFindings(answers);
  const contextChips = buildContextChips(answers);
  const isUnderTen = answers.age !== null && answers.age <= 10;

  // Cards run best-scoring first. The scorer deliberately keeps the parent's own
  // selection order, but that order means nothing to them once every card is
  // headed by a score — a 77 sitting above an 84 just reads as broken sorting.
  const orderedFits = [...chosenFits].sort((a, b) => b.score - a.score);

  // Everything downstream (trial booking, WhatsApp copy, the 4-week check-in)
  // hangs off one sport. An explicit choice outranks everything: until the
  // parent makes one we fall back to the strongest of their own picks, then to
  // our top recommendation — but those are inferences, and this isn't.
  const topFit = orderedFits[0];
  const inferredSport = topFit?.sport.name ?? topResults[0]?.sport.name;
  const primarySportName = chosenSport ?? inferredSport;
  const headlineSport = primarySportName;
  const chooseProps = (sport: string) => ({
    chosen: chosenSport === sport,
    saving: choosingSport,
    onChoose: onChooseSport ?? (() => {}),
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-12 duration-300 motion-reduce:animate-none">
      {savedStatus === "unsaved" && onSaveTo && (
        <SaveResultsPrompt
          childName={name}
          childrenOptions={childrenOptions}
          suggestedChildId={suggestedChildId}
          onSave={onSaveTo}
        />
      )}

      {/* ── Report header ──
          The verdict, the constraints it was measured against, and the way forward land
          above the fold. On the cream page itself, no card: DESIGN.md separates by tone and
          hairline, not by boxes and shadows. */}
      <header className="mb-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
              <span>Assessment complete</span>
              {savedStatus === "saving" && (
                <span className="text-ink-body inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="border-ink/40 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                  />
                  Saving to {savedForName ?? "the profile"}
                </span>
              )}
              {savedStatus === "saved" && (
                <span className="inline-flex items-center gap-1.5 text-green-800">
                  <CheckCircle
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  {savedForName ? `Saved to ${savedForName}'s profile` : "Saved to the profile"}
                </span>
              )}
              {savedStatus === "error" && (
                <span className="text-amber-800">
                  Couldn&apos;t save automatically. Your results are still below.
                </span>
              )}
            </p>

            <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-[1.08] sm:text-5xl">
              {hasShortlist
                ? `How ${name} fits the sports you're considering`
                : `Sports that suit ${name}`}
            </h1>
            <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-lg leading-relaxed">
              {hasShortlist
                ? shortlistSummary(chosenFits, name)
                : "Three options, each for a different reason: the strongest fit, a stretch worth trying, and the easiest way to start."}
            </p>
          </div>

          {/* Headline verdict: the one sport (and its number) plus the way forward */}
          {headlineSport && (
            <div className="border-hairline w-full shrink-0 rounded-2xl border bg-white p-5 lg:w-[290px]">
              <p className="text-ink-muted text-sm font-medium">
                {chosenSport ? "You're starting with" : topFit ? "Strongest fit" : "Best fit"}
              </p>
              <p className="font-editorial text-ink mt-1 text-3xl font-light leading-tight">
                {headlineSport}
              </p>

              {/* The score belongs to our verdict; once the parent has made their own
                  call, leading with our number undercuts it. */}
              {topFit && !chosenSport && (
                <div className="mt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-editorial text-ink text-3xl font-light tabular-nums leading-none">
                      {topFit.score}
                    </span>
                    <span className="text-ink-muted text-sm">/ 100</span>
                    <span
                      className={`ml-auto text-sm font-medium ${topFit.hasBlocker ? "text-amber-800" : "text-ink-body"}`}
                    >
                      {topFit.hasBlocker ? "Needs a fix" : topFit.fitLabel}
                    </span>
                  </div>
                  <div className="bg-hairline mt-2 h-1 overflow-hidden rounded-full">
                    <div className="bg-ink h-full" style={{ width: `${topFit.score}%` }} />
                  </div>
                </div>
              )}

              <a
                href={trialWhatsAppUrl(name, primarySportName)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${WHATSAPP_BUTTON} mt-5 w-full`}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Book a trial class
              </a>
            </div>
          )}
        </div>

        {/* Constraints every score was measured against */}
        {contextChips.length > 0 && (
          <dl className="border-hairline mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y py-3 text-sm">
            <span className="text-ink-muted font-medium">Scored against</span>
            {contextChips.map((chip) => (
              <div key={chip.label} className="flex items-baseline gap-1.5">
                <dt className="text-ink-muted">{chip.label}</dt>
                <dd className="text-ink font-medium">{chip.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {/* Under-10 multi-sport framing: don't push specialisation this young */}
      {isUnderTen && (
        <div className="bg-wash mb-10 flex items-start gap-3 rounded-xl px-4 py-3.5">
          <Info className="text-ink mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-ink text-sm leading-relaxed">
            At {answers.age}, we wouldn&apos;t pick just one yet. Playing 2 or 3 of these together
            builds broader athleticism than specialising early. Treat the ones below as sports to
            rotate between, not a single choice to commit to.
          </p>
        </div>
      )}

      {/* ── The parent's own shortlist, scored ── */}
      {hasShortlist && (
        <section className="mb-12">
          <SectionHeader
            title="Sports you're considering"
            sub="Scored the same way as our own suggestions, best fit first."
          />
          <div className="space-y-5">
            {orderedFits.map((fit, i) => (
              <SportFitCard
                key={fit.sport.id}
                fit={fit}
                answers={answers}
                eyebrow={
                  orderedFits.length > 1 && i === 0 ? "Best of your picks" : "Your shortlist"
                }
                {...chooseProps(fit.sport.name)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Our own suggestions ── */}
      {portfolio.length > 0 && (
        <section className="mb-12">
          {hasShortlist && (
            <SectionHeader
              title="Also worth a look"
              sub={`Sports you didn't pick that ${name}'s answers point toward.`}
            />
          )}
          <div
            className={`grid grid-cols-1 items-stretch gap-5 ${PORTFOLIO_GRID[portfolio.length] ?? "sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {portfolio.map(({ result, role }) => (
              <SportCard
                key={result.sport.id}
                result={result}
                answers={answers}
                role={role}
                compact={hasShortlist}
                {...chooseProps(result.sport.name)}
              />
            ))}
          </div>
        </section>
      )}

      {/* What the scores were based on. It mostly restates the parent's own answers, so
          it sits below the sports and starts closed instead of leading the page (audit F7). */}
      {keyFindings.length > 0 && (
        <details className="border-hairline group mb-12 border-y py-4">
          <summary className="text-ink flex cursor-pointer list-none items-center gap-2 text-base font-medium">
            What we based this on
            <ChevronDown
              className="text-ink ml-auto h-4 w-4 transition-transform duration-200 group-open:rotate-180"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-4 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check
                  className="text-ink mt-1 h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <p className="text-ink-body text-sm leading-relaxed">{finding}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* scroll-mt clears the fixed site nav */}
      <div id="next-step" className="scroll-mt-20">
        <JourneyPipeline childName={name} topSport={primarySportName} />
      </div>

      {/* Optional extras: screening, expert session, community, saving the profile */}
      <WhatsNextPanel
        childName={name}
        topSport={primarySportName}
        dependentId={dependentId}
        isLoggedIn={isLoggedIn}
        saved={savedStatus === "saved"}
      />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onRetake}
          className="text-ink-body hover:text-ink focus-visible:ring-ink focus-visible:ring-offset-paper flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          Retake the assessment
        </button>
      </div>
    </div>
  );
}
