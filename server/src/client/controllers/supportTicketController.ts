import { Request, Response } from "express";
import mongoose from "mongoose";
import { SupportTicket } from "../models/SupportTicket";
import { User } from "../models/User";
import {
  buildSupportTicketTeamAlert,
  sendSupportTicketReceivedEmail,
  sendSupportTicketReplyEmail,
  sendSupportTicketStatusEmail,
} from "../../utils/email";
import { recordAuditLog } from "../../admin/services/AuditLogService";
import { draftSupportReply } from "../services/supportReplyDraft";
import { parseReplyAttachments } from "../services/supportAttachments";
import OutboxMessage from "../../shared/models/OutboxMessage";
import { resolveAdminAppUrl } from "../../admin/services/AdminService";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("supportTicket");

const parsePagination = (pageRaw: unknown, limitRaw: unknown) => {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const createSupportTicket = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    await createTicketFromRequest(req, res, {
      requireAuth: true,
      authorId: req.user.id,
    });
  }
);

export const createPublicSupportTicket = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await createTicketFromRequest(req, res, { requireAuth: false });
  }
);

const createTicketFromRequest = async (
  req: Request,
  res: Response,
  options: { requireAuth: boolean; authorId?: string }
): Promise<void> => {
  const {
    subject,
    description,
    category,
    priority,
    initialNote,
    requesterName,
    requesterEmail,
    requesterPhone,
    requesterType,
  }: {
    subject?: string;
    description?: string;
    category?: "BOOKING" | "PAYMENT" | "ACCOUNT" | "TECHNICAL" | "OTHER";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    initialNote?: string;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    requesterType?: "player" | "venue_owner" | "coach" | "academy_owner" | "other";
  } = req.body;

  if (!subject?.trim() || !description?.trim()) {
    throw new AppError("subject and description are required", 400);
  }

  if (!options.requireAuth) {
    if (!requesterName?.trim() || !requesterEmail?.trim()) {
      throw new AppError("name and email are required", 400);
    }
    // The public form is open to anyone and emails a receipt to the address given,
    // so bound what it accepts: a real-looking address and short free text.
    if (
      requesterEmail.trim().length > 254 ||
      !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(requesterEmail.trim())
    ) {
      throw new AppError("Please enter a valid email address", 400);
    }
    if (requesterName.trim().length > 100) {
      throw new AppError("Name must be 100 characters or fewer", 400);
    }
  }
  if (subject.trim().length > 200 || description.trim().length > 5000) {
    throw new AppError("subject or description is too long", 400);
  }

  const notes = initialNote?.trim()
    ? [
        {
          authorType: options.requireAuth ? ("USER" as const) : ("Admin" as const),
          authorId: options.authorId
            ? new mongoose.Types.ObjectId(options.authorId)
            : new mongoose.Types.ObjectId(),
          message: initialNote.trim(),
          createdAt: new Date(),
        },
      ]
    : [];

  const ticket = await SupportTicket.create({
    ...(options.requireAuth && options.authorId
      ? { userId: new mongoose.Types.ObjectId(options.authorId) }
      : {}),
    ...(requesterName?.trim() ? { requesterName: requesterName.trim() } : {}),
    ...(requesterEmail?.trim() ? { requesterEmail: requesterEmail.trim().toLowerCase() } : {}),
    ...(requesterPhone?.trim() ? { requesterPhone: requesterPhone.trim() } : {}),
    ...(requesterType ? { requesterType } : {}),
    subject: subject.trim(),
    description: description.trim(),
    category: category || "OTHER",
    priority: priority || "MEDIUM",
    notes,
    ...(options.authorId ? { lastUpdatedBy: new mongoose.Types.ObjectId(options.authorId) } : {}),
  });

  await queueTeamAlert(ticket);

  // Acknowledge the ticket by email (fire-and-forget). Prefer the explicit
  // requester email; fall back to the authenticated user's account email.
  void (async () => {
    try {
      let toEmail = ticket.requesterEmail;
      let toName = ticket.requesterName;
      if (options.requireAuth && ticket.userId) {
        // A signed-in user's receipt goes to THEIR account address. The request body
        // must not be able to point it at somebody else's mailbox.
        const owner = await User.findById(ticket.userId).select("name email").lean();
        toEmail = owner?.email;
        toName = owner?.name || toName;
      } else if (toEmail) {
        // Anonymous submissions: one automatic receipt per address per hour, so the
        // form cannot be used to repeatedly mail a third party.
        const recentReceipts = await SupportTicket.countDocuments({
          requesterEmail: toEmail,
          userId: { $exists: false },
          createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
          _id: { $ne: ticket._id },
        });
        if (recentReceipts > 0) toEmail = undefined;
      }
      if (toEmail) {
        await sendSupportTicketReceivedEmail({
          name: toName,
          email: toEmail,
          ticketId: String(ticket._id),
          subject: ticket.subject,
          category: ticket.category,
        });
      }
    } catch (error) {
      log.error("Failed to send support ticket received email:", error);
    }
  })();

  res.status(201).json({
    success: true,
    message: "Support ticket created",
    data: ticket,
  });
};

/**
 * Who hears about new tickets: SUPPORT_NOTIFY_EMAIL (comma-separated for several),
 * else the address mail is sent from, which is the team inbox.
 */
const teamAlertRecipients = (): string | undefined =>
  process.env.SUPPORT_NOTIFY_EMAIL?.trim() ||
  process.env.EMAIL_FROM?.trim() ||
  process.env.EMAIL_USER?.trim() ||
  undefined;

/**
 * Queues the "new support ticket" email to the team on the outbox, where the worker
 * sends and retries it. Queuing never fails the requester's submit: the ticket is
 * already saved, and a lost alert is logged rather than shown to them as an error.
 */
const queueTeamAlert = async (ticket: InstanceType<typeof SupportTicket>): Promise<void> => {
  const to = teamAlertRecipients();
  if (!to) {
    log.warn("No SUPPORT_NOTIFY_EMAIL or EMAIL_FROM set; new-ticket alert not sent");
    return;
  }
  try {
    let name = ticket.requesterName;
    let email = ticket.requesterEmail;
    let phone = ticket.requesterPhone;
    if (ticket.userId) {
      const owner = await User.findById(ticket.userId).select("name email phone").lean();
      name = owner?.name || name;
      email = owner?.email || email;
      phone = (owner as { phone?: string } | null)?.phone || phone;
    }
    const alert = buildSupportTicketTeamAlert({
      ticketId: String(ticket._id),
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      requesterName: name,
      requesterEmail: email,
      requesterPhone: phone,
      requesterType: ticket.requesterType,
      signedIn: Boolean(ticket.userId),
      adminUrl: resolveAdminAppUrl(),
    });
    await OutboxMessage.create({ type: "send_email", payload: { to, ...alert } });
  } catch (error) {
    log.error("Failed to queue the new support ticket alert:", error);
  }
};

export const getMySupportTickets = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);

    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.user.id),
    };

    if (status) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved",
      data: tickets,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

export const getSupportTicketsForAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate("userId", "name email role")
        .populate("assignedAdminId", "name email role")
        .sort({ priority: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved",
      data: tickets,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

export const updateSupportTicketByAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const ticketId = (req.params as Record<string, unknown>).ticketId as string;
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new AppError("Invalid ticket id", 400);
    }

    const {
      status,
      priority,
      assignedAdminId,
      note,
    }: {
      status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assignedAdminId?: string | null;
      note?: string;
    } = req.body;

    const update: Record<string, unknown> = {
      lastUpdatedBy: new mongoose.Types.ObjectId(req.user.id),
    };

    if (status) {
      update.status = status;
    }

    if (priority) {
      update.priority = priority;
    }

    if (assignedAdminId === null) {
      update.assignedAdminId = null;
    } else if (
      typeof assignedAdminId === "string" &&
      mongoose.Types.ObjectId.isValid(assignedAdminId)
    ) {
      update.assignedAdminId = new mongoose.Types.ObjectId(assignedAdminId);
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        $set: update,
        ...(note?.trim()
          ? {
              $push: {
                notes: {
                  authorType: "Admin",
                  authorId: new mongoose.Types.ObjectId(req.user.id),
                  message: note.trim(),
                  createdAt: new Date(),
                },
              },
            }
          : {}),
      },
      { new: true }
    )
      .populate("userId", "name email role")
      .populate("assignedAdminId", "name email role");

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    // Notify the requester when the status changes (fire-and-forget).
    if (status) {
      const populatedUser = ticket.userId as unknown as {
        name?: string;
        email?: string;
      } | null;
      const toEmail = ticket.requesterEmail || populatedUser?.email;
      const toName = ticket.requesterName || populatedUser?.name;
      if (toEmail) {
        sendSupportTicketStatusEmail({
          name: toName,
          email: toEmail,
          ticketId: String(ticket._id),
          subject: ticket.subject,
          status,
          note: note?.trim() || undefined,
        }).catch((error) => log.error("Failed to send support ticket status email:", error));
      }
    }

    res.status(200).json({
      success: true,
      message: "Support ticket updated",
      data: ticket,
    });
  }
);

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const REPLY_MAX_LENGTH = 5000;

/**
 * An admin's written answer to a ticket, emailed to the requester and kept on the
 * ticket as a note with `emailedTo`/`emailedAt`.
 *
 * The email is sent first and the note saved only once it has gone, so the panel
 * never shows a reply the requester did not get. A signed-in requester is mailed at
 * their account address, the same rule as the receipt: the address typed into the
 * form is only used for tickets with no account behind them.
 *
 * A reply to an OPEN ticket moves it to IN_PROGRESS unless the admin picks a status.
 */
export const replyToSupportTicketByAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const ticketId = (req.params as Record<string, unknown>).ticketId as string;
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new AppError("Invalid ticket id", 400);
    }

    const {
      message,
      status,
      attachments,
    }: { message?: unknown; status?: unknown; attachments?: unknown } = req.body ?? {};
    const text = typeof message === "string" ? message.trim() : "";
    if (!text) {
      throw new AppError("Write a reply before sending", 400);
    }
    if (text.length > REPLY_MAX_LENGTH) {
      throw new AppError(`A reply can be at most ${REPLY_MAX_LENGTH} characters`, 400);
    }
    if (status !== undefined && !TICKET_STATUSES.includes(status as never)) {
      throw new AppError("Invalid status", 400);
    }
    const files = parseReplyAttachments(attachments);

    const ticket = await SupportTicket.findById(ticketId).populate("userId", "name email");
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const owner = ticket.userId as unknown as { name?: string; email?: string } | null;
    const toEmail = ticket.userId ? owner?.email : ticket.requesterEmail;
    const toName = owner?.name || ticket.requesterName;
    if (!toEmail) {
      throw new AppError("This ticket has no email address to reply to", 400);
    }

    try {
      await sendSupportTicketReplyEmail({
        name: toName,
        email: toEmail,
        ticketId: String(ticket._id),
        subject: ticket.subject,
        message: text,
        originalMessage: ticket.description,
        attachments: files,
      });
    } catch (error) {
      log.error("Failed to send support ticket reply:", error);
      throw new AppError(
        "The email could not be sent, so the reply was not saved. Try again.",
        502
      );
    }

    const nextStatus =
      (status as (typeof TICKET_STATUSES)[number] | undefined) ??
      (ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);
    const now = new Date();

    const updated = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        $set: {
          status: nextStatus,
          lastUpdatedBy: new mongoose.Types.ObjectId(req.user.id),
        },
        $push: {
          notes: {
            authorType: "Admin",
            authorId: new mongoose.Types.ObjectId(req.user.id),
            message: text,
            emailedTo: toEmail,
            emailedAt: now,
            ...(files.length
              ? {
                  attachments: files.map((file) => ({
                    filename: file.filename,
                    contentType: file.contentType,
                    size: file.content.length,
                  })),
                }
              : {}),
            createdAt: now,
          },
        },
      },
      { new: true }
    )
      .populate("userId", "name email role")
      .populate("assignedAdminId", "name email role");

    if (req.user.email) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: "support_ticket.reply",
        targetType: "SupportTicket",
        targetId: ticketId,
        metadata: {
          emailedTo: toEmail,
          status: nextStatus,
          attachments: files.map((file) => file.filename),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Reply sent to ${toEmail}`,
      data: updated,
    });
  }
);

const DRAFT_INSTRUCTIONS_MAX_LENGTH = 500;

/**
 * An AI first draft for the reply box. Returns text only: it sends nothing and
 * does not touch the ticket, so the admin always reads and edits before sending.
 * Optional `instructions` steer it ("say the PDF is coming next week").
 */
export const draftSupportTicketReplyByAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ticketId = (req.params as Record<string, unknown>).ticketId as string;
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      throw new AppError("Invalid ticket id", 400);
    }

    const { instructions }: { instructions?: unknown } = req.body ?? {};
    const hint = typeof instructions === "string" ? instructions.trim() : "";
    if (hint.length > DRAFT_INSTRUCTIONS_MAX_LENGTH) {
      throw new AppError(
        `Instructions can be at most ${DRAFT_INSTRUCTIONS_MAX_LENGTH} characters`,
        400
      );
    }

    const ticket = await SupportTicket.findById(ticketId)
      .select("subject category description status notes")
      .lean();
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    let draft: string;
    try {
      draft = await draftSupportReply(
        {
          subject: ticket.subject,
          category: ticket.category,
          description: ticket.description,
          status: ticket.status,
          notes: ticket.notes ?? [],
        },
        hint || undefined
      );
    } catch (error) {
      log.error("Failed to draft a support reply:", error);
      throw new AppError(
        "The AI could not write a draft right now. Try again or write it yourself.",
        503
      );
    }

    res.status(200).json({ success: true, message: "Draft ready", data: { draft } });
  }
);
