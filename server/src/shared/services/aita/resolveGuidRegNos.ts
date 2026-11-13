/**
 * Gives GUID-keyed rows their real AITA number when we already know the player.
 *
 * AITA's list pages stopped printing the registration number (the platform now
 * sends a GUID in `data-player`), but our archive is keyed on that number: week
 * over week movement, state rank and history all join on `regNo`. A row the
 * parser could not number arrives with a provisional `g-<guid>` regNo; this maps
 * it back onto the archive in two steps, both against the newest earlier
 * published week of the SAME list:
 *
 *   1. the GUID itself, if that week's row stored it as `playerKey`
 *   2. name + birth year + state, only when exactly one earlier row has that
 *      identity and no other row in this list has already claimed its number
 *
 * Anything else keeps the provisional number: a new name is a new player, and a
 * wrong merge would hand one child another's history. Once a row is stored with
 * its GUID as `playerKey`, step 1 makes later weeks exact.
 */

import { RankingEntry } from "../../models/RankingEntry";
import { RankingSnapshot } from "../../models/RankingSnapshot";
import { isProvisionalRegNo } from "./rankingListParser";
import type { ParsedRankingRow } from "./types";

export interface GuidResolution {
  /** Rows renumbered to a known AITA number. */
  matched: number;
  /** Rows left on a provisional number (new players, or ambiguous names). */
  provisional: number;
  /** Rows that matched on identity but were left alone because it was ambiguous. */
  ambiguous: number;
}

const identity = (
  name: string,
  birthYear: number | null | undefined,
  state: string | null | undefined
) =>
  `${name.toLowerCase().replace(/\s+/g, " ").trim()}|${birthYear ?? ""}|${(state ?? "").toUpperCase()}`;

export async function resolveGuidRegNos(args: {
  category: string;
  subcategory: string;
  asOnDate: string;
  rows: ParsedRankingRow[];
}): Promise<GuidResolution> {
  const result: GuidResolution = { matched: 0, provisional: 0, ambiguous: 0 };
  const pending = args.rows.filter((row) => isProvisionalRegNo(row.regNo));
  if (pending.length === 0) return result;

  const previous = await RankingSnapshot.findOne({
    category: args.category,
    subcategory: args.subcategory,
    status: "published",
    asOnDate: { $lt: new Date(args.asOnDate) },
  })
    .sort({ asOnDate: -1, version: -1 })
    .select("_id")
    .lean();

  if (!previous) {
    result.provisional = pending.length;
    return result;
  }

  const earlier = await RankingEntry.find({ snapshot: previous._id })
    .select("regNo fullName birthYear stateCode playerKey")
    .lean();

  const byGuid = new Map<string, string>();
  const byIdentity = new Map<string, string[]>();
  for (const e of earlier) {
    const regNo = String(e.regNo);
    if (e.playerKey) byGuid.set(String(e.playerKey).toLowerCase(), regNo);
    const id = identity(String(e.fullName), e.birthYear, e.stateCode);
    byIdentity.set(id, [...(byIdentity.get(id) ?? []), regNo]);
  }

  // Numbers already taken in THIS list, so two rows can never share one.
  const claimed = new Set(
    args.rows.filter((r) => !isProvisionalRegNo(r.regNo)).map((r) => r.regNo)
  );
  const stillProvisional: ParsedRankingRow[] = [];

  for (const row of pending) {
    const exact = byGuid.get(row.playerKey.toLowerCase());
    if (exact && !claimed.has(exact)) {
      row.regNo = exact;
      claimed.add(exact);
      result.matched += 1;
    } else {
      stillProvisional.push(row);
    }
  }

  // Identity matches are only trusted when both sides are unambiguous.
  const wanted = new Map<string, ParsedRankingRow[]>();
  for (const row of stillProvisional) {
    const id = identity(row.fullName, row.birthYear, row.stateCode);
    wanted.set(id, [...(wanted.get(id) ?? []), row]);
  }
  for (const [id, rows] of wanted) {
    const candidates = byIdentity.get(id) ?? [];
    if (candidates.length === 1 && rows.length === 1 && !claimed.has(candidates[0]!)) {
      rows[0]!.regNo = candidates[0]!;
      claimed.add(candidates[0]!);
      result.matched += 1;
    } else {
      if (candidates.length > 0) result.ambiguous += rows.length;
      result.provisional += rows.length;
    }
  }
  return result;
}
