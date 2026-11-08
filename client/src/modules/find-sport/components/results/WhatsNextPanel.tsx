"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import api from "@/lib/api/axios";
import { expertApi } from "@/modules/expert/services/expert";
import { loginUrlFor } from "@/flow/policy";
import { ScreeningRequestModal } from "../ScreeningRequestModal";

// Real bookings only — an unpaid hold or a cancelled session was never a
// completed step from the parent's point of view.
const REAL_EXPERT_SESSION_STATUSES = ["PAID", "SCHEDULED", "COMPLETED"];

type BookedState = { screeningDone: boolean; expertDone: boolean };

const EMPTY_BOOKED: BookedState = { screeningDone: false, expertDone: false };

function storageKey(dependentId?: string): string {
  return `pms_journey_${dependentId || "guest"}`;
}

// Local persistence covers guests (no server record to check against at all)
// and gives an instant, optimistic reflection of a just-submitted screening
// request before the next server reconciliation confirms it.
function loadBooked(dependentId?: string): BookedState {
  if (typeof window === "undefined") return EMPTY_BOOKED;
  try {
    const raw = localStorage.getItem(storageKey(dependentId));
    if (!raw) return EMPTY_BOOKED;
    const parsed = JSON.parse(raw) as Partial<BookedState>;
    return {
      screeningDone: parsed.screeningDone === true,
      expertDone: parsed.expertDone === true,
    };
  } catch {
    return EMPTY_BOOKED;
  }
}

/** Secondary action on cream: ink text, 30% ink underline that goes solid on hover. */
const TEXT_LINK =
  "text-ink decoration-ink/30 hover:decoration-ink inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 transition-colors duration-200";

/**
 * The CTA section below the results. Physical screening and an expert session
 * live here as add-ons rather than as steps between the assessment and a trial
 * class — a parent can book either at any point, or none of them, without it
 * blocking the trial.
 */
export function WhatsNextPanel({
  childName,
  topSport,
  city,
  dependentId,
  isLoggedIn,
  saved = false,
}: {
  childName: string;
  topSport?: string;
  city?: string;
  dependentId?: string;
  /** True only once the results are actually on a child's profile. */
  saved?: boolean;
  isLoggedIn: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [booked, setBooked] = useState<BookedState>(() => loadBooked(dependentId));
  const name = childName || "your child";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey(dependentId), JSON.stringify(booked));
    } catch {}
  }, [dependentId, booked]);

  // Reconcile with real server records for a logged-in parent's saved child —
  // if a screening or expert session was actually booked, say so instead of
  // inviting them to book it a second time.
  useEffect(() => {
    if (!dependentId) return;
    let cancelled = false;

    api
      .get("/screenings/mine", { params: { dependentId } })
      .then((res) => {
        if (cancelled) return;
        const requests: Array<{ status: string }> = res.data?.data?.requests ?? [];
        if (requests.some((r) => r.status !== "cancelled")) {
          setBooked((prev) => (prev.screeningDone ? prev : { ...prev, screeningDone: true }));
        }
      })
      .catch(() => {});

    expertApi
      .mySessions()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const hasReal = res.data.some(
          (s) => s.player?._id === dependentId && REAL_EXPERT_SESSION_STATUSES.includes(s.status)
        );
        if (hasReal) setBooked((prev) => (prev.expertDone ? prev : { ...prev, expertDone: true }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [dependentId]);

  // One quiet, ruled list (DESIGN.md "Question list" pattern) instead of a dark panel of
  // four boxes: these are optional, and the page's one action is booking the trial above.
  const rows: Array<{
    key: string;
    title: string;
    body: string;
    action: React.ReactNode;
  }> = [
    {
      key: "screening",
      title: "Physical screening",
      body: booked.screeningDone
        ? "Your screening request is in. Our team will call you to confirm the slot."
        : "A six-test fitness check at a partner venue (speed, power, endurance, agility), with a printed report.",
      action: booked.screeningDone ? (
        <span className="text-sm font-medium text-green-800">Requested</span>
      ) : (
        <button type="button" onClick={() => setModalOpen(true)} className={TEXT_LINK}>
          Request a slot
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      ),
    },
    {
      key: "expert",
      title: "Expert session",
      body: "A paid one-on-one with a coach who knows the pathway. Useful when the scores are close or a gap needs a second opinion.",
      action: (
        <a
          href={booked.expertDone ? "/experts/sessions" : "/booking?tab=experts"}
          className={TEXT_LINK}
        >
          {booked.expertDone ? "View your session" : "Find an expert"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </a>
      ),
    },
    {
      key: "community",
      title: "Parent community",
      body: "Academy reviews, training tips and real experiences from parents across India. Free.",
      action: (
        <a href="/community" className={TEXT_LINK}>
          Join
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </a>
      ),
    },
  ];

  if (!isLoggedIn) {
    rows.push({
      key: "save",
      title: `Save ${name}'s profile`,
      body: "Keep these results, get a roadmap for the sport, and track progress as they grow. Under a minute.",
      action: (
        <span className="flex flex-col items-start gap-1 sm:items-end">
          <a href="/register" className={TEXT_LINK}>
            Create an account
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </a>
          <a
            href={loginUrlFor("/assessment/discover")}
            className="text-ink-body text-sm underline underline-offset-4"
          >
            or log in
          </a>
        </span>
      ),
    });
  } else if (saved) {
    rows.push({
      key: "saved",
      title: "Profile saved",
      body: `${name}'s results are on their profile. Retake the assessment any time as they grow.`,
      action: (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Saved
        </span>
      ),
    });
  }

  return (
    <section aria-labelledby="optional-extras-heading" className="mb-8">
      <h2
        id="optional-extras-heading"
        className="font-editorial text-ink text-2xl font-light leading-tight"
      >
        Optional, whenever it helps
      </h2>
      <p className="text-ink-body mt-1 text-sm">None of these are needed before a trial class.</p>
      <ul className="border-hairline mt-4 border-t">
        {rows.map((row) => (
          <li
            key={row.key}
            className="border-hairline flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
          >
            <div className="min-w-0">
              <p className="text-ink text-base font-medium">{row.title}</p>
              <p className="text-ink-body mt-0.5 max-w-[60ch] text-sm leading-relaxed">
                {row.body}
              </p>
            </div>
            <div className="shrink-0">{row.action}</div>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <ScreeningRequestModal
          childName={childName}
          sport={topSport}
          city={city}
          dependentId={dependentId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setBooked((prev) => ({ ...prev, screeningDone: true }))}
        />
      )}
    </section>
  );
}
