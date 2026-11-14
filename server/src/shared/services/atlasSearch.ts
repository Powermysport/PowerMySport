import { log } from "../../utils/logger";

// ─── Shared switch and safety net for every Atlas Search query ──────────────
//
// Atlas Search is opt-in (ATLAS_SEARCH_ENABLED=true) and only after the search
// index it needs exists in Atlas. A `$search` stage against a cluster or index
// that does not have it throws, and that must never be the reason a page fails,
// so every caller goes through `tryAtlasSearch`: it returns null when search is
// off, recently failed, or fails now, and the caller carries on with the plain
// query it had before.
//
// A failure pauses Atlas for that caller for a minute rather than timing out on
// every keystroke of an as-you-type box.

const BACKOFF_MS = 60_000;
const skipUntil = new Map<string, number>();

export const atlasSearchEnabled = (): boolean => process.env.ATLAS_SEARCH_ENABLED === "true";

/**
 * Runs an Atlas Search query. Resolves to its result, or to null when the caller
 * should use its fallback (switched off, paused after a failure, or failing now).
 * `key` names the caller so one failing index does not pause the others.
 */
export async function tryAtlasSearch<T>(key: string, run: () => Promise<T>): Promise<T | null> {
  if (!atlasSearchEnabled() || Date.now() < (skipUntil.get(key) ?? 0)) return null;

  try {
    return await run();
  } catch (error) {
    skipUntil.set(key, Date.now() + BACKOFF_MS);
    log.warn(
      `[atlas-search:${key}] unavailable, using the plain query for ${BACKOFF_MS / 1000}s: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/** Test seam: forget every recorded failure. */
export const resetAtlasBackoff = (): void => {
  skipUntil.clear();
};
