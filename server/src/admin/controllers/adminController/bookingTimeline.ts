import { Request, Response } from "express";
import { BookingEventService } from "../../../client/services/BookingEventService";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Full audit timeline for one booking or expert session.
 * GET /api/admin/bookings/:subjectId/timeline
 *
 * The subject id is looked up across both BOOKING and EXPERT_SESSION on
 * purpose: support staff paste an id from a URL or an email and shouldn't have
 * to know which of the two systems it belongs to. `subjectType` is returned on
 * each event so the caller can still tell them apart.
 */
export const getBookingTimeline = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const subjectId = String((req.params as Record<string, unknown>).subjectId ?? "");

    if (!subjectId) {
      throw new AppError("subjectId is required", 400);
    }

    const events = await BookingEventService.getTimelineByIdAcrossSubjects(subjectId);

    res.status(200).json({
      success: true,
      message: "Booking timeline retrieved successfully",
      data: events,
    });
  }
);
