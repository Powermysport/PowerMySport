"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile } from "@/modules/community/types";
import { hasAuthToken } from "@/lib/auth/token";
import AuthorAvatar from "./AuthorAvatar";

/**
 * Compact "My Account" access for the blog tab: avatar + @username linking to
 * the account page. Fetches the current user's blog profile once on mount.
 */
export default function BlogAccountChip({ className = "" }: { className?: string }) {
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This chip renders on the public blog pages too — skip the call
    // entirely for guests rather than let a 401 trip the global axios
    // interceptor and bounce a guest reader to login.
    if (!hasAuthToken()) {
      setLoading(false);
      return;
    }

    let active = true;
    void blogService
      .getMyProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // Not eligible / not signed in — chip stays hidden.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`border-hairline inline-flex items-center gap-2 rounded-md border py-1 pl-1 pr-3 ${className}`}
        aria-hidden="true"
      >
        <span className="bg-ink/10 h-8 w-8 animate-pulse rounded-full" />
        <span className="bg-ink/10 h-3 w-16 animate-pulse rounded-sm" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href="/experiences/account"
        title="My Account"
        className={`border-hairline hover:border-ink/45 inline-flex min-h-11 items-center gap-2 rounded-md border bg-white py-1 pl-1 pr-3 transition-colors duration-200 ${className}`}
      >
        <AuthorAvatar name={profile.name} photoUrl={profile.photoUrl} size={32} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-ink-muted truncate text-xs font-medium">My Account</span>
          <span className="text-ink truncate text-sm font-semibold">
            {profile.username ? `@${profile.username}` : profile.name}
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
