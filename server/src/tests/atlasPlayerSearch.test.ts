// Pure checks on the Atlas Search request and its off switch. No database.
import assert = require("node:assert/strict");
const { describe, it, afterEach } = require("node:test");

const {
  buildPlayerSearchPipeline,
  findSimilarPlayerIds,
  RANKING_SEARCH_INDEX,
} = require("../shared/services/ranking/atlasPlayerSearch");

const scope = { sportSlug: "tennis", category: "BOYS", subcategory: "U14", isLatest: true };

describe("atlas player search", () => {
  afterEach(() => {
    delete process.env.ATLAS_SEARCH_ENABLED;
  });

  it("targets the named index with a fuzzy name match inside the viewed list", () => {
    const [search] = buildPlayerSearchPipeline("sarma", { ...scope, state: "Delhi" });
    const body = search.$search;
    assert.equal(body.index, RANKING_SEARCH_INDEX);
    assert.equal(body.compound.minimumShouldMatch, 1);
    assert.equal(body.compound.should.length, 2);
    for (const clause of body.compound.should) {
      const inner = clause.autocomplete ?? clause.text;
      assert.equal(inner.path, "fullName");
      assert.equal(inner.fuzzy.maxEdits, 1);
    }
    const paths = body.compound.filter.map((f: any) => f.equals.path);
    assert.deepEqual(paths, ["sportSlug", "category", "subcategory", "isLatest", "state"]);
  });

  it("caps an oversized term", () => {
    const [search] = buildPlayerSearchPipeline("a".repeat(500), scope);
    assert.equal(search.$search.compound.should[0].autocomplete.query.length, 100);
  });

  it("does nothing, and touches no database, while switched off", async () => {
    assert.deepEqual(await findSimilarPlayerIds("sarma", scope), []);
  });

  it("ignores a one-letter term", async () => {
    process.env.ATLAS_SEARCH_ENABLED = "true";
    assert.deepEqual(await findSimilarPlayerIds("s", scope), []);
  });
});
