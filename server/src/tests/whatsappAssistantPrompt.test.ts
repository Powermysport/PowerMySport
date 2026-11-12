// What the WhatsApp assistant is told about its own earlier answers.
//
// Seen on a real number on 2026-11-12: a parent asked what the assistant had on their child, and
// it listed facts a tool had returned (training type, state, no assessment taken, no season plan).
// On the next message it told the parent those lines "weren't from his account details, so please
// disregard them". They were. The saved chat keeps only the words, never what a tool returned, so
// the next turn could not see where the facts came from, tried to check them against the short
// account block in its prompt (which leaves those facts out), and took back true statements.
//
// A model's behaviour needs a live run to prove, so this guards what is deterministic: that the
// assistant is told it cannot see earlier tool results, must not call an earlier answer wrong for
// that reason, and is sent back to the tool to check.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  CHANNEL_ADDENDUM,
  identityAddendum,
} = require("../shared/services/whatsappAssistantService");

const parent = {
  parent: { firstName: "Aarav", city: "Chandigarh" },
  children: [
    {
      firstName: "Anuj",
      age: 15,
      sports: ["Cricket"],
      level: "intermediate",
      state: "Chandigarh",
    },
  ],
  moreChildren: 0,
  plannedEvents: 0,
  upcomingSessions: 0,
};

describe("how the assistant treats its own earlier answers", () => {
  it("is told it cannot see what a tool returned in an earlier reply", () => {
    assert.match(
      CHANNEL_ADDENDUM,
      /cannot see the results of tools you used in earlier replies/,
      "the model must know why it cannot find an earlier fact"
    );
  });

  it("may call an earlier answer wrong only when something it can see now proves it", () => {
    assert.match(
      CHANNEL_ADDENDUM,
      /Only call an earlier answer wrong when something you can see now proves it/
    );
    assert.match(
      CHANNEL_ADDENDUM,
      /never call an earlier answer wrong, or tell the parent to disregard it, just because you cannot find it/
    );
  });

  it("is sent back to the tool to check, instead of taking the answer back", () => {
    assert.match(
      CHANNEL_ADDENDUM,
      /Call the tool again to check, and correct only what it contradicts/
    );
  });

  it("still corrects a real mistake, in one short sentence", () => {
    assert.match(
      CHANNEL_ADDENDUM,
      /If an earlier answer of yours was wrong or incomplete, say so in one short sentence, give the corrected answer, and move on/
    );
  });

  it("is told the account list is shorter than what the tools can read, for a known parent", () => {
    const known = identityAddendum(true, parent, []);
    assert.match(known, /shorter than what the tools can read/);
    assert.match(known, /training type, weekly hours, the assessment result and the season plan/);
    assert.match(known, /Call get_my_children or get_my_season_plan again/);
    assert.match(known, /do not retract or disown/i);
  });

  it("keeps the rule to say only what the account or a tool shows", () => {
    const known = identityAddendum(true, parent, []);
    assert.match(known, /Say only what the account block below or a tool shows/);
    assert.match(known, /Say only what is listed here or returned by a tool/);
  });

  it("does not describe an account list to a number with no account", () => {
    const unknown = identityAddendum(false, null, []);
    assert.doesNotMatch(unknown, /shorter than what the tools can read/);
  });
});
