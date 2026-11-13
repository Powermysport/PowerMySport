import cron, { ScheduledTask } from "node-cron";
import mongoose from "mongoose";

import { syncAicfCalendar } from "../shared/services/aicf/AicfCalendarSyncService";
import { revalidateTournamentEditions } from "../admin/services/ClientCacheRevalidationService";
import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("aicfCalendar");

/**
 * Daily sweep of AICF's "All Events" page into the stored chess editions (see
 * AicfCalendarSyncService.ts). 05:15 IST, one page request.
 *
 * Daily rather than twice a week like AITA's: it is a single request, and chess
 * organisers register events with AICF only weeks ahead, so a week's delay would
 * miss a real share of a short entry window.
 *
 * Off unless this is the deployed server, exactly like the AITA calendar sweep
 * (utils/aitaCalendarScheduler.ts explains why: one database, and it is
 * production). `AICF_CALENDAR_CRON=on` runs it elsewhere on purpose;
 * `AICF_CALENDAR_CRON_DISABLED=true` turns it off even in production.
 */
const cronExpression = process.env.AICF_CALENDAR_CRON_SCHEDULE || "15 5 * * *";

let running = false;
let consecutiveFailures = 0;

export async function runAicfCalendarSweep(): Promise<void> {
  if (running) {
    log.warn("Skipping the AICF sweep: one is already running");
    return;
  }
  running = true;
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("the database connection is not open");

    const report = await syncAicfCalendar(
      { db },
      { apply: true, onWritten: revalidateTournamentEditions }
    );
    consecutiveFailures = 0;

    const { updated, created, failed } = report.written;
    log.info(
      `AICF calendar sweep: ${report.rowsRead} rows read, ${report.rejected.length} rejected; ` +
        `${report.plan.updates.length} matched (${updated} changed), ${created} created, ` +
        `${report.plan.skipped.length} skipped, ${failed.length} failed; ` +
        `${report.plan.missing.length} stored events no longer listed, ` +
        `${report.plan.possibleDuplicates.length} possible duplicates stored`
    );
    for (const r of report.rejected)
      log.warn(`AICF calendar: rejected [${r.eventCode}] ${r.name}: ${r.reason}`);
    for (const s of report.plan.skipped)
      log.warn(`AICF calendar: skipped [${s.eventCode}] ${s.name}: ${s.reason}`);
    for (const m of report.plan.missing)
      log.warn(`AICF calendar: no longer listed [${m.externalId}] ${m.name}`);
    for (const f of failed) log.error(`AICF calendar: ${f}`);
  } catch (error) {
    consecutiveFailures += 1;
    log.error(
      `AICF calendar sweep failed${consecutiveFailures > 1 ? ` (${consecutiveFailures} in a row)` : ""}; ` +
        `nothing was written. Check https://aicf.in/all-events/ before assuming a code fault. ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    running = false;
  }
}

export function initializeAicfCalendarScheduler(): ScheduledTask | null {
  const wanted = process.env.NODE_ENV === "production" || process.env.AICF_CALENDAR_CRON === "on";
  if (!wanted || process.env.AICF_CALENDAR_CRON_DISABLED === "true") {
    bootFact("jobs", "aicf-calendar off");
    return null;
  }
  const job = cron.schedule(cronExpression, () => void runAicfCalendarSweep(), {
    timezone: "Asia/Kolkata",
  });
  bootFact("jobs", `aicf-calendar ${cronExpression}`);
  return job;
}
