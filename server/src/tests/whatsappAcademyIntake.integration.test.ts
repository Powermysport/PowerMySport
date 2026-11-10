// Coach/academy requests on WhatsApp, and the team's reply from the admin panel. No coaches or
// academies are listed yet, so a tap on "Find a coach or academy" must end with the child's details
// in front of the team (and an email to them), not with a dead end. Real (in-memory) MongoDB; the
// model is a stub that fails the test if it is called, and Meta's API is a stubbed fetch.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.SUPPORT_NOTIFY_EMAIL = "team@example.com";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { WhatsAppEnquiry } = require("../client/models/WhatsAppEnquiry");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const OutboxMessage = require("../shared/models/OutboxMessage").default;
const {
  answerOutsidePilot,
  answerWhatsAppMessage,
  hashPhone,
} = require("../shared/services/whatsappAssistantService");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { PILOT_REPLY, PILOT_PASSED_ON_REPLY } = require("../shared/services/whatsappPilot");
const {
  parseAge,
  parseCity,
  INTAKE_CANCELLED,
} = require("../shared/services/whatsappAcademyIntake");
const { decryptValue } = require("../shared/utils/encryption");
const { sendTeamMessage } = require("../admin/services/WhatsAppEnquiryAdminService");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await WhatsAppEnquiry.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await Promise.all([
    WhatsAppEnquiry.deleteMany({}),
    WhatsAppConversation.deleteMany({}),
    OutboxMessage.deleteMany({}),
  ]);
});

const PHONE = `9197${String(Date.now()).slice(-8)}`;
let n = 0;
const msg = (text: string, replyId?: string) => ({
  id: `wamid.intake.${++n}`,
  from: PHONE,
  type: replyId ? "interactive" : "text",
  text,
  ...(replyId ? { replyId } : {}),
});
// The intake runs in code: the model must never be asked.
const noModel = async function* () {
  throw new Error("the model was called during the intake");
};
const say = (text: string, replyId?: string) => answerWhatsAppMessage(msg(text, replyId), noModel);
const enquiry = () => WhatsAppEnquiry.findOne({ phoneHash: hashPhone(PHONE) }).lean();

describe("the coach/academy intake", () => {
  it("collects the child's details step by step and forwards them to the team", async () => {
    const start = await say("Find a coach or academy", "next_coach");
    assert.match(start.reply, /don't list coaches or academies/);
    assert.match(start.reply, /How old is your child/);
    assert.equal((await enquiry()).followUpStatus, "none", "nothing forwarded before the details");

    assert.match((await say("he is 11")).reply, /Which sport/);
    assert.match((await say("Tennis")).reply, /Which city and area/);
    const level = await say("Pune, Baner");
    assert.match(level.reply, /Where is your child at/);
    assert.equal(level.buttons.length, 3);
    const needs = await say("Plays regularly", "intake_level_regular");
    assert.match(needs.reply, /Anything else/);
    const done = await say("Weekday evenings, under 5000 a month");
    assert.match(done.reply, /Your reference: PMS-/);

    const e = await enquiry();
    assert.equal(e.childAge, 11);
    assert.equal(e.sport, "Tennis");
    assert.equal(e.city, "Pune, Baner");
    assert.equal(e.level, "plays regularly");
    assert.equal(e.followUpStatus, "new");
    assert.deepEqual(e.assistance, ["coach"]);
    assert.match(e.followUpSummary, /11 years old, Tennis, plays regularly/);
    assert.match(e.followUpSummary, /Area: Pune, Baner/);
    assert.match(e.followUpSummary, /Weekday evenings/);
    assert.equal(e.intake, undefined, "the intake is over");
    assert.equal(decryptValue(e.contactPhoneEnc), PHONE, "the team can reach them");
    assert.equal(e.turns.length, 6, "every step is in the conversation the team reads");

    const mail = await OutboxMessage.find({}).lean();
    assert.equal(mail.length, 1, "one email to the team");
    assert.equal(mail[0].payload.to, "team@example.com");
    assert.match(mail[0].payload.subject, new RegExp(e.reference));
    assert.match(mail[0].payload.html, /Pune, Baner/);
    assert.ok(!mail[0].payload.html.includes(PHONE), "the number stays behind the panel");
  });

  it("does not ask again for what the parent already said on this topic", async () => {
    await say("Find a coach or academy", "next_coach");
    await WhatsAppEnquiry.updateOne(
      { phoneHash: hashPhone(PHONE) },
      { $set: { sport: "Badminton", level: "beginner" } }
    );
    assert.match((await say("9")).reply, /Which city/, "sport is known, so it is skipped");
    assert.match((await say("Delhi, Dwarka")).reply, /Anything else/, "level is known too");
    assert.match((await say("skip", "intake_skip")).reply, /Your reference/);
    assert.equal((await enquiry()).followUpStatus, "new");
  });

  it("asks for the age once more, then moves on rather than looping", async () => {
    await say("Find a coach or academy", "next_coach");
    assert.match((await say("not sure")).reply, /didn't catch the age/);
    assert.match((await say("still not sure")).reply, /Which sport/);
    assert.equal((await enquiry()).childAge, undefined);
  });

  it("stops on cancel, and a tapped menu topic leaves the intake for the assistant", async () => {
    await say("Find a coach or academy", "next_coach");
    assert.equal((await say("cancel")).reply, INTAKE_CANCELLED);
    assert.equal((await enquiry()).intake, undefined);
    assert.equal((await enquiry()).followUpStatus, "none");

    await say("Find a coach or academy", "next_coach");
    let modelCalled = false;
    await answerWhatsAppMessage(
      msg("Tournaments & rankings", "menu_tournaments"),
      async function* () {
        modelCalled = true;
        yield "Here is how rankings work.";
      }
    );
    assert.ok(modelCalled, "the tap went to the assistant, not into the age step");
    assert.equal((await enquiry()).intake, undefined);
  });

  it("a coach request after an older handled one starts a clean enquiry and asks everything again", async () => {
    // 2026-11-10: the intake reused an Oct 25 enquiry, skipped age/sport/level from the old child
    // and ended with "already with our team" without telling the team anything new.
    await WhatsAppEnquiry.create({
      phoneHash: hashPhone(PHONE),
      parentRef: "old",
      reference: "PMS-OLD01",
      question: "older question",
      childAge: 14,
      sport: "tennis",
      level: "intermediate",
      assistance: ["coach"],
      followUpStatus: "new",
      lastMessageAt: new Date(),
      lastTeamMessageAt: new Date(),
    });
    const start = await say("I want to book a coach", "next_coach");
    assert.match(start.reply, /How old is your child/, "nothing reused from the older enquiry");
    await say("11");
    await say("Badminton");
    await say("Chandigarh, Sector 22");
    await say("Just starting", "intake_level_beginner");
    const done = await say("Nothing more", "intake_skip");
    assert.match(done.reply, /We have noted that you are looking for a coach or academy/);
    assert.doesNotMatch(done.reply, /PMS-OLD01/);

    const fresh = await WhatsAppEnquiry.findOne({ reference: { $ne: "PMS-OLD01" } }).lean();
    assert.equal(fresh.childAge, 11);
    assert.equal(fresh.city, "Chandigarh, Sector 22");
    assert.equal(fresh.followUpStatus, "new");
    assert.equal(await OutboxMessage.countDocuments({}), 1, "the team is emailed about it");
  });

  it("a sentence is not taken as the city: it is kept as a note and the place asked again", async () => {
    await say("Find a coach or academy", "next_coach");
    await say("12");
    await say("Tennis");
    const again = await say("I think i should go for academy for Jatin");
    assert.match(again.reply, /noted that for the team/);
    assert.match(again.reply, /Which city and area/);
    assert.equal((await enquiry()).city, undefined);
    assert.match((await say("I live in Pune, Baner")).reply, /Where is your child at/);
    assert.equal((await enquiry()).city, "Pune, Baner");
    await say("Competes", "intake_level_competes");
    await say("Nothing more", "intake_skip");
    assert.match((await enquiry()).followUpSummary, /academy for Jatin/);
  });

  it("reads an age out of a sentence", () => {
    assert.equal(parseAge("my son is 12 years old"), 12);
    assert.equal(parseAge("2"), undefined);
    assert.equal(parseAge("45"), undefined);
    assert.equal(parseAge("twelve"), undefined);
  });

  it("reads a place, and refuses what is not one", () => {
    assert.equal(parseCity("Pune, Baner"), "Pune, Baner");
    assert.equal(parseCity("I live in Mohali"), "Mohali");
    assert.equal(parseCity("in Sector 22, Chandigarh."), "Sector 22, Chandigarh");
    assert.equal(parseCity("I think i should go for academy for Jatin"), undefined);
    assert.equal(parseCity("we want a coach near home"), undefined);
  });
});

describe("the team's reply from the admin panel", () => {
  const sent: Array<Record<string, unknown>> = [];
  const realFetch = global.fetch;
  before(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    global.fetch = (async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 });
    }) as typeof fetch;
  });
  after(() => {
    global.fetch = realFetch;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });
  afterEach(() => {
    sent.length = 0;
    delete process.env.WHATSAPP_TEAM_REPLY_TEMPLATE;
  });

  const seed = async (lastMessageAt: Date) => {
    await say("Find a coach or academy", "next_coach");
    await WhatsAppEnquiry.updateOne({ phoneHash: hashPhone(PHONE) }, { $set: { lastMessageAt } });
    return String((await enquiry())._id);
  };

  it("sends plain text inside 24 hours, keeps it, and marks the enquiry contacted", async () => {
    const id = await seed(new Date());
    sent.length = 0;
    const { row, via } = await sendTeamMessage(id, "We found two academies in Baner.", "a@pms.in");
    assert.equal(via, "text");
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, PHONE);
    assert.match((sent[0]!.text as { body: string }).body, /^\*PowerMySport team\*\nWe found two/);
    assert.equal(row.followUpStatus, "contacted");
    assert.equal(row.teamMessages[0].text, "We found two academies in Baner.");
    assert.equal(row.teamMessages[0].by, "a@pms.in");

    const chat = await WhatsAppConversation.findOne({ phoneHash: hashPhone(PHONE) }).lean();
    assert.match(chat.messages.at(-1).content, /Message from the PowerMySport team/);
  });

  it("outside 24 hours uses the approved template, or refuses when there is none", async () => {
    const id = await seed(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    sent.length = 0;
    await assert.rejects(sendTeamMessage(id, "Hello", undefined), /approved template/);
    assert.equal(sent.length, 0);

    process.env.WHATSAPP_TEAM_REPLY_TEMPLATE = "team_followup";
    const { via } = await sendTeamMessage(id, "Line one\nline two", undefined);
    assert.equal(via, "template");
    const template = sent[0]!.template as {
      name: string;
      components: Array<{ parameters: Array<{ text: string }> }>;
    };
    assert.equal(template.name, "team_followup");
    const params = template.components[0]!.parameters.map((p) => p.text);
    assert.match(params[0]!, /^PMS-/);
    assert.equal(params[1], "Line one line two", "no line breaks in a template parameter");
  });

  it("a parent who answers the team the next day stays on the same enquiry", async () => {
    const id = await seed(new Date());
    await sendTeamMessage(id, "Does Saturday work?", undefined);
    await WhatsAppEnquiry.updateOne({ _id: id }, { $set: { closed: true } });
    await answerWhatsAppMessage(msg("Yes Saturday works"), async function* () {
      yield "Great, I will let the team know.";
    });
    assert.equal(await WhatsAppEnquiry.countDocuments({}), 1);
  });

  it("a parent's answer to the team puts the enquiry back to waiting and emails the team once", async () => {
    const id = await seed(new Date());
    await sendTeamMessage(id, "Does Saturday work?", undefined);
    await OutboxMessage.deleteMany({});
    const ai = async function* () {
      yield "Thanks, your reply has gone to the team.";
    };
    await answerWhatsAppMessage(msg("Yes Saturday works"), ai);
    await answerWhatsAppMessage(msg("Morning is better"), ai);

    const e = await WhatsAppEnquiry.findById(id).lean();
    assert.equal(e.followUpStatus, "new", "back to Waiting");
    assert.ok(e.parentRepliedAt);
    const mail = await OutboxMessage.find({}).lean();
    assert.equal(mail.length, 1, "one email per team message, not per parent message");
    assert.match(mail[0].payload.subject, /the parent replied/);
    assert.match(mail[0].payload.html, /Yes Saturday works/);
    assert.match(mail[0].payload.html, /Does Saturday work\?/);

    // A new team message, a new answer: told again.
    await sendTeamMessage(id, "Great, 9am then?", undefined);
    await answerWhatsAppMessage(msg("Yes"), ai);
    assert.equal(await OutboxMessage.countDocuments({}), 2);
  });

  it("refuses an empty or over-long message", async () => {
    const id = await seed(new Date());
    await assert.rejects(sendTeamMessage(id, "  ", undefined), /Write a message/);
    await assert.rejects(sendTeamMessage(id, "x".repeat(1001), undefined), /under 1000/);
  });
});

describe("ways to a person where the assistant cannot help", () => {
  const followUp = () =>
    ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "request_whatsapp_followup");

  it("a typed coach request starts the intake, without waiting for a yes", async () => {
    const out = await followUp().execute(
      { kind: "coach", summary: "wants a tennis coach", parentAgreed: false },
      { phoneHash: hashPhone(PHONE), userMessage: "need a tennis coach" }
    );
    assert.equal(out.collecting, true);
    assert.match(out.instruction, /How old is your child/);
    assert.equal((await enquiry()).intake.step, "age");
    assert.equal((await enquiry()).followUpStatus, "none");
  });

  it("other kinds still need a clear yes", async () => {
    const out = await followUp().execute(
      { kind: "team", summary: "x", parentAgreed: false },
      { phoneHash: hashPhone(PHONE), userMessage: "hmm" }
    );
    assert.equal(out.sent, false);
  });

  it("'Not really' offers the team, and the tap reaches the team with no model call", async () => {
    await answerWhatsAppMessage(msg("Which sport for my 8 year old?"), async function* () {
      yield "Try swimming.";
    });
    const sorry = await say("Not really", "fb_not_helpful");
    assert.deepEqual(
      sorry.buttons.map((b: { id: string }) => b.id),
      ["ask_team"]
    );
    const tapped = await say("Talk to our team", "ask_team");
    assert.match(tapped.reply, /talk to someone from our team/);
    assert.match(tapped.reply, /Your reference: PMS-/);
    const e = await enquiry();
    assert.equal(e.followUpStatus, "new");
    assert.ok(e.assistance.includes("team"));
    assert.equal(await OutboxMessage.countDocuments({}), 1, "the team is emailed");
  });

  it("an error reply offers the team instead of the website", async () => {
    const out = await answerWhatsAppMessage(msg("What next for my son?"), async function* () {
      throw new Error("model down");
    });
    assert.doesNotMatch(out.reply, /powermysport\.com\/ask/);
    assert.equal(out.buttons[0].id, "ask_team");
  });
});

describe("a number outside the pilot", () => {
  const OUTSIDE = `9196${String(Date.now()).slice(-8)}`;
  const from = (text: string, replyId?: string) => ({
    id: `wamid.out.${++n}`,
    from: OUTSIDE,
    type: replyId ? "interactive" : "text",
    text,
    ...(replyId ? { replyId } : {}),
  });
  const stored = () => WhatsAppEnquiry.find({ phoneHash: hashPhone(OUTSIDE) }).lean();

  it("gets the pilot notice with a team button, and nothing is stored", async () => {
    const out = await answerOutsidePilot(from("Hi, which sport for my daughter?"));
    assert.equal(out.reply, PILOT_REPLY);
    assert.equal(out.buttons[0].id, "ask_team");
    assert.equal((await stored()).length, 0);
  });

  it("a tap reaches the team; later messages go to the team; STOP deletes it all", async () => {
    const tapped = await answerOutsidePilot(from("Talk to our team", "ask_team"));
    assert.match(tapped.reply, /Your reference: PMS-/);
    let [e] = await stored();
    assert.equal(e.followUpStatus, "new");
    assert.equal(decryptValue(e.contactPhoneEnc), OUTSIDE);

    const next = await answerOutsidePilot(from("It's about tennis coaching in Pune"));
    assert.equal(next.reply, PILOT_PASSED_ON_REPLY);
    [e] = await stored();
    assert.match(e.turns.at(-1).parent, /tennis coaching in Pune/);

    const stop = await answerOutsidePilot(from("STOP"));
    assert.match(stop.reply, /deleted/);
    assert.equal((await stored()).length, 0);
  });
});

describe("the coach questions for a parent with an account", () => {
  const { User } = require("../client/models/User");
  const { Player } = require("../client/models/Player");
  const years = (n: number) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - n);
    d.setUTCMonth(0, 1);
    return d;
  };
  const seedFamily = async (kids: Array<Record<string, unknown>>) => {
    const userId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id: userId,
      name: "Aarav Sharma",
      email: `aarav-${userId}@test.com`,
      phone: `+91 ${PHONE.slice(-10)}`,
      city: "Chandigarh",
      role: "Parent",
      password: "x",
    });
    for (const kid of kids) {
      await Player.collection.insertOne({ userId, createdAt: new Date(), ...kid });
    }
    return userId;
  };
  beforeEach(async () => {
    await Promise.all([User.collection.deleteMany({}), Player.collection.deleteMany({})]);
  });

  it("uses the named child's profile and the parent's city instead of asking for them", async () => {
    // 2026-11-10: "I want to find an academy for ansh" was asked Ansh's age although the
    // account already held it.
    await seedFamily([
      {
        name: "Jatin Sharma",
        dob: years(14),
        chosenSport: "Tennis",
        experienceLevel: "intermediate",
      },
      { name: "Ansh Sharma", dob: years(9), chosenSport: "Badminton", experienceLevel: "beginner" },
    ]);
    const start = await answerWhatsAppMessage(
      msg("I want to find an academy for ansh"),
      async function* () {
        yield* (async function* () {})();
        // The model hands a coach request to the intake, as request_whatsapp_followup does.
        const tool = ASSISTANT_CHAT_TOOLS.find(
          (t: { name: string }) => t.name === "request_whatsapp_followup"
        );
        const { findUserIdByPhone } = require("../shared/services/whatsappIdentity");
        const out = await tool.execute(
          { kind: "coach", summary: "academy for Ansh", parentAgreed: false },
          {
            phoneHash: hashPhone(PHONE),
            userMessage: "I want to find an academy for ansh",
            userId: await findUserIdByPhone(PHONE),
          }
        );
        yield out.instruction.split("\n").slice(1).join("\n");
      }
    );
    assert.match(
      start.reply,
      /From Ansh's profile: 9 years old, Badminton, beginner\. Area: Chandigarh/
    );
    assert.match(
      start.reply,
      /Anything else the team should know/,
      "nothing left to ask but the extras"
    );
    assert.doesNotMatch(start.reply, /How old is your child/);

    await say("Nothing more", "intake_skip");
    const e = await WhatsAppEnquiry.findOne({ followUpStatus: "new" }).lean();
    assert.equal(e.childAge, 9);
    assert.equal(e.sport, "Badminton");
    assert.equal(e.city, "Chandigarh");
    assert.match(e.followUpSummary, /Child: Ansh, 9 years old, Badminton, beginner/);
  });

  it("with several children and none named, asks which one, and a tap fills in the rest", async () => {
    await seedFamily([
      {
        name: "Jatin Sharma",
        dob: years(14),
        chosenSport: "Tennis",
        experienceLevel: "competitive",
      },
      { name: "Ansh Sharma", dob: years(9), chosenSport: "Badminton" },
    ]);
    const start = await say("Find a coach or academy", "next_coach");
    assert.match(start.reply, /Which child is this for: Jatin, Ansh\?/);
    assert.deepEqual(
      start.buttons.map((b: { title: string }) => b.title),
      ["Jatin", "Ansh"]
    );

    const jatinButton = start.buttons[0].id;
    const next = await say("Jatin", jatinButton);
    assert.match(next.reply, /From Jatin's profile: 14 years old, Tennis, competes in tournaments/);
    assert.match(next.reply, /Anything else/);
  });

  it("asks only what the profile does not hold", async () => {
    await seedFamily([{ name: "Ansh Sharma", dob: years(9) }]);
    const start = await say("Find a coach or academy", "next_coach");
    assert.match(start.reply, /From Ansh's profile: 9 years old/);
    assert.match(start.reply, /Which sport is it for/);
  });
});

describe("the coach questions follow what the parent asked for", () => {
  const { wantsFrom } = require("../shared/services/whatsappAcademyIntake");
  const { findUserIdByPhone } = require("../shared/services/whatsappIdentity");
  const coachTool = () =>
    ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "request_whatsapp_followup");
  // No account for this number here: every question is asked, so the answers below line up.
  beforeEach(async () => {
    const { User } = require("../client/models/User");
    const { Player } = require("../client/models/Player");
    await Promise.all([User.collection.deleteMany({}), Player.collection.deleteMany({})]);
  });

  it("tells an academy from a coach", () => {
    assert.equal(wantsFrom("I want to find an academy for ansh"), "academy");
    assert.equal(wantsFrom("need a tennis coach twice a week"), "coach");
    assert.equal(wantsFrom("I'd like help finding a coach or academy for my child."), "either");
    assert.equal(wantsFrom("help with training"), "either");
  });

  it("an academy request talks about academies, and the team reads 'an academy'", async () => {
    const text = "I want to find an academy for my daughter";
    const out = await coachTool().execute(
      { kind: "coach", summary: "academy", parentAgreed: false },
      { phoneHash: hashPhone(PHONE), userMessage: text, userId: await findUserIdByPhone(PHONE) }
    );
    assert.match(out.instruction, /We don't list academies on PowerMySport yet/);
    assert.doesNotMatch(out.instruction, /coaches/);

    await say("10");
    await say("Football");
    await say("Mohali, Phase 7");
    await say("Just starting", "intake_level_beginner");
    const done = await say("Nothing more", "intake_skip");
    assert.match(done.reply, /We have noted that you are looking for an academy\./);
    assert.match((await enquiry()).followUpSummary, /^Looking for an academy\./);
  });
});
