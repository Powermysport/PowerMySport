"use client";

import { LifecycleBadge } from "@/modules/shared/ui/LifecycleBadge";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { statsApi } from "@/modules/analytics/services/stats";
import { adminApi } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import { Venue } from "@/types";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { Panel } from "@/modules/shared/ui/Panel";
import { ArrowLeft, Image as ImageIcon, Pencil, Star, X } from "lucide-react";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import { useConfirm } from "@/modules/shared/ui/useConfirm";
import { usePrompt } from "@/modules/shared/ui/usePrompt";
import type { OnboardingVenue } from "@/modules/onboarding/types/onboarding";

interface VenueEditForm {
  name: string;
  description: string;
  pricePerHour: number;
  sports: string;
  amenities: string;
  allowExternalCoaches: boolean;
}

export default function AdminVenueDetailPage() {
  const params = useParams();
  const venueId = params.id as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<VenueEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [confirmAction, confirmDialog] = useConfirm();
  const [prompt, promptDialog] = usePrompt();
  // Photos and signed document links come from the onboarding review endpoint,
  // and are only needed while a decision is still open.
  const [review, setReview] = useState<OnboardingVenue | null>(null);

  const fetchVenue = async () => {
    try {
      setLoading(true);
      const response = await statsApi.getVenueById(venueId);
      if (response.success && response.data) {
        setVenue(response.data);
      } else {
        setError(response.message || "Failed to load venue details");
      }
    } catch (err) {
      console.error("Error fetching venue:", err);
      setError("Failed to load venue details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!venueId) return;
    fetchVenue();
  }, [venueId]);

  const needsDecision = Boolean(venue && venue.approvalStatus !== "APPROVED");
  useEffect(() => {
    if (!needsDecision) return;
    let active = true;
    onboardingApi
      .getVenueDetailsForReview(venueId)
      .then((response) => {
        if (active && response.success && response.data) setReview(response.data);
      })
      .catch(() => {
        // The decision panel still works without it; only the extra material is missing.
      });
    return () => {
      active = false;
    };
  }, [needsDecision, venueId]);

  const openEdit = () => {
    if (!venue) return;
    setEditForm({
      name: venue.name,
      description: venue.description || "",
      pricePerHour: venue.pricePerHour,
      sports: (venue.sports || []).join(", "),
      amenities: (venue.amenities || []).join(", "),
      allowExternalCoaches: venue.allowExternalCoaches,
    });
    setIsEditing(true);
  };

  const closeEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const response = await adminApi.updateVenue(venueId, {
        name: editForm.name,
        description: editForm.description,
        pricePerHour: editForm.pricePerHour,
        sports: editForm.sports
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        amenities: editForm.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allowExternalCoaches: editForm.allowExternalCoaches,
      });
      if (response.success) {
        toast.success("Venue updated.");
        closeEdit();
        await fetchVenue();
      } else {
        toast.error(response.message || "Failed to update venue.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update venue.");
    } finally {
      setSaving(false);
    }
  };

  // The decision routes (not a plain approvalStatus edit) are what notify the
  // owner and record the reason, so the review queue sends venues here.
  const noteLength = (value: string) =>
    value.trim().length < 5
      ? "Write at least 5 characters."
      : value.trim().length > 500
        ? "Keep it under 500 characters."
        : null;

  const decide = async (kind: "APPROVE" | "REVIEW" | "REJECT") => {
    if (!venue) return;
    let note: string | null = null;
    if (kind === "APPROVE") {
      const ok = await confirmAction({
        title: `Approve "${venue.name}"?`,
        description: "The venue goes live immediately.",
        confirmLabel: "Approve venue",
      });
      if (!ok) return;
    } else {
      note = await prompt(
        kind === "REJECT"
          ? {
              title: "Why reject this venue?",
              description: "The owner sees this reason in their notification.",
              label: "Reason",
              confirmLabel: "Reject venue",
              multiline: true,
              validate: noteLength,
            }
          : {
              title: "What should the owner change?",
              description: "The owner is notified and the venue moves to review.",
              label: "Notes for the owner",
              confirmLabel: "Ask for changes",
              multiline: true,
              validate: noteLength,
            }
      );
      if (!note) return;
    }

    setDeciding(true);
    try {
      const response =
        kind === "APPROVE"
          ? await onboardingApi.approveVenue(venueId)
          : kind === "REJECT"
            ? await onboardingApi.rejectVenue(venueId, note as string)
            : await onboardingApi.markVenueForReview(venueId, note as string);
      if (!response.success) throw new Error(response.message || "The decision didn't save.");
      toast.success(
        kind === "APPROVE"
          ? "Venue approved."
          : kind === "REJECT"
            ? "Venue rejected. The owner has been notified."
            : "Changes requested. The owner has been notified."
      );
      await fetchVenue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The decision didn't save.");
    } finally {
      setDeciding(false);
    }
  };

  const header = (
    <AdminPageHeader
      badge="Commerce"
      title={venue?.name || "Venue"}
      subtitle={venue?.address || (loading ? "Loading venue" : "Venue details")}
      action={
        venue ? (
          <div className="flex items-center gap-3">
            <LifecycleBadge kind="venue" source={venue} />
            <button type="button" onClick={openEdit} className={btn("outline")}>
              <Pencil size={14} aria-hidden /> Edit venue
            </button>
          </div>
        ) : undefined
      }
    />
  );

  const back = (
    <Link
      href="/admin/venues"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft size={16} aria-hidden />
      Venues
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock rows={8} label="Loading venue" />
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="space-y-6">
        {header}
        {back}
        <ErrorNotice message={error || "We couldn't find this venue."} onRetry={fetchVenue} />
      </div>
    );
  }

  const imageUrl = venue.coverPhotoUrl || (venue.images && venue.images[0]) || null;
  const joinedDate = venue.createdAt
    ? new Date(venue.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Unknown";
  const owner =
    typeof venue.ownerId === "object" && venue.ownerId !== null
      ? (venue.ownerId as { name?: string; email?: string; phone?: string })
      : null;

  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Price per hour", value: <span className="tabular-nums">₹{venue.pricePerHour}</span> },
    {
      label: "Rating",
      value: venue.rating ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden />
          {venue.rating.toFixed(1)}
          <span className="font-normal text-slate-500">({venue.reviewCount || 0} reviews)</span>
        </span>
      ) : (
        "No reviews yet"
      ),
    },
    { label: "Listed on", value: joinedDate },
    {
      label: "External coaches",
      value: venue.allowExternalCoaches ? "Allowed" : "Not allowed",
    },
    {
      label: "Coordinates",
      value: venue.location?.coordinates ? (
        <span className="font-mono text-xs">
          {venue.location.coordinates[1]}, {venue.location.coordinates[0]}
        </span>
      ) : (
        "Not set"
      ),
    },
    {
      label: "Venue ID",
      value: <span className="break-all font-mono text-xs">{venue.id || venue._id}</span>,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {header}
      {back}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-6">
          <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/5 md:h-72">
            {imageUrl ? (
              <Image src={imageUrl} alt={`Photo of ${venue.name}`} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="size-12 text-slate-300" aria-hidden />
              </div>
            )}
          </div>

          <Panel title="About this venue">
            <p className="max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {venue.description || "No description provided."}
            </p>
          </Panel>

          <Panel title="Sports and amenities">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm text-slate-500">Sports</p>
                {venue.sports && venue.sports.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {venue.sports.map((sport) => (
                      <li
                        key={sport}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-800"
                      >
                        {sport}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No sports listed.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-500">Amenities</p>
                {venue.amenities && venue.amenities.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {venue.amenities.map((amenity) => (
                      <li
                        key={amenity}
                        className="rounded-md bg-orange-50 px-2.5 py-1 text-sm font-medium text-orange-900"
                      >
                        {amenity}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No amenities listed.</p>
                )}
              </div>
            </div>
          </Panel>

          {review?.images && review.images.length > 1 && (
            <Panel title="All photos">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {review.images.map((photo, idx) => (
                  <div key={photo} className="relative aspect-video overflow-hidden rounded-lg">
                    <Image
                      src={photo}
                      alt={`Venue photo ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {needsDecision && (
            <Panel title="Documents">
              {review?.documents && review.documents.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {review.documents.map((doc) => (
                    <li
                      key={doc.url}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{doc.type}</p>
                        <p className="truncate text-sm text-slate-600">{doc.fileName}</p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={btn("outline", "sm")}
                      >
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              )}
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {needsDecision && (
            <Panel
              title="Decision"
              description={
                venue.approvalStatus === "REJECTED"
                  ? "This venue was rejected. You can still approve it or ask for changes."
                  : "Approving puts the venue live. The owner is notified of every decision."
              }
            >
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => decide("APPROVE")}
                  disabled={deciding}
                  className={btn("primary")}
                >
                  Approve venue
                </button>
                {venue.approvalStatus !== "REVIEW" && (
                  <button
                    type="button"
                    onClick={() => decide("REVIEW")}
                    disabled={deciding}
                    className={btn("outline")}
                  >
                    Ask for changes
                  </button>
                )}
                {venue.approvalStatus !== "REJECTED" && (
                  <button
                    type="button"
                    onClick={() => decide("REJECT")}
                    disabled={deciding}
                    className={btn("danger")}
                  >
                    Reject
                  </button>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Details">
            <dl className="divide-y divide-slate-100">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <dt className="shrink-0 text-sm text-slate-500">{fact.label}</dt>
                  <dd className="min-w-0 text-right text-sm font-medium text-slate-900">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Owner">
            {owner ? (
              <div className="text-sm text-slate-900">
                <p className="font-semibold">{owner.name || "Unknown"}</p>
                {owner.email && <p className="mt-1 text-slate-600">{owner.email}</p>}
                {owner.phone && <p className="text-slate-600">{owner.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Owner details aren&apos;t available.</p>
            )}
          </Panel>
        </div>
      </div>

      {isEditing && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={closeEdit}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit venue"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit venue</h2>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="v-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="v-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => prev && { ...prev, name: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-desc" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="v-desc"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, description: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-sports" className={labelClass}>
                  Sports (comma separated)
                </label>
                <input
                  id="v-sports"
                  value={editForm.sports}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, sports: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-amen" className={labelClass}>
                  Amenities (comma separated)
                </label>
                <input
                  id="v-amen"
                  value={editForm.amenities}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, amenities: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="v-price" className={labelClass}>
                    Price per hour (₹)
                  </label>
                  <input
                    id="v-price"
                    type="number"
                    value={editForm.pricePerHour}
                    onChange={(e) =>
                      setEditForm(
                        (prev) => prev && { ...prev, pricePerHour: Number(e.target.value) }
                      )
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.allowExternalCoaches}
                  onChange={(e) =>
                    setEditForm(
                      (prev) => prev && { ...prev, allowExternalCoaches: e.target.checked }
                    )
                  }
                  className="size-4 rounded accent-orange-700"
                />
                Allow external coaches
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className={btn("outline")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className={btn("primary")}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
      {promptDialog}
    </div>
  );
}
