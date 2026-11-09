import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { createHash, createPrivateKey, randomBytes, sign, type KeyObject } from "crypto";
import { log as __rootLog } from "../../../utils/logger";

const log = __rootLog.child("aitaIdentity");

/**
 * How PowerMySport's reader identifies itself and behaves on AITA's site, in one
 * place for all three AITA clients (rankings, calendar, acceptance lists).
 *
 * Written for Cloudflare's Verified Bots programme, whose bar is: declare who you
 * are deterministically, obey robots.txt and crawl directives, keep request rates
 * reasonable. Each of those is implemented here, and https://powermysport.com/bot
 * (client/src/app/(marketing)/bot/page.tsx) describes it publicly. Keep the two in
 * step.
 *
 *   • Identity: a stable user agent naming the bot and linking to that page, plus
 *     Web Bot Auth signatures (RFC 9421, Ed25519) once a key is configured.
 *   • robots.txt: fetched, cached a day, obeyed (RFC 9309), Crawl-delay included.
 *   • Pace: one shared gap per host for every client in this process, at least
 *     1.5 s, longer if robots.txt asks.
 */

export const AITA_USER_AGENT =
  "PowerMySportBot/1.0 (+https://powermysport.com/bot; teams@powermysport.com)";
/** The robots.txt product token: what a site names to give us our own rules. */
export const ROBOTS_TOKEN = "powermysportbot";
/** Where our Web Bot Auth key directory lives (/.well-known/http-message-signatures-directory). */
export const SIGNATURE_AGENT = "https://powermysport.com";

const MIN_GAP_MS = 1500;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;
/** Web Bot Auth signatures are short-lived; Cloudflare's docs say a minute is enough. */
const SIGNATURE_LIFETIME_S = 60;

// ── Web Bot Auth ──────────────────────────────────────────────────────────────

export interface SigningKey {
  key: KeyObject;
  /** Base64url JWK thumbprint (RFC 7638 / RFC 8037), the `keyid` Cloudflare looks up. */
  keyid: string;
}

/** RFC 7638 thumbprint of an Ed25519 public key: SHA-256 over the required members, sorted. */
export function jwkThumbprint(x: string): string {
  const canonical = `{"crv":"Ed25519","kty":"OKP","x":"${x}"}`;
  return createHash("sha256").update(canonical).digest("base64url");
}

/**
 * Reads the private key from WEB_BOT_AUTH_PRIVATE_KEY: a JWK JSON string
 * `{"kty":"OKP","crv":"Ed25519","x":"…","d":"…"}` (see scripts/generateWebBotAuthKey.ts).
 * Returns null when unset, so a deployment without a key still runs, unsigned.
 */
export function loadSigningKey(raw = process.env.WEB_BOT_AUTH_PRIVATE_KEY): SigningKey | null {
  if (!raw?.trim()) return null;
  try {
    const jwk = JSON.parse(raw) as { kty?: string; crv?: string; x?: string; d?: string };
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || !jwk.d) {
      throw new Error("expected an Ed25519 private JWK with x and d");
    }
    const key = createPrivateKey({ key: jwk as never, format: "jwk" });
    return { key, keyid: jwkThumbprint(jwk.x) };
  } catch (error) {
    log.error("WEB_BOT_AUTH_PRIVATE_KEY is set but unusable; requests go out unsigned:", error);
    return null;
  }
}

/**
 * The three Web Bot Auth headers for one request to `authority` (host[:port]).
 * Signs `@authority` and `signature-agent`, the two components Cloudflare asks for.
 */
export function webBotAuthHeaders(
  authority: string,
  signingKey: SigningKey,
  now: number = Date.now(),
  nonce: string = randomBytes(32).toString("base64url")
): Record<string, string> {
  const created = Math.floor(now / 1000);
  const expires = created + SIGNATURE_LIFETIME_S;
  const agent = `"${SIGNATURE_AGENT}"`;
  const params =
    `("@authority" "signature-agent");created=${created};keyid="${signingKey.keyid}";` +
    `alg="ed25519";expires=${expires};nonce="${nonce}";tag="web-bot-auth"`;
  const base = [
    `"@authority": ${authority.toLowerCase()}`,
    `"signature-agent": ${agent}`,
    `"@signature-params": ${params}`,
  ].join("\n");
  const signature = sign(null, Buffer.from(base, "utf8"), signingKey.key).toString("base64");
  return {
    "Signature-Agent": agent,
    "Signature-Input": `sig1=${params}`,
    Signature: `sig1=:${signature}:`,
  };
}

// ── robots.txt (RFC 9309) ─────────────────────────────────────────────────────

export interface RobotsPolicy {
  rules: Array<{ allow: boolean; path: string }>;
  /** Crawl-delay in seconds, when the matching group sets one. */
  crawlDelaySec: number | null;
}

export const ALLOW_ALL: RobotsPolicy = { rules: [], crawlDelaySec: null };
export const DISALLOW_ALL: RobotsPolicy = {
  rules: [{ allow: false, path: "/" }],
  crawlDelaySec: null,
};

/** The group for our token if the file names us, else the `*` group, else allow-all. */
export function parseRobots(text: string, token: string = ROBOTS_TOKEN): RobotsPolicy {
  type Group = { agents: string[]; rules: RobotsPolicy["rules"]; delay: number | null };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "nothing is disallowed": no rule at all.
      if (value) current.rules.push({ allow: field === "allow", path: value });
    } else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.delay = seconds;
    }
  }

  const ours = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes("*"));
  if (chosen.length === 0) return ALLOW_ALL;
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySec: chosen.reduce<number | null>(
      (max, g) => (g.delay === null ? max : Math.max(max ?? 0, g.delay)),
      null
    ),
  };
}

const ruleRegex = (path: string): RegExp => {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
};

/** Longest matching rule wins; on a tie, Allow wins (RFC 9309 §2.2.2). */
export function isPathAllowed(policy: RobotsPolicy, pathWithQuery: string): boolean {
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of policy.rules) {
    if (!ruleRegex(rule.path).test(pathWithQuery)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { allow: rule.allow, length };
    }
  }
  return best ? best.allow : true;
}

// ── Per-host state: robots cache and the shared pace ──────────────────────────

const robotsCache = new Map<string, { policy: RobotsPolicy; fetchedAt: number }>();
const lastRequestAt = new Map<string, number>();

/** Test hook: forget cached robots files and pacing. */
export function resetAitaIdentityState(): void {
  robotsCache.clear();
  lastRequestAt.clear();
}

async function robotsFor(origin: string, signingKey: SigningKey | null): Promise<RobotsPolicy> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.policy;

  let policy: RobotsPolicy;
  try {
    const url = new URL("/robots.txt", origin);
    const res = await axios.get<string>(url.toString(), {
      timeout: 30_000,
      responseType: "text",
      validateStatus: () => true,
      headers: {
        "User-Agent": AITA_USER_AGENT,
        Accept: "text/plain",
        ...(signingKey ? webBotAuthHeaders(url.host, signingKey) : {}),
      },
    });
    if (res.status >= 200 && res.status < 300) policy = parseRobots(String(res.data ?? ""));
    // RFC 9309 §2.3.1.3: a 4xx means "no robots.txt", so everything is allowed.
    else if (res.status >= 400 && res.status < 500) policy = ALLOW_ALL;
    // §2.3.1.4: unreachable (5xx) means assume everything is disallowed.
    else policy = DISALLOW_ALL;
  } catch {
    policy = DISALLOW_ALL;
  }
  robotsCache.set(origin, { policy, fetchedAt: Date.now() });
  return policy;
}

/**
 * Adds our identity, robots.txt check, shared pacing and (when a key is set)
 * Web Bot Auth signature to every request an AITA client makes. Returns the
 * same instance for chaining.
 */
export function attachAitaIdentity(instance: AxiosInstance): AxiosInstance {
  // Read on first use, not at import: a module-level client can be created before
  // the environment is loaded.
  let signingKey: SigningKey | null | undefined;
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (signingKey === undefined) signingKey = loadSigningKey();
    const url = new URL(axios.getUri(config));
    const policy = await robotsFor(url.origin, signingKey);
    if (!isPathAllowed(policy, `${url.pathname}${url.search}`)) {
      throw new Error(`robots.txt on ${url.host} disallows ${url.pathname} for PowerMySportBot`);
    }

    const gap = Math.max(MIN_GAP_MS, (policy.crawlDelaySec ?? 0) * 1000);
    const wait = (lastRequestAt.get(url.host) ?? 0) + gap - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt.set(url.host, Date.now());

    config.headers.set("User-Agent", AITA_USER_AGENT);
    if (signingKey) {
      for (const [name, value] of Object.entries(webBotAuthHeaders(url.host, signingKey))) {
        config.headers.set(name, value);
      }
    }
    return config;
  });
  return instance;
}
