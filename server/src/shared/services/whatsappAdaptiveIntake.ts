import {
  ENQUIRY_IDLE_MS,
  TEAM_REPLY_PROMISE_MS,
  TEAM_THREAD_MS,
  WhatsAppEnquiry,
  type AdaptiveAsking,
  type EnquiryCategory,
  type SessionFormat,
  type WhatsAppEnquiryDocument,
} from "../../client/models/WhatsAppEnquiry";
import { newEnquiry, plain, requestFollowUp } from "./whatsappEnquiries";
import { PERSONAL_CASE, chooseRoute, type GateDeps } from "./whatsappAnswerGate";
import { queueLateInfoAlert } from "./whatsappTeamAlert";
import type { ReplyButton } from "./whatsappInteractive";
import {
  CHILD_ID,
  accountChildren,
  childButtons,
  namedIn,
  parseAge,
  parseCity,
  type AccountChild,
  type IntakeReply,
} from "./whatsappAcademyIntake";
import { Player } from "../../client/models/Player";
import {
  cleanExtracted,
  geminiExtractor,
  type ExtractHint,
  type ExtractInput,
  type Extracted,
  type IntakeExtractor,
} from "./whatsappIntakeExtractor";
import { reserveIntakeRead } from "./whatsappIntakeBudget";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("whatsappAdaptiveIntake");

/**
 * The one conversation for every parent query: read what the parent said, ask only what is
 * missing, say it back, and once they confirm, the team has it and has promised a reply within
 * 24 hours. The parent should feel heard, not interrogated: a detail already in the opening
 * message is never asked again, the questions stop at a small cap, and free text is always
 * accepted next to the buttons.
 *
 * Switched on with WHATSAPP_ADAPTIVE_INTAKE=on. Off, the chat behaves as it did before this
 * existed, so the new path can ship dark and be turned off again without a deploy.
 *
 * Which question comes next, and the words of every question, are decided here in code. The model
 * only reads what the parent wrote into fields (see whatsappIntakeExtractor.ts).
 */
export const adaptiveIntakeEnabled = (): boolean => process.env.WHATSAPP_ADAPTIVE_INTAKE === "on";

/** Longest the parent waits for the model to read a message before the plain question is used. */
export const EXTRACT_TIMEOUT_MS = 8000;

/** What the intake depends on, as parameters so tests run it without the model or Redis. */
export interface AdaptiveDeps extends GateDeps {
  extract?: IntakeExtractor;
  /** Takes one reading from the parent's daily budget; false when it is spent. */
  reserve?: (phoneHash: string) => Promise<boolean>;
  timeoutMs?: number;
}

/**
 * Every reading goes through here: inside the parent's daily budget, with a time limit, and
 * cleaned afterwards whoever produced it, so the code never trusts what came back. Throws when no
 * usable reading could be had, and the caller then asks the plain question without the model.
 */
async function callExtractor(
  deps: AdaptiveDeps,
  phoneHash: string,
  input: Omit<ExtractInput, "signal">
): Promise<Extracted> {
  if (!(await (deps.reserve ?? reserveIntakeRead)(phoneHash))) {
    throw new Error("today's reading budget is spent");
  }
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("the reader took too long"));
    }, deps.timeoutMs ?? EXTRACT_TIMEOUT_MS);
  });
  try {
    const extract = deps.extract ?? geminiExtractor;
    return cleanExtracted(
      await Promise.race([extract({ ...input, signal: controller.signal }), timedOut])
    );
  } finally {
    clearTimeout(timer);
  }
}

export const ADAPTIVE_YES_ID = "intake_yes";
export const ADAPTIVE_CHANGE_ID = "intake_change";
const CONFIRM_BUTTONS: ReplyButton[] = [
  { id: ADAPTIVE_YES_ID, title: "Yes, correct" },
  { id: ADAPTIVE_CHANGE_ID, title: "Change something" },
];

/** Follow-up questions asked at most, however much is still missing. */
export const MAX_FOLLOW_UPS = 3;
/**
 * Some requests have more to settle before the team can act (where and when for a coach, the
 * class and the institutions for admissions), so they may ask more. Every other kind keeps the
 * lower limit, so a parent is never quizzed for the sake of it.
 */
const FOLLOW_UP_CAP: Partial<Record<EnquiryCategory, number>> = {
  coaching: 6,
  admissions: 6,
  scholarships: 5,
  fitness: 5,
  sport: 5,
};
export const followUpCap = (category: EnquiryCategory): number =>
  FOLLOW_UP_CAP[category] ?? MAX_FOLLOW_UPS;
/** How long a half-finished conversation is remembered. Same as the coach questions. */
export const ADAPTIVE_TTL_MS = 2 * 60 * 60 * 1000;

type Field = Exclude<AdaptiveAsking, "child" | "confirm" | "fix">;

const QUESTION: Record<Field, string> = {
  sport: "Which sport does your child play?",
  age: "How old is your child?",
  city: "Which city are you based in?",
  area: "Which area or locality would suit for training? For example Sector 22 or Baner.",
  timing: "What days and times work best? For example weekday evenings or weekend mornings.",
  format: "Would you prefer group sessions or one-to-one?",
  budget: "Do you have a monthly budget in mind? You can skip this.",
  grade: "Which class is your child in, and which board? For example Class 9, CBSE.",
  admission: "Is this for school admission, college admission, or both?",
  targets: "Are there any schools or colleges you already have in mind? You can skip this.",
  state: "Which state does your child compete or train in?",
  support: "What kind of support are you looking for? For example fees, kit or travel.",
  hours: "How many hours a week does your child train?",
  experience: "What has your child played or achieved so far, and how do they train?",
  goal: "Is there anything specific you would like us to help with?",
};

/** Wording that fits the kind of request better than the general question does. */
const QUESTION_FOR: Partial<Record<EnquiryCategory, Partial<Record<Field, string>>>> = {
  tournaments: {
    experience:
      "Has your child played any competitive tournaments before, or would this be the first?",
  },
  start: { experience: "Is your child just starting out, or already training somewhere?" },
  coaching: {
    experience:
      "Where is your child at in the sport: just starting, playing regularly, or competing?",
    goal: "What kind of coaching are you looking for, for example timings, budget or a coach for a tournament?",
  },
  sport: {
    experience: "Which sports does your child play or enjoy at the moment?",
    goal: "What would you like sport to do for your child, for example fitness, fun or a competitive path?",
    hours: "How many hours a week could your child give to sport?",
    budget: "Do you have a monthly budget for sport in mind? You can skip this.",
  },
  pathway: {
    experience: "How far has your child come in the sport so far?",
    goal: "What are you hoping your child's sporting path looks like?",
  },
  scholarships: {
    experience:
      "What has your child achieved so far in the sport, such as rankings, medals or state-level play?",
    goal: "Is there a particular scholarship, sponsor or institution you have in mind?",
  },
  admissions: {
    experience:
      "What level does your child play at in the sport, and what have they achieved so far?",
    goal: "What are you looking for, for example admission to a school or college through sport?",
  },
  fitness: {
    goal: "What would you like help with, for example fitness, an injury or conditioning?",
  },
  other: { goal: "What would you like help with?" },
};

const questionFor = (category: EnquiryCategory, field: Field): string =>
  QUESTION_FOR[category]?.[field] ?? QUESTION[field];

const INTRO: Partial<Record<EnquiryCategory, string>> = {
  tournaments: "That's great! We can help you understand the tournament pathway.",
  sport: "Happy to help you choose the right sport.",
  start: "Happy to help your child get started or improve.",
  coaching:
    "Happy to help you find a coach or book a trial. Our team will match you personally, so a few details first.",
  pathway: "Happy to help you understand the sports pathway.",
  scholarships:
    "Happy to help with scholarships and sponsorships. A few details first so our team can look at the right options.",
  admissions:
    "Happy to help with school and college admissions through sport. A few details first so our team can guide you properly.",
  fitness: "Happy to help with fitness and sports support.",
};

/**
 * What to ask for each kind of request, most useful first. Only what that request needs: choosing
 * a sport does not ask for a class, and "something else" asks only what is wanted.
 */
const CHECKLIST: Record<EnquiryCategory, Field[]> = {
  tournaments: ["sport", "age", "city", "experience", "goal"],
  start: ["sport", "age", "city", "experience", "goal"],
  coaching: ["sport", "age", "city", "area", "timing", "format", "budget", "experience", "goal"],
  sport: ["age", "experience", "goal", "hours", "budget", "city"],
  pathway: ["sport", "age", "experience", "goal"],
  scholarships: ["sport", "age", "experience", "state", "support", "goal"],
  admissions: ["sport", "age", "grade", "admission", "city", "experience", "targets", "goal"],
  fitness: ["age", "sport", "goal", "hours", "city"],
  other: ["goal"],
};

/** How the team's list names each kind of request. */
const CATEGORY_LABEL: Record<EnquiryCategory, string> = {
  sport: "Choosing a sport",
  start: "Starting or improving",
  coaching: "Coach or academy",
  tournaments: "Tournaments",
  pathway: "Pathway",
  scholarships: "Scholarships",
  admissions: "School and college admissions",
  fitness: "Fitness and sports support",
  other: "Other",
};

/** The menu rows and buttons that start the questions on a topic, and what each is about. */
export const ADAPTIVE_CATEGORY_FOR_REPLY: Record<string, EnquiryCategory> = {
  menu_sport: "sport",
  menu_start: "start",
  menu_tournaments: "tournaments",
  menu_pathway: "pathway",
  menu_scholarships: "scholarships",
  menu_admissions: "admissions",
  menu_fitness: "fitness",
  menu_other: "other",
  next_coach: "coaching",
  next_tournaments: "tournaments",
};

const FIX_QUESTION = "No problem. What should I change? Tell me in your own words.";

const ACK_EXTRA: Partial<Record<EnquiryCategory, string>> = {
  coaching:
    "If you have a preferred academy or any other details you'd like us to consider, you can share them here too.",
  tournaments:
    "If you have any recent tournament results or other details you'd like us to consider, you can share them here too.",
  scholarships:
    "If you have achievements, certificates or rankings you'd like us to consider, you can share them here too.",
  admissions:
    "If you have report cards, certificates or tournament results you'd like us to consider, you can share them here too.",
};
const ACK_EXTRA_DEFAULT =
  "If there is anything else you'd like us to consider, you can share it here too.";

export const acknowledgement = (reference: string, category?: EnquiryCategory): string =>
  `Thank you for sharing this with PowerMySport! We've captured your request (${reference}). Our team will review the details and get back to you within 24 hours.\n\n${(category && ACK_EXTRA[category]) || ACK_EXTRA_DEFAULT}`;

// ─── The details a request can hold ───────────────────────────────────────────
// One table, read by the question picker, the saving, the summary and the typed-answer fallbacks,
// so a new detail is one entry here and not a change in five places.

/** A button that stands for an answer. */
interface Tap {
  id: string;
  title: string;
  value: string;
}

/** A detail kept as short text on the enquiry, and read back by the reader under the same name. */
type TextProp =
  "area" | "timing" | "budget" | "grade" | "targets" | "state" | "supportType" | "trainingHours";
interface TextDetail {
  prop: TextProp;
  max: number;
  /** The summary line's label. */
  label: string;
  /** A parent may pass it over: a Skip button, or "skip" and "no" typed. */
  skippable?: boolean;
  /** Buttons that stand for an answer, next to typing one. */
  taps?: Tap[];
}

const SKIP_WORDS = /^(skip|no|none|nothing|na|n\/a|nahi|nahin|not sure|flexible|no budget)[.!]*$/i;
const skipId = (field: Field): string => `intake_${field}_skip`;
/** Kept under its old name: the budget's Skip button. */
export const BUDGET_SKIP_ID = skipId("budget");

const TEXT_DETAILS: Partial<Record<Field, TextDetail>> = {
  // Shown within the Location line, so its label is not used.
  area: { prop: "area", max: 80, label: "Area" },
  timing: { prop: "timing", max: 120, label: "Timing" },
  budget: { prop: "budget", max: 60, label: "Budget", skippable: true },
  grade: { prop: "grade", max: 60, label: "Class and board" },
  targets: { prop: "targets", max: 120, label: "Institutions in mind", skippable: true },
  state: { prop: "state", max: 40, label: "State" },
  support: {
    prop: "supportType",
    max: 80,
    label: "Support wanted",
    taps: [
      { id: "intake_support_fees", title: "Fees", value: "fees" },
      { id: "intake_support_kit", title: "Kit", value: "kit" },
      { id: "intake_support_travel", title: "Travel", value: "travel" },
    ],
  },
  hours: { prop: "trainingHours", max: 40, label: "Training hours" },
};

/** A detail with a fixed set of answers, each a tap. */
interface ChoiceDetail {
  prop: "sessionFormat" | "admission";
  label: string;
  taps: Tap[];
  /** How each stored value reads in the summary. */
  display: Record<string, string>;
  /** The answer in a typed reply, when the reader could not be asked. */
  parse: (said: string) => string | undefined;
}

/** Group or one-to-one from a typed answer. */
function formatFrom(said: string): SessionFormat | undefined {
  if (/\b(either|any|both|no preference|doesn.?t matter)\b/i.test(said)) return "either";
  if (/\bone[- ]?(to|on)[- ]?one\b|\bindividual\b|\bprivate\b|\bpersonal\b|\bsolo\b/i.test(said))
    return "individual";
  if (/\b(group|batch)\b/i.test(said)) return "group";
  return undefined;
}

/** School, college or both from a typed answer. */
function admissionFrom(said: string): "school" | "college" | "both" | undefined {
  const school = /\bschool\b/i.test(said);
  const college = /\b(college|university|degree|graduation)\b/i.test(said);
  if (/\bboth\b/i.test(said) || (school && college)) return "both";
  if (college) return "college";
  if (school) return "school";
  return undefined;
}

const CHOICE_DETAILS: Partial<Record<Field, ChoiceDetail>> = {
  format: {
    prop: "sessionFormat",
    label: "Format",
    taps: [
      { id: "intake_format_group", title: "Group", value: "group" },
      { id: "intake_format_individual", title: "One-to-one", value: "individual" },
      { id: "intake_format_either", title: "Either", value: "either" },
    ],
    display: { group: "Group", individual: "One-to-one", either: "Either" },
    parse: formatFrom,
  },
  admission: {
    prop: "admission",
    label: "Admission",
    taps: [
      { id: "intake_admission_school", title: "School", value: "school" },
      { id: "intake_admission_college", title: "College", value: "college" },
      { id: "intake_admission_both", title: "Both", value: "both" },
    ],
    display: { school: "School", college: "College", both: "School and college" },
    parse: admissionFrom,
  },
};

const asButtons = (taps: Tap[]): ReplyButton[] => taps.map(({ id, title }) => ({ id, title }));
export const FORMAT_BUTTONS: ReplyButton[] = asButtons(CHOICE_DETAILS.format!.taps);

/** What a question offers to tap, if anything. */
function buttonsFor(field: Field): ReplyButton[] | undefined {
  const choice = CHOICE_DETAILS[field];
  if (choice) return asButtons(choice.taps);
  const text = TEXT_DETAILS[field];
  if (text?.taps) return asButtons(text.taps);
  if (text?.skippable) return [{ id: skipId(field), title: "Skip" }];
  return undefined;
}

/** The enquiry's own fields, read and written by name for the table above. */
const store = (e: WhatsAppEnquiryDocument): Record<string, string | undefined> =>
  e as unknown as Record<string, string | undefined>;

/**
 * An answer that needs no reading: a tap, or a typed pass on something skippable. Returns the
 * value to store, "skip" to carry on without one, or null when the answer has to be read.
 */
function shortcutFor(
  field: Field,
  replyId: string | null | undefined,
  answer: string
): { prop: string; value: string } | "skip" | null {
  const choice = CHOICE_DETAILS[field];
  const text = TEXT_DETAILS[field];
  const tap = (choice?.taps ?? text?.taps)?.find((t) => t.id === replyId);
  if (tap) return { prop: (choice?.prop ?? text?.prop)!, value: tap.value };
  if (text?.skippable && (replyId === skipId(field) || SKIP_WORDS.test(answer))) return "skip";
  return null;
}

const present = (e: WhatsAppEnquiryDocument, field: Field): boolean => {
  if (field === "sport") return Boolean(e.sport);
  if (field === "age") return e.childAge !== undefined;
  if (field === "city") return Boolean(e.city);
  if (field === "experience") return Boolean(e.playingContext);
  if (field === "goal") return Boolean(e.objective);
  const detail = CHOICE_DETAILS[field] ?? TEXT_DETAILS[field];
  return detail ? Boolean(store(e)[detail.prop]) : false;
};

/** The next question worth asking: the first missing detail not asked before, within the cap. */
function nextQuestion(
  e: WhatsAppEnquiryDocument,
  category: EnquiryCategory,
  asked: AdaptiveAsking[]
): Field | null {
  if (asked.length >= followUpCap(category)) return null;
  for (const field of CHECKLIST[category] ?? []) {
    if (!present(e, field) && !asked.includes(field)) return field;
  }
  return null;
}

const capital = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Writes what the parent said on the enquiry. `overwrite` names the details this message is the
 * answer to, or "all" for the opening message and a correction; any other detail is only filled
 * when it is still empty, so a passing remark never replaces what the parent confirmed.
 */
function apply(e: WhatsAppEnquiryDocument, x: Extracted, overwrite: Field[] | "all"): void {
  const can = (field: Field): boolean =>
    overwrite === "all" || overwrite.includes(field) || !present(e, field);
  if (x.age !== undefined && can("age")) e.childAge = x.age;
  if (x.sport && can("sport")) e.sport = capital(x.sport);
  if (x.city && can("city")) e.city = x.city;
  if (x.playingContext && can("experience")) e.playingContext = x.playingContext;
  if (x.goal && can("goal")) e.objective = x.goal;
  if (x.childName && !e.childName) e.childName = x.childName;
  const read = x as Record<string, unknown>;
  for (const [field, detail] of Object.entries({ ...TEXT_DETAILS, ...CHOICE_DETAILS })) {
    const value = read[detail!.prop];
    if (typeof value === "string" && value && can(field as Field)) store(e)[detail!.prop] = value;
  }
}

/** What the model would have read, when it could not be asked: the answer to the question put. */
function fallback(hint: ExtractHint, said: string): Extracted {
  if (hint === "city") {
    const city = parseCity(said);
    return city ? { city } : {};
  }
  if (hint === "age") {
    const age = parseAge(said);
    return age !== undefined ? { age } : {};
  }
  const choice = CHOICE_DETAILS[hint as Field];
  if (choice) {
    const value = choice.parse(said);
    return value ? ({ [choice.prop]: value } as Extracted) : {};
  }
  const text = TEXT_DETAILS[hint as Field];
  if (text) {
    const value =
      text.skippable && SKIP_WORDS.test(said.trim()) ? undefined : plain(said, text.max);
    return value ? ({ [text.prop]: value } as Extracted) : {};
  }
  const value = plain(said, hint === "sport" ? 40 : 240);
  if (!value) return {};
  if (hint === "sport") return { sport: value };
  if (hint === "experience") return { playingContext: value };
  if (hint === "goal") return { goal: value };
  return {};
}

const knownOf = (e: WhatsAppEnquiryDocument): Extracted => {
  const known: Record<string, unknown> = {
    ...(e.childAge !== undefined ? { age: e.childAge } : {}),
    ...(e.sport ? { sport: e.sport } : {}),
    ...(e.city ? { city: e.city } : {}),
    ...(e.playingContext ? { playingContext: e.playingContext } : {}),
    ...(e.objective ? { goal: e.objective } : {}),
  };
  for (const detail of [...Object.values(TEXT_DETAILS), ...Object.values(CHOICE_DETAILS)]) {
    const value = store(e)[detail!.prop];
    if (value) known[detail!.prop] = value;
  }
  return known as Extracted;
};

async function read(
  deps: AdaptiveDeps,
  said: string,
  hint: ExtractHint,
  e: WhatsAppEnquiryDocument
): Promise<Extracted> {
  try {
    return await callExtractor(deps, e.phoneHash, { text: said, hint, known: knownOf(e) });
  } catch (err) {
    log.warn(`could not read the message, using the plain answer: ${String(err).slice(0, 160)}`);
    return fallback(hint, said);
  }
}

/** A summary line for a detail, or nothing when the request does not hold it. */
const lineFor = (e: WhatsAppEnquiryDocument, field: Field): string | null => {
  const choice = CHOICE_DETAILS[field];
  if (choice) {
    const value = store(e)[choice.prop];
    return value ? `${choice.label}: ${choice.display[value] ?? value}` : null;
  }
  const text = TEXT_DETAILS[field];
  const value = text && store(e)[text.prop];
  return text && value ? `${text.label}: ${value}` : null;
};

/** The request in the parent's words and ours, the way the team reads it. */
const summaryFor = (e: WhatsAppEnquiryDocument): string =>
  [
    e.childName || e.childAge !== undefined
      ? `Child: ${[e.childName, e.childAge !== undefined ? `${e.childAge} years old` : null]
          .filter(Boolean)
          .join(", ")}`
      : null,
    e.sport ? `Sport: ${e.sport}` : null,
    e.city ? `Location: ${[e.area, e.city].filter(Boolean).join(", ")}` : null,
    lineFor(e, "grade"),
    lineFor(e, "admission"),
    lineFor(e, "state"),
    lineFor(e, "timing"),
    lineFor(e, "format"),
    lineFor(e, "hours"),
    lineFor(e, "budget"),
    lineFor(e, "support"),
    lineFor(e, "targets"),
    e.playingContext ? `Playing context: ${e.playingContext}` : null,
    e.objective ? `Your request: ${e.objective}` : null,
  ]
    .filter(Boolean)
    .join("\n");

const confirmReply = (e: WhatsAppEnquiryDocument): IntakeReply => ({
  reply: `Here's what we've captured:\n${summaryFor(e)}\n\nIs this summary correct?`,
  buttons: CONFIRM_BUTTONS,
});

/** One line for the team's list: what was asked and who it is for. */
const teamSummary = (e: WhatsAppEnquiryDocument, category: EnquiryCategory): string =>
  `${CATEGORY_LABEL[category]}. ${summaryFor(e).replace(/\n/g, ". ").replace("Your request: ", "Wants: ")}`.slice(
    0,
    600
  );

/** Where to go next: the next question, or the summary once nothing useful is missing. */
async function moveOn(
  e: WhatsAppEnquiryDocument,
  category: EnquiryCategory,
  asked: AdaptiveAsking[],
  startedAt: Date,
  now: Date
): Promise<IntakeReply> {
  // A parent describing a problem with their own account, registration or payment is not asked
  // about the child's sport, age or city: only a person can help, and the summary is their words.
  const next = PERSONAL_CASE.test(e.question) ? null : nextQuestion(e, category, asked);
  e.intake = {
    step: "needs",
    startedAt,
    retries: 0,
    adaptive: {
      asking: next ?? "confirm",
      category,
      asked: next ? [...asked, next] : asked,
    },
  };
  e.lastMessageAt = now;
  await e.save();
  if (!next) return confirmReply(e);
  const buttons = buttonsFor(next);
  return { reply: questionFor(category, next), ...(buttons ? { buttons } : {}) };
}

/**
 * A parent the team has written to is talking to the team: what they write belongs to that
 * conversation, not to new questions.
 */
async function inTeamThread(phoneHash: string, now: Date): Promise<boolean> {
  return Boolean(
    await WhatsAppEnquiry.exists({
      phoneHash,
      closed: { $ne: true },
      lastTeamMessageAt: { $gte: new Date(now.getTime() - TEAM_THREAD_MS) },
    })
  );
}

/** The request this parent confirmed within the last day and has not closed, if any. */
async function recentConfirmed(
  phoneHash: string,
  now: Date
): Promise<WhatsAppEnquiryDocument | null> {
  return WhatsAppEnquiry.findOne({
    phoneHash,
    closed: { $ne: true },
    confirmedAt: { $gte: new Date(now.getTime() - ENQUIRY_IDLE_MS) },
  }).sort({ confirmedAt: -1 });
}

const LATE_INFO_ALERT_GAP_MS = 60 * 60 * 1000;

/**
 * More details after a request went to the team: they stay on the same request, the conversation
 * the team reads shows them, and the team is emailed, at most once an hour so a parent sending
 * several short messages does not send several emails.
 */
async function attachLateInfo(
  e: WhatsAppEnquiryDocument,
  said: string,
  now: Date
): Promise<IntakeReply> {
  const claimed = await WhatsAppEnquiry.findOneAndUpdate(
    {
      _id: e._id,
      $or: [
        { lateInfoAt: { $exists: false } },
        { lateInfoAt: { $lt: new Date(now.getTime() - LATE_INFO_ALERT_GAP_MS) } },
      ],
    },
    { $set: { lateInfoAt: now } },
    { new: true }
  );
  if (claimed) await queueLateInfoAlert(claimed, plain(said, 500) ?? said.slice(0, 500));
  return {
    reply: `Thanks, I've added that to your request (${e.reference}). Our team will see it with the rest.`,
  };
}

/**
 * Puts what the account's child profile holds on the enquiry, only where the parent has not
 * already said it: the parent's own words always win over an old profile. Returns the line that
 * tells the parent what was taken from it, or nothing when it held nothing new.
 */
function fillFromProfile(
  e: WhatsAppEnquiryDocument,
  child: AccountChild,
  city: string | undefined
): string {
  e.childName = child.name;
  e.childId = child.id;
  const taken: string[] = [];
  if (e.childAge === undefined && child.age !== undefined) {
    e.childAge = child.age;
    taken.push(`${child.age} years old`);
  }
  if (!e.sport && child.sport) {
    e.sport = child.sport;
    taken.push(child.sport);
  }
  let area = "";
  if (!e.city && city) {
    e.city = city;
    area = ` Area: ${city}.`;
  }
  if (!taken.length && !area) return "";
  return `From ${child.name}'s profile:${taken.length ? ` ${taken.join(", ")}.` : ""}${area} I'll pass these on.`;
}

/** The first question, behind a line on what it is about and, for an account, what it already knows. */
function opening(category: EnquiryCategory, from: string, reply: IntakeReply): IntakeReply {
  // The summary has no intro: the parent has already been through the questions. A question
  // with buttons (group or one-to-one) is still a first question and gets its intro.
  if (reply.reply.startsWith("Here's what we've captured")) {
    return from ? { ...reply, reply: `${from}\n\n${reply.reply}` } : reply;
  }
  const intro = INTRO[category];
  const body = intro ? `${intro}\n${reply.reply}` : reply.reply;
  return { ...reply, reply: from ? `${from}\n\n${body}` : body };
}

/**
 * Starts the questions on a topic the parent has chosen or named. `extracted` is what their first
 * message already said, and `userId` the account the number belongs to, if any, whose child
 * profile fills in what would otherwise be asked.
 */
async function begin(
  phoneHash: string,
  said: string,
  category: EnquiryCategory,
  extracted: Extracted,
  userId: string | undefined,
  now: Date
): Promise<IntakeReply> {
  // Looked up without creating one: `currentEnquiry` opens an enquiry when there is none, which
  // would leave an empty one behind every time.
  const latest = await WhatsAppEnquiry.findOne({
    phoneHash,
    closed: false,
    lastMessageAt: { $gte: new Date(now.getTime() - ENQUIRY_IDLE_MS) },
  }).sort({ lastMessageAt: -1 });
  // Only a request this flow itself started on the same topic is picked up again (a parent who
  // let the questions lapse and came back). An ordinary chat enquiry is never reused: it holds
  // another question, and whatever the assistant noted on it may be about another child.
  const reusable =
    latest !== null &&
    latest.category === category &&
    latest.followUpStatus === "none" &&
    !latest.confirmedAt;
  const e = reusable && latest ? latest : await newEnquiry(phoneHash, said, now);
  e.category = category;
  apply(e, extracted, "all");

  let from = "";
  if (userId) {
    const account = await accountChildren(userId, now).catch(() => null);
    const kids = account?.children ?? [];
    const child = namedIn(said, kids) ?? (kids.length === 1 ? kids[0] : undefined);
    if (child) {
      from = fillFromProfile(e, child, account?.city);
    } else if (kids.length > 1) {
      e.intake = {
        step: "needs",
        startedAt: now,
        retries: 0,
        childOptions: kids.map((k) => k.id),
        adaptive: { asking: "child", category, asked: [] },
      };
      e.lastMessageAt = now;
      await e.save();
      return {
        reply: `${INTRO[category] ? `${INTRO[category]}\n` : ""}Which child is this for: ${kids.map((k) => k.name).join(", ")}?`,
        buttons: childButtons(kids),
      };
    }
  }
  return opening(category, from, await moveOn(e, category, [], now, now));
}

/**
 * Starts the questions from a message the parent typed, when it is a new request this flow
 * handles. Returns null for anything else, and the chat carries on as before.
 */
export async function startAdaptive(
  phoneHash: string,
  said: string,
  userId: string | undefined,
  deps: AdaptiveDeps = {},
  now: Date = new Date()
): Promise<IntakeReply | null> {
  if (!adaptiveIntakeEnabled()) return null;
  if (await inTeamThread(phoneHash, now)) return null;
  const recent = await recentConfirmed(phoneHash, now);

  let x: Extracted | null = null;
  try {
    x = await callExtractor(deps, phoneHash, { text: said, hint: "opening", known: {} });
  } catch (err) {
    log.warn(`could not read the first message: ${String(err).slice(0, 160)}`);
  }

  // After a confirmed request, a message is more of the same request unless it is clearly about
  // something else. If the reader could not tell, it stays with the request it follows.
  const separate = Boolean(
    x?.category && x.category !== "other" && recent && x.category !== recent.category
  );
  if (recent && !separate) {
    return recent.answeredBy === "team" ? attachLateInfo(recent, said, now) : null;
  }

  // A message the reader cannot place ("ok", "thanks") is not a new request: the chat carries on.
  if (!x?.category || x.category === "other") return null;
  return begin(phoneHash, said, x.category, x, userId, now);
}

/**
 * Starts the questions from a tapped menu row or button, where the topic is already chosen and
 * the model has nothing to read. Returns null while the flag is off.
 */
export async function startAdaptiveTopic(
  phoneHash: string,
  question: string,
  category: EnquiryCategory,
  userId: string | undefined,
  now: Date = new Date()
): Promise<IntakeReply | null> {
  if (!adaptiveIntakeEnabled()) return null;
  return begin(phoneHash, question, category, {}, userId, now);
}

const YES =
  /^(yes|y|yeah|yep|correct|that'?s correct|right|sahi|haan|ha|ok|okay|confirm(ed)?)[.!]*$/i;
const CHANGE = /^(change|change something|no|nope|wrong|not correct|incorrect|nahi|nahin)[.!]*$/i;

const FOLLOW_UP_KIND = { coaching: "coach", tournaments: "tournaments" } as const;

/** The request as a sentence for the assistant, once the parent has confirmed the details. */
const TOPIC_ASK: Record<EnquiryCategory, string> = {
  sport: "Help me choose the right sport for my child.",
  start: "Help my child get started or improve in a sport.",
  coaching: "Help me find a coach or academy for my child.",
  tournaments: "Help me with tournaments and rankings for my child.",
  pathway: "Show me the sports career pathway for my child.",
  scholarships: "Help me with scholarships and sponsorships for my child.",
  admissions: "Help me with school and college admissions through sport for my child.",
  fitness: "Help me with fitness and sports support for my child.",
  other: "Help me with what I asked.",
};

/** What the parent confirmed, put to the assistant so it answers this and does not ask again. */
function requestForAssistant(e: WhatsAppEnquiryDocument, category: EnquiryCategory): string {
  const known = [
    e.childAge !== undefined ? `${e.childAge} years old` : null,
    e.sport,
    e.city ? `lives in ${e.city}` : null,
    e.playingContext ? `so far: ${e.playingContext}` : null,
    e.objective ? `wants: ${e.objective}` : null,
  ].filter(Boolean);
  return `${TOPIC_ASK[category]}${e.childName ? ` The child is ${e.childName}.` : ""} Details I gave: ${known.join(", ") || "none"}. These are already saved, so do not save or repeat them back. Answer from what you know; if you do not know, say so plainly in one sentence.`;
}

async function finalize(
  e: WhatsAppEnquiryDocument,
  deps: AdaptiveDeps,
  now: Date
): Promise<IntakeReply> {
  const category = e.intake?.adaptive?.category ?? e.category ?? "other";
  const said = [e.question, e.objective].filter(Boolean).join(". ");
  const { route } = await chooseRoute(category, said, deps);

  if (route === "assistant") {
    // Known well enough to answer now. Nothing goes to the team; the parent can still ask for it.
    e.set("intake", undefined);
    e.confirmedAt = now;
    e.answeredBy = "assistant";
    e.lastMessageAt = now;
    await e.save();
    return { reply: "", continueWith: requestForAssistant(e, category), offerTeam: true };
  }

  e.set("intake", undefined);
  e.confirmedAt = now;
  e.answeredBy = "team";
  e.lastMessageAt = now;
  await e.save();
  // The team hears about it here, in code, or "within 24 hours" is a promise nobody sees.
  const result = await requestFollowUp(e.phoneHash, e.question, {
    kind: FOLLOW_UP_KIND[category as keyof typeof FOLLOW_UP_KIND] ?? "other",
    summary: teamSummary(e, category),
    refresh: true,
  });
  return { reply: acknowledgement(result.reference, category), forwarded: true };
}

/**
 * Takes the parent's message as the answer to what the intake is waiting for and returns what to
 * say next. `replyId` is set when they tapped a button instead of typing.
 */
export async function answerAdaptive(
  e: WhatsAppEnquiryDocument,
  said: string,
  replyId: string | null | undefined,
  deps: AdaptiveDeps = {},
  now: Date = new Date()
): Promise<IntakeReply> {
  const intake = e.intake!;
  const state = intake.adaptive!;
  const answer = said.trim();
  const keep = { category: state.category, asked: state.asked };

  if (state.asking === "child") {
    // Which child: a tap, or a name typed. Not recognising it is not worth another question; the
    // questions just carry on without the profile.
    const options = intake.childOptions ?? [];
    const owner = await Player.findById(options[0])
      .select("userId")
      .lean()
      .catch(() => null);
    const account = owner
      ? await accountChildren(String(owner.userId), now).catch(() => null)
      : null;
    const kids = (account?.children ?? []).filter((k) => options.includes(k.id));
    const tapped = replyId?.startsWith(CHILD_ID) ? replyId.slice(CHILD_ID.length) : null;
    const child = (tapped ? kids.find((k) => k.id === tapped) : undefined) ?? namedIn(answer, kids);
    const from = child ? fillFromProfile(e, child, account?.city) : "";
    const next = await moveOn(e, state.category, state.asked, intake.startedAt, now);
    return opening(state.category, from, next);
  }

  if (state.asking === "confirm") {
    if (replyId === ADAPTIVE_YES_ID || YES.test(answer)) return finalize(e, deps, now);
    if (replyId === ADAPTIVE_CHANGE_ID || CHANGE.test(answer)) {
      e.intake = {
        step: "needs",
        startedAt: intake.startedAt,
        retries: 0,
        adaptive: { ...keep, asking: "fix" },
      };
      e.lastMessageAt = now;
      await e.save();
      return { reply: FIX_QUESTION };
    }
    // Typed in place of tapping: treat it as the correction it almost certainly is.
  }

  if (state.asking === "confirm" || state.asking === "fix") {
    apply(e, await read(deps, answer, "fix", e), "all");
    e.intake = {
      step: "needs",
      startedAt: intake.startedAt,
      retries: 0,
      adaptive: { ...keep, asking: "confirm" },
    };
    e.lastMessageAt = now;
    await e.save();
    return confirmReply(e);
  }

  const field = state.asking;
  // A tap on an answer, or a pass on something skippable, needs no reading.
  const shortcut = shortcutFor(field, replyId, answer);
  if (shortcut) {
    if (shortcut !== "skip") store(e)[shortcut.prop] = shortcut.value;
    return moveOn(e, state.category, state.asked, intake.startedAt, now);
  }
  apply(e, await read(deps, answer, field, e), [field]);
  return moveOn(e, state.category, state.asked, intake.startedAt, now);
}

/**
 * A second tap on "Yes, correct" after the summary was confirmed: the parent is told the same
 * thing again, and nothing is sent to the team twice.
 */
export async function acknowledgeAgain(
  phoneHash: string,
  now: Date = new Date()
): Promise<IntakeReply | null> {
  const e = await WhatsAppEnquiry.findOne({
    phoneHash,
    confirmedAt: { $gte: new Date(now.getTime() - TEAM_REPLY_PROMISE_MS) },
  })
    .sort({ confirmedAt: -1 })
    .select("reference category answeredBy")
    .lean();
  if (!e) return null;
  // An answered request was not promised to the team, so it must not be told it was.
  if (e.answeredBy === "assistant") {
    return {
      reply: "That's done already. Ask me anything else, or tap Talk to our team any time.",
    };
  }
  return { reply: acknowledgement(e.reference, e.category) };
}
