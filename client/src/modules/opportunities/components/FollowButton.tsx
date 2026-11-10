"use client";

import { Bell, BellOff } from "lucide-react";
import Link from "next/link";

import { useOpportunityFollow } from "../hooks/useOpportunityFollow";

/**
 * "Tell me when the dates move" on an entry's page.
 *
 * Says what following does, in the button's own words, because "Follow" alone
 * does not tell a parent that an email is the result. A signed-out visitor gets
 * a link to sign in that brings them back here, rather than a button that fails.
 */
export function FollowButton({ slug }: { slug: string }) {
  const { signedIn, hydrated, ready, following, toggle } = useOpportunityFollow(slug);

  // Reserve the space so the card does not jump when the session is read.
  if (!hydrated || !ready) return <div aria-hidden className="min-h-6" />;

  if (!signedIn) {
    return (
      <p className="text-ink-body text-sm">
        <Link
          href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
          className="text-ink decoration-ink/30 hover:decoration-ink font-medium underline underline-offset-4"
        >
          Sign in
        </Link>{" "}
        to get an email when applications open or are about to close.
      </p>
    );
  }

  const Icon = following ? BellOff : Bell;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!following)}
      disabled={toggle.isPending}
      aria-pressed={following}
      className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
    >
      <Icon aria-hidden className="h-4 w-4" />
      {following ? "Stop these emails" : "Email me about these dates"}
    </button>
  );
}
