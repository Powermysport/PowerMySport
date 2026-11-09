import "dotenv/config";
import { primarySport, sportsFocusFor } from "@powermysport/shared-types";
import { promises as fs } from "node:fs";
import mongoose from "mongoose";

/**
 * Migration 73: one sport per child.
 *
 * ── Why ──
 *
 * A child's sport lived in two fields that nothing kept together. `chosenSport` was written by
 * the assessment's results page; `sportsFocus` was the only thing the edit form wrote. So a
 * child could be Badminton on the dashboard and Tennis in the form (found 2026-11-10).
 *
 * From now on `chosenSport` is the sport, and `sportsFocus` is kept only as the mirror
 * `[chosenSport]` (see the Player model's validate hook). This brings the rows already stored
 * into that shape, so the code that relies on it can ship.
 *
 * ── What it does, per child ──
 *
 *   sport = chosenSport, else the first entry of sportsFocus
 *   chosenSport = sport,   sportsFocus = [sport]
 *
 * A child with no sport at all is left alone. `chosenSportAt` is never touched: a sport taken
 * from the list was not a dated decision, so it stays undated.
 *
 * ── What it removes ──
 *
 * Any OTHER entry in `sportsFocus` leaves the profile. Those were sports the parent listed
 * beside the chosen one (or, for the assessment, sports the child used to play). They are
 * not kept anywhere, so each row's full before-state goes to the `--backup` file first, and
 * `--down --backup <file>` puts it back. Rows that lose entries are listed by id in the report.
 * Names are never printed or written: this is child data and the ids are enough to look a row up.
 *
 * ── Safety ──
 *
 * Dry run by default. Reads with the raw collection, not the Player model, because importing
 * the model against this database creates its indexes (autoIndex is on locally and there is
 * one database, and it is production). Each update is guarded by the row's own before-state,
 * so a parent who edits their child's profile mid-run is not overwritten. Idempotent.
 *
 * Safe to run BEFORE the code that depends on it deploys: the old code reads
 * `chosenSport || sportsFocus[0]`, which is the same answer after this.
 *
 * USAGE (PowerShell strips a bare `--`, so call ts-node directly)
 *   npx ts-node src/migrations/73_one_sport_per_child.ts
 *   npx ts-node src/migrations/73_one_sport_per_child.ts --apply --backup <file.json>
 *   npx ts-node src/migrations/73_one_sport_per_child.ts --down --backup <file.json>
 */

export interface SportRow {
  _id: mongoose.Types.ObjectId;
  chosenSport?: string | null;
  sportsFocus?: string[] | null;
}

export type SportChange = {
  id: string;
  /** What the row held before, kept verbatim for the backup. */
  before: { chosenSport: string | null; sportsFocus: string[] | null };
  sport: string;
  /** The chosen sport was missing and was taken from the list. */
  backfilled: boolean;
  /** Other sports that leave the profile. */
  dropped: string[];
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The change one row needs, or null when it already has the shape (or has no sport at all). */
export const planOne = (row: SportRow): SportChange | null => {
  const sport = primarySport(row);
  if (!sport) return null;

  const list = row.sportsFocus ?? [];
  const mirrored = sportsFocusFor(sport);
  const alreadyRight =
    (row.chosenSport ?? "") === sport && list.length === 1 && list[0] === mirrored[0];
  if (alreadyRight) return null;

  return {
    id: String(row._id),
    before: { chosenSport: row.chosenSport ?? null, sportsFocus: row.sportsFocus ?? null },
    sport,
    backfilled: !row.chosenSport?.trim(),
    dropped: list.map((s) => s.trim()).filter((s) => s && !same(s, sport)),
  };
};

export const plan = (rows: SportRow[]): SportChange[] =>
  rows.map(planOne).filter((change): change is SportChange => change !== null);

interface Options {
  apply?: boolean;
  backup?: string;
}

const players = () => mongoose.connection.collection<SportRow>("players");

export const up = async (options: Options = {}) => {
  const apply = Boolean(options.apply);
  console.log(`Starting migration 73: one sport per child (${apply ? "APPLY" : "DRY RUN"})...`);
  if (apply && !options.backup) throw new Error("--apply needs --backup <file.json>.");

  const rows = await players()
    .find({}, { projection: { chosenSport: 1, sportsFocus: 1 } })
    .toArray();
  const changes = plan(rows);
  const losing = changes.filter((c) => c.dropped.length > 0);

  console.log(`  scanned ${rows.length} child profile(s).`);
  console.log(`  ${changes.length} need the one-sport shape:`);
  console.log(`    ${changes.filter((c) => c.backfilled).length} take their sport from the list`);
  console.log(`    ${losing.length} lose other listed sports from the profile`);
  for (const change of losing) {
    console.log(`      ${change.id}: keeps "${change.sport}", loses ${change.dropped.length}`);
  }

  if (changes.length === 0) {
    console.log("  nothing to do.");
    return;
  }
  if (!apply) {
    console.log("Dry run complete. Re-run with --apply --backup <file.json>.");
    return;
  }

  await fs.writeFile(options.backup!, JSON.stringify(changes, null, 2), { flag: "wx" });
  console.log(`  backup written to ${options.backup}`);

  let updated = 0;
  let skipped = 0;
  for (const change of changes) {
    // Guarded by the before-state: a row edited since the scan no longer matches and is left.
    const guard: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(change.id),
      sportsFocus: change.before.sportsFocus ?? { $exists: false },
      chosenSport: change.before.chosenSport ?? { $exists: false },
    };
    const result = await players().updateOne(guard as never, {
      $set: { chosenSport: change.sport, sportsFocus: sportsFocusFor(change.sport) },
    });
    if (result.modifiedCount) updated++;
    else skipped++;
  }
  console.log(`  updated ${updated}, skipped ${skipped} that changed while this ran.`);
  console.log("Migration 73 complete.");
};

export const down = async (options: Options = {}) => {
  if (!options.backup) throw new Error("--down needs the --backup <file.json> that --apply wrote.");
  const changes = JSON.parse(await fs.readFile(options.backup, "utf8")) as SportChange[];
  let restored = 0;
  for (const change of changes) {
    const { chosenSport, sportsFocus } = change.before;
    // A field that did not exist before is removed again rather than set to null.
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    if (chosenSport === null) unset.chosenSport = "";
    else set.chosenSport = chosenSport;
    if (sportsFocus === null) unset.sportsFocus = "";
    else set.sportsFocus = sportsFocus;
    const result = await players().updateOne(
      { _id: new mongoose.Types.ObjectId(change.id) } as never,
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      } as never
    );
    restored += result.modifiedCount;
  }
  console.log(`Restored ${restored} child profile(s) from ${options.backup}.`);
};

const isDirectRun = require.main === module;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--backup");
  const options: Options = {
    apply: argv.includes("--apply"),
    ...(at >= 0 && argv[at + 1] ? { backup: argv[at + 1]! } : {}),
  };

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  void mongoose
    .connect(uri)
    .then(() => (argv.includes("--down") ? down(options) : up(options)))
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Migration 73 failed:", error);
      process.exit(1);
    });
}
