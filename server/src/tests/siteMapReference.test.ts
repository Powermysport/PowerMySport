// Every page the assistant's site map names must be a page the website really has.
//
// The assistant sends parents the links it finds in this map. On 2026-11-12 it sent
// https://powermysport.com/settings to a parent who asked to change their child's sport: the map
// listed "/settings — Account settings", but the page is /dashboard/settings, so the link was a
// 404 and the assistant had only done what its prompt told it. This reads the client's real
// routes and redirects and fails when the map drifts from them.
// The shop's pages are in the map only while the shop is live, so the test checks the fullest map.
process.env.SHOP_IS_LIVE = "true";

import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");
const { describe, it } = require("node:test");

const { SITE_MAP_REFERENCE } = require("../shared/services/siteMapReference");

const CLIENT = path.resolve(__dirname, "../../../client");
const APP = path.join(CLIENT, "src", "app");

/** Every page the client has, as a URL path: route groups such as (booking) are not in the URL. */
function clientRoutes(dir: string, base: string[] = []): string[] {
  const routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name))) {
    routes.push(`/${base.join("/")}`);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    routes.push(
      ...clientRoutes(path.join(dir, entry.name), isGroup ? base : [...base, entry.name])
    );
  }
  return routes;
}

/** Paths the client redirects somewhere else, which still work for a parent who follows them. */
function redirectSources(): string[] {
  const config = fs.readFileSync(path.join(CLIENT, "next.config.ts"), "utf8");
  return [...config.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

/** A dynamic segment such as [expertId] matches any one segment. */
const matches = (route: string, wanted: string): boolean => {
  const a = route.split("/");
  const b = wanted.split("/");
  return (
    a.length === b.length &&
    a.every((part, i) => part === b[i] || /^\[.+\]$/.test(part) || /^\[.+\]$/.test(b[i]!))
  );
};

const mapped: string[] = [...SITE_MAP_REFERENCE.matchAll(/^- (\/[^\s]*)/gm)].map((m) => m[1]!);

describe("the assistant's site map", () => {
  it("is found and lists pages", () => {
    assert.ok(fs.existsSync(APP), "the client app folder must be next to the server");
    assert.ok(mapped.length >= 15, `only ${mapped.length} pages were read from the map`);
  });

  it("names only pages that exist or are redirected to one", () => {
    const routes = clientRoutes(APP);
    const redirects = redirectSources();
    const missing = mapped
      // A query string picks a tab on a page; the page is what has to exist.
      .map((p) => p.split("?")[0]!.replace(/\/$/, "") || "/")
      .filter((p) => !routes.some((r) => matches(r, p)) && !redirects.some((r) => matches(r, p)));
    assert.deepEqual(
      missing,
      [],
      `the map sends parents to pages that do not exist: ${missing.join(", ")}`
    );
  });
});
