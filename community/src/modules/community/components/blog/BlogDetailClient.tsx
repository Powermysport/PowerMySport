"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Flag,
  Link as LinkIcon,
  MessageCircle,
  Pencil,
  Trash2,
  Twitter,
} from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogDetail } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import { getCommunitySocket, blogRoom, subscribeToCommunityRoom } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";
import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";
import { formatBlogDate } from "@/modules/community/utils/blogFormat";
import { useConfirm } from "@/modules/community/hooks/useConfirm";
import { useReportModal } from "@/modules/community/hooks/useReportModal";
import { ReportModal } from "@/modules/community/components/chat/ReportModal";
import BlogContentRenderer from "./BlogContentRenderer";
import BlogCommentsSidebar from "./BlogCommentsSidebar";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";
import SubjectReplyBand from "./SubjectReplyBand";

const authorHref = (author: BlogDetail["author"]) =>
  author.username ? `/experiences/by/${author.username}` : `/experiences/by/${author.id}`;

export default function BlogDetailClient({
  blogId,
  initialBlog = null,
}: {
  blogId: string;
  /** Already fetched by the page for its metadata, so passing it down puts the
   *  story in the SSR HTML instead of shipping a loading message to crawlers. */
  initialBlog?: BlogDetail | null;
}) {
  const router = useRouter();
  const [blog, setBlog] = useState<BlogDetail | null>(initialBlog);
  const [isLoading, setIsLoading] = useState(!initialBlog);
  const [likePending, setLikePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const { reportModal, handleOpenReportModal, setReportModal, isSubmittingReport, handleSubmitReportWrapper } = // prettier-ignore
    useReportModal();

  // Never swap rendered content back to a loading state on refresh — that
  // would undo the server render the moment the client hydrates.
  const hasContentRef = useRef(Boolean(initialBlog));

  const load = useCallback(async () => {
    try {
      if (!hasContentRef.current) {
        setIsLoading(true);
      }
      // This page is a shareable public link — no session required to read it.
      const data = await blogService.getBlog(blogId);
      setBlog(data);
      hasContentRef.current = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load experience");
      setBlog(null);
    } finally {
      setIsLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live like-count sync from other clients.
  useEffect(() => {
    const socket = getCommunitySocket();
    const handleLike = (payload?: {
      targetType?: string;
      targetId?: string;
      likeCount?: number;
    }) => {
      if (
        payload?.targetType === "BLOG" &&
        payload.targetId === blogId &&
        typeof payload.likeCount === "number"
      ) {
        setBlog((current) =>
          current ? { ...current, likeCount: payload.likeCount as number } : current
        );
      }
    };
    socket.on("community:blogLiked", handleLike);
    const unsubscribe = subscribeToCommunityRoom(blogRoom(blogId));
    return () => {
      unsubscribe();
      socket.off("community:blogLiked", handleLike);
    };
  }, [blogId]);

  const handleToggleLike = async () => {
    if (!blog) return;
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    setLikePending(true);
    const optimisticLiked = !blog.likedByMe;
    setBlog({
      ...blog,
      likedByMe: optimisticLiked,
      likeCount: Math.max(0, blog.likeCount + (optimisticLiked ? 1 : -1)),
    });
    try {
      const result = await blogService.toggleLike("EXPERIENCE", blog.id);
      setBlog((current) =>
        current ? { ...current, likedByMe: result.liked, likeCount: result.likeCount } : current
      );
    } catch (error) {
      setBlog((current) =>
        current ? { ...current, likedByMe: blog.likedByMe, likeCount: blog.likeCount } : current
      );
      toast.error(error instanceof Error ? error.message : "Failed to react");
    } finally {
      setLikePending(false);
    }
  };

  const handleDelete = async () => {
    if (!blog) return;
    setIsDeleting(true);
    try {
      await blogService.deleteBlog(blog.id);
      toast.success("Experience deleted");
      router.push("/experiences");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!blog) return;
    const confirmed = await confirm({
      title: "Delete this experience?",
      description: `"${blog.title || "Untitled experience"}" will be removed permanently, along with its likes and comments. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (confirmed) void handleDelete();
  };

  const shareOnTwitter = () => {
    if (!blog) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${blog.title} on PowerMySport`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading experience"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-3 w-28 animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-12 w-4/5 animate-pulse rounded-sm" />
        <div className="bg-ink/10 mt-8 aspect-[16/9] animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="bg-paper-deep rounded-3xl px-6 py-16 text-center">
          <p className="font-editorial text-ink text-4xl font-light">Experience not found.</p>
          <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
            It may have been deleted, or the link may be wrong.
          </p>
          <Link
            href="/experiences"
            className="btn-motion bg-power-orange-solid mt-7 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
          >
            Back to experiences
          </Link>
        </div>
      </div>
    );
  }

  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";
  const textLink =
    "text-ink decoration-ink/30 hover:decoration-ink inline-flex min-h-11 items-center gap-1.5 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50";

  // One set of actions, rendered twice: pinned in the side rail from `lg` up,
  // and as the closing row of the article below that. Only one is ever
  // displayed, so there is a single tab stop per action at any width.
  const actions = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:-ml-4">
        <LikeButton
          liked={blog.likedByMe}
          count={blog.likeCount}
          onToggle={handleToggleLike}
          disabled={likePending}
          size="lg"
        />
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="btn-motion text-ink-muted hover:bg-paper-deep hover:text-ink inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold tabular-nums"
        >
          <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" />
          {blog.commentCount.toLocaleString("en-IN")}{" "}
          {blog.commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 lg:flex-col lg:items-start lg:gap-x-0">
        <button type="button" onClick={() => void copyLink()} className={textLink}>
          <LinkIcon size={15} strokeWidth={1.5} aria-hidden="true" />
          Copy link
        </button>
        <button type="button" onClick={shareOnTwitter} className={textLink}>
          <Twitter size={15} strokeWidth={1.5} aria-hidden="true" />
          Share on X
        </button>
        {blog.isMine ? (
          <>
            <Link href={`/experiences/${blog.id}/edit`} className={textLink}>
              <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
              Edit
            </Link>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-red-700 underline decoration-red-700/30 underline-offset-4 transition-colors duration-200 hover:decoration-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
              Delete
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => handleOpenReportModal("EXPERIENCE", blog.id)}
            className="text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors duration-200"
          >
            <Flag size={14} strokeWidth={1.5} aria-hidden="true" />
            Report
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="bg-paper relative min-h-[calc(100vh-5.5rem)]">
      <article className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/experiences"
          className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
        >
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          All experiences
        </Link>

        <h1 className="font-editorial text-ink mt-4 max-w-4xl text-balance text-4xl font-light leading-[1.08] [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
          {blog.title}
        </h1>

        {/* Cover, shown whole rather than cropped to a banner. A 16/9 box with
            object-cover cut the bottom off anything portrait, which for the
            documents people actually post (certificates, result sheets) removed
            the part they uploaded it for. The fallback keeps a fixed ratio
            because it is generated art with nothing to lose. */}
        <div
          className={`bg-paper-deep mt-8 w-full overflow-hidden rounded-2xl sm:mt-10 ${
            coverUrl ? "" : "aspect-[16/9]"
          }`}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={blog.title}
              width={blog.coverImageWidth ?? undefined}
              height={blog.coverImageHeight ?? undefined}
              className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full"
            />
          ) : (
            <BlogCoverFallback topic={blog.topic} />
          )}
        </div>

        <div className="mt-8 grid gap-8 sm:mt-10 lg:mt-14 lg:grid-cols-[13.5rem_minmax(0,40rem)] lg:gap-16">
          {/* Who wrote it and what you can do with it. On a phone this is just
              the byline; from lg it pins beside the text so like, comment and
              share stay in reach for the whole read. */}
          <aside aria-label="About this experience" className="lg:sticky lg:top-24 lg:self-start">
            <Link href={authorHref(blog.author)} className="flex items-center gap-3">
              <AuthorAvatar name={blog.author.name} photoUrl={blog.author.photoUrl} size={44} />
              <span className="min-w-0">
                <span className="text-ink block text-base font-semibold [overflow-wrap:anywhere]">
                  {blog.author.name}
                </span>
                {blog.author.username ? (
                  <span className="text-ink-muted block truncate text-sm">
                    @{blog.author.username}
                  </span>
                ) : null}
              </span>
            </Link>
            <p className="text-ink-muted mt-4 text-sm">{formatBlogDate(blog.createdAt)}</p>
            <p className="text-ink-muted mt-1 inline-flex items-center gap-1.5 text-sm">
              <topic.Icon size={14} strokeWidth={1.5} aria-hidden="true" />
              {topic.label}
            </p>

            <div className="border-hairline mt-6 hidden flex-col gap-2 border-t pt-4 lg:flex">
              {actions}
            </div>
          </aside>

          <div className="min-w-0 lg:[&_.blog-prose]:!text-[1.125rem]">
            <BlogContentRenderer content={blog.content} />

            {blog.tags.length > 0 ? (
              <p className="text-ink-muted mt-10 text-sm [overflow-wrap:anywhere]">
                {blog.tags.map((tag) => `#${tag}`).join(" ")}
              </p>
            ) : null}

            {/* Right of reply: a coach or expert named in `subject` can post one
                response to what was written about them. */}
            {blog.subject ? (
              <SubjectReplyBand
                blog={blog}
                onReplyPosted={(reply) => setBlog((current) => (current ? { ...current, subjectReply: reply } : current))} // prettier-ignore
              />
            ) : null}

            <div className="border-hairline mt-12 flex flex-col gap-2 border-t pt-6 lg:hidden">
              {actions}
            </div>
          </div>
        </div>
      </article>

      <BlogCommentsSidebar
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        blogId={blog.id}
        blogTitle={blog.title}
        onCountChange={(delta) =>
          setBlog((current) =>
            current
              ? {
                  ...current,
                  commentCount: Math.max(0, current.commentCount + delta),
                }
              : current
          )
        }
      />

      {reportModal ? (
        <ReportModal
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          isSubmitting={isSubmittingReport}
          onClose={() => setReportModal(null)}
          onSubmit={handleSubmitReportWrapper}
        />
      ) : null}

      {confirmDialog}
    </div>
  );
}
