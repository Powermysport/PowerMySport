"use client";

import { useCallback, useEffect, useState } from "react";
import { blogService } from "@/modules/community/services/blog";
import { BlogAuthorProfile, BlogListItem } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/modules/community/hooks/useConfirm";
import BlogProfileView from "./BlogProfileView";
import EditProfileModal from "./EditProfileModal";

const PAGE_SIZE = 20;

export default function MyAccountClient() {
  const [profile, setProfile] = useState<BlogAuthorProfile | null>(null);
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBlogs, setIsLoadingBlogs] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    try {
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }
      setEmail(session.email);
      const me = await blogService.getMyProfile();
      setProfile(me);

      setIsLoadingBlogs(true);
      const data = await blogService.listBlogs(1, PAGE_SIZE, { mine: true });
      setBlogs(data.items || []);
      setPage(1);
      setHasMore(1 < (data.pagination?.totalPages || 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not load your account");
    } finally {
      setIsLoading(false);
      setIsLoadingBlogs(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const next = page + 1;
      const data = await blogService.listBlogs(next, PAGE_SIZE, { mine: true });
      setBlogs((current) => [...current, ...(data.items || [])]);
      setPage(next);
      setHasMore(next < (data.pagination?.totalPages || 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDeleteBlog = async (blog: BlogListItem) => {
    const confirmed = await confirm({
      title: "Delete this experience?",
      description: `"${blog.title || "Untitled experience"}" will be removed permanently, along with its likes and comments. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await blogService.deleteBlog(blog.id);
      setBlogs((current) => current.filter((item) => item.id !== blog.id));
      setProfile((current) =>
        current
          ? {
              ...current,
              blogCount: Math.max(0, current.blogCount - 1),
            }
          : current
      );
      toast.success("Experience deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  if (isLoading || !profile) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading your account"
        className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-56 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <>
      <BlogProfileView
        profile={profile}
        blogs={blogs}
        isLoadingBlogs={isLoadingBlogs}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={() => void loadMore()}
        onDeleteBlog={handleDeleteBlog}
        onEditProfile={() => setEditOpen(true)}
      />
      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        email={email}
        onSaved={setProfile}
      />
      {confirmDialog}
    </>
  );
}
