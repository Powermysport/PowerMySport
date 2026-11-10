"use client";

import { ChevronDown, CircleCheck, CircleHelp, CircleX, Minus } from "lucide-react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import type { Opportunity } from "../services/opportunities";
import {
  VERDICT_LABELS,
  checkOpportunity,
  hasProfile,
  type CheckState,
  type EligibilityCheck,
  type Verdict,
} from "../utils/match";
import { ProfileFields } from "./ProfileFields";

// ─── "Can your child apply?" ─────────────────────────────────────────────
//
// Every rule the entry states, one row each, with the child checked against
// the ones that can be checked. A rule written in the scheme's own words
// (marks, income, level) is listed as published and marked "check this
// yourself": a tick there would be a guess, and a parent could act on it.
//
// A rule that could be checked but has no answer yet carries no tag: one line
// above the list says how to check, instead of the same words on every row.

const STATE_VIEW: Record<
  CheckState,
  { Icon: typeof CircleCheck; tone: string; tag: string | null; srLabel: string }
> = {
  pass: { Icon: CircleCheck, tone: "text-emerald-700", tag: "Matches", srLabel: "Matches" },
  fail: { Icon: CircleX, tone: "text-red-700", tag: "Does not match", srLabel: "Does not match" },
  manual: {
    Icon: CircleHelp,
    tone: "text-amber-700",
    tag: "Check this yourself",
    srLabel: "Check this yourself",
  },
  unknown: { Icon: Minus, tone: "text-ink-muted", tag: null, srLabel: "Not checked yet" },
};

const VERDICT_BANNER: Record<Verdict, string> = {
  fits: "border-emerald-200 bg-emerald-50 text-emerald-900",
  check: "border-amber-200 bg-amber-50 text-amber-950",
  no: "border-hairline bg-paper-deep text-ink",
};

const VERDICT_DETAIL: Record<Verdict, string> = {
  fits: "Your child matches every rule we can check.",
  check:
    'Nothing we checked stops your child, but please confirm the rules marked "Check this yourself".',
  no: "Your child does not meet at least one rule. See which one below.",
};

/** Rules are stored as written ("national-level athlete"); a row starts with a capital. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function Row({ check }: { check: EligibilityCheck }) {
  const view = STATE_VIEW[check.state];
  return (
    <li className="flex gap-3 py-4">
      <view.Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${view.tone}`} />
      <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-ink-muted text-sm">
            {check.label}
            <span className="sr-only">: {view.srLabel}</span>
          </p>
          <p className="text-ink mt-0.5 text-pretty text-base leading-relaxed">
            {sentence(check.detail)}
          </p>
        </div>
        {view.tag && (
          <p className={`mt-1 shrink-0 text-sm font-medium sm:mt-0.5 ${view.tone}`} aria-hidden>
            {view.tag}
          </p>
        )}
      </div>
    </li>
  );
}

export function EligibilityChecklist({
  opportunity,
}: {
  opportunity: Pick<Opportunity, "sports" | "allSports" | "geography" | "eligibility">;
}) {
  const { profile } = useOpportunityProfile();
  const { checks, verdict } = checkOpportunity(opportunity, profile);
  const known = hasProfile(profile);

  return (
    <div className="space-y-5">
      {/*
        The rules are the answer; the form only sharpens it. It stays closed for a
        first visit so the rules come first, and opens by itself for a parent who
        has already given details, whose verdict below it depends on them.
      */}
      <details
        className="border-hairline group rounded-xl border bg-white"
        open={known || undefined}
      >
        <summary className="text-ink hover:bg-paper-deep/50 focus-visible:ring-ink flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-base font-medium focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
          <span>
            Check if my child can apply
            <span className="text-ink-muted ml-2 hidden text-sm font-normal sm:inline">
              Age, sport, boy or girl, state
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="text-ink-muted h-4 w-4 shrink-0 transition group-open:rotate-180"
          />
        </summary>
        <div className="border-hairline border-t p-4">
          <ProfileFields
            sports={opportunity.allSports ? [] : opportunity.sports}
            className="grid grid-cols-2 gap-x-3 gap-y-4"
          />
          <p className="text-ink-muted mt-3 text-sm">Your answers stay on this device only.</p>
        </div>
      </details>

      {verdict && known && (
        <p role="status" className={`rounded-lg border p-3 text-sm ${VERDICT_BANNER[verdict]}`}>
          <span className="font-semibold">{VERDICT_LABELS[verdict]}.</span>{" "}
          {VERDICT_DETAIL[verdict]}
        </p>
      )}

      <ul className="divide-hairline border-hairline divide-y border-y">
        {checks.map((check) => (
          <Row key={check.key} check={check} />
        ))}
      </ul>
    </div>
  );
}
