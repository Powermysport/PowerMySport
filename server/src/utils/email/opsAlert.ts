import OutboxMessage from "../../shared/models/OutboxMessage";
import { log as __rootLog } from "../logger";
import { escapeHtml, renderEmailShell } from "./shared";

const log = __rootLog.child("opsAlert");

/**
 * Who hears about a background job that has stopped working: OPS_ALERT_EMAIL
 * (comma-separated for several), else the support alert address, else the
 * address mail is sent from, which is the team inbox.
 */
export const opsAlertRecipients = (): string | undefined =>
  process.env.OPS_ALERT_EMAIL?.trim() ||
  process.env.SUPPORT_NOTIFY_EMAIL?.trim() ||
  process.env.EMAIL_FROM?.trim() ||
  process.env.EMAIL_USER?.trim() ||
  undefined;

export interface OpsAlert {
  subject: string;
  heading: string;
  /** Plain-text paragraphs; escaped here. */
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}

/**
 * Queues an email to the team about a job that needs a person, on the outbox so
 * the worker sends and retries it. Never throws: an alert that cannot be queued
 * is logged, and the job that raised it carries on.
 *
 * Exists because log lines alone were not enough. The AITA ranking import logged
 * a STALE error every day for seven weeks in October 2026 and nobody saw it.
 */
export async function queueOpsAlert(alert: OpsAlert): Promise<void> {
  const to = opsAlertRecipients();
  if (!to) {
    log.warn(`No alert address set; not emailed: ${alert.subject}`);
    return;
  }
  try {
    const html = renderEmailShell({
      heading: escapeHtml(alert.heading),
      bodyHtml: alert.paragraphs
        .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p)}</p>`)
        .join(""),
      ...(alert.ctaLabel && alert.ctaUrl ? { ctaLabel: alert.ctaLabel, ctaUrl: alert.ctaUrl } : {}),
      footer: "Sent automatically by a PowerMySport background job.",
    });
    await OutboxMessage.create({
      type: "send_email",
      payload: { to, subject: `[PowerMySport alert] ${alert.subject}`, html },
    });
  } catch (error) {
    log.error(`Failed to queue alert "${alert.subject}":`, error);
  }
}
