/**
 * Generates the Ed25519 key PowerMySportBot signs its requests with (Web Bot Auth).
 *
 *   npx ts-node src/scripts/generateWebBotAuthKey.ts
 *
 * Prints three things and writes nothing:
 *  1. WEB_BOT_AUTH_PRIVATE_KEY: set this, exactly, on BOTH deployments: the
 *     server (it signs requests to AITA) and the client on Vercel (it signs the
 *     public key directory at /.well-known/http-message-signatures-directory).
 *  2. The public JWK the directory will publish.
 *  3. The keyid (JWK thumbprint) Cloudflare will see on every request.
 *
 * Treat the private key like a password: never commit it or paste it in chat.
 * Rotating is: generate a new one, set it in both places, redeploy both.
 */
import { generateKeyPairSync } from "crypto";
import { jwkThumbprint } from "../shared/services/aita/aitaIdentity";

const { privateKey } = generateKeyPairSync("ed25519");
const jwk = privateKey.export({ format: "jwk" }) as {
  kty: string;
  crv: string;
  x: string;
  d: string;
};

console.log("WEB_BOT_AUTH_PRIVATE_KEY (private, set on server AND client, never commit):");
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, d: jwk.d }));
console.log("\nPublic JWK (published in the key directory):");
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x }));
console.log("\nkeyid (JWK thumbprint):");
console.log(jwkThumbprint(jwk.x));
