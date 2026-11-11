import mongoose, { Document, Schema } from "mongoose";

/**
 * One parent question on WhatsApp, and how it ended, so the team can review the pilot.
 *
 * The chat keeps only the latest turns and expires in 90 days. This is the part worth reviewing
 * afterwards: what the parent asked, who the child is (age, sport, level), what they wanted,
 * what we told them, whether they needed a person, and how it went. One record covers one topic:
 * a new one starts after the parent closes the last or after a day of silence, so a parent who
 * returns weeks later with a new question is a second enquiry, not an edit of the first.
 *
 * The number itself is not stored in the clear. `phoneHash` is the same keyed hash the chat uses,
 * so STOP deletes the chat, the notes and these together. `parentRef` is a short pseudonym of it
 * for the admin screen. The number is kept encrypted on every enquiry (`contactPhoneEnc`), so the
 * team can follow up on any question; it leaves the server only through the audit-logged reveal
 * and the team-reply sender. The first-contact notice tells the parent so.
 *
 * Every free-text field is cut down and capped by the service before it gets here.
 */

export const ENQUIRY_RETENTION_SECONDS = 60 * 60 * 24 * 180;
/** A parent who writes again within this long of the last message is still on the same topic. */
export const ENQUIRY_IDLE_MS = 24 * 60 * 60 * 1000;
/**
 * A parent answering the team within this long is still talking to the team about that enquiry.
 * Longer than the idle window, because a template message can reach a parent days later.
 */
export const TEAM_THREAD_MS = 7 * 24 * 60 * 60 * 1000;

/** The most recent exchanges kept on one enquiry. Older ones drop off, so a long chat stays bounded. */
export const MAX_ENQUIRY_TURNS = 30;

export interface EnquiryTurn {
  at: Date;
  /** What the parent said, or for a voice note what was heard, or for a photo a short label. */
  parent: string;
  /** What the assistant answered. */
  assistant: string;
}

export const ASSISTANCE_KINDS = ["coach", "tournaments", "expert", "team", "other"] as const;
export type AssistanceKind = (typeof ASSISTANCE_KINDS)[number];

export const FOLLOW_UP_STATUSES = ["none", "new", "contacted", "done"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const ENQUIRY_FEEDBACK = ["helpful", "not_helpful"] as const;

/** A message the team sent the parent from the admin panel. */
export interface TeamMessage {
  at: Date;
  text: string;
  /** "text" inside WhatsApp's 24-hour window, "template" outside it. */
  via: "text" | "template";
  /** The admin who sent it. */
  by?: string;
}

/** The steps of the coach/academy intake, asked in this order. */
/** "child" is asked only when the account has several children and the parent named none. */
export const INTAKE_STEPS = ["child", "age", "sport", "city", "level", "needs"] as const;
export type IntakeStep = (typeof INTAKE_STEPS)[number];

export interface EnquiryIntake {
  step: IntakeStep;
  startedAt: Date;
  /** Wrong answers to the current step, so a parent is not asked the same thing forever. */
  retries: number;
  /** What the parent added at the last step (timings, budget...). */
  needs?: string;
  /** The child on the account this is for, by first name, once known. */
  childName?: string;
  /** What the parent asked for, in their words: an academy, a coach, or either. */
  wants?: "academy" | "coach" | "either";
  /** What the parent picked from the menu. Absent means the coach/academy request. */
  topic?: "sport" | "start" | "tournaments" | "pathway";
  /** The account's children to choose from, by id, while the "child" step is open. */
  childOptions?: string[];
}
export type EnquiryFeedback = (typeof ENQUIRY_FEEDBACK)[number];

export interface WhatsAppEnquiryDocument extends Document {
  phoneHash: string;
  /** Short pseudonym of the number, for the admin screen. Not reversible. */
  parentRef: string;
  /** What the parent can quote to the team, e.g. "PMS-4F2K9". */
  reference: string;
  /** The parent's first message on this topic. */
  question: string;
  childAge?: number;
  sport?: string;
  level?: string;
  /** City and area, asked when the parent wants a coach or academy. */
  city?: string;
  objective?: string;
  /** The assistant's latest answer, kept as its own field for lists and quick reading. */
  guidance?: string;
  /** Every exchange on this topic, oldest first, so the team sees all the advice and not just the last. */
  turns: EnquiryTurn[];
  assistance: AssistanceKind[];
  followUpStatus: FollowUpStatus;
  followUpSummary?: string;
  /** The support ticket the hand-off created, when there was one. */
  ticketId?: string;
  /** Encrypted number, so the team can reach the parent. */
  contactPhoneEnc?: string;
  /** Messages the team sent from the admin panel, oldest first. */
  teamMessages: TeamMessage[];
  /** When the team last wrote; a parent answering within a day stays on this enquiry. */
  lastTeamMessageAt?: Date;
  /** When the parent last wrote after a team message, so the team is told once per message. */
  parentRepliedAt?: Date;
  /** Set while the coach/academy intake is collecting the child's details. */
  intake?: EnquiryIntake;
  feedback?: EnquiryFeedback;
  /** True once the parent said they were done, or the conversation moved on. */
  closed: boolean;
  /** Written by the team in the admin screen. */
  teamNote?: string;
  turnCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const whatsAppEnquirySchema = new Schema<WhatsAppEnquiryDocument>(
  {
    phoneHash: { type: String, required: true },
    parentRef: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    question: { type: String, required: true, maxlength: 500 },
    childAge: { type: Number, min: 3, max: 21 },
    sport: { type: String, maxlength: 40 },
    level: { type: String, maxlength: 60 },
    city: { type: String, maxlength: 60 },
    objective: { type: String, maxlength: 240 },
    guidance: { type: String, maxlength: 2000 },
    turns: {
      type: [
        new Schema<EnquiryTurn>(
          {
            at: { type: Date, required: true },
            parent: { type: String, required: true, maxlength: 500 },
            assistant: { type: String, required: true, maxlength: 2000 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    assistance: { type: [{ type: String, enum: ASSISTANCE_KINDS }], default: [] },
    followUpStatus: { type: String, enum: FOLLOW_UP_STATUSES, default: "none" },
    followUpSummary: { type: String, maxlength: 600 },
    ticketId: { type: String, maxlength: 40 },
    contactPhoneEnc: { type: String, maxlength: 400 },
    teamMessages: {
      type: [
        new Schema<TeamMessage>(
          {
            at: { type: Date, required: true },
            text: { type: String, required: true, maxlength: 1000 },
            via: { type: String, enum: ["text", "template"], required: true },
            by: { type: String, maxlength: 120 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    lastTeamMessageAt: { type: Date },
    parentRepliedAt: { type: Date },
    intake: {
      type: new Schema<EnquiryIntake>(
        {
          step: { type: String, enum: INTAKE_STEPS, required: true },
          startedAt: { type: Date, required: true },
          retries: { type: Number, default: 0 },
          needs: { type: String, maxlength: 240 },
          childName: { type: String, maxlength: 60 },
          wants: { type: String, enum: ["academy", "coach", "either"] },
          topic: { type: String, enum: ["sport", "start", "tournaments", "pathway"] },
          childOptions: { type: [String], default: undefined },
        },
        { _id: false }
      ),
      required: false,
    },
    feedback: { type: String, enum: ENQUIRY_FEEDBACK },
    closed: { type: Boolean, default: false },
    teamNote: { type: String, maxlength: 1000 },
    turnCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Finding this number's open topic, newest first.
whatsAppEnquirySchema.index({ phoneHash: 1, lastMessageAt: -1 });
// The admin list, newest first, and its "needs follow-up" filter.
whatsAppEnquirySchema.index({ followUpStatus: 1, lastMessageAt: -1 });
whatsAppEnquirySchema.index({ createdAt: -1 });
// A child's details and a parent's question are in here, so enquiries are not kept indefinitely.
whatsAppEnquirySchema.index(
  { lastMessageAt: 1 },
  { expireAfterSeconds: ENQUIRY_RETENTION_SECONDS }
);

export const WhatsAppEnquiry = mongoose.model<WhatsAppEnquiryDocument>(
  "WhatsAppEnquiry",
  whatsAppEnquirySchema
);
