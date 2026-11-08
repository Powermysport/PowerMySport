"use client";

import { Check } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";

/**
 * The one control on the results page that records a decision.
 *
 * Everything else here is either something the parent told us before seeing
 * results (their shortlist) or something we worked out (scores, the sport our
 * CTA names). Until this is clicked, "which sport did they go with" is a guess
 * — and the WhatsApp handoff that follows leaves no trace to correct it.
 *
 * Styled as the secondary (outline) action: the page's primary action is booking the
 * trial on WhatsApp, and DESIGN.md allows one per view. Chosen is a success state, so green.
 */
export function ChooseSportButton({
  sportName,
  chosen,
  saving,
  onChoose,
  tone = "light",
}: {
  sportName: string;
  chosen: boolean;
  /**
   * A write is in flight for *some* card. Only guards against a second pick
   * racing the first — deliberately renders no spinner, because the card that
   * was actually clicked has already flipped to its chosen state and the other
   * four aren't loading anything.
   */
  saving: boolean;
  onChoose: (sport: string) => void;
  /** `subtle` cards are narrow columns, where a full-width control reads as part of the card. */
  tone?: "light" | "subtle";
}) {
  const width = tone === "subtle" ? "w-full" : "";

  if (chosen) {
    return (
      <span
        role="status"
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-green-700/30 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 ${width}`}
      >
        <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        You&apos;re starting here
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onChoose(sportName)}
      disabled={saving}
      className={`py-2 ${width}`}
    >
      Start with {sportName}
    </Button>
  );
}
