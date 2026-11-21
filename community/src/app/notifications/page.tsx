"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { communityService } from "@/modules/community/services/community";
import { CommunityActivityItem } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { buildNotificationHref } from "@/modules/community/utils/notificationLinks";

type NotificationFilter = "ALL" | "UNREAD";

const PAGE_SIZE = 20;

/** "5m ago" while recent. Past a day the heading above already says which day,
 *  so "30d ago" under "Thu, Oct 22" only repeats it; show the time of day. */
const toRelativeTime = (value: string): string => {
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "";
  const diffMin = Math.max(1, Math.floor((Date.now() - at) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const toDateKey = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "unknown";
  }

  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const toDateHeading = (dateKey: string): string => {
  if (dateKey === "unknown") {
    return "Unknown date";
  }

  const [y, m, d] = dateKey.split("-").map((part) => Number(part));
  const at = new Date(y, m - 1, d);
  if (Number.isNaN(at.getTime())) {
    return "Unknown date";
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startAt = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const diffDays = Math.round((startToday.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return at.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getEventLabel = (item: CommunityActivityItem): string => {
  const event = item.data?.event || "";

  if (event === "COMMUNITY_ANSWER_CREATED") return "Q&A";
  if (event === "COMMUNITY_UPVOTE_RECEIVED") return "Q&A";
  if (event === "COMMUNITY_MESSAGE_RECEIVED") return "Message";
  if (event === "COMMUNITY_CONVERSATION_REQUESTED") return "Request";
  if (event === "COMMUNITY_CONVERSATION_ACCEPTED") return "Request";
  if (event === "COMMUNITY_CONVERSATION_REJECTED") return "Request";
  if (event === "COMMUNITY_GROUP_MEMBER_ADDED") return "Group";
  if (event === "COMMUNITY_GROUP_JOINED") return "Group";
  if (event === "COMMUNITY_GROUP_LEFT") return "Group";

  return "Community";
};

/** One line in the list: usually one notification, but a run of messages from
 *  the same conversation collapses into one row so a burst of ten messages is
 *  one entry, not ten. `item` is the newest; `members` is every notification
 *  the row stands for. */
type NotificationRow = { item: CommunityActivityItem; members: CommunityActivityItem[] };

const collapseRuns = (dayItems: CommunityActivityItem[]): NotificationRow[] => {
  const rows: NotificationRow[] = [];
  for (const item of dayItems) {
    const previous = rows[rows.length - 1];
    const isMessage = item.data?.event === "COMMUNITY_MESSAGE_RECEIVED";
    if (
      previous &&
      isMessage &&
      previous.item.data?.event === "COMMUNITY_MESSAGE_RECEIVED" &&
      item.data?.conversationId &&
      previous.item.data?.conversationId === item.data.conversationId
    ) {
      previous.members.push(item);
    } else {
      rows.push({ item, members: [item] });
    }
  }
  return rows;
};

/** "Priya Nair sent you a message in community chat." -> "...sent you 20 messages...".
 *  Falls back to a plain count when the text is not in that shape. */
const describeRun = (row: NotificationRow): { title: string; message: string } => {
  const count = row.members.length;
  if (count === 1) return { title: row.item.title, message: row.item.message };
  const sender = /^(.+?) sent you a message/.exec(row.item.message)?.[1];
  return {
    title: `${count.toLocaleString("en-IN")} new messages`,
    message: sender
      ? `${sender} sent you ${count.toLocaleString("en-IN")} messages in community chat.`
      : `${count.toLocaleString("en-IN")} messages in one conversation.`,
  };
};

export default function CommunityNotificationsPage() {
  const [items, setItems] = useState<CommunityActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const unreadCount = useMemo(
    () => items.reduce((count, item) => (item.isRead ? count : count + 1), 0),
    [items]
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
  );

  // Grouped by day, and left in time order inside each day. It used to sub-group
  // by type, which put an older Q&A item above a newer message.
  const groupedItems = useMemo(() => {
    const days = new Map<string, CommunityActivityItem[]>();
    for (const item of sortedItems) {
      const dateKey = toDateKey(item.createdAt);
      if (!days.has(dateKey)) days.set(dateKey, []);
      days.get(dateKey)!.push(item);
    }
    return [...days.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayItems]) => ({
        dateKey,
        heading: toDateHeading(dateKey),
        rows: collapseRuns(dayItems),
      }));
  }, [sortedItems]);

  const loadNotifications = useCallback(
    async (targetPage = 1, isBackground = false) => {
      try {
        if (!isBackground) {
          setIsLoading(true);
          setLoadFailed(false);
        }
        const response = await communityService.listCommunityNotifications(
          targetPage,
          PAGE_SIZE,
          filter === "UNREAD" ? false : undefined
        );

        setItems(response.items || []);
        setPage(targetPage);
        setPages(Math.max(1, response.pagination.pages || 1));
      } catch {
        if (!isBackground) {
          setItems([]);
          setPage(targetPage);
          setPages(1);
          setLoadFailed(true);
        }
        toast.error("Failed to load notifications");
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [filter]
  );

  const handleMarkRowRead = useCallback(async (row: NotificationRow) => {
    const unread = row.members.filter((entry) => !entry.isRead);
    if (unread.length === 0) return;

    try {
      await Promise.all(
        unread.map((entry) => communityService.markCommunityNotificationRead(entry.id))
      );
      const ids = new Set(unread.map((entry) => entry.id));
      setItems((current) =>
        current.map((entry) => (ids.has(entry.id) ? { ...entry, isRead: true } : entry))
      );
    } catch {
      toast.error("We could not mark that as read");
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount || isMarkingAll) {
      return;
    }

    try {
      setIsMarkingAll(true);
      const count = await communityService.markAllCommunityNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      if (count > 0) {
        toast.success("All notifications marked as read");
      }
    } catch {
      toast.error("We could not mark them as read");
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unreadCount]);

  useEffect(() => {
    void loadNotifications(1);
  }, [loadNotifications]);

  useEffect(() => {
    const socket = getCommunitySocket();

    const refresh = () => {
      void communityService.clearNotificationCache();
      void loadNotifications(1, true);
    };

    socket.on("notification:new", refresh);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", refresh);
    };
  }, [loadNotifications]);

  const link =
    "text-ink decoration-ink/30 hover:decoration-ink min-h-11 inline-flex items-center text-base font-semibold underline underline-offset-4 transition-colors duration-200";

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="Notifications"
          subtitle="Answers, upvotes, requests and messages from the community."
          action={
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || isMarkingAll}
              className="btn-motion border-ink text-ink hover:bg-ink disabled:hover:text-ink inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {isMarkingAll ? "Marking" : "Mark all read"}
            </button>
          }
        />

        <div className="mt-10">
          <div
            role="tablist"
            aria-label="Filter notifications"
            className="border-hairline flex gap-8 border-b"
          >
            {(
              [
                { value: "ALL", label: "All" },
                {
                  value: "UNREAD",
                  label: unreadCount > 0 && pages <= 1 ? `Unread (${unreadCount})` : "Unread",
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={filter === tab.value}
                onClick={() => setFilter(tab.value)}
                className={`-mb-px min-h-12 border-b-2 text-base font-semibold tabular-nums transition-colors duration-200 ${
                  filter === tab.value
                    ? "border-ink text-ink"
                    : "text-ink-muted hover:text-ink border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div aria-busy="true" aria-label="Loading notifications" className="mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-hairline space-y-3 border-b py-6">
                  <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                  <div className="bg-ink/10 h-5 w-2/3 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : loadFailed ? (
            <div role="alert" className="bg-paper-deep mt-8 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">
                Could not load notifications.
              </p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={() => void loadNotifications(page)}
                className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-paper-deep mt-8 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">
                {filter === "UNREAD" ? "You are all caught up." : "Nothing yet."}
              </p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Answers, upvotes, requests and messages will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-12">
              {groupedItems.map((dateGroup) => (
                <section key={dateGroup.dateKey} aria-label={dateGroup.heading}>
                  <h2 className="font-editorial text-ink text-2xl font-normal">
                    {dateGroup.heading}
                  </h2>
                  <ul className="border-hairline mt-3 border-t">
                    {dateGroup.rows.map((row) => {
                      const { item } = row;
                      const isRead = row.members.every((entry) => entry.isRead);
                      const { title, message } = describeRun(row);
                      const actionHref = buildNotificationHref(item.data);
                      return (
                        <li key={item.id} className="border-hairline border-b py-5">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                                isRead ? "bg-transparent" : "bg-power-orange-solid"
                              }`}
                              role={isRead ? undefined : "img"}
                              aria-label={isRead ? undefined : "Unread"}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-ink-muted text-sm tabular-nums">
                                {getEventLabel(item)} · {toRelativeTime(item.createdAt)}
                              </p>
                              <p
                                className={`mt-1 text-lg leading-snug [overflow-wrap:anywhere] ${
                                  isRead ? "text-ink-body" : "text-ink font-semibold"
                                }`}
                              >
                                {title}
                              </p>
                              <p className="text-ink-body mt-1 max-w-[60ch] text-base leading-relaxed [overflow-wrap:anywhere]">
                                {message}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-6">
                                {actionHref ? (
                                  <Link
                                    href={actionHref}
                                    onClick={() => {
                                      void handleMarkRowRead(row);
                                    }}
                                    className={link}
                                  >
                                    Open
                                  </Link>
                                ) : null}
                                {!isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleMarkRowRead(row)}
                                    className="text-ink-muted hover:text-ink min-h-11 text-base font-medium transition-colors duration-200"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {pages > 1 ? (
            <div className="mt-10 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => void loadNotifications(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
                className={`${link} disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40`}
              >
                Previous
              </button>
              <span className="text-ink-muted text-sm tabular-nums">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                onClick={() => void loadNotifications(Math.min(pages, page + 1))}
                disabled={page >= pages || isLoading}
                className={`${link} disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40`}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
