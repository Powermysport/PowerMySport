import type { EnquiryCategory } from "../../client/models/WhatsAppEnquiry";

/**
 * The parents the evaluation plays. None is a real person: each is a short, invented family, with
 * the answers they would give if asked. The first is the team's own example conversation.
 */

export type Field = "sport" | "age" | "city" | "experience" | "goal";

export interface Persona {
  id: string;
  label: string;
  /** The parent's first message, typed in their own words. */
  opener: string;
  /** What is true about the family, so what was captured can be checked against it. */
  truth: { age?: number; sport?: string; city?: string };
  /** What the parent says when asked about each detail. */
  answers: Partial<Record<Field, string>>;
  expect: {
    /** The request the reader should place the opening message in. */
    category: EnquiryCategory;
    /** The details the opening message already states, which must never be asked again. */
    statedInOpener: Field[];
    /**
     * "team" means the assistant must not answer it (a personal case, or a coach to be matched by
     * hand). "either" means both routes are acceptable and the run only reports which was taken.
     */
    route: "team" | "either";
  };
  /** What the offline run uses in place of the model: the reading of each message, in order. */
  scripted: {
    opening: Record<string, unknown>;
    answers: Partial<Record<Field, Record<string, unknown>>>;
    /** The knowledge-base score the offline run uses in place of the real search. */
    score: number;
  };
}

export const PERSONAS: Persona[] = [
  {
    id: "aita-start",
    label: "The team's own example: a 13-year-old tennis player starting AITA tournaments",
    opener:
      "My son is 13 and plays tennis. I want to know how he can start playing AITA tournaments.",
    truth: { age: 13, sport: "tennis", city: "Chandigarh" },
    answers: {
      city: "Chandigarh.",
      experience: "He has played a few local tournaments but no AITA tournaments.",
      goal: "All three actually. I don't know where to start.",
    },
    expect: { category: "tournaments", statedInOpener: ["age", "sport", "goal"], route: "either" },
    scripted: {
      opening: {
        category: "tournaments",
        age: 13,
        sport: "tennis",
        goal: "Learn how to start playing AITA tournaments",
      },
      answers: {
        city: { city: "Chandigarh" },
        experience: { playingContext: "Has played local tournaments, no AITA tournaments yet" },
      },
      score: 0.82,
    },
  },
  {
    id: "scholarship-swimmer",
    label: "A 15-year-old state-level swimmer, asking about scholarships",
    opener:
      "My daughter is 15 and swims at state level. Are there any scholarships she could apply for?",
    truth: { age: 15, sport: "swimming", city: "Pune" },
    answers: {
      city: "We are in Pune.",
      experience:
        "She has won state medals in 200m freestyle and trains at a club six days a week.",
      goal: "A scholarship for college, or a sponsor for her travel to meets.",
    },
    expect: { category: "scholarships", statedInOpener: ["age", "sport", "goal"], route: "either" },
    scripted: {
      opening: {
        category: "scholarships",
        age: 15,
        sport: "swimming",
        goal: "Find scholarships she could apply for",
      },
      answers: {
        experience: { playingContext: "State medals in 200m freestyle, trains six days a week" },
        city: { city: "Pune" },
      },
      score: 0.55,
    },
  },
  {
    id: "choose-a-sport",
    label: "An 8-year-old who likes two sports, and the parent cannot decide",
    opener: "My 8 year old son loves both football and cricket. Which one should we focus on?",
    truth: { age: 8 },
    answers: {
      experience: "He plays both in the colony ground on weekends, nothing formal yet.",
      goal: "Something he enjoys, but I would like him to be good at it.",
    },
    expect: { category: "sport", statedInOpener: ["age", "goal"], route: "either" },
    scripted: {
      opening: {
        category: "sport",
        age: 8,
        playingContext: "Plays football and cricket",
        goal: "Decide which sport to focus on",
      },
      answers: {},
      score: 0.78,
    },
  },
  {
    id: "registration-failed",
    label: "A parent whose AITA registration failed after paying: a personal case",
    opener: "My AITA registration failed and the payment got deducted. Please help me.",
    truth: {},
    answers: {
      sport: "Tennis",
      age: "12",
      goal: "Get the registration done or the money back.",
    },
    expect: { category: "tournaments", statedInOpener: ["goal"], route: "team" },
    scripted: {
      opening: { category: "tournaments", goal: "Registration failed after payment" },
      answers: {
        sport: { sport: "tennis" },
        age: { age: 12 },
      },
      score: 0.9,
    },
  },
  {
    id: "badminton-coach",
    label: "A parent who wants a badminton coach for a 10-year-old in Mumbai",
    opener:
      "I am looking for a badminton coach for my 10 year old daughter in Mumbai, weekday evenings.",
    truth: { age: 10, sport: "badminton", city: "Mumbai" },
    answers: {
      experience: "She has just started, about three months of weekend classes.",
      goal: "A good coach nearby, budget around 5000 a month.",
    },
    expect: {
      category: "coaching",
      statedInOpener: ["age", "sport", "city", "goal"],
      route: "team",
    },
    scripted: {
      opening: {
        category: "coaching",
        age: 10,
        sport: "badminton",
        city: "Mumbai",
        goal: "Badminton coach on weekday evenings",
      },
      answers: { experience: { playingContext: "Three months of weekend classes" } },
      score: 0.95,
    },
  },
];

/**
 * Questions put to the knowledge-base search alone, to see where the "answer it now" line should
 * sit. `want` is the intended route: general guidance the assistant should be able to give, or a
 * specific case only the team can answer. The run prints each one's best matches so a person can
 * judge whether the line is in the right place.
 */
export interface Probe {
  text: string;
  want: "assistant" | "team";
}

export const PROBES: Probe[] = [
  { text: "How do I start playing AITA tournaments?", want: "assistant" },
  { text: "What age groups are there in junior tennis tournaments?", want: "assistant" },
  { text: "How are AITA rankings calculated?", want: "assistant" },
  { text: "Which sport is best for a 9 year old?", want: "assistant" },
  { text: "How do sports scholarships work in India?", want: "assistant" },
  { text: "What is PowerMySport and how does it work?", want: "assistant" },
  { text: "Is my son eligible for the Chandigarh under 14 event on 20 December?", want: "team" },
  { text: "Which academy near Sector 22 offers a free trial for badminton?", want: "team" },
  {
    text: "Will my daughter get a scholarship at a Pune college with a state silver medal?",
    want: "team",
  },
  { text: "My son's knee hurts after football practice, what should he do?", want: "team" },
  { text: "Can you tell me what my child's current ranking points are?", want: "team" },
];
