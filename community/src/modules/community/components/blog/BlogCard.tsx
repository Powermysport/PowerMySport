"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BlogListItem } from "@/modules/community/types";
import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";
import { formatCount, toRelativeTime } from "@/modules/community/utils/blogFormat";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "3d" while recent, then "Sep 8, 2026": the long form does not fit beside the
 *  counts in a three-column tile and was being clipped. */
const cardTime = (value?: string | null): string => {
  const relative = toRelativeTime(value);
  if (!relative || /^\d+[mhd]$/.test(relative)) return relative;
  return shortDate.format(new Date(value as string));
};

interface BlogCardProps {
  blog: BlogListItem;
  onToggleLike: (blog: BlogListItem) => void;
  likePending?: boolean;
}

/** An editorial tile, not a boxed card. With a photograph: photo, a plain topic
 *  label, a serif headline, one meta line. Without one: the tile is the text
 *  itself, a deeper-paper block with a larger headline and the excerpt, so a
 *  post with no image never shows an empty picture frame. Hover underlines the
 *  headline; nothing lifts or casts a shadow. */
export default function BlogCard({ blog, onToggleLike, likePending }: BlogCardProps) {
  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";
  const hasPhoto = Boolean(coverUrl);
  const authorHref = `/experiences/by/${blog.author.username || blog.author.id}`;
  const showExcerpt = Boolean(blog.excerpt && blog.excerpt.trim() !== blog.title.trim());

  const topicLabel = (
    <p className="text-ink-muted inline-flex items-center gap-1.5 text-sm font-medium">
      <topic.Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      {topic.label}
    </p>
  );

  const byline = (
    <div
      className={`relative z-10 mt-auto flex items-center justify-between gap-3 ${hasPhoto ? "pt-5" : "pt-6"}`}
    >
      <Link href={authorHref} className="flex min-w-0 items-center gap-2.5">
        <AuthorAvatar name={blog.author.name} photoUrl={blog.author.photoUrl} size={32} />
        <span className="min-w-0">
          <span className="text-ink block truncate text-sm font-semibold">{blog.author.name}</span>
          <span className="text-ink-muted block truncate text-sm">{cardTime(blog.createdAt)}</span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <span className="text-ink-muted inline-flex items-center gap-1 px-1 text-sm tabular-nums">
          <MessageCircle size={15} strokeWidth={1.5} aria-hidden="true" />
          <span aria-hidden="true">{formatCount(blog.commentCount)}</span>
          <span className="sr-only">
            {blog.commentCount} {blog.commentCount === 1 ? "comment" : "comments"}
          </span>
        </span>
        <LikeButton
          liked={blog.likedByMe}
          count={blog.likeCount}
          onToggle={() => onToggleLike(blog)}
          disabled={likePending}
          size="sm"
        />
      </div>
    </div>
  );

  if (!hasPhoto) {
    return (
      <article className="bg-paper-deep group relative flex h-full flex-col rounded-2xl p-5 sm:p-6">
        {topicLabel}
        {/* The after: overlay makes the whole tile one click target; the byline
            sits above it (z-10) so the author link and like button still work. */}
        <Link
          href={`/experiences/${blog.id}`}
          className="mt-3 block after:absolute after:inset-0 after:content-['']"
        >
          <h3 className="font-editorial text-ink decoration-ink/30 line-clamp-4 text-balance text-2xl font-normal leading-[1.12] underline-offset-4 [overflow-wrap:anywhere] group-hover:underline sm:text-[1.7rem]">
            {blog.title}
          </h3>
        </Link>
        {showExcerpt ? (
          <p className="text-ink-body mt-4 line-clamp-4 text-base leading-relaxed [overflow-wrap:anywhere]">
            {blog.excerpt}
          </p>
        ) : null}
        {byline}
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col">
      <Link
        href={`/experiences/${blog.id}`}
        aria-label={blog.title}
        tabIndex={-1}
        className="bg-paper-deep relative block aspect-[16/10] overflow-hidden rounded-2xl"
      >
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover saturate-[0.85] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </Link>

      <div className="mt-5 flex flex-1 flex-col">
        {topicLabel}
        <Link href={`/experiences/${blog.id}`} className="mt-2 block">
          <h3 className="font-editorial text-ink decoration-ink/30 line-clamp-2 text-balance text-2xl font-normal leading-tight underline-offset-4 [overflow-wrap:anywhere] group-hover:underline">
            {blog.title}
          </h3>
        </Link>
        {showExcerpt ? (
          <p className="text-ink-body mt-3 line-clamp-2 text-base leading-relaxed [overflow-wrap:anywhere]">
            {blog.excerpt}
          </p>
        ) : null}
        {byline}
      </div>
    </article>
  );
}
