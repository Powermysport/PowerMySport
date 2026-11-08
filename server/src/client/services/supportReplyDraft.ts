import { GoogleGenAI } from "@google/genai";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("supportReplyDraft");

/**
 * An AI first draft of an admin's reply to a support ticket.
 *
 * It only ever fills the reply box: the admin reads it, edits it and sends it
 * through the normal reply endpoint. Nothing here sends mail or writes the ticket.
 *
 * What the model is given is the ticket's subject, category, message and the
 * conversation so far. Not the requester's name, email or phone: the reply
 * email adds the greeting itself, so the model has no use for them.
 */

export interface DraftTicketInput {
  subject: string;
  category: string;
  description: string;
  status: string;
  notes: Array<{ authorType: string; message: string; emailedAt?: Date | string | null }>;
}

/** The model call: system prompt and user prompt in, plain text out. A seam for tests. */
export type DraftModel = (systemPrompt: string, userPrompt: string) => Promise<string>;

const SYSTEM_PROMPT = `You draft email replies for the support team of PowerMySport, an Indian platform that helps parents with their children's sport: finding the right sport, coaches, academies, venues, tournaments, rankings and pathways.

Write the body of one reply to the parent or user who raised the ticket.

Rules:
- Plain, warm and direct, like a helpful person at a small company. Short paragraphs. Usually 60 to 150 words.
- Do not start with a greeting and do not sign off: the email already adds "Hi <name>," above and "PowerMySport support team" below.
- Answer what they actually asked. If you can't know the answer (a date, a price, whether a feature exists, a refund decision, an account detail), do not guess or promise: put a short placeholder in square brackets for the team to fill, such as [confirm date].
- Never invent policies, timelines, prices, links or features. Never promise a refund or a callback.
- No em dashes, no emoji, no marketing language, no bullet lists unless steps are genuinely needed.
- Internal notes are the team's private context: use them to shape the answer, never quote them.
- If the team gave instructions, follow them.
- Reply with the email body only, as plain text.`;

/** The user prompt: the ticket and its history, without the requester's contact details. */
export function buildDraftPrompt(
  ticket: DraftTicketInput,
  instructions?: string,
  now: Date = new Date()
): string {
  const history = ticket.notes
    .map((note) => {
      const who =
        note.authorType === "USER"
          ? "The user wrote"
          : note.emailedAt
            ? "The team replied (sent)"
            : "Internal note (never sent)";
      return `${who}:\n${note.message}`;
    })
    .join("\n\n");

  // Without today's date the model reasons from its training cutoff: asked for "June 2025"
  // rankings in late 2026, it told the parent those dates were still in the future.
  const today = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return [
    `Today's date: ${today}`,
    `Ticket subject: ${ticket.subject}`,
    `Category: ${ticket.category}`,
    `Status: ${ticket.status}`,
    "",
    `The user's message:\n${ticket.description}`,
    ...(history ? ["", `Conversation so far:\n${history}`] : []),
    ...(instructions?.trim() ? ["", `Instructions from the team:\n${instructions.trim()}`] : []),
    "",
    "Write the reply body now.",
  ].join("\n");
}

/** Cleans what the model sends back: fences, a stray greeting or sign-off, em dashes. */
export function cleanDraft(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .trim()
    .replace(/^(hi|hello|dear)\b[^\n]{0,40},?\s*\n+/i, "")
    .replace(/\n+\s*(best|kind|warm)?\s*regards,?[\s\S]*$/i, "")
    .replace(/\n+\s*(thanks|thank you),?\s*\n+\s*(the\s+)?powermysport[\s\S]*$/i, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();
}

const candidates = (): string[] =>
  [process.env.SUPPORT_GEMINI_MODEL, "gemini-2.5-flash", "gemini-3.5-flash"]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, all) => all.indexOf(name) === index);

const RETRYABLE = [
  "404",
  "not found",
  "429",
  "quota",
  "rate limit",
  "too many requests",
  "503",
  "unavailable",
  "high demand",
  "overloaded",
  "empty response",
];

const BUSY = ["503", "unavailable", "high demand", "overloaded"];
const BUSY_PAUSE_MS = 2500;

/** Gemini, moving on to the next model when one is missing, out of quota or busy. */
export const callGeminiText: DraftModel = async (systemPrompt, userPrompt) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable");
  const client = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;
  for (let pass = 0; pass < 2; pass += 1) {
    if (pass === 1) {
      // Every model said it was busy. Demand spikes pass in seconds, so one more round after
      // a pause beats sending the admin away. Quota and missing models are not retried.
      const message = lastError instanceof Error ? lastError.message.toLowerCase() : "";
      if (!BUSY.some((word) => message.includes(word))) break;
      await new Promise((resolve) => setTimeout(resolve, BUSY_PAUSE_MS));
    }
    for (const model of candidates()) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: userPrompt,
          config: { systemInstruction: systemPrompt, temperature: 0.4 },
        });
        const text = (response.text ?? "").trim();
        if (!text) throw new Error("The model returned an empty response");
        return text;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (RETRYABLE.some((word) => message.includes(word))) {
          log.warn(
            `Support draft model ${model} unavailable, trying the next: ${message.slice(0, 160)}`
          );
          continue;
        }
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No model was available");
};

/** A cleaned first draft for the reply box. Throws when no model could answer. */
export async function draftSupportReply(
  ticket: DraftTicketInput,
  instructions?: string,
  model: DraftModel = callGeminiText
): Promise<string> {
  const draft = cleanDraft(await model(SYSTEM_PROMPT, buildDraftPrompt(ticket, instructions)));
  if (!draft) throw new Error("The model returned an empty draft");
  return draft;
}
