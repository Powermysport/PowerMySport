"use client";

import { Circle, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import type { ReactNode } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import type { Opportunity } from "../services/opportunities";
import {
  checkOpportunity,
  hasProfile,
  type CheckState,
  type EligibilityCheck,
} from "../utils/match";
import { AgeField, GenderField, SportField, StateField } from "./ProfileFields";

// ─── "Can your child apply?" ─────────────────────────────────────────────
//
// Each rule we can check carries its own question, on the same row: the rule
// on the left, the parent's answer on the right, the result under the rule as
// soon as it is answered. No separate form to find, open and come back from.
//
// The rules split in two, because they ask different things of the parent:
//   We can check these     sport, age, boy or girl, state: answer and see
//   Check these yourself   level, marks, income: written in the scheme's own
//                          words, so a tick would be a guess a parent could
//                          act on. Listed as published, never ticked.
//
// A rule every child passes ("open to every sport", "open across India") gets
// no row: the header already says it, and a tick nobody earned is noise.

type Answerable = "sport" | "age" | "gender" | "where";

const RESULT: Record<
  Exclude<CheckState, "manual">,
  { Icon: typeof CircleCheck; tone: string; tag: string | null; srLabel: string }
> = {
  pass: { Icon: CircleCheck, tone: "text-emerald-700", tag: "Matches", srLabel: "Matches" },
  fail: { Icon: CircleX, tone: "text-red-700", tag: "Does not match", srLabel: "Does not match" },
  unknown: { Icon: Circle, tone: "text-ink/25", tag: null, srLabel: "Not checked yet" },
};

/** How a failed rule is named in the summary line: "does not meet the age rule". */
const RULE_NAME: Record<Answerable, string> = {
  sport: "sport",
  age: "age",
  gender: "boy-or-girl",
  where: "state",
};

/** Rules are stored as written ("national-level athlete"); a row starts with a capital. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function listOf(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The question that answers a rule, or null when the rule needs no answer
 * because every child passes it.
 */
function questionFor(
  check: EligibilityCheck,
  opportunity: Pick<Opportunity, "sports" | "allSports" | "geography">
): ReactNode | null {
  const field = "w-full sm:w-56";
  switch (check.key) {
    case "sport":
      return opportunity.allSports || opportunity.sports.length === 0 ? null : (
        <SportField sports={opportunity.sports} label="Child's sport" className={field} />
      );
    case "age":
      return <AgeField label="Child's age" className={`${field} max-w-[10rem] sm:max-w-none`} />;
    case "gender":
      return <GenderField label="Boy or girl" className={`${field} max-w-[14rem] sm:max-w-none`} />;
    case "where":
      return opportunity.geography?.scope === "state" ? (
        <StateField label="Your state" className={field} />
      ) : null;
    default:
      return null;
  }
}

/**
 * The rule's name, what it says, and (on the name's own line, so the row never
 * grows and nothing below it moves while the parent answers) the result.
 */
function RuleText({ check, result }: { check: EligibilityCheck; result?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-ink-muted text-sm">{check.label}</p>
        {result}
      </div>
      <p className="text-ink mt-0.5 text-pretty text-base leading-relaxed">
        {sentence(check.detail)}
      </p>
    </div>
  );
}

function AnswerRow({ check, question }: { check: EligibilityCheck; question: ReactNode }) {
  const result = RESULT[check.state === "manual" ? "unknown" : check.state];
  return (
    <li className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-10">
      <div className="flex gap-3">
        <result.Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone}`} />
        <RuleText
          check={check}
          result={
            result.tag ? (
              <p className={`text-sm font-medium ${result.tone}`}>{result.tag}</p>
            ) : (
              <span className="sr-only">{result.srLabel}</span>
            )
          }
        />
      </div>
      <div className="pl-8 sm:pl-0">{question}</div>
    </li>
  );
}

function ManualRow({ check }: { check: EligibilityCheck }) {
  return (
    <li className="flex gap-3 py-4">
      <CircleHelp aria-hidden className="text-ink-muted mt-0.5 h-5 w-5 shrink-0" />
      <RuleText check={check} />
    </li>
  );
}

export function EligibilityChecklist({
  opportunity,
}: {
  opportunity: Pick<Opportunity, "sports" | "allSports" | "geography" | "eligibility">;
}) {
  const { profile } = useOpportunityProfile();
  const { checks } = checkOpportunity(opportunity, profile);

  const answerable = checks
    .filter((check) => check.state !== "manual")
    .map((check) => ({ check, question: questionFor(check, opportunity) }))
    .filter(
      (row): row is { check: EligibilityCheck; question: ReactNode } => row.question !== null
    );
  const manual = checks.filter((check) => check.state === "manual");

  const fails = answerable.filter(({ check }) => check.state === "fail");
  const open = answerable.filter(({ check }) => check.state === "unknown");
  const answered = answerable.length - open.length;

  // One line that says where the parent stands, once they have answered anything here.
  let status: { tone: string; text: string } | null = null;
  if (answerable.length > 0 && answered > 0 && hasProfile(profile)) {
    if (fails.length > 0) {
      const names = fails.map(({ check }) => RULE_NAME[check.key as Answerable] ?? check.label);
      status = {
        tone: "border-hairline bg-paper-deep text-ink",
        text: `Does not match. Your child does not meet the ${listOf(names)} rule${names.length > 1 ? "s" : ""}.`,
      };
    } else if (open.length > 0) {
      status = {
        tone: "border-hairline bg-white text-ink",
        text: "So far so good. Answer the rest to finish the check.",
      };
    } else {
      status = {
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
        text:
          manual.length > 0
            ? `Matches so far. Your child meets every rule we can check. Check the ${manual.length === 1 ? "one" : manual.length} below yourself.`
            : "Matches. Your child meets every rule we can check.",
      };
    }
  }

  return (
    <div className="space-y-10">
      {answerable.length > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-ink text-lg font-medium">We can check these for you</h3>
            <p className="text-ink-muted text-sm">Your answers stay on this device.</p>
          </div>
          <ul className="divide-hairline border-hairline mt-4 divide-y border-y">
            {answerable.map(({ check, question }) => (
              <AnswerRow key={check.key} check={check} question={question} />
            ))}
          </ul>
          {/*
            Under the questions, not above them: a line appearing above would push
            the next field down while the parent is reaching for it. The live region
            is always there so a screen reader hears each change.
          */}
          <div role="status">
            {status && (
              <p className={`mt-4 rounded-lg border p-3 text-sm ${status.tone}`}>{status.text}</p>
            )}
          </div>
        </div>
      )}

      {manual.length > 0 && (
        <div>
          <h3 className="text-ink text-lg font-medium">Check these yourself</h3>
          <p className="text-ink-body mt-1 max-w-[60ch] text-pretty text-sm leading-relaxed">
            We cannot check these for you. Read the full wording on the official website.
          </p>
          <ul className="divide-hairline border-hairline mt-4 divide-y border-y">
            {manual.map((check) => (
              <ManualRow key={check.key} check={check} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
