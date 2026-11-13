/**
 * Bring the stored chess editions in line with AICF's "All Events" page.
 *
 *   Report only (writes nothing):
 *     npx ts-node src/scripts/ingestAicfCalendar.ts
 *   Write:
 *     npx ts-node src/scripts/ingestAicfCalendar.ts --apply --backup <file.json>
 *
 * (Not `npm run x -- --apply`: PowerShell strips the `--` and it silently reports.)
 *
 * The same sweep the scheduler runs (shared/services/aicf/AicfCalendarSyncService.ts):
 *   - UPDATES a stored chess row when it is the same event (same AICF code, or the
 *     same start day and a matching name), keeping its name and slug; fields an admin
 *     filled in are never replaced, only empty ones are filled.
 *   - CREATES a row for every upcoming AICF event we do not hold.
 *   - Never cancels and never deletes; events missing from AICF are listed below.
 *   - `--apply` refuses to run without `--backup`, and the backup is written and read
 *     back before the first write.
 *
 * There is ONE database and it is production (server/CLAUDE.md), so this uses the raw
 * driver and imports no Mongoose model.
 */

import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

import { syncAicfCalendar } from "../shared/services/aicf/AicfCalendarSyncService";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "";
if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

const argValue = (flag: string): string | undefined => {
  const at = process.argv.indexOf(flag);
  return at === -1 ? undefined : process.argv[at + 1];
};
const APPLY = process.argv.includes("--apply");
const BACKUP = argValue("--backup");

async function main(): Promise<void> {
  if (APPLY && !BACKUP) {
    console.error(
      "--apply needs --backup <file.json>: the rows about to be changed are saved there first."
    );
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db!;

  console.log("Reading AICF's events page...");
  const report = await syncAicfCalendar(
    { db },
    {
      apply: APPLY,
      backup: (rows) => {
        fs.writeFileSync(
          BACKUP!,
          JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 1)
        );
        const reread = JSON.parse(fs.readFileSync(BACKUP!, "utf8")) as { rows: unknown[] };
        if (reread.rows.length !== rows.length)
          throw new Error("The backup did not read back complete.");
        console.log(`Backed up ${rows.length} rows to ${BACKUP}`);
      },
    }
  );
  await mongoose.disconnect();

  const { plan } = report;
  const real = plan.updates.filter((u) => u.changed.length > 0);
  console.log(`\nAICF rows read: ${report.rowsRead}, rejected: ${report.rejected.length}`);
  console.log(`Already finished (ignored): ${plan.finished}`);
  console.log(`\n── Plan (${report.applied ? "WRITTEN" : "report only"}) ──`);
  console.log(
    `Matched:  ${plan.updates.length}  (${plan.updates.filter((u) => u.matchedBy === "eventCode").length} by AICF code, ${plan.updates.filter((u) => u.matchedBy === "name").length} by name and date, ${plan.updates.filter((u) => u.matchedBy === "moved").length} moved by AICF); ${real.length} with changes`
  );
  console.log(`Possible duplicates already stored (left alone): ${plan.possibleDuplicates.length}`);
  console.log(`Create:   ${plan.creates.length}`);
  console.log(`Skipped:  ${plan.skipped.length}`);
  console.log(`Missing from AICF (left alone): ${plan.missing.length}`);

  if (real.length) {
    console.log("\nUpdates:");
    for (const u of real)
      console.log(
        `  ${u.name.slice(0, 70).padEnd(70)} [${u.eventCode}, ${u.matchedBy}] ${u.changed.join(", ")}`
      );
  }
  if (plan.creates.length) {
    console.log("\nCreates:");
    for (const c of plan.creates) {
      const d = c.doc;
      console.log(
        `  ${d.startDate.toISOString().slice(0, 10)}  ${d.name.slice(0, 70).padEnd(70)} ${[d.city, d.state].filter(Boolean).join(", ")}${d.documents ? "  +brochure" : ""}`
      );
    }
  }
  if (plan.skipped.length) {
    console.log("\nSkipped:");
    for (const s of plan.skipped) console.log(`  [${s.eventCode}] ${s.name}: ${s.reason}`);
  }
  if (report.rejected.length) {
    console.log("\nRejected by the parser:");
    for (const r of report.rejected) console.log(`  [${r.eventCode}] ${r.name}: ${r.reason}`);
  }
  if (plan.possibleDuplicates.length) {
    console.log(
      "\nStored rows that look like a matched event (candidates for a merge, left alone):"
    );
    for (const d of plan.possibleDuplicates)
      console.log(
        `  ${d.stored.startDate.toISOString().slice(0, 10)}  ${d.stored.name.slice(0, 70)}  (${d.stored.slug ?? "no slug"})  ~ [${d.likeEventCode}]`
      );
  }
  if (plan.missing.length) {
    console.log("\nStored with an AICF code but no longer listed (left alone):");
    for (const s of plan.missing)
      console.log(`  ${s.startDate.toISOString().slice(0, 10)}  ${s.name}  [${s.externalId}]`);
  }

  if (!report.applied) {
    console.log("\nNothing was written. Re-run with --apply --backup <file> to write.");
    return;
  }
  const w = report.written;
  console.log(`\nUpdated ${w.updated}, created ${w.created}, failed ${w.failed.length}.`);
  for (const f of w.failed) console.log("  " + f);
  if (w.failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("failed:", error instanceof Error ? error.message.slice(0, 300) : error);
  process.exit(1);
});
