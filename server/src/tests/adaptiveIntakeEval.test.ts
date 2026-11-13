// The offline run of the adaptive-intake evaluation, as a test: five invented parents are played
// through the real conversation with the readings and the search scripted, and every rule must
// hold. It also guards that the evaluation can never reach the real database.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { fieldAsked, renderReport, runAdaptiveEval } = require("../evals/adaptiveIntake/run");
const { PERSONAS, PROBES } = require("../evals/adaptiveIntake/fixtures");

describe("the adaptive intake evaluation, offline", () => {
  it("plays every invented parent through the conversation without breaking a rule", async () => {
    process.env.MONGO_URI = "mongodb://production.invalid:27017/Powermysport";
    process.env.MONGODB_URI = "mongodb://production.invalid:27017/Powermysport";

    const result = await runAdaptiveEval({
      model: false,
      label: "test",
      delayMs: 0,
      outDir: "",
      write: false,
    });

    assert.deepEqual(
      result.conversations.map((c: { id: string }) => c.id),
      PERSONAS.map((p: { id: string }) => p.id)
    );
    assert.deepEqual(
      result.conversations.flatMap((c: { violations: string[] }) => c.violations),
      []
    );
    assert.equal(result.violations, 0);
    assert.equal(result.probes.length, 0, "the search probes are for the model run only");

    // A personal case and a coach request are never answered by the assistant.
    const route = (id: string) =>
      result.conversations.find((c: { id: string }) => c.id === id).route;
    assert.equal(route("registration-failed"), "team");
    assert.equal(route("badminton-coach"), "team");

    // A coach request asks the leading questions the team needs, and not what was already said.
    const coach = result.conversations.find((c: { id: string }) => c.id === "badminton-coach");
    assert.deepEqual(coach.questions, ["area", "format", "budget", "experience"]);

    // Each topic asks its own leading questions, and nothing the opening message said.
    const asked = (id: string) =>
      result.conversations.find((c: { id: string }) => c.id === id).questions;
    assert.deepEqual(asked("scholarship-swimmer"), ["state", "support"]);
    assert.deepEqual(asked("choose-a-sport"), ["hours", "budget", "city"]);
    assert.deepEqual(asked("admissions-class-9"), ["age", "admission", "city", "targets"]);
    assert.deepEqual(asked("fitness-knee"), ["hours", "city"]);
    // Admissions, scholarships and fitness are the team's, and never answered by the assistant.
    for (const id of ["scholarship-swimmer", "admissions-class-9", "fitness-knee"]) {
      assert.equal(route(id), "team", id);
    }

    // A parent reporting a problem with their own case is not quizzed about the child.
    const failed = result.conversations.find((c: { id: string }) => c.id === "registration-failed");
    assert.deepEqual(failed.questions, []);

    // The team's own example: asks only for the city and the playing history.
    const aita = result.conversations.find((c: { id: string }) => c.id === "aita-start");
    assert.deepEqual(aita.questions, ["city", "experience"]);

    // The evaluation can never reach the real database.
    // Checked without printing the values: a failure message must never show a connection string.
    assert.ok(process.env.MONGO_URI === undefined, "MONGO_URI is still set after the run");
    assert.ok(process.env.MONGODB_URI === undefined, "MONGODB_URI is still set after the run");
  });

  it("writes a report a person can read", async () => {
    const result = await runAdaptiveEval({
      model: false,
      label: "readable",
      delayMs: 0,
      outDir: "",
      write: false,
    });
    const report = renderReport(result);
    assert.match(report, /^# Adaptive intake evaluation: readable/);
    assert.match(report, /\*\*Violations: 0\.\*\*/);
    for (const persona of PERSONAS) assert.ok(report.includes(persona.label), persona.id);
    assert.doesNotMatch(report, /Where should the line sit/, "no probes offline");
  });

  it("recognises each question the conversation asks, so the parent is given the right answer", () => {
    const asked: Array<[string, string]> = [
      ["Which sport does your child play?", "sport"],
      ["How old is your child?", "age"],
      ["Which city are you based in?", "city"],
      ["Which area or locality would suit for training? For example Sector 22 or Baner.", "area"],
      [
        "What days and times work best? For example weekday evenings or weekend mornings.",
        "timing",
      ],
      ["Would you prefer group sessions or one-to-one?", "format"],
      ["Do you have a monthly budget in mind? You can skip this.", "budget"],
      ["Which class is your child in, and which board? For example Class 9, CBSE.", "grade"],
      ["Is this for school admission, college admission, or both?", "admission"],
      ["Are there any schools or colleges you already have in mind? You can skip this.", "targets"],
      ["Which state does your child compete or train in?", "state"],
      ["What kind of support are you looking for? For example fees, kit or travel.", "support"],
      ["How many hours a week does your child train?", "hours"],
      ["How many hours a week could your child give to sport?", "hours"],
      ["Do you have a monthly budget for sport in mind? You can skip this.", "budget"],
      [
        "What level does your child play at in the sport, and what have they achieved so far?",
        "experience",
      ],
      ["Is there a particular scholarship, sponsor or institution you have in mind?", "goal"],
      [
        "Has your child played any competitive tournaments before, or would this be the first?",
        "experience",
      ],
      ["Is your child just starting out, or already training somewhere?", "experience"],
      [
        "Where is your child at in the sport: just starting, playing regularly, or competing?",
        "experience",
      ],
      ["Which sports does your child play or enjoy at the moment?", "experience"],
      ["How far has your child come in the sport so far?", "experience"],
      [
        "What has your child achieved so far in the sport, such as rankings, medals or state-level play?",
        "experience",
      ],
      ["Is there anything specific you would like us to help with?", "goal"],
      ["What would you like help with?", "goal"],
      [
        "What kind of coaching are you looking for, for example timings, budget or a coach for a tournament?",
        "goal",
      ],
      ["What are you hoping your child's sporting path looks like?", "goal"],
    ];
    for (const [question, field] of asked) assert.equal(fieldAsked(question), field, question);
    assert.equal(fieldAsked("Here's what we've captured:\nChild: 13 years old"), null);
  });

  it("keeps the probe set balanced between questions to answer and questions for the team", () => {
    const wanted = (want: string) => PROBES.filter((p: { want: string }) => p.want === want).length;
    assert.ok(wanted("assistant") >= 5 && wanted("team") >= 5);
  });
});
