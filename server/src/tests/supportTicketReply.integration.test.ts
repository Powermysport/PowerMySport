// An admin's reply to a support ticket is emailed to the requester and kept on the
// ticket. The email goes first: a failed send saves nothing, so the panel never shows
// a reply the requester did not get. In-memory MongoDB; the mail transport is mocked.
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
const emailUtil = require("../utils/email/shared"); // the barrel re-exports via getters, which cannot be mocked
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };
let adminToken: string;
let sent: Array<{
  to: string;
  subject: string;
  html: string;
  critical?: boolean;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}>;
let failSend: boolean;

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
  for (const name of ["users", "admins", "supporttickets", "adminauditlogs", "outboxmessages"]) {
    await col(name).deleteMany({});
  }
  sent = [];
  failSend = false;
  mock.method(emailUtil, "sendEmail", async (options: (typeof sent)[number]) => {
    if (failSend && options.critical) throw new Error("SMTP down");
    sent.push(options);
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

const firstMail = () => {
  const mail = sent[0];
  assert.ok(mail, "expected an email to have been sent");
  return mail;
};

const createTicket = async (fields: Record<string, unknown> = {}) => {
  const _id = oid();
  await col("supporttickets").insertOne({
    _id,
    requesterName: "Aariv Gupta",
    requesterEmail: "parent@example.test",
    subject: "Technical support",
    description: "Can I get the under-12 ranking PDF?",
    category: "OTHER",
    status: "OPEN",
    priority: "MEDIUM",
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields,
  });
  return _id;
};

const reply = (ticketId: unknown, body: Record<string, unknown>, token = adminToken) =>
  request(app)
    .post(`/api/support-tickets/admin/${String(ticketId)}/reply`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);

describe("admin reply to a support ticket", () => {
  it("emails the requester and keeps the reply on the ticket", async () => {
    const ticketId = await createTicket();
    const response = await reply(ticketId, { message: "Hi,\nYes, here it is <b>soon</b>." });

    assert.equal(response.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(firstMail().to, "parent@example.test");
    assert.match(firstMail().subject, /^Re: Technical support \(#/);
    // Escaped, line breaks kept, and the original question quoted under it.
    assert.match(firstMail().html, /Hi,<br\/>Yes, here it is &lt;b&gt;soon&lt;\/b&gt;\./);
    assert.match(firstMail().html, /under-12 ranking PDF/);
    assert.doesNotMatch(firstMail().html, /automated message/);

    const saved = await col("supporttickets").findOne({ _id: ticketId });
    assert.equal(saved.notes.length, 1);
    assert.equal(saved.notes[0].authorType, "Admin");
    assert.equal(saved.notes[0].emailedTo, "parent@example.test");
    assert.ok(saved.notes[0].emailedAt instanceof Date);
    // A reply to an open ticket means someone is on it.
    assert.equal(saved.status, "IN_PROGRESS");

    const audit = await col("adminauditlogs").findOne({ action: "support_ticket.reply" });
    assert.equal(audit?.targetId, String(ticketId));
  });

  it("saves nothing when the email cannot be sent", async () => {
    const ticketId = await createTicket();
    failSend = true;
    const response = await reply(ticketId, { message: "Here you go" });

    assert.equal(response.status, 502);
    const saved = await col("supporttickets").findOne({ _id: ticketId });
    assert.equal(saved.notes.length, 0);
    assert.equal(saved.status, "OPEN");
  });

  it("mails a signed-in requester at their account address, not the typed one", async () => {
    const userId = oid();
    await col("users").insertOne({
      _id: userId,
      name: "Account Holder",
      email: "account@example.test",
      role: "Player",
    });
    const ticketId = await createTicket({ userId, requesterEmail: "typed@example.test" });

    const response = await reply(ticketId, { message: "Done" });
    assert.equal(response.status, 200);
    assert.equal(firstMail().to, "account@example.test");
  });

  it("applies a status the admin picks", async () => {
    const ticketId = await createTicket();
    const response = await reply(ticketId, { message: "Sorted", status: "RESOLVED" });
    assert.equal(response.status, 200);
    assert.equal((await col("supporttickets").findOne({ _id: ticketId })).status, "RESOLVED");
  });

  it("refuses an empty reply, a bad status and a ticket with no email", async () => {
    const ticketId = await createTicket();
    assert.equal((await reply(ticketId, { message: "   " })).status, 400);
    assert.equal((await reply(ticketId, { message: "ok", status: "DONE" })).status, 400);

    const noEmail = await createTicket({ requesterEmail: undefined });
    assert.equal((await reply(noEmail, { message: "ok" })).status, 400);
    assert.equal(sent.length, 0);
  });

  it("is admin-only", async () => {
    const ticketId = await createTicket();
    const userId = oid();
    const userToken = generateToken({
      id: userId.toString(),
      email: "u@example.test",
      role: "Player",
    });
    const response = await reply(ticketId, { message: "hi" }, userToken);
    assert.ok([401, 403].includes(response.status));
    assert.equal(sent.length, 0);
  });
});

const b64 = (text: string) => Buffer.from(text).toString("base64");

describe("reply attachments", () => {
  it("sends the files with the email and records only their names and sizes", async () => {
    const ticketId = await createTicket();
    const response = await reply(ticketId, {
      message: "Both PDFs attached.",
      attachments: [
        { filename: "june-2025.pdf", content: b64("%PDF-june") },
        { filename: "C:\\fakepath\\dec-2025.PDF", content: b64("%PDF-december") },
      ],
    });

    assert.equal(response.status, 200);
    const files = firstMail().attachments ?? [];
    assert.deepEqual(
      files.map((f) => [f.filename, f.contentType, f.content.toString()]),
      [
        ["june-2025.pdf", "application/pdf", "%PDF-june"],
        ["dec-2025.PDF", "application/pdf", "%PDF-december"],
      ]
    );
    const saved = await col("supporttickets").findOne({ _id: ticketId });
    assert.deepEqual(saved.notes[0].attachments, [
      { filename: "june-2025.pdf", contentType: "application/pdf", size: 9 },
      { filename: "dec-2025.PDF", contentType: "application/pdf", size: 13 },
    ]);
  });

  it("refuses a disallowed type, too many files and unreadable content, sending nothing", async () => {
    const ticketId = await createTicket();
    const file = (filename: string) => ({ filename, content: b64("x") });
    assert.equal(
      (await reply(ticketId, { message: "hi", attachments: [file("run.exe")] })).status,
      400
    );
    assert.equal(
      (
        await reply(ticketId, {
          message: "hi",
          attachments: ["a", "b", "c", "d", "e", "f"].map((n) => file(`${n}.pdf`)),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await reply(ticketId, {
          message: "hi",
          attachments: [{ filename: "a.pdf", content: "not base64!" }],
        })
      ).status,
      400
    );
    assert.equal(sent.length, 0);
  });

  it("takes a body over the global 100 KB limit, but only after the admin check", async () => {
    const ticketId = await createTicket();
    const big = { filename: "scan.png", content: b64("p".repeat(300 * 1024)) };

    const ok = await reply(ticketId, { message: "Scan attached", attachments: [big] });
    assert.equal(ok.status, 200);

    const anonymous = await request(app)
      .post(`/api/support-tickets/admin/${String(ticketId)}/reply`)
      .send({ message: "x", attachments: [big] });
    assert.equal(anonymous.status, 401);
  });
});

describe("new ticket alert to the team", () => {
  it("queues an email to the team inbox, replying to the requester, with their text escaped", async () => {
    process.env.SUPPORT_NOTIFY_EMAIL = "team@example.test";
    try {
      const response = await request(app).post("/api/support-tickets/public").send({
        subject: "Ranking <PDF>",
        description: "Need the June file\n<script>x</script>",
        requesterName: "Aariv",
        requesterEmail: "aariv@example.test",
        requesterPhone: "+919800000000",
      });
      assert.equal(response.status, 201);

      const queued = await col("outboxmessages").find({ type: "send_email" }).toArray();
      const alert = queued.find(
        (q: { payload: { to: string } }) => q.payload.to === "team@example.test"
      );
      assert.ok(alert, "expected a team alert on the outbox");
      assert.equal(alert.payload.replyTo, "aariv@example.test");
      assert.match(alert.payload.subject, /^New support ticket #\w{8}: Ranking <PDF>$/);
      assert.match(alert.payload.html, /&lt;script&gt;/);
      assert.doesNotMatch(alert.payload.html, /<script>/);
      assert.match(alert.payload.html, /\+919800000000/);
      assert.match(alert.payload.html, /\/admin\/support-tickets/);
    } finally {
      delete process.env.SUPPORT_NOTIFY_EMAIL;
    }
  });
});
