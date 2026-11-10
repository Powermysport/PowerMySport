import {
  INTAKE_STEPS,
  WhatsAppEnquiry,
  type IntakeStep,
  type WhatsAppEnquiryDocument,
} from "../../client/models/WhatsAppEnquiry";
import { currentEnquiry, newEnquiry, plain, requestFollowUp } from "./whatsappEnquiries";
import { followUpReply, type ReplyButton } from "./whatsappInteractive";

/**
 * Finding a coach or academy for a parent, while none are listed on PowerMySport yet.
 *
 * The team does the matching by hand, so what it needs is the child's details: age, sport, where
 * the family lives, the level, and anything else that matters (timings, budget). The intake asks
 * for them one at a time, in code and without the model, so it is quick, free and always lands:
 * a parent who taps "Find a coach or academy" ends with their details with the team and a reference,
 * not with "we noted it" and nothing the team can act on. Details the parent already gave on this
 * topic are not asked again.
 *
 * Each step's answer is the parent's next message. Typing "cancel" or tapping another option
 * leaves the intake; an intake left alone for two hours is forgotten.
 */

export const INTAKE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_RETRIES = 1;

export const INTAKE_SKIP_ID = "intake_skip";
export const LEVEL_BUTTONS: ReplyButton[] = [
  { id: "intake_level_beginner", title: "Just starting" },
  { id: "intake_level_regular", title: "Plays regularly" },
  { id: "intake_level_competes", title: "Competes" },
];
const LEVEL_FOR_ID: Record<string, string> = {
  intake_level_beginner: "beginner",
  intake_level_regular: "plays regularly",
  intake_level_competes: "competes in tournaments",
};
const SKIP_BUTTON: ReplyButton[] = [{ id: INTAKE_SKIP_ID, title: "Nothing more" }];

export const INTAKE_INTRO =
  "We don't list coaches or academies on PowerMySport yet, but our team can find good options near you. A few quick questions so they know what to look for (type cancel to stop).";
export const INTAKE_CANCELLED =
  "No problem, I've stopped there. Ask me anything else, or tap Find a coach or academy again any time.";

const QUESTION: Record<IntakeStep, string> = {
  age: "How old is your child? Just the age in years, for example 11.",
  sport: "Which sport is it for?",
  city: "Which city and area do you live in? For example: Pune, Baner.",
  level: "Where is your child at in this sport?",
  needs:
    "Anything else the team should know? For example preferred timings, budget, or a coach for a tournament. Or tap Nothing more.",
};
const RETRY: Partial<Record<IntakeStep, string>> = {
  city: "Got it, I've noted that for the team. Which city and area do you live in? For example: Chandigarh, Sector 22. Or type skip.",
  age: "Sorry, I didn't catch the age. Please send just the number of years, for example 11, or type skip.",
};

export interface IntakeReply {
  reply: string;
  buttons?: ReplyButton[];
  /** True once the details went to the team. */
  forwarded?: boolean;
}

const has = (e: WhatsAppEnquiryDocument, step: IntakeStep): boolean => {
  if (step === "age") return e.childAge !== undefined;
  if (step === "sport") return Boolean(e.sport);
  if (step === "city") return Boolean(e.city);
  if (step === "level") return Boolean(e.level);
  return false;
};

/** The first step after `from` (exclusive) whose answer is not known yet. */
function nextStep(e: WhatsAppEnquiryDocument, from?: IntakeStep): IntakeStep | null {
  const start = from ? INTAKE_STEPS.indexOf(from) + 1 : 0;
  for (const step of INTAKE_STEPS.slice(start)) if (!has(e, step)) return step;
  return null;
}

function ask(step: IntakeStep, prefix?: string): IntakeReply {
  const text = prefix ? `${prefix}\n\n${QUESTION[step]}` : QUESTION[step];
  if (step === "level") return { reply: text, buttons: LEVEL_BUTTONS };
  if (step === "needs") return { reply: text, buttons: SKIP_BUTTON };
  return { reply: text };
}

/** The summary the team reads, in one line per thing. */
export function intakeSummary(e: WhatsAppEnquiryDocument, needs?: string): string {
  const child = [
    e.childAge !== undefined ? `${e.childAge} years old` : null,
    e.sport,
    e.level,
  ].filter(Boolean);
  return [
    "Looking for a coach or academy.",
    child.length ? `Child: ${child.join(", ")}.` : null,
    e.city ? `Area: ${e.city}.` : null,
    needs ? `Also: ${needs}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The intake this number is in the middle of, if any. */
export async function activeIntake(
  phoneHash: string,
  now = new Date()
): Promise<WhatsAppEnquiryDocument | null> {
  return WhatsAppEnquiry.findOne({
    phoneHash,
    "intake.startedAt": { $gte: new Date(now.getTime() - INTAKE_TTL_MS) },
  }).sort({ lastMessageAt: -1 });
}

export async function cancelIntake(phoneHash: string): Promise<void> {
  await WhatsAppEnquiry.updateMany(
    { phoneHash, intake: { $exists: true } },
    { $unset: { intake: 1 } }
  );
}

async function finish(e: WhatsAppEnquiryDocument, needs?: string): Promise<IntakeReply> {
  const summary = intakeSummary(e, needs);
  // Saved as the newest topic, so the follow-up below lands on this same enquiry.
  e.set("intake", undefined);
  e.lastMessageAt = new Date();
  await e.save();
  // The parent just gave these details, so the team hears about them even if this enquiry
  // already had a request waiting.
  const result = await requestFollowUp(e.phoneHash, e.question, {
    kind: "coach",
    summary,
    refresh: true,
  });
  return {
    reply: followUpReply("coach", result.reference, result.alreadyRequested),
    forwarded: true,
  };
}

/**
 * Starts the intake on the parent's current topic and returns the first question, or forwards
 * straight away when everything is already known.
 */
export async function startIntake(
  phoneHash: string,
  question: string,
  now = new Date()
): Promise<IntakeReply> {
  const current = await currentEnquiry(phoneHash, question, now);
  // Only details given on this same, fresh topic are reused. A topic the team already handled, or
  // one from an earlier day, may be about another child: start a clean enquiry and ask again.
  const reusable =
    current.followUpStatus === "none" &&
    now.getTime() - current.createdAt.getTime() < 24 * 60 * 60 * 1000;
  const enquiry = reusable ? current : await newEnquiry(phoneHash, question, now);
  const step = nextStep(enquiry);
  if (!step) return finish(enquiry);
  enquiry.intake = { step, startedAt: now, retries: 0 };
  enquiry.lastMessageAt = now;
  await enquiry.save();
  return ask(step, INTAKE_INTRO);
}

const SKIP = /^(skip|no|nothing|nothing more|none|na|n\/a|nahi|nahin|no thanks)\.?$/i;
const CANCEL = /^(cancel|stop it|exit|quit|band karo|rehne do)\.?$/i;

export function isCancel(text: string): boolean {
  return CANCEL.test(text.trim());
}

const NOT_A_PLACE =
  /\b(think|want|wants|should|would|need|needs|academy|academies|coach|coaching|book|help|looking|maybe|please)\b/i;
const PLACE_LEAD = /^(i|we)\s+(live|stay|am|are)\s+(in|at|near)\s+|^(in|at|near)\s+/i;

/**
 * The place in an answer to "Which city and area?", or undefined when the answer is about
 * something else. "I live in Pune, Baner" gives "Pune, Baner".
 */
export function parseCity(text: string): string | undefined {
  const cleaned = text
    .trim()
    .replace(PLACE_LEAD, "")
    .replace(/[.!]+$/, "")
    .trim();
  if (!cleaned || NOT_A_PLACE.test(cleaned)) return undefined;
  if (cleaned.split(/\s+/).length > 6) return undefined;
  return plain(cleaned, 60);
}

/** The first whole number in the text, if it is a plausible age. */
export function parseAge(text: string): number | undefined {
  const match = text.match(/\b(\d{1,2})\b/);
  if (!match) return undefined;
  const age = Number(match[1]);
  return age >= 3 && age <= 21 ? age : undefined;
}

/**
 * Takes the parent's answer to the current step and returns what to say next. `replyId` is set
 * when they tapped a button instead of typing.
 */
export async function answerIntake(
  enquiry: WhatsAppEnquiryDocument,
  text: string,
  replyId: string | null | undefined,
  now = new Date()
): Promise<IntakeReply> {
  const intake = enquiry.intake!;
  const step = intake.step;
  const answer = text.trim();
  const skipped = replyId === INTAKE_SKIP_ID || SKIP.test(answer);

  // Written on this enquiry directly: the intake belongs to it, whichever topic is newest.
  if (!skipped) {
    if (step === "age") {
      const age = parseAge(answer);
      if (age === undefined) {
        if (intake.retries < MAX_RETRIES) {
          enquiry.intake = { ...intake, retries: intake.retries + 1 };
          enquiry.lastMessageAt = now;
          await enquiry.save();
          return { reply: RETRY.age! };
        }
      } else {
        enquiry.childAge = age;
      }
    } else if (step === "sport") {
      const sport = plain(answer, 40);
      if (sport) enquiry.sport = sport;
    } else if (step === "city") {
      const city = parseCity(answer);
      if (!city) {
        // Something else was said ("I think an academy for Jatin"): keep it for the team as a
        // note, and ask for the place once more rather than storing a sentence as the city.
        const note = plain(answer, 240);
        if (note) intake.needs = [intake.needs, note].filter(Boolean).join(". ").slice(0, 240);
        if (intake.retries < MAX_RETRIES) {
          enquiry.intake = { ...intake, retries: intake.retries + 1 };
          enquiry.lastMessageAt = now;
          await enquiry.save();
          return { reply: RETRY.city! };
        }
      } else {
        enquiry.city = city;
      }
    } else if (step === "level") {
      const level = plain((replyId && LEVEL_FOR_ID[replyId]) || answer, 60);
      if (level) enquiry.level = level;
    } else if (step === "needs") {
      const needs = plain(answer, 240);
      if (needs) intake.needs = needs;
    }
  }

  const fresh = enquiry;
  const next = nextStep(fresh, step);
  if (!next) return finish(fresh, intake.needs ?? undefined);

  fresh.intake = {
    step: next,
    startedAt: intake.startedAt,
    retries: 0,
    ...(intake.needs ? { needs: intake.needs } : {}),
  };
  fresh.lastMessageAt = now;
  await fresh.save();
  return ask(next);
}
