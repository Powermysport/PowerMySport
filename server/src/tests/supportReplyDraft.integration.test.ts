// The AI draft fills the admin's reply box and nothing else: it sends no mail and
// writes nothing to the ticket. The requester's contact details never reach the
// model. In-memory MongoDB; the model is faked, so no test spends an API call.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const Admin = require("../admin/models/Admin").default;
const emailUtil = require("../utils/email/shared");
const draftService = require("../client/services/supportReplyDraft");
const redis = require("../config/redis").default;

const { buildDraftPrompt, cleanDraft, draftSupportReply } = draftService;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };
let adminToken: string;
let mailsSent: number;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["admins", "supporttickets"]) await col(name).deleteMany({});
  mailsSent = 0;
  mock.method(emailUtil, "sendEmail", async () => {
    mailsSent += 1;
  });
  const adminId = oid();
  await Admin.collection.insertOne({
    _id: adminId,
    name: "Support Admin",
    email: "support@example.test",
    role: "SYSTEM_ADMIN",
    permissions: [],
    isActive: true,
  });
  adminToken = generateToken({
    id: adminId.toString(),
    email: "support@example.test",
    role: "SYSTEM_ADMIN",
  });
});

afterEach(() => mock.restoreAll());

const ticket = {
  subject: "Ranking PDF",
  category: "OTHER",
  status: "OPEN",
  description: "Can I get the under-12 ranking PDF for June 2025?",
  notes: [
    { authorType: "Admin", message: "We do have the June file archived." },
    { authorType: "Admin", message: "Sent earlier", emailedAt: new Date() },
    { authorType: "USER", message: "Any update?" },
  ],
};

describe("draft prompt", () => {
  it("carries the ticket and history, labelled, with the team's instructions", () => {
    const prompt = buildDraftPrompt(ticket, "Say it will be ready next week");
    assert.match(prompt, /under-12 ranking PDF/);
    assert.match(prompt, /Internal note \(never sent\):\nWe do have the June file archived\./);
    assert.match(prompt, /The team replied \(sent\):\nSent earlier/);
    assert.match(prompt, /The user wrote:\nAny update\?/);
    assert.match(prompt, /Instructions from the team:\nSay it will be ready next week/);
  });

  it("tells the model today's date, so past months are not called future ones", () => {
    const prompt = buildDraftPrompt(ticket, undefined, new Date("2026-11-08T12:00:00Z"));
    assert.match(prompt, /^Today's date: 8 November 2026$/m);
  });

  it("leaves out instructions when there are none", () => {
    assert.doesNotMatch(buildDraftPrompt(ticket), /Instructions from the team/);
  });
});

describe("draft clean-up", () => {
  it("drops fences, a greeting, a sign-off and em dashes", () => {
    const raw =
      "```\nHi Aariv,\n\nThe file is ready — we will send it.\n\nBest regards,\nPowerMySport team\n```";
    assert.equal(cleanDraft(raw), "The file is ready, we will send it.");
  });

  it("leaves a plain body alone", () => {
    assert.equal(cleanDraft("Thanks for asking. Here is how."), "Thanks for asking. Here is how.");
  });
});

describe("draftSupportReply", () => {
  it("passes the prompts to the model and cleans its answer", async () => {
    let seenUser = "";
    const draft = await draftSupportReply(
      ticket,
      undefined,
      async (_system: string, user: string) => {
        seenUser = user;
        return "Hello,\nWe can help with that.";
      }
    );
    assert.equal(draft, "We can help with that.");
    assert.match(seenUser, /Ranking PDF/);
  });

  it("refuses an empty answer", async () => {
    await assert.rejects(draftSupportReply(ticket, undefined, async () => "   "));
  });
});

describe("POST /support-tickets/admin/:id/draft-reply", () => {
  const insertTicket = async () => {
    const _id = oid();
    await col("supporttickets").insertOne({
      _id,
      requesterName: "Aariv Gupta",
      requesterEmail: "parent@example.test",
      requesterPhone: "+919800000000",
      ...ticket,
      notes: [],
      priority: "MEDIUM",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id;
  };
  const draft = (id: unknown, body: Record<string, unknown> = {}, token = adminToken) =>
    request(app)
      .post(`/api/support-tickets/admin/${String(id)}/draft-reply`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  it("returns a draft, sends nothing, writes nothing, and keeps contact details from the model", async () => {
    const id = await insertTicket();
    let seen: unknown[] = [];
    mock.method(draftService, "draftSupportReply", async (...args: unknown[]) => {
      seen = args;
      return "Here is your answer.";
    });

    const response = await draft(id, { instructions: "be brief" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.draft, "Here is your answer.");
    assert.equal(seen[1], "be brief");
    const sentToModel = JSON.stringify(seen[0]);
    assert.doesNotMatch(sentToModel, /Aariv|parent@example|9800000000/);

    assert.equal(mailsSent, 0);
    const saved = await col("supporttickets").findOne({ _id: id });
    assert.equal(saved.notes.length, 0);
    assert.equal(saved.status, "OPEN");
  });

  it("answers 503 when the model fails", async () => {
    const id = await insertTicket();
    mock.method(draftService, "draftSupportReply", async () => {
      throw new Error("quota");
    });
    assert.equal((await draft(id)).status, 503);
  });

  it("refuses over-long instructions and non-admins", async () => {
    const id = await insertTicket();
    assert.equal((await draft(id, { instructions: "x".repeat(501) })).status, 400);
    const userToken = generateToken({
      id: oid().toString(),
      email: "u@example.test",
      role: "Player",
    });
    assert.ok([401, 403].includes((await draft(id, {}, userToken)).status));
  });
});
