import { buildDirectory, readPrivateJwk } from "@/modules/bot/utils/webBotAuthDirectory";

/**
 * PowerMySportBot's Web Bot Auth key directory (see modules/bot/utils and
 * https://powermysport.com/bot). Signed per request, so never statically cached.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const jwk = readPrivateJwk(process.env.WEB_BOT_AUTH_PRIVATE_KEY);
  if (!jwk) {
    return new Response("Key directory not configured.", { status: 404 });
  }
  const authority = request.headers.get("host") ?? new URL(request.url).host;
  const { body, headers } = buildDirectory(jwk, authority);
  return new Response(body, { status: 200, headers });
}
