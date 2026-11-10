import { User } from "../../client/models/User";
import { Expert } from "../../client/models/ExpertProfile";
import type { ExpertSessionDocument } from "../../client/models/ExpertBooking";
import { WhatsAppConversation } from "../../client/models/WhatsAppConversation";
import { normalizeIndianPhone } from "./WhatsAppNotificationService";
import { sendWhatsAppText, whatsappSendingConfigured } from "./whatsappService";
import { formatIstDateTime } from "./whatsappTemplates";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("whatsappBookingReceipt");

/**
 * The end of a booking made in the WhatsApp chat: the parent pays on PhonePe, comes back to the
 * chat, and is told there that it went through. Without this they were left on a website page
 * that wanted them signed in, and the assistant could only guess whether the payment had landed.
 */

/** The PowerMySport WhatsApp number, as wa.me wants it. Same default as the website's buttons. */
export const whatsappBusinessNumber = (): string =>
  (process.env.WHATSAPP_BUSINESS_NUMBER || "918968582443").replace(/\D/g, "");

/** Where PhonePe sends a parent who paid from WhatsApp: back into the chat. */
export const whatsappChatUrl = (): string => `https://wa.me/${whatsappBusinessNumber()}`;

export function bookingReceiptText(details: {
  expertName: string;
  when: string;
  minutes: number;
  mode: "ONLINE" | "IN_PERSON";
  amount: number;
  reference: string;
}): string {
  return [
    `Payment received: ₹${details.amount}. Your session with ${details.expertName} is booked.`,
    "",
    `When: ${details.when} (Indian time)`,
    `Length: ${details.minutes} minutes, ${details.mode === "IN_PERSON" ? "in person" : "online"}`,
    `Reference: ${details.reference}`,
    "",
    `${details.expertName} will confirm the time and share the joining details. I'll let you know here when they do.`,
  ].join("\n");
}

/**
 * Sends the receipt to the number the parent booked from, and puts it in the chat history so the
 * assistant knows the booking is paid if they ask. The parent wrote minutes ago, so this is inside
 * WhatsApp's 24-hour window and needs no template. Never throws.
 */
export async function sendWhatsAppBookingReceipt(session: ExpertSessionDocument): Promise<void> {
  try {
    if (!whatsappSendingConfigured() || !session.scheduledAt) return;
    const parent = await User.findById(session.userId).select("phone").lean();
    if (!parent?.phone) {
      log.warn("booking receipt not sent: the parent has no phone", { id: String(session._id) });
      return;
    }
    const to = normalizeIndianPhone(parent.phone);
    const expert = await Expert.findById(session.expertId).populate("userId", "name").lean();
    const expertName =
      ((expert?.userId as unknown as { name?: string } | null)?.name ?? "the expert").split(
        " "
      )[0] ?? "the expert";

    const text = bookingReceiptText({
      expertName,
      when: formatIstDateTime(new Date(session.scheduledAt).toISOString()),
      minutes: session.durationMinutes || 60,
      mode: session.mode === "IN_PERSON" ? "IN_PERSON" : "ONLINE",
      amount: session.amount,
      reference: String(session._id).slice(-8).toUpperCase(),
    });
    const sent = await sendWhatsAppText(to, text);
    if (!sent) {
      log.warn("booking receipt NOT sent: Meta refused it", { id: String(session._id) });
      return;
    }

    // Loaded here, not at the top: the assistant's module reaches the booking code through its
    // tools, so a static import would be circular.
    const { hashPhone } = await import("./whatsappAssistantService");
    await WhatsAppConversation.updateOne(
      { phoneHash: hashPhone(to) },
      {
        $push: {
          messages: {
            $each: [
              { role: "assistant", content: `(Booking update) ${text}`, createdAt: new Date() },
            ],
            $slice: -20,
          },
        },
      }
    );
    log.info("booking receipt sent on WhatsApp", { id: String(session._id) });
  } catch (err) {
    log.error("could not send the WhatsApp booking receipt", err);
  }
}
