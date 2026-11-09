// PowerMySportBot's identity on AITA's site: Web Bot Auth signatures and
// robots.txt handling. No network.
import assert from "node:assert/strict";
import test from "node:test";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import {
  ALLOW_ALL,
  isPathAllowed,
  jwkThumbprint,
  loadSigningKey,
  parseRobots,
  webBotAuthHeaders,
} from "../shared/services/aita/aitaIdentity";

test("the keyid is the RFC 8037 JWK thumbprint", () => {
  // RFC 8037 Appendix A.3, the published worked example.
  assert.equal(
    jwkThumbprint("11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"),
    "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k"
  );
});

const freshKeyJson = () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  return JSON.stringify(privateKey.export({ format: "jwk" }));
};

test("an unset or malformed key means unsigned, not a crash", () => {
  assert.equal(loadSigningKey(undefined), null);
  assert.equal(loadSigningKey(""), null);
  assert.equal(loadSigningKey('{"kty":"RSA"}'), null);
  assert.equal(loadSigningKey("not json"), null);
});

test("requests carry a verifiable RFC 9421 signature over @authority and signature-agent", () => {
  const raw = freshKeyJson();
  const key = loadSigningKey(raw)!;
  const jwk = JSON.parse(raw) as { x: string };
  const headers = webBotAuthHeaders("www.aita.hitcourt.com", key, 1_750_000_000_000, "n0nce");

  assert.equal(headers["Signature-Agent"], '"https://powermysport.com"');
  const input = headers["Signature-Input"]!;
  assert.match(input, /^sig1=\("@authority" "signature-agent"\);created=1750000000;/);
  assert.match(input, new RegExp(`keyid="${jwkThumbprint(jwk.x)}"`));
  assert.match(input, /;alg="ed25519";expires=1750000060;nonce="n0nce";tag="web-bot-auth"$/);

  // Rebuild the signature base exactly as a verifier would, and check it.
  const params = input.slice("sig1=".length);
  const base = [
    '"@authority": www.aita.hitcourt.com',
    '"signature-agent": "https://powermysport.com"',
    `"@signature-params": ${params}`,
  ].join("\n");
  const signature = /^sig1=:(.+):$/.exec(headers.Signature!)![1]!;
  const publicKey = createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: jwk.x },
    format: "jwk",
  });
  assert.ok(verify(null, Buffer.from(base), publicKey, Buffer.from(signature, "base64")));
});

test("robots.txt: our own group wins over *, with its crawl delay", () => {
  const policy = parseRobots(
    [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: PowerMySportBot",
      "Disallow: /admin",
      "Allow: /admin/public",
      "Crawl-delay: 5",
    ].join("\n")
  );
  assert.equal(policy.crawlDelaySec, 5);
  assert.equal(isPathAllowed(policy, "/ranking-view?wid=1&category=BS12"), true);
  assert.equal(isPathAllowed(policy, "/admin/users"), false);
  // Longest match wins.
  assert.equal(isPathAllowed(policy, "/admin/public/page"), true);
});

test("robots.txt: without our own group, * applies, wildcards and $ included", () => {
  const policy = parseRobots(
    [
      "User-agent: Googlebot",
      "Disallow:",
      "",
      "User-agent: *",
      "Disallow: /*.pdf$",
      "Disallow: /private",
    ].join("\n")
  );
  assert.equal(isPathAllowed(policy, "/ranking-pdf?wid=1"), true);
  assert.equal(isPathAllowed(policy, "/docs/rules.pdf"), false);
  assert.equal(isPathAllowed(policy, "/private/x"), false);
  assert.equal(policy.crawlDelaySec, null);
});

test("robots.txt: an empty Disallow, comments and an empty file allow everything", () => {
  assert.equal(isPathAllowed(parseRobots("User-agent: *\nDisallow:\n"), "/anything"), true);
  assert.equal(isPathAllowed(parseRobots("# nothing here\n"), "/anything"), true);
  assert.equal(isPathAllowed(ALLOW_ALL, "/"), true);
  assert.equal(
    isPathAllowed(parseRobots("User-agent: powermysportbot\nDisallow: / # all of it\n"), "/x"),
    false
  );
});

test("robots.txt: a tie between Allow and Disallow goes to Allow", () => {
  const policy = parseRobots("User-agent: *\nDisallow: /page\nAllow: /page\n");
  assert.equal(isPathAllowed(policy, "/page"), true);
});
