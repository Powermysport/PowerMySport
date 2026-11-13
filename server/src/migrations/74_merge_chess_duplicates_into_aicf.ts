/**
 * Migration 74: redirect duplicate chess editions to the row AICF's event code owns.
 *
 * The admin extraction stored several chess events more than once: a row per
 * category plus one for the whole festival, or one event under two names. On
 * 2026-11-14 the AICF sync dry run found 17 such rows among ~43 upcoming. Since
 * that sync, each upcoming AICF event has one row carrying its FIDE event code;
 * this points the code-less look-alikes at it. The rules are in
 * shared/services/aicf/chessDuplicates.ts.
 *
 * RUN ORDER: after the AICF sync has applied at least once (scripts/ingestAicfCalendar.ts
 * --apply, or one scheduled sweep). Before that no row has a code and this finds nothing.
 *
 * Losers are not deleted: they gain `mergedInto` (plus `mergedReason`, so `--down`
 * undoes only this migration's merges) and their URL answers with a permanent
 * redirect. Facts a survivor lacks (venue, organiser, documents...) are copied to
 * it first. Rows that already redirected to a loser are re-pointed at the survivor,
 * so no redirect chain is created.
 *
 * Uses the raw driver and imports no Mongoose model: loading a model from a local
 * script creates its indexes in the one production database (server/CLAUDE.md).
 *
 * USAGE (npx, not `npm run x -- --apply`: PowerShell strips the `--`)
 *   npx ts-node src/migrations/74_merge_chess_duplicates_into_aicf.ts                       # dry run
 *   npx ts-node src/migrations/74_merge_chess_duplicates_into_aicf.ts --apply --backup f.json
 *   npx ts-node src/migrations/74_merge_chess_duplicates_into_aicf.ts --down
 *
 * `--down` clears the redirects; values copied onto survivors stay (they are true
 * facts about the same event). The backup file holds every touched row as it was.
 */

import "dotenv/config";
import fs from "node:fs";
import mongoose, { type mongo } from "mongoose";

import { planChessDuplicateMerges, type ChessRow } from "../shared/services/aicf/chessDuplicates";

const COLLECTION = "tournamenteditions";
export const MERGED_REASON = "aicf-duplicate-74";

export interface RunOptions {
  apply: boolean;
  backup?: (rows: unknown[]) => void;
  log?: (line: string) => void;
}

export async function up(db: mongo.Db, options: RunOptions) {
  const log = options.log ?? ((line: string) => console.log(line));
  const col = db.collection(COLLECTION);
  const rows = (await col
    .find(
      { sportSlug: "chess" },
      {
        projection: {
          slug: 1,
          name: 1,
          officialName: 1,
          startDate: 1,
          externalId: 1,
          sourceUrl: 1,
          mergedInto: 1,
          venue: 1,
          organiser: 1,
          detailUrl: 1,
          registrationDeadlineDate: 1,
          documents: 1,
        },
      }
    )
    .toArray()) as unknown as ChessRow[];

  const plan = planChessDuplicateMerges(rows);
  const coded = rows.filter((r) => r.externalId && !r.mergedInto).length;
  log(
    `Migration 74 (${options.apply ? "APPLY" : "DRY RUN"}): ${rows.length} chess rows, ${coded} with an AICF code.`
  );
  if (coded === 0) {
    log("No row carries an AICF code yet. Run the AICF sync with --apply first; nothing to do.");
    return { plan, written: { merged: 0, filled: 0, repointed: 0 } };
  }

  // Rows already redirecting to a loser, so they can follow it to the survivor.
  const loserToSurvivor = new Map(plan.merges.map((m) => [m.loser.slug, m.survivor.slug]));
  const repoint = rows.filter((r) => r.mergedInto && loserToSurvivor.has(r.mergedInto));

  log(`\nMerges: ${plan.merges.length}`);
  for (const m of plan.merges) {
    log(`  ${m.loser.startDate.toISOString().slice(0, 10)}  ${m.loser.slug ?? "(no slug)"}`);
    log(`      -> ${m.survivor.slug}  [${m.survivor.externalId}]  (${m.reason})`);
  }
  if (plan.fills.size) {
    log(`\nFacts copied onto survivors: ${plan.fills.size}`);
    for (const [slug, f] of plan.fills) log(`  ${slug}: ${f.changed.join(", ")}`);
  }
  if (repoint.length) log(`\nExisting redirects re-pointed past a loser: ${repoint.length}`);
  if (plan.ambiguous.length) {
    log(`\nAmbiguous, left alone (needs a person): ${plan.ambiguous.length}`);
    for (const a of plan.ambiguous) {
      log(`  ${a.row.slug ?? a.row.name}: ${a.reason}`);
      for (const c of a.candidates) log(`      ? ${c.slug}`);
    }
  }

  const written = { merged: 0, filled: 0, repointed: 0 };
  if (!options.apply) {
    log("\nDry run: nothing written. Re-run with --apply --backup <file>.");
    return { plan, written };
  }

  const touchedIds = [
    ...plan.merges.map((m) => m.loser._id),
    ...[...plan.fills.values()].map((f) => f.survivor._id),
    ...repoint.map((r) => r._id),
  ];
  if (touchedIds.length === 0) {
    log("\nNothing to write.");
    return { plan, written };
  }
  if (!options.backup) throw new Error("--apply needs a backup of the rows it changes");
  options.backup(await col.find({ _id: { $in: touchedIds as never[] } }).toArray());

  const now = new Date();
  for (const f of plan.fills.values()) {
    const res = await col.updateOne(
      { _id: f.survivor._id as never },
      { $set: { ...f.set, updatedAt: now } }
    );
    written.filled += res.modifiedCount;
  }
  for (const m of plan.merges) {
    const res = await col.updateOne(
      { _id: m.loser._id as never, mergedInto: { $in: [null, undefined] } },
      { $set: { mergedInto: m.survivor.slug, mergedReason: MERGED_REASON, updatedAt: now } }
    );
    written.merged += res.modifiedCount;
  }
  for (const r of repoint) {
    const res = await col.updateOne(
      { _id: r._id as never },
      { $set: { mergedInto: loserToSurvivor.get(r.mergedInto!), updatedAt: now } }
    );
    written.repointed += res.modifiedCount;
  }
  log(
    `\nMerged ${written.merged}, filled ${written.filled} survivors, re-pointed ${written.repointed}.`
  );
  log("Pages cache for about five minutes.");
  return { plan, written };
}

export async function down(db: mongo.Db, log: (line: string) => void = console.log) {
  const res = await db
    .collection(COLLECTION)
    .updateMany({ mergedReason: MERGED_REASON }, { $unset: { mergedInto: "", mergedReason: "" } });
  log(`Migration 74 reverted: cleared ${res.modifiedCount} redirect(s).`);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--backup");
  const backupPath = at === -1 ? undefined : argv[at + 1];
  const apply = argv.includes("--apply");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  if (apply && !backupPath) {
    console.error("--apply needs --backup <file.json>");
    process.exit(1);
  }

  void (async () => {
    await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db!;
    if (argv.includes("--down")) {
      await down(db);
    } else {
      await up(db, {
        apply,
        backup: (rows) => {
          fs.writeFileSync(
            backupPath!,
            JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 1)
          );
          const reread = JSON.parse(fs.readFileSync(backupPath!, "utf8")) as { rows: unknown[] };
          if (reread.rows.length !== rows.length)
            throw new Error("The backup did not read back complete.");
          console.log(`Backed up ${rows.length} rows to ${backupPath}`);
        },
      });
    }
    await mongoose.disconnect();
  })().catch(async (error: unknown) => {
    console.error("Migration 74 failed:", error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
}
