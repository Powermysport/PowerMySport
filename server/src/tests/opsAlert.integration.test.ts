// Background-job alarms are emailed to the team through the outbox, so they are
// retried and seen. In-memory MongoDB only; nothing is sent.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { queueOpsAlert, opsAlertRecipients } = require("../utils/email/opsAlert");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };
const outbox = () => mongoose.connection.db.collection("outboxmessages");
const saved = { ...process.env };

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
  await outbox().deleteMany({});
  for (const key of ["OPS_ALERT_EMAIL", "SUPPORT_NOTIFY_EMAIL", "EMAIL_FROM", "EMAIL_USER"]) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("ops alerts", () => {
  it("queues one email to the team inbox, with the job's text escaped", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@example.test";
    await queueOpsAlert({
      subject: "AITA rankings have stopped updating",
      heading: "Rankings <stale>",
      paragraphs: ["Newest list is 49 days old & <b>stuck</b>."],
      ctaLabel: "Open",
      ctaUrl: "https://example.test",
    });

    const rows = await outbox().find({}).toArray();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "send_email");
    assert.equal(rows[0].payload.to, "ops@example.test");
    assert.equal(
      rows[0].payload.subject,
      "[PowerMySport alert] AITA rankings have stopped updating"
    );
    assert.match(rows[0].payload.html, /Rankings &lt;stale&gt;/);
    assert.match(rows[0].payload.html, /&amp; &lt;b&gt;stuck&lt;\/b&gt;/);
    assert.doesNotMatch(rows[0].payload.html, /automated message/);
  });

  it("falls back to the support alert address, then the sender address", () => {
    delete process.env.OPS_ALERT_EMAIL;
    process.env.SUPPORT_NOTIFY_EMAIL = "support@example.test";
    assert.equal(opsAlertRecipients(), "support@example.test");
    delete process.env.SUPPORT_NOTIFY_EMAIL;
    process.env.EMAIL_FROM = "teams@example.test";
    assert.equal(opsAlertRecipients(), "teams@example.test");
  });

  it("does not throw or queue when no address is set", async () => {
    for (const key of ["OPS_ALERT_EMAIL", "SUPPORT_NOTIFY_EMAIL", "EMAIL_FROM", "EMAIL_USER"]) {
      delete process.env[key];
    }
    await queueOpsAlert({ subject: "x", heading: "x", paragraphs: ["x"] });
    assert.equal(await outbox().countDocuments(), 0);
  });
});
