/* eslint-disable no-console -- a command-line tool: printing is its output */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { PERSONAS, PROBES, type Field, type Persona } from "./fixtures";

/**
 * Plays a handful of invented parents through the WhatsApp conversation and checks what came out.
 *
 * Offline (the default) the model that reads messages is replaced by the readings in the fixtures
 * and the knowledge-base search by a fixed score, so it runs in seconds, spends nothing and proves
 * the conversation and the checks still work. With `--model` it uses Gemini for reading messages
 * and for the knowledge-base search, and also puts a set of questions to the search alone to show
 * where the "answer it now" line should sit.
 *
 * Nothing here can touch the real database. The conversation runs in a throwaway in-memory one,
 * and the connection settings for the real one are removed from this process before anything else
 * loads. In `--model` mode the knowledge base is rebuilt in that throwaway database from the
 * sources in the code. Gemini is the only thing outside this machine that is called.
 */

export interface EvalOptions {
  model: boolean;
  label: string;
  /** Pause between model calls, to stay under the rate limit. */
  delayMs: number;
  outDir: string;
  write: boolean;
  /** Play only this parent, by id. Skips the search probes. */
  only?: string;
  /** Leave the knowledge base empty, so every search finds nothing. Saves the 51 embedding calls. */
  skipKnowledge?: boolean;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ConversationResult {
  id: string;
  label: string;
  transcript: Array<{ parent: string; bot: string; buttons?: string[] }>;
  /** What was understood from the opening message alone. */
  opening: Record<string, unknown>;
  questions: Field[];
  route: "team" | "assistant" | "usual-assistant";
  /** The opening message could not be read (the model was busy, over quota or too slow). */
  degraded: boolean;
  score: number | null;
  matches: Array<{ title: string; score: number }>;
  reason: string | null;
  checks: Check[];
  violations: string[];
}

export interface ProbeResult {
  text: string;
  want: "assistant" | "team";
  score: number;
  matches: Array<{ title: string; score: number }>;
}

export interface EvalResult {
  options: Pick<EvalOptions, "model" | "label">;
  conversations: ConversationResult[];
  probes: ProbeResult[];
  sweep: Array<{ line: number; answered: number; right: number; total: number }>;
  /** Opening messages the reader could not read, which the usual assistant then answered. */
  degraded: number;
  violations: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Which question a bot message is asking, so the parent can be given the matching answer. */
const QUESTION_FIELD: Array<[RegExp, Field]> = [
  [/Which sport does your child play/, "sport"],
  [/How old is your child/, "age"],
  [/Which city are you based in/, "city"],
  [/played|achieved|training|how far|Where is your child at|enjoy at the moment/i, "experience"],
  [
    /anything specific|What would you like|What kind of|What are you looking|What are you hoping/i,
    "goal",
  ],
];

export const fieldAsked = (reply: string): Field | null => {
  for (const [pattern, field] of QUESTION_FIELD) if (pattern.test(reply)) return field;
  return null;
};

const SUMMARY = /Here's what we've captured/;
const MAX_TURNS = 8;
const LINES = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85];

export async function runAdaptiveEval(options: EvalOptions): Promise<EvalResult> {
  // What could reach a real service is settled before any application code loads.
  if (options.model) (await import("dotenv")).config();
  process.env.REDIS_ENABLED = "false";
  process.env.WHATSAPP_ADAPTIVE_INTAKE = "on";
  process.env.WHATSAPP_INTAKE_DAILY_READS = "100000";
  delete process.env.WHATSAPP_ADAPTIVE_AI_ANSWER;
  if (!process.env.JWT_SECRET)
    process.env.JWT_SECRET = "eval-secret-eval-secret-eval-secret-123456";
  if (!process.env.BANK_ENCRYPTION_KEY)
    process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
  if (options.model && !(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)) {
    throw new Error("--model needs GEMINI_API_KEY (or GOOGLE_API_KEY) in server/.env");
  }

  const { answerWhatsAppMessage, hashPhone } =
    await import("../../shared/services/whatsappAssistantService");
  const { WhatsAppEnquiry } = await import("../../client/models/WhatsAppEnquiry");
  const { chooseRoute } = await import("../../shared/services/whatsappAnswerGate");
  const { geminiExtractor } = await import("../../shared/services/whatsappIntakeExtractor");
  const knowledge = await import("../../shared/services/knowledgeRetrievalService");
  const { MongoMemoryServer } = await import("mongodb-memory-server");

  // Removed only now: loading the application's modules reads server/.env again (config/env.ts),
  // which would put the real connection string straight back.
  delete process.env.MONGO_URI;
  delete process.env.MONGODB_URI;

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // A second lock on the same door: refuse to run against anything but this machine.
  if (!["127.0.0.1", "localhost"].includes(mongoose.connection.host)) {
    await mongoose.disconnect();
    await mongod.stop();
    throw new Error("The evaluation must only ever use its own in-memory database.");
  }
  try {
    const personas = options.only ? PERSONAS.filter((p) => p.id === options.only) : PERSONAS;
    if (!personas.length) throw new Error(`No parent called "${options.only}"`);
    const searchWorks = options.model && !options.skipKnowledge;
    if (searchWorks) await seedKnowledge(options.delayMs, knowledge);

    const conversations: ConversationResult[] = [];
    for (const persona of personas) {
      conversations.push(
        await converse(persona, options, {
          answerWhatsAppMessage,
          hashPhone,
          WhatsAppEnquiry,
          chooseRoute,
          geminiExtractor,
          retrieveRelevantChunks: knowledge.retrieveRelevantChunks,
        })
      );
    }

    const probes = searchWorks && !options.only ? await runProbes(options.delayMs, knowledge) : [];
    const sweep = probes.length ? sweepLines(probes) : [];
    return {
      options: { model: options.model, label: options.label },
      conversations,
      probes,
      sweep,
      degraded: conversations.filter((c) => c.degraded).length,
      violations: conversations.reduce((sum, c) => sum + c.violations.length, 0),
    };
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

type Services = {
  answerWhatsAppMessage: typeof import("../../shared/services/whatsappAssistantService").answerWhatsAppMessage;
  hashPhone: typeof import("../../shared/services/whatsappAssistantService").hashPhone;
  WhatsAppEnquiry: typeof import("../../client/models/WhatsAppEnquiry").WhatsAppEnquiry;
  chooseRoute: typeof import("../../shared/services/whatsappAnswerGate").chooseRoute;
  geminiExtractor: typeof import("../../shared/services/whatsappIntakeExtractor").geminiExtractor;
  retrieveRelevantChunks: typeof import("../../shared/services/knowledgeRetrievalService").retrieveRelevantChunks;
};

/** The knowledge base, built in the throwaway database from the sources in the code. */
async function seedKnowledge(
  delayMs: number,
  knowledge: typeof import("../../shared/services/knowledgeRetrievalService")
): Promise<void> {
  const { KNOWLEDGE_BASE_SOURCES } = await import("../../shared/config/knowledgeBaseSources");
  const { KnowledgeChunk } = await import("../../shared/models/KnowledgeChunk");
  for (const entry of KNOWLEDGE_BASE_SOURCES) {
    const embedding = await knowledge.embedText(`${entry.title}\n${entry.content}`);
    await KnowledgeChunk.updateOne(
      { sourceType: entry.sourceType, sourceId: entry.sourceId },
      { $set: { title: entry.title, content: entry.content, embedding } },
      { upsert: true }
    );
    await sleep(delayMs);
  }
  knowledge.refreshKnowledgeCache();
}

async function converse(
  persona: Persona,
  options: EvalOptions,
  svc: Services
): Promise<ConversationResult> {
  const phone = `9199${Math.floor(10000000 + Math.random() * 89999999)}`;
  const phoneHash = svc.hashPhone(phone);

  // The search is wrapped so the report can show what it found for this request.
  let found: Array<{ title: string; score: number }> = [];
  const retrieve = async (query: string) => {
    if (!options.model) {
      found = [];
      return [{ score: persona.scripted.score }];
    }
    await sleep(options.delayMs);
    const chunks = await svc.retrieveRelevantChunks(query);
    found = chunks.slice(0, 3).map((c) => ({ title: c.title, score: c.score }));
    return chunks;
  };

  const scriptedAnswers = { ...persona.scripted.answers };
  let opened = false;
  const extract = options.model
    ? async (input: Parameters<typeof svc.geminiExtractor>[0]) => {
        await sleep(options.delayMs);
        return svc.geminiExtractor(input);
      }
    : async (input: { hint: string }) => {
        if (input.hint === "opening" && !opened) {
          opened = true;
          return persona.scripted.opening;
        }
        return scriptedAnswers[input.hint as Field] ?? {};
      };
  const deps = { extract, retrieve, reserve: async () => true } as never;

  const generate = async function* () {
    yield "[the assistant would answer here]";
  };
  let n = 0;
  const transcript: ConversationResult["transcript"] = [];
  const send = async (text: string, replyId?: string) => {
    const out = await svc.answerWhatsAppMessage(
      {
        id: `eval.${persona.id}.${++n}`,
        from: phone,
        type: replyId ? "interactive" : "text",
        text,
        ...(replyId ? { replyId } : {}),
      } as never,
      generate as never,
      {},
      deps
    );
    transcript.push({
      parent: text,
      bot: out.reply,
      ...(out.buttons ? { buttons: out.buttons.map((b) => b.title) } : {}),
    });
    return out;
  };

  let reply = await send(persona.opener);
  const afterOpening = await svc.WhatsAppEnquiry.findOne({ phoneHash }).lean();
  const opening = {
    category: afterOpening?.category ?? null,
    age: afterOpening?.childAge ?? null,
    sport: afterOpening?.sport ?? null,
    city: afterOpening?.city ?? null,
    playingContext: afterOpening?.playingContext ?? null,
    goal: afterOpening?.objective ?? null,
  };

  const questions: Field[] = [];
  let summarised = false;
  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    if (SUMMARY.test(reply.reply)) {
      summarised = true;
      break;
    }
    const field = fieldAsked(reply.reply);
    if (!field) break;
    questions.push(field);
    reply = await send(persona.answers[field] ?? "Not sure.");
  }
  let final = reply;
  if (summarised) final = await send("Yes, correct", "intake_yes");

  const stored = await svc.WhatsAppEnquiry.findOne({ phoneHash }).lean();
  const route: ConversationResult["route"] = !summarised
    ? "usual-assistant"
    : stored?.answeredBy === "assistant"
      ? "assistant"
      : "team";

  // Why that route: the same rule, shown the same words and the same search results.
  let reason: string | null = null;
  let score: number | null = null;
  if (summarised && stored?.category) {
    const decision = await svc.chooseRoute(
      stored.category,
      [stored.question, stored.objective].filter(Boolean).join(". "),
      { retrieve: async () => (options.model ? found : [{ score: persona.scripted.score }]) }
    );
    reason = decision.reason;
    score = decision.score;
  }

  const checks = checkConversation(persona, {
    transcript,
    opening,
    questions,
    route,
    summarised,
    final: final.reply,
    teamOffer: Boolean((final as { teamOffer?: boolean }).teamOffer),
    stored: stored as never,
  });
  return {
    id: persona.id,
    label: persona.label,
    transcript,
    opening,
    questions,
    route,
    degraded: opening.category === null,
    score,
    matches: found,
    reason,
    checks,
    violations: checks.filter((c) => !c.ok).map((c) => `${persona.id}: ${c.name} (${c.detail})`),
  };
}

interface Outcome {
  transcript: ConversationResult["transcript"];
  opening: Record<string, unknown>;
  questions: Field[];
  route: ConversationResult["route"];
  summarised: boolean;
  final: string;
  teamOffer: boolean;
  stored: {
    category?: string;
    childAge?: number;
    sport?: string;
    city?: string;
  } | null;
}

function checkConversation(persona: Persona, o: Outcome): Check[] {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  check(
    "reads the request into the right category",
    o.opening.category === persona.expect.category || o.route === "usual-assistant",
    `expected ${persona.expect.category}, read ${String(o.opening.category)}`
  );

  const repeated = o.questions.filter((q) => persona.expect.statedInOpener.includes(q));
  check(
    "never asks for what the opening message already said",
    repeated.length === 0,
    repeated.length ? `asked again: ${repeated.join(", ")}` : "nothing repeated"
  );
  check(
    "asks at most three questions",
    o.questions.length <= 3,
    `${o.questions.length} asked (${o.questions.join(", ") || "none"})`
  );

  if (o.summarised && o.stored) {
    const { age, sport, city } = persona.truth;
    if (age !== undefined)
      check(
        "captures the age correctly",
        o.stored.childAge === age,
        `${String(o.stored.childAge)}`
      );
    if (sport)
      check(
        "captures the sport correctly",
        (o.stored.sport ?? "").toLowerCase().includes(sport),
        `${String(o.stored.sport)}`
      );
    if (city)
      check(
        "captures the city correctly",
        (o.stored.city ?? "").toLowerCase().includes(city.toLowerCase()),
        `${String(o.stored.city)}`
      );
  }

  if (persona.expect.route === "team") {
    // A personal case or a coach to match by hand must never be answered by the assistant.
    check("is not answered by the assistant", o.route !== "assistant", `routed to ${o.route}`);
  }
  if (o.route === "team") {
    check(
      "tells the parent the team will reply within 24 hours",
      /PMS-/.test(o.final) && /within 24 hours/.test(o.final),
      "acknowledgement present"
    );
  }
  if (o.route === "assistant") {
    check("offers the team after an answer", o.teamOffer, o.teamOffer ? "offered" : "not offered");
  }

  const sent = o.transcript.map((t) => t.bot);
  check(
    "uses no em dash in anything sent to the parent",
    !sent.some((s) => s.includes("—")),
    "copy rule"
  );
  check(
    "keeps every message inside WhatsApp's limits",
    o.transcript.every(
      (t) =>
        t.bot.length <= 1024 ||
        !t.buttons /* only messages with buttons are held to the body limit */
    ) &&
      o.transcript.every(
        (t) => !t.buttons || (t.buttons.length <= 3 && t.buttons.every((b) => b.length <= 20))
      ),
    "buttons at most 3, titles at most 20 characters, body at most 1024"
  );
  return checks;
}

async function runProbes(
  delayMs: number,
  knowledge: typeof import("../../shared/services/knowledgeRetrievalService")
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const probe of PROBES) {
    await sleep(delayMs);
    const chunks = await knowledge.retrieveRelevantChunks(probe.text);
    out.push({
      text: probe.text,
      want: probe.want,
      score: chunks.reduce((best, c) => Math.max(best, c.score), 0),
      matches: chunks.slice(0, 3).map((c) => ({ title: c.title, score: c.score })),
    });
  }
  return out;
}

/** For each candidate line: how many probes it would answer, and how many it gets right. */
function sweepLines(probes: ProbeResult[]): EvalResult["sweep"] {
  return LINES.map((line) => ({
    line,
    answered: probes.filter((p) => p.score >= line).length,
    right: probes.filter((p) => p.score >= line === (p.want === "assistant")).length,
    total: probes.length,
  }));
}

export function renderReport(result: EvalResult): string {
  const lines: string[] = [];
  lines.push(`# Adaptive intake evaluation: ${result.options.label}`);
  lines.push("");
  lines.push(
    result.options.model
      ? "Gemini reads the messages and searches the knowledge base (rebuilt in a throwaway database from the sources in the code)."
      : "Offline: the fixtures stand in for the model and the search. This proves the conversation and checks work; it says nothing about the model."
  );
  lines.push("");
  lines.push(`**Violations: ${result.violations}.** Each is a rule broken, not a judgement call.`);
  lines.push(
    `**Opening messages the reader could not read: ${result.degraded} of ${result.conversations.length}.** The usual assistant answered those, as it did before this feature. A high number means the model was busy or over quota.`
  );
  lines.push("");
  lines.push("| Parent | Read as | Questions | Route | Best match | Rule broken |");
  lines.push("|---|---|---|---|---|---|");
  for (const c of result.conversations) {
    lines.push(
      `| ${c.id} | ${String(c.opening.category)} | ${c.questions.join(", ") || "none"} | ${c.route} | ${c.score === null ? "n/a" : c.score.toFixed(2)} | ${c.violations.length || "none"} |`
    );
  }
  for (const c of result.conversations) {
    lines.push("", `## ${c.label}`, "");
    lines.push(
      `Understood from the opening message: ${JSON.stringify(c.opening)}. Route: ${c.route}${c.reason ? ` (${c.reason})` : ""}.`
    );
    if (c.matches.length) {
      lines.push("", "Closest knowledge-base entries:");
      for (const m of c.matches) lines.push(`- ${m.score.toFixed(2)} ${m.title}`);
    }
    lines.push("", "```");
    for (const t of c.transcript) {
      lines.push(
        `PARENT: ${t.parent}`,
        `BOT: ${t.bot}${t.buttons ? `  [${t.buttons.join(" | ")}]` : ""}`,
        ""
      );
    }
    lines.push("```", "");
    for (const check of c.checks)
      lines.push(`- ${check.ok ? "ok" : "BROKEN"}: ${check.name} (${check.detail})`);
  }
  if (result.probes.length) {
    lines.push("", "## Where should the line sit?", "");
    lines.push(
      "Each question put to the knowledge-base search alone. `want` is the route a person would want. Read the matches and decide whether the best one really covers the question."
    );
    lines.push("", "| Best | Want | Question | Closest entries |", "|---|---|---|---|");
    for (const p of result.probes) {
      lines.push(
        `| ${p.score.toFixed(2)} | ${p.want} | ${p.text} | ${p.matches.map((m) => `${m.score.toFixed(2)} ${m.title}`).join("; ") || "nothing close"} |`
      );
    }
    lines.push("", "| Line | Answered by the assistant | Routed as wanted |", "|---|---|---|");
    for (const s of result.sweep)
      lines.push(
        `| ${s.line.toFixed(2)} | ${s.answered} of ${s.total} | ${s.right} of ${s.total} |`
      );
  }
  return lines.join("\n");
}

function parseArgs(argv: string[]): EvalOptions {
  const flag = (name: string) => argv.includes(`--${name}`);
  const value = (name: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const model = flag("model");
  const only = value("only");
  return {
    model,
    label: value("label") ?? (model ? "model" : "offline"),
    delayMs: Number(value("delay-ms")) || (model ? 600 : 0),
    outDir: value("out") ?? path.resolve(__dirname, "../../../../docs/adaptive-intake-eval"),
    write: !flag("no-report"),
    ...(only ? { only } : {}),
    skipKnowledge: flag("skip-knowledge"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runAdaptiveEval(options);
  const report = renderReport(result);
  if (options.write) {
    fs.mkdirSync(options.outDir, { recursive: true });
    fs.writeFileSync(path.join(options.outDir, `${options.label}.md`), report);
    fs.writeFileSync(
      path.join(options.outDir, `${options.label}.json`),
      JSON.stringify(result, null, 2)
    );
    console.log(`Report written to ${path.join(options.outDir, `${options.label}.md`)}`);
  }
  for (const c of result.conversations) {
    console.log(
      `${c.violations.length ? "BROKEN" : "ok    "} ${c.id.padEnd(22)} read ${String(c.opening.category).padEnd(12)} asked ${c.questions.length} -> ${c.route}${c.degraded ? "  (reader unavailable)" : ""}`
    );
  }
  if (result.sweep.length) {
    for (const s of result.sweep) {
      console.log(
        `line ${s.line.toFixed(2)}: answers ${s.answered}/${s.total}, right ${s.right}/${s.total}`
      );
    }
  }
  console.log(
    `Opening messages the reader could not read: ${result.degraded} of ${result.conversations.length}`
  );
  console.log(`Violations: ${result.violations}`);
  process.exit(result.violations ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
