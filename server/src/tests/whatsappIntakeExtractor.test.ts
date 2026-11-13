// What the adaptive questions will accept from the model that reads a parent's message, and how a
// parent's daily budget of readings is kept. Nothing here talks to a model or a database.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const { cleanExtracted } = require("../shared/services/whatsappIntakeExtractor");
const {
  dailyReadCap,
  intakeBudgetKey,
  reserveIntakeRead,
} = require("../shared/services/whatsappIntakeBudget");
const redis = require("../config/redis").default;

afterEach(() => {
  delete process.env.WHATSAPP_INTAKE_DAILY_READS;
});

describe("what the reader may hand back", () => {
  it("keeps good values", () => {
    assert.deepEqual(
      cleanExtracted({
        category: "tournaments",
        age: 13,
        sport: "tennis",
        city: "Chandigarh",
        playingContext: "Plays local tournaments",
        goal: "Start AITA tournaments",
        childName: "Aarav",
      }),
      {
        category: "tournaments",
        age: 13,
        sport: "tennis",
        city: "Chandigarh",
        playingContext: "Plays local tournaments",
        goal: "Start AITA tournaments",
        childName: "Aarav",
      }
    );
  });

  it("drops an age that is out of range, fractional, or not a number", () => {
    for (const age of [2, 22, 99, -5, 13.5, "13", null, Number.NaN]) {
      assert.equal(cleanExtracted({ age }).age, undefined, `age ${String(age)} must be dropped`);
    }
    assert.equal(cleanExtracted({ age: 3 }).age, 3);
    assert.equal(cleanExtracted({ age: 21 }).age, 21);
  });

  it("drops a category it does not know", () => {
    assert.equal(cleanExtracted({ category: "hack" }).category, undefined);
    assert.equal(cleanExtracted({ category: "TOURNAMENTS" }).category, undefined);
    assert.equal(cleanExtracted({ category: ["tournaments"] }).category, undefined);
  });

  it("cuts text to the length the record allows and collapses stray whitespace", () => {
    const out = cleanExtracted({
      city: `  Pune,\n\n   Baner ${"x".repeat(200)}`,
      goal: "y".repeat(1000),
      sport: "   ",
    });
    assert.ok(out.city.length <= 60);
    assert.match(out.city, /^Pune, Baner x/);
    assert.equal(out.goal.length, 240);
    assert.equal(out.sport, undefined, "blank text is nothing");
  });

  it("copies only the fields it knows, whatever else the model or the parent put in", () => {
    const hostile = JSON.parse(
      `{"sport":"tennis","followUpStatus":"done","answeredBy":"assistant","confirmedAt":"2020-01-01",
        "intake":{"adaptive":{"asking":"confirm"}},"__proto__":{"polluted":true},"constructor":"x"}`
    );
    const out = cleanExtracted(hostile);
    assert.deepEqual(out, { sport: "tennis" });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });

  it("returns nothing for an answer that is not an object", () => {
    for (const raw of [null, undefined, "tennis", 7, [], ["tournaments"], true]) {
      assert.deepEqual(cleanExtracted(raw), {});
    }
  });

  it("treats null as not stated", () => {
    assert.deepEqual(cleanExtracted({ category: null, age: null, city: null, goal: null }), {});
  });
});

describe("the daily budget of readings", () => {
  it("is its own counter, not the chat's daily message cap", () => {
    const key = intakeBudgetKey("abc", new Date("2026-11-12T10:00:00Z"));
    assert.equal(key, "wa:intake:daily:abc:2026-11-12");
    assert.ok(!key.startsWith("guidance:chat:daily"));
  });

  it("rolls over at midnight in India, not UTC", () => {
    // 18:29 UTC is 23:59 IST; one minute later it is the next day in India.
    assert.match(intakeBudgetKey("abc", new Date("2026-11-12T18:29:00Z")), /2026-11-12$/);
    assert.match(intakeBudgetKey("abc", new Date("2026-11-12T18:31:00Z")), /2026-11-13$/);
  });

  it("is 40 a day unless set, and ignores a nonsense setting", () => {
    assert.equal(dailyReadCap(), 40);
    process.env.WHATSAPP_INTAKE_DAILY_READS = "5";
    assert.equal(dailyReadCap(), 5);
    for (const bad of ["0", "-3", "abc", ""]) {
      process.env.WHATSAPP_INTAKE_DAILY_READS = bad;
      assert.equal(dailyReadCap(), 40, `"${bad}" falls back to the default`);
    }
  });

  it("lets a reading through when the counter is unavailable, as the chat caps do", async () => {
    assert.equal(await reserveIntakeRead("abc"), true);
  });
});

process.on("exit", () => redis.disconnect());

describe("what the reader may hand back for a coach or trial request", () => {
  it("keeps the area, timing, budget and group or one-to-one", () => {
    assert.deepEqual(
      cleanExtracted({
        area: "Sector 22",
        timing: "weekday evenings",
        budget: "around 5000 a month",
        sessionFormat: "individual",
      }),
      {
        area: "Sector 22",
        timing: "weekday evenings",
        budget: "around 5000 a month",
        sessionFormat: "individual",
      }
    );
  });

  it("drops a format it does not know, and cuts each text to what the record allows", () => {
    for (const sessionFormat of ["both", "GROUP", "one-to-one", 1, null, ["group"]]) {
      assert.equal(
        cleanExtracted({ sessionFormat }).sessionFormat,
        undefined,
        String(sessionFormat)
      );
    }
    for (const sessionFormat of ["group", "individual", "either"]) {
      assert.equal(cleanExtracted({ sessionFormat }).sessionFormat, sessionFormat);
    }
    const out = cleanExtracted({
      area: "a".repeat(200),
      timing: "b".repeat(500),
      budget: "c".repeat(300),
    });
    assert.equal(out.area.length, 80);
    assert.equal(out.timing.length, 120);
    assert.equal(out.budget.length, 60);
  });
});

describe("what the reader may hand back for admissions, scholarships and fitness", () => {
  it("keeps the class, school or college, institutions, state, support and hours", () => {
    assert.deepEqual(
      cleanExtracted({
        grade: "Class 9, CBSE",
        admission: "both",
        targets: "Symbiosis and Fergusson College",
        state: "Maharashtra",
        supportType: "fees and travel",
        trainingHours: "about 5 hours a week",
      }),
      {
        grade: "Class 9, CBSE",
        admission: "both",
        targets: "Symbiosis and Fergusson College",
        state: "Maharashtra",
        supportType: "fees and travel",
        trainingHours: "about 5 hours a week",
      }
    );
  });

  it("drops an admission level it does not know, and cuts each text to what the record allows", () => {
    for (const admission of ["university", "SCHOOL", "school and college", 1, null, ["school"]]) {
      assert.equal(cleanExtracted({ admission }).admission, undefined, String(admission));
    }
    for (const admission of ["school", "college", "both"]) {
      assert.equal(cleanExtracted({ admission }).admission, admission);
    }
    const out = cleanExtracted({
      grade: "a".repeat(200),
      targets: "b".repeat(500),
      state: "c".repeat(200),
      supportType: "d".repeat(300),
      trainingHours: "e".repeat(200),
    });
    assert.equal(out.grade.length, 60);
    assert.equal(out.targets.length, 120);
    assert.equal(out.state.length, 40);
    assert.equal(out.supportType.length, 80);
    assert.equal(out.trainingHours.length, 40);
  });
});
