/* eslint-disable @typescript-eslint/no-var-requires */
// Community people search: the privacy rule, the Atlas Search request and its off
// switch, and the limiter. In-memory MongoDB (local dev points at the live
// cluster, so a test on the default connection would write to production).
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MemoryStore } = require("express-rate-limit");

const { User } = require("../client/models/User");
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityService } = require("../community/services/CommunityService");
const {
  buildPeopleSearchPipeline,
  findUserIdsByName,
  USER_SEARCH_INDEX,
} = require("../community/services/communityPeopleSearch");
const { createPeopleSearchRateLimiter } = require("../middleware/rateLimit");
const redis = require("../config/redis").default;

let memoryServer: { getUri(): string; stop(): Promise<void> };

const seedParent = async (name: string, profile: Record<string, unknown> = {}) => {
  const user = await User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
  });
  await CommunityProfile.create({
    userId: user._id,
    anonymousAlias: `Swift Falcon ${name.length}`,
    ...profile,
  });
  return user;
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
  redis.disconnect();
});

describe("searching parents by name", () => {
  it("finds a parent who shows their name", async () => {
    const viewer = await seedParent("Viewer One");
    await seedParent("Meera Kapoor");

    const results = await CommunityService.searchPlayers(String(viewer._id), "Kapoor");
    assert.deepEqual(
      results.map((row: { displayName: string }) => row.displayName),
      ["Meera Kapoor"]
    );
  });

  it("does not reveal who a private parent is by their real name", async () => {
    const viewer = await seedParent("Viewer Two");
    await seedParent("Anita Zorander", { isIdentityPublic: false, anonymousAlias: "Quiet Heron" });

    // The real name must not lead to the alias card: that would show which alias
    // belongs to which person.
    const byRealName = await CommunityService.searchPlayers(String(viewer._id), "Zorander");
    assert.deepEqual(byRealName, []);

    // The alias still works, and the card shows the alias, not the name.
    const byAlias = await CommunityService.searchPlayers(String(viewer._id), "Quiet Heron");
    assert.deepEqual(
      byAlias.map((row: { displayName: string }) => row.displayName),
      ["Quiet Heron"]
    );
  });

  it("does not need Atlas Search: it is off unless switched on", async () => {
    delete process.env.ATLAS_SEARCH_ENABLED;
    assert.equal(await findUserIdsByName("Kapoor", ["Parent"], 10), null);
  });

  it("does not use it for a one-letter term even when switched on", async () => {
    process.env.ATLAS_SEARCH_ENABLED = "true";
    try {
      assert.equal(await findUserIdsByName("k", ["Parent"], 10), null);
    } finally {
      delete process.env.ATLAS_SEARCH_ENABLED;
    }
  });
});

describe("the Atlas Search request", () => {
  it("targets the named index with a fuzzy name match narrowed to the roles", () => {
    const [search, limit] = buildPeopleSearchPipeline("rahool", ["Parent"], 31);
    const body = (search as any).$search;
    assert.equal(body.index, USER_SEARCH_INDEX);
    assert.equal(body.compound.minimumShouldMatch, 1);
    for (const clause of body.compound.should) {
      const inner = clause.autocomplete ?? clause.text;
      assert.equal(inner.path, "name");
      assert.equal(inner.fuzzy.maxEdits, 1);
    }
    assert.deepEqual(body.compound.filter, [{ in: { path: "role", value: ["Parent"] } }]);
    assert.deepEqual(limit, { $limit: 31 });
  });

  it("caps an oversized term", () => {
    const [search] = buildPeopleSearchPipeline("a".repeat(500), ["Parent"], 10);
    assert.equal((search as any).$search.compound.should[0].autocomplete.query.length, 100);
  });
});

describe("the people search limiter", () => {
  const appFor = () => {
    const app = express();
    app.use((req: any, _res: any, next: any) => {
      const id = req.get("x-user");
      if (id) req.user = { id };
      next();
    });
    app.get("/search", createPeopleSearchRateLimiter(new MemoryStore()), (_req: any, res: any) =>
      res.json({ success: true })
    );
    return app;
  };

  it("stops one parent after 120 a minute, and not a different parent", async () => {
    const app = appFor();
    for (let i = 0; i < 120; i += 1) {
      await request(app).get("/search").set("x-user", "parent-a");
    }
    const blocked = await request(app).get("/search").set("x-user", "parent-a");
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /wait a moment/i);

    const other = await request(app).get("/search").set("x-user", "parent-b");
    assert.equal(other.status, 200);
  });
});
