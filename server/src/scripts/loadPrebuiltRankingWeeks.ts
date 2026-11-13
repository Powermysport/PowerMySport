/**
 * Loads ranking weeks that were assembled outside the AITA site, through the
 * normal validate -> publish -> insights path (AitaRankingIngestService
 * .ingestPrebuiltList). Written for 28 Sep - 19 Oct 2026, the weeks AITA's
 * Cloudflare block kept the scraper from reading.
 *
 *   Dry run (default, no writes):
 *     npx ts-node src/scripts/loadPrebuiltRankingWeeks.ts --file=/path/payload.json
 *
 *   Apply (writes to the ONE database, which is production):
 *     npx ts-node src/scripts/loadPrebuiltRankingWeeks.ts --file=/path/payload.json --apply
 *
 * Payload: { weeks: [{ category, subcategory, asOnDate, rows: [{ rank, regNo,
 * fullName, stateCode, birthYear, playerKey, totalPoints }] }] }.
 * Weeks are processed oldest first, and a list whose earlier week did not publish
 * is skipped for the later ones, because each week is measured against the one
 * before it.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { AitaRankingIngestService } from "../shared/services/aita/AitaRankingIngestService";
import type { AitaCategory, ParsedRankingRow } from "../shared/services/aita/types";

interface PayloadRow {
  rank: number;
  regNo: string;
  fullName: string;
  stateCode: string | null;
  birthYear: number | null;
  playerKey: string;
  totalPoints: number;
}
interface PayloadWeek {
  category: AitaCategory;
  subcategory: string;
  asOnDate: string;
  rows: PayloadRow[];
}

const NOTE =
  "Loaded from buzzato.com, a third-party compilation of AITA rankings, because AITA's " +
  "site blocked our reader. Roughly 1-3% of players may be absent from this week. " +
  "Superseded by AITA's own list once direct access returns.";

const file = process.argv.find((a) => a.startsWith("--file="))?.slice("--file=".length);
const apply = process.argv.includes("--apply");

function toRow(r: PayloadRow): ParsedRankingRow {
  return {
    rank: r.rank,
    givenName: "",
    familyName: "",
    fullName: r.fullName,
    regNo: r.regNo,
    playerKey: r.playerKey,
    dob: null,
    birthYear: r.birthYear,
    stateCode: r.stateCode,
    points: [{ label: "Total Pts.", value: r.totalPoints }],
    totalPoints: r.totalPoints,
    tournamentsPlayed: null,
    wtnSingles: null,
    wtnDoubles: null,
    photoUrl: null,
    sourceMovement: null,
  };
}

async function main(): Promise<void> {
  if (!file) throw new Error("--file=<payload.json> is required");
  const uri = process.env.MONGO_URI || "";
  if (!uri) throw new Error("MONGO_URI not set in .env");
  const { weeks } = JSON.parse(readFileSync(file, "utf8")) as { weeks: PayloadWeek[] };
  weeks.sort((a, b) => a.asOnDate.localeCompare(b.asOnDate));

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${weeks.length} lists`);
  await mongoose.connect(uri);
  const service = new AitaRankingIngestService();
  const blocked = new Set<string>();
  const tally: Record<string, number> = {};
  try {
    for (const week of weeks) {
      const key = `${week.category}/${week.subcategory}`;
      if (blocked.has(key)) {
        console.log(`⚪ ${key} ${week.asOnDate} skipped (an earlier week did not publish)`);
        tally.skipped = (tally.skipped ?? 0) + 1;
        continue;
      }
      const sub = week.subcategory.replace("-", "");
      const outcome = await service.ingestPrebuiltList({
        category: week.category,
        subcategory: week.subcategory,
        asOnDate: week.asOnDate,
        rows: week.rows.map(toRow),
        sourceUrl: `https://buzzato.com/tennis/aita/rankings/show/${week.category}/${sub}`,
        note: NOTE,
        dryRun: !apply,
      });
      tally[outcome.status] = (tally[outcome.status] ?? 0) + 1;
      if (outcome.status !== "published" && outcome.status !== "unchanged") blocked.add(key);
      console.log(
        `${outcome.status === "published" ? "✅" : outcome.status === "unchanged" ? "➖" : "🟡"} ` +
          `${key} ${week.asOnDate} ${outcome.status} ${outcome.rowCount ?? ""} rows` +
          `${outcome.reason ? ` — ${outcome.reason}` : ""}`
      );
    }
  } finally {
    await mongoose.disconnect();
  }
  console.log("summary", JSON.stringify(tally));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
