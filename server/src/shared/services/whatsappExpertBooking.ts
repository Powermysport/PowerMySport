import { ExpertSession } from "../../client/models/ExpertBooking";
import { Player } from "../../client/models/Player";
import { getExpertOpenSlots } from "../../client/services/ExpertsService/discovery";
import { initiateExpertSession } from "../../client/services/ExpertsService/sessionLifecycle";
import { log as __rootLog } from "../../utils/logger";
import type { ChatToolContext } from "./chatToolsService";
import { firstName } from "./parentContext";
import { expertProfileUrl, findExpert } from "./whatsappExperts";
import {
  registerPendingExecutor,
  storePendingAction,
  type PendingExecutor,
} from "./whatsappPendingAction";
import { formatIstDateTime } from "./whatsappTemplates";

const log = __rootLog.child("whatsappExpertBooking");

/**
 * Booking an expert from WhatsApp, for a parent whose number is on an account.
 *
 * Nothing new about the booking itself: it is the website's own `initiateExpertSession`, so the
 * slot lock, the 15-minute hold, the PhonePe payment and the confirmation messages are exactly the
 * website's. What is WhatsApp's is getting there: the parent picks a time from a tappable list,
 * replies YES (the shared confirm step, which checks their own words), and gets a pay button.
 * The slot is taken only when the payment goes through, as on the website.
 *
 * Switched on with WHATSAPP_EXPERT_BOOKING=on. A parent with no account is sent the profile link.
 */

export const BOOKING_KIND = "expert_booking";
export const bookingToolEnabled = (): boolean => process.env.WHATSAPP_EXPERT_BOOKING === "on";

/** Holds a parent can start from WhatsApp in a day: each one blocks a slot for 15 minutes. */
export const MAX_BOOKING_STARTS_PER_DAY = 3;
const DAY_MS = 24 * 3600 * 1000;
/** Rows in the time picker: WhatsApp allows ten in a list. */
const MAX_SLOT_ROWS = 10;
const HOLD_MINUTES = 15;

/** A tapped time in the picker: `slot_<expertId>_<start in epoch minutes>`. */
const SLOT_ID = /^slot_([a-f0-9]{24})_(\d{6,10})$/i;

export function slotRowId(expertId: string, startIso: string): string {
  return `slot_${expertId}_${Math.round(new Date(startIso).getTime() / 60_000)}`;
}

/** What a tapped time means, as a sentence the assistant can act on. Null for any other tap. */
export function slotTapText(replyId: string | null | undefined): string | null {
  const match = replyId ? SLOT_ID.exec(replyId) : null;
  if (!match) return null;
  const start = new Date(Number(match[2]) * 60_000).toISOString();
  return `I'd like to book the ${formatIstDateTime(start)} session with expert ${match[1]}.`;
}

const NOT_ON = {
  ready: false,
  reason: "not_switched_on",
  instruction:
    "Booking from WhatsApp is not switched on yet. Give the expert's profile link on its own line and say booking and payment happen there.",
};

const NOT_LINKED = (profileUrl?: string) => ({
  ready: false,
  reason: "number_not_linked",
  instruction: `This WhatsApp number is not tied to a PowerMySport account, so booking cannot start here. Say so, and that they can book${
    profileUrl ? ` on the expert's page: ${profileUrl}` : " on https://powermysport.com/experts"
  } after signing in.`,
});

/** "15 Nov 2026, 10:00 AM" and "15 nov 2026 10:00am" are the same time. */
const squash = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Every session this parent started in the last day, on the website too: a hold is a hold. */
async function startsInTheLastDay(userId: string, now: Date): Promise<number> {
  return ExpertSession.countDocuments({
    userId,
    createdAt: { $gte: new Date(now.getTime() - DAY_MS) },
  });
}

/**
 * Step one. With no time chosen, it returns the open times and asks the WhatsApp service to show
 * them as a tappable list. With a time, it checks it is still open and sets up the booking for a YES.
 */
export async function prepareExpertBooking(
  context: ChatToolContext | undefined,
  args: Record<string, unknown>,
  now: Date = new Date()
): Promise<unknown> {
  const query = typeof args.expert === "string" ? args.expert.trim().slice(0, 100) : "";
  if (!query) {
    return {
      ready: false,
      reason: "which_expert",
      instruction:
        "Ask which expert they want to book, by name, or offer to search by sport or city.",
    };
  }
  const found = await findExpert(query, typeof args.sport === "string" ? args.sport : undefined);
  if ("reply" in found) return found.reply;
  const { expert } = found;
  const profileUrl = expertProfileUrl(expert.id);

  if (!bookingToolEnabled()) return { ...NOT_ON, profileUrl };
  if (!context?.userId || !context.phoneHash) return NOT_LINKED(profileUrl);
  const { userId, phoneHash } = context;

  const slots = (await getExpertOpenSlots(expert.id).catch(() => [])).filter(
    (slot) => new Date(slot.start).getTime() > now.getTime()
  );
  if (slots.length === 0) {
    return {
      ready: false,
      reason: "no_open_times",
      profileUrl,
      instruction: `${expert.name} has no open times in the next two weeks. Say so, give the profile link on its own line, and offer to look for another expert.`,
    };
  }

  const wanted = typeof args.slot === "string" ? args.slot.trim() : "";
  const slot = wanted
    ? slots.find(
        (s) =>
          s.start === wanted ||
          new Date(s.start).getTime() === new Date(wanted).getTime() ||
          squash(formatIstDateTime(s.start)) === squash(wanted)
      )
    : undefined;

  if (!slot) {
    // Show the times to pick from. The list goes out under the reply as its own message.
    const rows = slots.slice(0, MAX_SLOT_ROWS).map((s) => ({
      id: slotRowId(expert.id, s.start),
      title: formatIstDateTime(s.start).slice(0, 24),
    }));
    if (context.outbound) context.outbound.slotPicker = { expertName: expert.name, rows };
    return {
      ready: false,
      reason: wanted ? "time_not_open" : "pick_a_time",
      expert: expert.name,
      feePerSessionRupees: expert.sessionFee,
      sessionMinutes: expert.sessionDurationMinutes,
      instruction: `${
        wanted ? "That time is not open (it may have just been taken). " : ""
      }Say in one or two lines that they can pick a time with ${expert.name} from the list that appears under your message (₹${expert.sessionFee} for ${expert.sessionDurationMinutes} minutes). Do not list the times yourself. Nothing is booked yet.`,
    };
  }

  if ((await startsInTheLastDay(userId, now)) >= MAX_BOOKING_STARTS_PER_DAY) {
    return {
      ready: false,
      reason: "daily_limit",
      profileUrl,
      instruction: `They have started ${MAX_BOOKING_STARTS_PER_DAY} bookings in the last day, which is the most from WhatsApp. Say so, and that they can book on the profile page: ${profileUrl}`,
    };
  }

  // The child, if it is clear who it is for. Booking does not need one, so it never asks.
  const players = await Player.find({ userId }).select("name").sort({ createdAt: 1 }).lean();
  const childName = typeof args.childName === "string" ? args.childName.trim().toLowerCase() : "";
  const child = childName
    ? players.find((p) => firstName(p.name, "").toLowerCase() === childName)
    : players.length === 1
      ? players[0]
      : undefined;

  const mode =
    expert.sessionMode === "BOTH"
      ? args.mode === "IN_PERSON"
        ? "IN_PERSON"
        : "ONLINE"
      : expert.sessionMode;
  const when = formatIstDateTime(slot.start);

  await storePendingAction(
    phoneHash,
    BOOKING_KIND,
    {
      expertId: expert.id,
      expertName: expert.name,
      scheduledAt: slot.start,
      fee: expert.sessionFee,
      mode,
      ...(child ? { playerId: String(child._id), childName: firstName(child.name, "") } : {}),
    },
    now
  );

  return {
    ready: true,
    expert: expert.name,
    when,
    feePerSessionRupees: expert.sessionFee,
    sessionMinutes: expert.sessionDurationMinutes,
    mode: mode === "IN_PERSON" ? "in person" : "online",
    ...(child ? { forChild: firstName(child.name, "") } : {}),
    instruction: `Say back the booking in two or three short lines: ${expert.name}, ${when} (Indian time), ${expert.sessionDurationMinutes} minutes ${
      mode === "IN_PERSON" ? "in person" : "online"
    }, ₹${expert.sessionFee}${child ? `, for ${firstName(child.name, "")}` : ""}. Say that if they reply YES you will send a payment link, the time is held for ${HOLD_MINUTES} minutes while they pay, and it is booked once the payment goes through. Nothing is booked yet. Do NOT call confirm_pending_action until they reply.`,
  };
}

interface BookingPayload {
  expertId: string;
  expertName: string;
  scheduledAt: string;
  fee: number;
  mode: "ONLINE" | "IN_PERSON";
  playerId?: string;
  childName?: string;
}

/** Step two, after the parent's YES: hold the slot and start the payment, as the website does. */
const executeBooking: PendingExecutor["execute"] = async (pending, { userId, now }) => {
  const p = pending.payload as unknown as BookingPayload;
  const profileUrl = expertProfileUrl(p.expertId);

  if (new Date(p.scheduledAt).getTime() <= now.getTime()) {
    return {
      done: false,
      retry: false,
      reply: {
        reason: "time_passed",
        instruction: "That time has passed. Say so and offer to pick another time.",
      },
    };
  }
  if ((await startsInTheLastDay(userId, now)) >= MAX_BOOKING_STARTS_PER_DAY) {
    return {
      done: false,
      retry: false,
      reply: {
        reason: "daily_limit",
        instruction: `They have started the most bookings allowed from WhatsApp today. Say so, and that they can book on ${profileUrl}`,
      },
    };
  }

  try {
    const { sessionId, redirectUrl } = await initiateExpertSession({
      expertId: p.expertId,
      userId,
      scheduledAt: p.scheduledAt,
      mode: p.mode,
      channel: "WHATSAPP",
      ...(p.playerId ? { playerId: p.playerId } : {}),
    });
    log.info("expert session started from WhatsApp", { sessionId });
    return {
      done: true,
      reply: {
        held: true,
        payment: { url: redirectUrl, label: `Pay ₹${p.fee}` },
        instruction: `The time with ${p.expertName} on ${formatIstDateTime(
          p.scheduledAt
        )} is held for ${HOLD_MINUTES} minutes. Say so in one line, and that the payment button appears under your message. It is booked only once the payment goes through, and they will get a confirmation. Do not write the payment link yourself.`,
      },
    };
  } catch (err) {
    // The website's own refusals (slot just taken, expert unavailable) are about this time, so a
    // second YES will not help: say so and offer another time.
    const message = err instanceof Error ? err.message : "";
    log.warn("could not start an expert session from WhatsApp", { reason: message });
    return {
      done: false,
      retry: false,
      reply: {
        reason: "not_held",
        instruction: `That time could not be held${
          message ? ` (${message.slice(0, 120)})` : ""
        }. Say so plainly, nothing was charged, and offer to pick another time or book on ${profileUrl}`,
      },
    };
  }
};

registerPendingExecutor(BOOKING_KIND, {
  enabled: bookingToolEnabled,
  notEnabledReply: NOT_ON,
  execute: executeBooking,
});
