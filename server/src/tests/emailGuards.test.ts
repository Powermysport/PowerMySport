import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPermanentSmtpFailure, isUndeliverableAddress } from "../utils/email/shared";

describe("email guards", () => {
  it("refuses reserved test domains but not real ones", () => {
    assert.equal(isUndeliverableAddress("aarav-1@example.test"), true);
    assert.equal(isUndeliverableAddress("a@example.com"), true);
    assert.equal(isUndeliverableAddress("a@Foo.INVALID"), true);
    assert.equal(isUndeliverableAddress("teams@powermysport.com"), false);
  });

  it("treats only a 5xx SMTP reply as permanent", () => {
    assert.equal(isPermanentSmtpFailure({ responseCode: 550 }), true);
    assert.equal(isPermanentSmtpFailure({ responseCode: 421 }), false);
    assert.equal(isPermanentSmtpFailure(new Error("timeout")), false);
  });
});
