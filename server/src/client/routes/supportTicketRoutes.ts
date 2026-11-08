import express, { Router } from "express";
import {
  createSupportTicket,
  createPublicSupportTicket,
  getMySupportTickets,
  getSupportTicketsForAdmin,
  replyToSupportTicketByAdmin,
  draftSupportTicketReplyByAdmin,
  updateSupportTicketByAdmin,
} from "../controllers/supportTicketController";
import { publicSupportTicketRateLimiter } from "../../middleware/rateLimit";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.post("/public", publicSupportTicketRateLimiter, createPublicSupportTicket);
router.post("/", authMiddleware, createSupportTicket);
router.get("/my", authMiddleware, getMySupportTickets);

router.get(
  "/admin",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:view"),
  getSupportTicketsForAdmin
);
router.patch(
  "/admin/:ticketId",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:manage"),
  updateSupportTicketByAdmin
);
/** The global JSON parser skips this path (app.ts): the route parses it after auth. */
export const SUPPORT_REPLY_PATH = /^\/api\/support-tickets\/admin\/[^/]+\/reply\/?$/;

router.post(
  "/admin/:ticketId/reply",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:manage"),
  // Attachments arrive as base64: up to 10 MB of files, about 13.4 MB encoded.
  express.json({ limit: "15mb" }),
  replyToSupportTicketByAdmin
);
router.post(
  "/admin/:ticketId/draft-reply",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:manage"),
  draftSupportTicketReplyByAdmin
);

export default router;
