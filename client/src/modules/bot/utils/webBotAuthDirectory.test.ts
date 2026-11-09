import { createPublicKey, generateKeyPairSync, verify } from "crypto";
import { describe, expect, it } from "vitest";
import {
  DIRECTORY_CONTENT_TYPE,
  buildDirectory,
  jwkThumbprint,
  readPrivateJwk,
} from "./webBotAuthDirectory";

const freshJwk = () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  return readPrivateJwk(JSON.stringify(privateKey.export({ format: "jwk" })))!;
};

describe("Web Bot Auth key directory", () => {
  it("uses the RFC 8037 thumbprint, the same as the server", () => {
    expect(jwkThumbprint("11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo")).toBe(
      "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k"
    );
  });

  it("rejects a missing or wrong key instead of serving something broken", () => {
    expect(readPrivateJwk(undefined)).toBeNull();
    expect(readPrivateJwk("nope")).toBeNull();
    expect(readPrivateJwk('{"kty":"OKP","crv":"Ed25519","x":"abc"}')).toBeNull();
  });

  it("publishes only the public key, with the directory content type", () => {
    const jwk = freshJwk();
    const { body, headers } = buildDirectory(jwk, "powermysport.com");
    expect(JSON.parse(body)).toEqual({ keys: [{ kty: "OKP", crv: "Ed25519", x: jwk.x }] });
    expect(body).not.toContain(jwk.d);
    expect(headers["Content-Type"]).toBe(DIRECTORY_CONTENT_TYPE);
  });

  it("signs itself over @authority;req with the directory tag, verifiably", () => {
    const jwk = freshJwk();
    const { headers } = buildDirectory(jwk, "PowerMySport.com", 1_750_000_000_000, "n");
    const input = headers["Signature-Input"]!;
    expect(input).toBe(
      `sig1=("@authority";req);alg="ed25519";keyid="${jwkThumbprint(jwk.x)}";nonce="n";` +
        `tag="http-message-signatures-directory";created=1750000000;expires=1750000300`
    );
    const base = [
      '"@authority";req: powermysport.com',
      `"@signature-params": ${input.slice("sig1=".length)}`,
    ].join("\n");
    const signature = /^sig1=:(.+):$/.exec(headers.Signature!)![1]!;
    const publicKey = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: jwk.x },
      format: "jwk",
    });
    expect(verify(null, Buffer.from(base), publicKey, Buffer.from(signature, "base64"))).toBe(true);
  });
});
