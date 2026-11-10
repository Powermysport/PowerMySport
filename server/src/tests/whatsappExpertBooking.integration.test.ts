/* eslint-disable @typescript-eslint/no-var-requires */
// Booking an expert from WhatsApp: the picker of open times, the YES step, and the pay button.
// The booking itself is the website's initiateExpertSession, so this pins the WhatsApp side and
// that it lands in the same place. PhonePe is mocked (see expertSessionLifecycle's note on why
// this must run from dist/). A replica set, because the slot lock uses a transaction.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const PhonePeService = require("../shared/services/PhonePeService");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Expert } = require("../client/models/ExpertProfile");
const { User } = require("../client/models/User");
const { BookingEvent } = require("../client/models/BookingEvent");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const { ASSISTANT_CHAT_TOOLS, WEB_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const {
  MAX_BOOKING_STARTS_PER_DAY,
  slotTapText,
} = require("../shared/services/whatsappExpertBooking");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
let mongod: any;

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  mock.method(PhonePeService, "initiatePhonePePayment", async () => ({
    redirectUrl: "https://phonepe.test/pay/abc",
  }));
});

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  process.env.WHATSAPP_EXPERT_BOOKING = "on";
  await Promise.all([
    ExpertSession.collection.deleteMany({}),
    Expert.collection.deleteMany({}),
    User.collection.deleteMany({}),
    WhatsAppConversation.deleteMany({}),
  ]);
});
afterEach(() => {
  delete process.env.WHATSAPP_EXPERT_BOOKING;
});

const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);
const HASH = "hash-booking-parent";

const seedExpert = async () => {
  const expertUserId = oid();
  await User.collection.insertOne({
    _id: expertUserId,
    name: "Asha Verma",
    email: `expert-${expertUserId}@test.com`,
    phone: "9000000001",
    role: "EXPERT",
    password: "x",
  });
  const expertId = oid();
  await Expert.collection.insertOne({
    _id: expertId,
    userId: expertUserId,
    bio: "Tennis pathway guidance",
    sports: ["Tennis"],
    expertise: [],
    sessionFee: 1500,
    sessionMode: "ONLINE",
    sessionDurationMinutes: 60,
    timezone: "Asia/Kolkata",
    weeklyAvailability: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      start: "09:00",
      end: "12:00",
    })),
    blackoutDates: [],
    isActive: true,
    verificationStatus: "APPROVED",
    rating: 0,
    reviewCount: 0,
    languages: ["English"],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return expertId.toString();
};

const seedParent = async () => {
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: "9000000002",
    role: "Parent",
    password: "x",
  });
  return userId.toString();
};

const ctx = (userId?: string, userMessage = "book Asha") => ({
  ...(userId ? { userId } : {}),
  phoneHash: HASH,
  userMessage,
  outbound: {} as Record<string, any>,
});

/** The parent has written again since the action was set up, as a real YES would. */
const nextMessage = () =>
  WhatsAppConversation.updateOne({ phoneHash: HASH }, { $inc: { totalMessageCount: 1 } });

describe("booking an expert from WhatsApp", () => {
  it("is offered on WhatsApp only; the website has its own booking page", () => {
    assert.ok(tool("prepare_expert_booking"));
    assert.ok(!WEB_CHAT_TOOLS.some((t: { name: string }) => t.name === "prepare_expert_booking"));
  });

  it("sends the profile link when switched off, or when the number has no account", async () => {
    const expertId = await seedExpert();
    delete process.env.WHATSAPP_EXPERT_BOOKING;
    const off = await tool("prepare_expert_booking").execute({ expert: expertId }, ctx("x"));
    assert.equal(off.reason, "not_switched_on");
    assert.match(off.profileUrl, new RegExp(`/experts/${expertId}$`));

    process.env.WHATSAPP_EXPERT_BOOKING = "on";
    const unknown = await tool("prepare_expert_booking").execute({ expert: expertId }, ctx());
    assert.equal(unknown.reason, "number_not_linked");
    assert.match(unknown.instruction, new RegExp(`/experts/${expertId}`));
  });

  it("with no time chosen, puts the open times in a tappable list and books nothing", async () => {
    const expertId = await seedExpert();
    const userId = await seedParent();
    const context = ctx(userId);
    const out = await tool("prepare_expert_booking").execute({ expert: expertId }, context);

    assert.equal(out.reason, "pick_a_time");
    const rows = context.outbound.slotPicker.rows;
    assert.ok(rows.length > 0 && rows.length <= 10);
    assert.ok(rows.every((r: { title: string }) => r.title.length <= 24));
    // A tap becomes a sentence naming the expert and the time.
    const said = slotTapText(rows[0].id);
    assert.ok(said.includes(expertId));
    assert.ok(said.includes(rows[0].title));
    assert.equal(await ExpertSession.countDocuments({}), 0);
  });

  it("a chosen time waits for YES, then is held and paid through a button the model never sees", async () => {
    const expertId = await seedExpert();
    const userId = await seedParent();
    const picker = ctx(userId);
    await tool("prepare_expert_booking").execute({ expert: expertId }, picker);
    const time = picker.outbound.slotPicker.rows[0].title;

    const ready = await tool("prepare_expert_booking").execute(
      { expert: expertId, slot: time },
      ctx(userId, slotTapText(picker.outbound.slotPicker.rows[0].id))
    );
    assert.equal(ready.ready, true);
    assert.equal(ready.when, time);
    assert.equal(await ExpertSession.countDocuments({}), 0, "nothing held before YES");

    await nextMessage();
    const yes = ctx(userId, "yes");
    const done = await tool("confirm_pending_action").execute({}, yes);
    assert.equal(done.done, true);
    assert.equal(done.payment, undefined, "the link is not handed to the model");
    assert.deepEqual(yes.outbound.payLink, {
      url: "https://phonepe.test/pay/abc",
      label: "Pay ₹1500",
    });

    const session = await ExpertSession.findOne({}).lean();
    assert.equal(session.status, "PENDING_PAYMENT");
    assert.equal(String(session.userId), userId);
    const created = await BookingEvent.findOne({ type: "CREATED" }).lean();
    assert.equal(created.channel, "WHATSAPP");
  });

  it("does not hold anything without a clear yes", async () => {
    const expertId = await seedExpert();
    const userId = await seedParent();
    const picker = ctx(userId);
    await tool("prepare_expert_booking").execute({ expert: expertId }, picker);
    await tool("prepare_expert_booking").execute(
      { expert: expertId, slot: picker.outbound.slotPicker.rows[0].title },
      ctx(userId)
    );
    await nextMessage();
    const out = await tool("confirm_pending_action").execute({}, ctx(userId, "how much is it?"));
    assert.equal(out.done, false);
    assert.equal(await ExpertSession.countDocuments({}), 0);
  });

  it("a time that is not open shows the list again", async () => {
    const expertId = await seedExpert();
    const userId = await seedParent();
    const context = ctx(userId);
    const out = await tool("prepare_expert_booking").execute(
      { expert: expertId, slot: "1 Jan 2020, 3:00 AM" },
      context
    );
    assert.equal(out.reason, "time_not_open");
    assert.ok(context.outbound.slotPicker.rows.length > 0);
  });

  it(`stops at ${MAX_BOOKING_STARTS_PER_DAY} starts a day, since each one holds a slot`, async () => {
    const expertId = await seedExpert();
    const userId = await seedParent();
    for (let i = 0; i < MAX_BOOKING_STARTS_PER_DAY; i += 1) {
      await ExpertSession.collection.insertOne({
        expertId: new mongoose.Types.ObjectId(expertId),
        userId: new mongoose.Types.ObjectId(userId),
        status: "CANCELLED",
        merchantOrderId: `EXP_TEST_${i}`,
        createdAt: new Date(),
      });
    }
    const picker = ctx(userId);
    await tool("prepare_expert_booking").execute({ expert: expertId }, picker);
    const out = await tool("prepare_expert_booking").execute(
      { expert: expertId, slot: picker.outbound.slotPicker.rows[0].title },
      ctx(userId)
    );
    assert.equal(out.reason, "daily_limit");
  });
});
