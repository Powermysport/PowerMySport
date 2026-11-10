import type { WhatsAppEnquiryDocument } from "../../client/models/WhatsAppEnquiry";
import OutboxMessage from "../models/OutboxMessage";
import { resolveAdminAppUrl } from "../../admin/services/AdminService";
import { detailTable, escapeHtml, renderEmailShell } from "../../utils/email/shared";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappTeamAlert");

/**
 * Telling the team that a WhatsApp parent is waiting for them.
 *
 * Same recipients as the new-support-ticket alert: SUPPORT_NOTIFY_EMAIL (comma-separated for
 * several), else the address mail is sent from. The email carries the child's details and the
 * reference but never the number: that stays behind the audit-logged "Show number" in the panel.
 */

const ASSISTANCE_LABEL: Record<string, string> = {
  coach: "a coach or academy",
  expert: "a sports expert",
  tournaments: "help with tournaments",
  team: "a person to talk to",
  other: "help from the team",
};

const recipients = (): string | undefined =>
  process.env.SUPPORT_NOTIFY_EMAIL?.trim() ||
  process.env.EMAIL_FROM?.trim() ||
  process.env.EMAIL_USER?.trim() ||
  undefined;

export function buildFollowUpAlert(
  enquiry: Pick<
    WhatsAppEnquiryDocument,
    | "reference"
    | "question"
    | "childAge"
    | "sport"
    | "level"
    | "city"
    | "objective"
    | "assistance"
    | "followUpSummary"
  >,
  adminUrl: string
): { subject: string; html: string } {
  const wants =
    enquiry.assistance
      .filter((a) => a !== "team" || enquiry.assistance.length === 1)
      .map((a) => ASSISTANCE_LABEL[a] ?? a)
      .join(", ") || "help from the team";
  const value = (v: string | number | undefined) =>
    v === undefined || v === "" ? "Not given" : escapeHtml(String(v));
  const html = renderEmailShell({
    heading: "A WhatsApp parent is waiting for the team",
    intro: `A parent on the WhatsApp assistant asked for ${escapeHtml(wants)}.`,
    bodyHtml:
      detailTable([
        ["Reference", escapeHtml(enquiry.reference)],
        ["Child's age", value(enquiry.childAge)],
        ["Sport", value(enquiry.sport)],
        ["Level", value(enquiry.level)],
        ["City / area", value(enquiry.city)],
        ["Goal", value(enquiry.objective)],
      ]) +
      (enquiry.followUpSummary
        ? `<p style="margin:16px 0 6px;color:#64748b;font-size:13px;">What they want:</p>` +
          `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #e2e8f0;color:#334155;">${escapeHtml(enquiry.followUpSummary)}</blockquote>`
        : "") +
      `<p style="margin:16px 0 6px;color:#64748b;font-size:13px;">First message:</p>` +
      `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #e2e8f0;color:#334155;">${escapeHtml(enquiry.question)}</blockquote>`,
    ctaLabel: "Open WhatsApp enquiries",
    ctaUrl: `${adminUrl}/admin/whatsapp-pilot`,
    footer:
      "Reply from the enquiry in the admin panel: it goes out from the PowerMySport WhatsApp number and is kept with the conversation.",
  });
  return {
    subject: `WhatsApp ${enquiry.reference}: parent wants ${wants}`,
    html,
  };
}

/** Queues the alert on the outbox, which sends and retries it. Never throws. */
export async function queueFollowUpAlert(enquiry: WhatsAppEnquiryDocument): Promise<void> {
  const to = recipients();
  if (!to) {
    log.warn("No SUPPORT_NOTIFY_EMAIL or EMAIL_FROM set; WhatsApp follow-up alert not sent");
    return;
  }
  try {
    const alert = buildFollowUpAlert(enquiry, resolveAdminAppUrl());
    await OutboxMessage.create({ type: "send_email", payload: { to, ...alert } });
  } catch (err) {
    log.error("Failed to queue the WhatsApp follow-up alert", err);
  }
}

/** The parent answered a message the team sent. */
export function buildParentReplyAlert(
  enquiry: Pick<WhatsAppEnquiryDocument, "reference" | "teamMessages">,
  reply: string,
  adminUrl: string
): { subject: string; html: string } {
  const last = enquiry.teamMessages.at(-1)?.text;
  const quote = (text: string) =>
    `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #e2e8f0;color:#334155;">${escapeHtml(text)}</blockquote>`;
  const html = renderEmailShell({
    heading: "A WhatsApp parent replied to the team",
    intro: `The parent on ${escapeHtml(enquiry.reference)} answered your message. The assistant also replied to them, but only the team can act on it.`,
    bodyHtml:
      (last
        ? `<p style="margin:0 0 6px;color:#64748b;font-size:13px;">The team wrote:</p>${quote(last)}`
        : "") +
      `<p style="margin:16px 0 6px;color:#64748b;font-size:13px;">They replied:</p>${quote(reply)}`,
    ctaLabel: "Open WhatsApp enquiries",
    ctaUrl: `${adminUrl}/admin/whatsapp-pilot`,
    footer: "The enquiry is back to Waiting. Reply from it in the admin panel.",
  });
  return { subject: `WhatsApp ${enquiry.reference}: the parent replied`, html };
}

export async function queueParentReplyAlert(
  enquiry: WhatsAppEnquiryDocument,
  reply: string
): Promise<void> {
  const to = recipients();
  if (!to) {
    log.warn("No SUPPORT_NOTIFY_EMAIL or EMAIL_FROM set; WhatsApp parent-reply alert not sent");
    return;
  }
  try {
    const alert = buildParentReplyAlert(enquiry, reply, resolveAdminAppUrl());
    await OutboxMessage.create({ type: "send_email", payload: { to, ...alert } });
  } catch (err) {
    log.error("Failed to queue the WhatsApp parent-reply alert", err);
  }
}
