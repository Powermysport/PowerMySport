process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const { adaptiveIntakeEnabled } = require("../shared/services/whatsappAdaptiveIntake");

afterEach(() => {
  delete process.env.WHATSAPP_ADAPTIVE_INTAKE;
});

describe("the adaptive intake switch", () => {
  it("is off unless the flag is exactly on", () => {
    assert.equal(adaptiveIntakeEnabled(), false);
    for (const value of ["", "true", "1", "ON", "yes"]) {
      process.env.WHATSAPP_ADAPTIVE_INTAKE = value;
      assert.equal(adaptiveIntakeEnabled(), false, `"${value}" must not switch it on`);
    }
    process.env.WHATSAPP_ADAPTIVE_INTAKE = "on";
    assert.equal(adaptiveIntakeEnabled(), true);
  });
});
