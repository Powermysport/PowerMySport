import type { EnquiryCategory } from "../../client/models/WhatsAppEnquiry";
import { retrieveRelevantChunks } from "./knowledgeRetrievalService";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("whatsappAnswerGate");

/**
 * After a parent confirms their request: does the assistant answer it now, or does it go to the
 * team? Anything we already know well enough to answer is answered at once, and anything we do
 * not is left to a person, with the 24-hour promise. A wrong answer sent confidently is worse
 * than a slower right one, so every doubt goes to the team.
 *
 * The assistant answers only when ALL of these hold:
 *  - the switch is on (WHATSAPP_ADAPTIVE_AI_ANSWER is anything but "off"),
 *  - the request is not one the team always handles,
 *  - it is not about the parent's own account, registration, booking or payment, or a wish to
 *    speak to a person,
 *  - the knowledge base holds something close to it (a similarity score at or above the line).
 *
 * The line is a setting, because it needs tuning on real conversations. It started at 0.70, a guess.
 * The first live evaluation (src/evals/adaptiveIntake, Nov 2026) searched 11 questions and 5
 * confirmed requests against the 51 FAQ entries: every entry that did not really answer the
 * question scored 0.66 or less, and every one that did scored 0.69 or more, so the line is 0.68.
 * That is a small sample and a gap of 0.03, so re-run it when the knowledge base grows.
 */

export type Route = "assistant" | "team";

export interface GateDecision {
  route: Route;
  reason: "switched off" | "team only" | "personal case" | "not covered" | "covered";
  /** The best similarity score found, 0 when nothing was close or the check could not run. */
  score: number;
}

export interface GateDeps {
  retrieve?: (query: string) => Promise<Array<{ score: number }>>;
}

const DEFAULT_MIN_SCORE = 0.68;

export const answerMinScore = (): number => {
  const set = Number(process.env.WHATSAPP_ANSWER_MIN_SCORE);
  return Number.isFinite(set) && set > 0 && set <= 1 ? set : DEFAULT_MIN_SCORE;
};

export const aiAnswerEnabled = (): boolean => process.env.WHATSAPP_ADAPTIVE_AI_ANSWER !== "off";

/** Requests the team always handles. Coaches and academies are matched by hand: none are listed. */
const TEAM_ONLY: ReadonlySet<EnquiryCategory> = new Set<EnquiryCategory>(["coaching"]);

/**
 * A request about the parent's own case is a job for a person with access to it, not for general
 * guidance. This leans toward the team on purpose: a false match only costs a slower, human reply.
 */
export const PERSONAL_CASE =
  /\b(?:my|our)\s+(?:aita|registration|account|booking|payment|order|refund|ranking\s+points?)\b|\b(?:not working|doesn'?t work|failed|stuck|error|complain\w*|refund\w*|cancel(?:led|lation)?|deducted|wrongly)\b|\bcan'?t\s+(?:log\s?in|register|book|pay)\b|\b(?:talk|speak|connect)\b.{0,20}\b(?:someone|person|human|team|advisor|expert)\b/i;

export async function chooseRoute(
  category: EnquiryCategory,
  said: string,
  deps: GateDeps = {}
): Promise<GateDecision> {
  const decide = (route: Route, reason: GateDecision["reason"], score = 0): GateDecision => {
    log.info(`route=${route} reason="${reason}" category=${category} score=${score.toFixed(2)}`);
    return { route, reason, score };
  };

  if (!aiAnswerEnabled()) return decide("team", "switched off");
  if (TEAM_ONLY.has(category)) return decide("team", "team only");
  if (PERSONAL_CASE.test(said)) return decide("team", "personal case");

  let score = 0;
  try {
    const chunks = await (deps.retrieve ?? retrieveRelevantChunks)(said.slice(0, 500));
    score = chunks.reduce((best, c) => Math.max(best, c.score), 0);
  } catch (err) {
    // No knowledge check means no basis to answer: the team has it.
    log.warn(`could not check the knowledge base: ${String(err).slice(0, 160)}`);
  }
  return score >= answerMinScore()
    ? decide("assistant", "covered", score)
    : decide("team", "not covered", score);
}
