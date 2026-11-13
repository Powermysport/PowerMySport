// The rule that decides whether the assistant answers a confirmed request or the team does. Nothing
// here talks to a model or a database: the knowledge check is a stub.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const {
  PERSONAL_CASE,
  aiAnswerEnabled,
  answerMinScore,
  chooseRoute,
} = require("../shared/services/whatsappAnswerGate");

afterEach(() => {
  delete process.env.WHATSAPP_ADAPTIVE_AI_ANSWER;
  delete process.env.WHATSAPP_ANSWER_MIN_SCORE;
});

const at = (score: number) => ({ retrieve: async () => [{ score }] });

describe("who answers a confirmed request", () => {
  it("lets the assistant answer what the knowledge base covers", async () => {
    const out = await chooseRoute("tournaments", "How do I start AITA tournaments?", at(0.82));
    assert.deepEqual(out, { route: "assistant", reason: "covered", score: 0.82 });
  });

  it("uses the best score when several chunks come back", async () => {
    const out = await chooseRoute("sport", "Which sport suits a 10 year old?", {
      retrieve: async () => [{ score: 0.61 }, { score: 0.77 }, { score: 0.65 }],
    });
    assert.equal(out.route, "assistant");
    assert.equal(out.score, 0.77);
  });

  it("leaves it to the team when nothing is close", async () => {
    for (const chunks of [[], [{ score: 0.3 }]]) {
      const out = await chooseRoute("pathway", "Anything", { retrieve: async () => chunks });
      assert.equal(out.route, "team");
      assert.equal(out.reason, "not covered");
    }
  });

  it("always leaves coaches, admissions, scholarships and fitness to the team", async () => {
    for (const category of ["coaching", "admissions", "scholarships", "fitness"]) {
      const out = await chooseRoute(category, "Anything at all about this", at(0.99));
      assert.deepEqual([out.route, out.reason], ["team", "team only"], category);
    }
  });

  it("still lets the assistant answer what the knowledge base covers, in the other topics", async () => {
    for (const category of ["sport", "start", "tournaments", "pathway", "other"]) {
      const out = await chooseRoute(category, "Which sport suits a 9 year old?", at(0.9));
      assert.equal(out.route, "assistant", category);
    }
  });

  it("leaves the switch to the team when it is off, and only the exact word turns it off", async () => {
    process.env.WHATSAPP_ADAPTIVE_AI_ANSWER = "off";
    assert.equal(aiAnswerEnabled(), false);
    assert.equal((await chooseRoute("sport", "x", at(0.99))).reason, "switched off");
    for (const value of ["", "false", "0", "OFF", "on"]) {
      process.env.WHATSAPP_ADAPTIVE_AI_ANSWER = value;
      assert.equal(aiAnswerEnabled(), true, `"${value}" leaves it on`);
    }
  });

  it("leaves it to the team when the knowledge check fails", async () => {
    const out = await chooseRoute("sport", "Which sport?", {
      retrieve: async () => {
        throw new Error("down");
      },
    });
    assert.deepEqual([out.route, out.reason, out.score], ["team", "not covered", 0]);
  });

  it("takes the line from the setting, and ignores a nonsense one", () => {
    assert.equal(answerMinScore(), 0.68);
    process.env.WHATSAPP_ANSWER_MIN_SCORE = "0.85";
    assert.equal(answerMinScore(), 0.85);
    for (const bad of ["0", "-1", "1.5", "abc", ""]) {
      process.env.WHATSAPP_ANSWER_MIN_SCORE = bad;
      assert.equal(answerMinScore(), 0.68, `"${bad}" falls back`);
    }
  });
});

describe("a question about the parent's own case", () => {
  const personal = [
    "My AITA registration failed",
    "my account is not working",
    "I want a refund for the booking",
    "payment deducted twice",
    "I can't log in",
    "can't register for the tournament",
    "I want to speak to someone from the team",
    "please connect me with an advisor",
    "this is a complaint",
  ];
  const general = [
    "How do I start playing AITA tournaments?",
    "Which sport suits a 10 year old?",
    "What are the age groups for junior tennis?",
    "Tell me about scholarships for swimmers",
  ];

  it("is sent to the team, even when the answer is well covered", async () => {
    for (const text of personal) {
      assert.match(text, PERSONAL_CASE, text);
      const out = await chooseRoute("tournaments", text, at(0.99));
      assert.equal(out.reason, "personal case", text);
    }
  });

  it("is not triggered by ordinary questions", async () => {
    for (const text of general) {
      assert.doesNotMatch(text, PERSONAL_CASE, text);
      assert.equal((await chooseRoute("tournaments", text, at(0.9))).route, "assistant", text);
    }
  });
});

describe("a request that asks for a coach, an academy or a trial", () => {
  const { WANTS_A_MATCH } = require("../shared/services/whatsappAnswerGate");

  it("is recognised in the parent's words", () => {
    for (const text of [
      "I need a badminton coach",
      "Can you book a trial for my son?",
      "looking for an academy near me",
      "tennis coaching for a 10 year old",
      "a trainer for fitness",
      "Which academies are there?",
    ]) {
      assert.match(text, WANTS_A_MATCH, text);
    }
  });

  it("is not triggered by ordinary questions", () => {
    for (const text of [
      "How do I start playing AITA tournaments?",
      "Which sport is best for a 9 year old?",
      "What is the refund window for the wallet?",
      "How are rankings calculated?",
    ]) {
      assert.doesNotMatch(text, WANTS_A_MATCH, text);
    }
  });

  it("goes to the team however well the knowledge base matches", async () => {
    for (const category of ["tournaments", "start", "sport", "other"]) {
      const out = await chooseRoute(category, "I want to book a trial with a coach", at(0.99));
      assert.deepEqual([out.route, out.reason], ["team", "team only"], category);
    }
  });
});
