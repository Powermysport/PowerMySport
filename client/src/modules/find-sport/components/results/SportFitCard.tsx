"use client";

import { AlertTriangle, Check, Clock, IndianRupee, Minus } from "lucide-react";
import type { SportFitResult, WizardAnswers } from "../../types";
import { ChooseSportButton } from "./ChooseSportButton";

/** At most this many lines per side, so a card reads in one glance on a phone (audit F7). */
const MAX_LINES = 3;

export function SportFitCard({
  fit,
  answers,
  eyebrow,
  chosen,
  saving,
  onChoose,
}: {
  fit: SportFitResult;
  answers: WizardAnswers;
  /** Position label. Never an ordinal of the parent's pick order — the cards are
   *  sorted by score, so a "#2" beside a higher number than the "#3" below it
   *  read as a bug. */
  eyebrow: string;
  chosen: boolean;
  saving: boolean;
  onChoose: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const strengths = fit.strengths.slice(0, MAX_LINES);
  const gaps = fit.gaps.slice(0, MAX_LINES);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white ${
        chosen ? "border-green-700/40 ring-1 ring-green-700/30" : "border-hairline"
      }`}
    >
      {/* ── Identity, score and practicals ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-ink-muted text-sm font-medium">{eyebrow}</p>
          <h3 className="font-editorial text-ink mt-1 text-3xl font-light leading-tight">
            {fit.sport.name}
          </h3>
          <p className="text-ink-body mt-1 text-sm">{fit.sport.tagline}</p>
        </div>
        <div className="sm:text-right">
          <p className="font-editorial text-ink text-4xl font-light tabular-nums leading-none">
            {fit.score}
            <span className="text-ink-muted ml-1 font-sans text-sm">/ 100</span>
          </p>
          <p
            className={`mt-1.5 text-sm font-medium ${fit.hasBlocker ? "text-amber-800" : "text-ink-body"}`}
          >
            {fit.hasBlocker ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Needs a fix first
              </span>
            ) : (
              fit.fitLabel
            )}
          </p>
        </div>
      </div>

      <div className="border-hairline text-ink-body flex flex-wrap gap-x-5 gap-y-1.5 border-t px-5 py-3 text-sm sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <IndianRupee className="text-ink h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {fit.sport.costRange}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="text-ink h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {fit.sport.minWeeklyHours}+ hrs a week to progress
        </span>
      </div>

      {/* ── Two-sided breakdown ── */}
      <div className="border-hairline divide-hairline grid grid-cols-1 divide-y border-t md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-ink text-sm font-semibold">Where {name} fits</p>
          <ul className="mt-3 space-y-2.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check
                  className="text-ink mt-1 h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <p className="text-ink-body text-sm leading-relaxed">{s}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 py-4 sm:px-6">
          <p className="text-ink text-sm font-semibold">Where it&apos;ll be harder</p>
          {gaps.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Minus
                    className="text-ink mt-1 h-3.5 w-3.5 shrink-0"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <p className="text-ink-body text-sm leading-relaxed">{g}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-body mt-3 text-sm leading-relaxed">
              Nothing in {name}&apos;s answers works against {fit.sport.name}. A trial class is the
              only thing left to check.
            </p>
          )}
        </div>
      </div>

      {/* ── The decision ── */}
      <div className="border-hairline flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-6">
        <p className="text-ink-body text-sm">
          {chosen
            ? `Your trial booking and follow-ups will use ${fit.sport.name}.`
            : "Decided? Tell us and we'll set the trial up in this sport."}
        </p>
        <ChooseSportButton
          sportName={fit.sport.name}
          chosen={chosen}
          saving={saving}
          onChoose={onChoose}
        />
      </div>
    </article>
  );
}
