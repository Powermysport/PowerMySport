import { createHash, createPrivateKey, randomBytes, sign } from "crypto";

/**
 * The Web Bot Auth key directory PowerMySportBot points Cloudflare at, served at
 * https://powermysport.com/.well-known/http-message-signatures-directory.
 *
 * Cloudflare's rules (Web Bot Auth docs, Oct 2026): HTTPS at that exact path,
 * content type application/http-message-signatures-directory+json, a JWKS of
 * Ed25519 public keys, and the response itself signed by each key it lists with
 * tag "http-message-signatures-directory" over ("@authority";req).
 *
 * The private key is the same WEB_BOT_AUTH_PRIVATE_KEY the server signs its AITA
 * requests with (server/src/shared/services/aita/aitaIdentity.ts); the thumbprint
 * below must stay identical to the server's.
 */

export const DIRECTORY_CONTENT_TYPE = "application/http-message-signatures-directory+json";
const LIFETIME_S = 300;

interface PrivateJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  d: string;
}

/** RFC 7638 thumbprint of an Ed25519 public key (RFC 8037). */
export function jwkThumbprint(x: string): string {
  return createHash("sha256")
    .update(`{"crv":"Ed25519","kty":"OKP","x":"${x}"}`)
    .digest("base64url");
}

export function readPrivateJwk(raw: string | undefined): PrivateJwk | null {
  if (!raw?.trim()) return null;
  try {
    const jwk = JSON.parse(raw) as Partial<PrivateJwk>;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || !jwk.d) return null;
    return jwk as PrivateJwk;
  } catch {
    return null;
  }
}

/**
 * The directory body and the headers that sign it, for a request to `authority`
 * (the Host it was asked for, e.g. "powermysport.com").
 */
export function buildDirectory(
  jwk: PrivateJwk,
  authority: string,
  now: number = Date.now(),
  nonce: string = randomBytes(32).toString("base64url")
): { body: string; headers: Record<string, string> } {
  const keyid = jwkThumbprint(jwk.x);
  const created = Math.floor(now / 1000);
  const params =
    `("@authority";req);alg="ed25519";keyid="${keyid}";nonce="${nonce}";` +
    `tag="http-message-signatures-directory";created=${created};expires=${created + LIFETIME_S}`;
  const base = [
    `"@authority";req: ${authority.toLowerCase()}`,
    `"@signature-params": ${params}`,
  ].join("\n");
  const key = createPrivateKey({ key: jwk as never, format: "jwk" });
  const signature = sign(null, Buffer.from(base, "utf8"), key).toString("base64");

  return {
    // Public members only: `d` must never leave the server.
    body: JSON.stringify({ keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x }] }),
    headers: {
      "Content-Type": DIRECTORY_CONTENT_TYPE,
      "Cache-Control": `public, max-age=${LIFETIME_S}`,
      "Signature-Input": `sig1=${params}`,
      Signature: `sig1=:${signature}:`,
    },
  };
}
