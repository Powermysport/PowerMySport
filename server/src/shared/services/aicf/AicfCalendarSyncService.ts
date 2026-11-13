import type { mongo } from "mongoose";

import { AicfEventsSource } from "./AicfEventsSource";
import type { AicfRejectedRow } from "./aicfEventsParser";
import { planAicfIngest, type AicfIngestPlan, type StoredChessEdition } from "./aicfIngest";

/**
 * One sweep of AICF's "All Events" page into the stored chess editions: read,
 * plan, write. The scheduler (utils/aicfCalendarScheduler.ts) and the script
 * (scripts/ingestAicfCalendar.ts) both run this, so what the script reports is
 * what the schedule does.
 *
 * Takes a raw `Db`, like the AITA sweep, because importing a Mongoose model
 * from a local script creates its collection and indexes in the one production
 * database (server/CLAUDE.md).
 */

type Db = mongo.Db;

const COLLECTION = "tournamenteditions";

/**
 * Below this many rows the page is not the calendar we know (419 rows on
 * 2026-11-14, about 110 of them upcoming). A redesign or an error page parsed as
 * a near-empty table must stop the sweep, not be written as "no events".
 */
const MIN_ROWS = 50;

export interface AicfSyncOptions {
  apply: boolean;
  now?: Date;
  /** Called with the rows about to be changed, before the first write. Throwing aborts. */
  backup?: (rows: unknown[]) => Promise<void> | void;
  /** Called after a sweep that wrote something, so cached pages are not stale. */
  onWritten?: () => void;
}

export interface AicfSyncReport {
  applied: boolean;
  rowsRead: number;
  rejected: AicfRejectedRow[];
  plan: AicfIngestPlan;
  written: { updated: number; created: number; failed: string[] };
}

export async function syncAicfCalendar(
  deps: { db: Db; source?: AicfEventsSource },
  options: AicfSyncOptions
): Promise<AicfSyncReport> {
  const now = options.now ?? new Date();
  const source = deps.source ?? new AicfEventsSource();

  const { page } = await source.fetchEvents();
  if (page.rows.length < MIN_ROWS) {
    throw new Error(
      `AICF's events page gave ${page.rows.length} rows (expected well over ${MIN_ROWS}); ` +
        "the page has probably changed, so nothing was planned or written"
    );
  }

  const col = deps.db.collection(COLLECTION);
  const stored = (await col
    .find(
      { sportSlug: "chess", mergedInto: { $exists: false } },
      {
        projection: {
          name: 1,
          slug: 1,
          startDate: 1,
          endDate: 1,
          externalId: 1,
          federationSlug: 1,
          officialName: 1,
          city: 1,
          state: 1,
          level: 1,
          ageGroups: 1,
          documents: 1,
          status: 1,
        },
      }
    )
    .toArray()) as unknown as StoredChessEdition[];
  const takenSlugs = new Set(
    (await col.find({ slug: { $exists: true } }, { projection: { slug: 1 } }).toArray()).map((d) =>
      String(d.slug)
    )
  );

  const plan = planAicfIngest({ rows: page.rows, stored, takenSlugs, now });
  const report: AicfSyncReport = {
    applied: false,
    rowsRead: page.rows.length,
    rejected: page.rejected,
    plan,
    written: { updated: 0, created: 0, failed: [] },
  };
  if (!options.apply) return report;

  // Only rows with a real change are backed up; a bare `lastCheckedAt` stamp is not one.
  const changing = plan.updates.filter((u) => u.changed.length > 0);
  if (options.backup && changing.length > 0) {
    const before = await col.find({ _id: { $in: changing.map((u) => u.id) as never[] } }).toArray();
    await options.backup(before);
  }

  for (const u of plan.updates) {
    try {
      const res = await col.updateOne({ _id: u.id as never }, { $set: u.set });
      if (u.changed.length > 0) report.written.updated += res.modifiedCount;
    } catch (error) {
      report.written.failed.push(
        `update ${u.name}: ${error instanceof Error ? error.message.slice(0, 160) : error}`
      );
    }
  }
  for (const c of plan.creates) {
    try {
      await col.insertOne(c.doc as never);
      report.written.created += 1;
    } catch (error) {
      report.written.failed.push(
        `create ${c.doc.name}: ${error instanceof Error ? error.message.slice(0, 160) : error}`
      );
    }
  }

  report.applied = true;
  if (report.written.updated + report.written.created > 0) options.onWritten?.();
  return report;
}
