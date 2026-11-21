"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import BlogProfileView from "./BlogProfileView";

const PAGE_SIZE = 20;

export default function WriterProfileClient({ identifier }: { identifier: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadFailed(false);
      setNotFound(false);
      const author = await blogService.getAuthorProfile(identifier);

      // Viewing your own writer page → send to the editable account page.
      if (author.isMe) {
        router.replace("/experiences/account");
        return;
      }
      setProfile(author);

      setIsLoadingBlogs(true);
      const data = await blogService.listBlogs(1, PAGE_SIZE, {
        authorId: author.userId,
      });
      setBlogs(data.items || []);
      setPage(1);
      setHasMore(1 < (data.pagination?.totalPages || 0));
    } catch (error) {
      // Only a 404 means "no such writer"; a dropped connection or a server
      // error is a failed load, and telling someone the writer left would be
      // wrong.
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNotFound(true);
      else setLoadFailed(true);
      toast.error(error instanceof Error ? error.message : "Failed to load writer");
    } finally {
      setIsLoading(false);
      setIsLoadingBlogs(false);
    }
  }, [identifier, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!profile || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const next = page + 1;
      const data = await blogService.listBlogs(next, PAGE_SIZE, { authorId: profile.userId });
      setBlogs((current) => [...current, ...(data.items || [])]);
      setPage(next);
      setHasMore(next < (data.pagination?.totalPages || 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading writer"
        className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-56 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (loadFailed && !profile) {
    return (
      <div role="alert" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="bg-paper-deep rounded-3xl px-6 py-16 text-center">
          <p className="font-editorial text-ink text-4xl font-light">Could not load this writer.</p>
          <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void load();
            }}
            className="btn-motion bg-power-orange-solid mt-7 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="bg-paper-deep rounded-3xl px-6 py-16 text-center">
          <p className="font-editorial text-ink text-4xl font-light">Writer not found.</p>
          <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
            The link may be wrong, or the writer may have left.
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

  return (
    <BlogProfileView
      profile={profile}
      blogs={blogs}
      isLoadingBlogs={isLoadingBlogs}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={() => void loadMore()}
    />
  );
}
