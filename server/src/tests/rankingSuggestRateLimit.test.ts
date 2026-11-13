/* eslint-disable @typescript-eslint/no-var-requires */
// The limiter on the ranking search suggestions. The real one is Redis-backed
// and fails open (the test setup), so this builds the same limiter around an
// in-memory store to see it trip.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, describe, it } = require("node:test");
const express = require("express");
const request = require("supertest");
const { MemoryStore } = require("express-rate-limit");
const { createRankingSuggestRateLimiter } = require("../middleware/rateLimit");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

const appFor = () => {
  const app = express();
  app.set("trust proxy", 1);
  app.get("/suggest", createRankingSuggestRateLimiter(new MemoryStore()), (_req: any, res: any) =>
    res.json({ success: true, data: [] })
  );
  return app;
};

describe("the ranking suggestions limiter", () => {
  it("lets a normal search through", async () => {
    const app = appFor();
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await request(app).get("/suggest")).status, 200);
    }
  });

  it("stops one address after 90 a minute with a 429 and a plain message", async () => {
    const app = appFor();
    for (let i = 0; i < 90; i += 1) {
      await request(app).get("/suggest").set("x-forwarded-for", "203.0.113.7");
    }
    const res = await request(app).get("/suggest").set("x-forwarded-for", "203.0.113.7");
    assert.equal(res.status, 429);
    assert.match(res.body.message, /wait a moment/i);
  });

  it("does not throttle a different address", async () => {
    const app = appFor();
    for (let i = 0; i < 91; i += 1) {
      await request(app).get("/suggest").set("x-forwarded-for", "203.0.113.8");
    }
    const other = await request(app).get("/suggest").set("x-forwarded-for", "203.0.113.9");
    assert.equal(other.status, 200);
  });
});
