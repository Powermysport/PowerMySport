"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { communityService } from "@/modules/community/services/community";
import { CommunityLeaderboardResponse, CommunityPost } from "@/modules/community/types";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { ContributorModal } from "@/modules/community/components/contributors/ContributorModal";
import { LeaderboardItem } from "@/modules/community/components/contributors/types";

const LEADERBOARD_SIZE = 15;

/** Photo, or the first grapheme of the name when there is none or it fails to
 *  load (a broken-image icon in a leaderboard row reads as a bug). */
function ContributorAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (Array.from(name.trim())[0] ?? "?").toLocaleUpperCase();
  return (
    <span className="bg-paper-deep text-ink-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold">
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}

const GRID_COLS =
  "grid-cols-[2rem_minmax(0,1fr)_3.5rem] sm:grid-cols-[3.5rem_minmax(0,1fr)_5rem_5rem_5rem_5.5rem]";
const fmt = (n: number) => n.toLocaleString("en-IN");

export default function ContributorsPage() {
  return (
    <Suspense
      fallback={
        <div className="community-page-shell">
          <div
            aria-busy="true"
            aria-label="Loading contributors"
            className="community-content-wrap"
          >
            <div className="bg-ink/10 h-48 animate-pulse rounded-2xl" />
          </div>
        </div>
      }
    >
      <ContributorsPageContent />
    </Suspense>
  );
}

function ContributorsPageContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<CommunityLeaderboardResponse | null>(null);
  const [threadState, setThreadState] = useState<{
    forId: string;
    items: CommunityPost[];
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
  const [myReputation, setMyReputation] = useState<{
    totalPoints: number;
    questionCount: number;
    answerCount: number;
    receivedUpvotes: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }
        setCurrentUserId(session.id);

        const [rep, board] = await Promise.all([
          communityService.getMyReputation(),
          communityService.listLeaderboard(LEADERBOARD_SIZE),
        ]);

        setMyReputation(rep);
        setLeaderboard(board);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load contributors");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const rows = useMemo<LeaderboardItem[]>(() => leaderboard?.items ?? [], [leaderboard]);

  const myEntry = leaderboard?.me ?? null;

  // Rows stay in rank order so the Place column always reads 1, 2, 3. If you
  // are inside the top of the board your row is simply highlighted in place; if
  // you are further down, your real rank (the server's, so #204 stays #204)
  // follows after a gap instead of jumping above the leader.
  const { displayRows, meBelowBoard } = useMemo(() => {
    const top = [...rows].sort((a, b) => a.rank - b.rank).slice(0, LEADERBOARD_SIZE);
    const meInTop = Boolean(myEntry && top.some((item) => item.id === myEntry.id));
    return {
      displayRows: myEntry && !meInTop ? [...top, myEntry] : top,
      meBelowBoard: Boolean(myEntry && !meInTop),
    };
  }, [rows, myEntry]);

  const selectedContributor = useMemo(
    () => displayRows.find((item) => item.id === selectedContributorId) || null,
    [displayRows, selectedContributorId]
  );

  // Fetched per contributor rather than sliced out of a bulk post prefetch —
  // the server filters by author and leaves out anything they posted
  // anonymously.
  //
  // The result is tagged with the contributor it belongs to so both "which
  // threads" and "still loading" are derived rather than held in their own
  // state: nothing is set synchronously in the effect body, and a slow response
  // for a previously-opened contributor cannot paint into the current one.
  useEffect(() => {
    if (!selectedContributorId) {
      return;
    }

    let cancelled = false;
    void communityService
      .listPosts(1, 12, { sort: "TOP", authorId: selectedContributorId })
      .then((list) => {
        if (!cancelled) {
          setThreadState({
            forId: selectedContributorId,
            items: list.items || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThreadState({ forId: selectedContributorId, items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedContributorId]);

  const threads =
    threadState && threadState.forId === selectedContributorId ? threadState.items : [];
  const isLoadingThreads =
    Boolean(selectedContributorId) && threadState?.forId !== selectedContributorId;

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap">
        <CommunityPageHeader
          title="Contributor leaderboard"
          subtitle="Parents who share knowledge other parents can use."
          badge="Leaderboard"
        />

        {myReputation && (
          <section aria-labelledby="my-contribution" className="mt-12">
            <h2 id="my-contribution" className="font-editorial text-ink text-3xl font-light">
              Your contribution
            </h2>
            <dl className="border-hairline mt-4 grid grid-cols-2 border-t lg:grid-cols-4">
              {[
                { label: "Points", value: myReputation.totalPoints },
                { label: "Questions", value: myReputation.questionCount },
                { label: "Answers", value: myReputation.answerCount },
                { label: "Upvotes received", value: myReputation.receivedUpvotes },
              ].map((stat) => (
                <div key={stat.label} className="border-hairline border-b py-6 pr-4">
                  <dt className="text-ink-muted text-sm">{stat.label}</dt>
                  <dd className="font-editorial text-ink mt-1 text-4xl font-light tabular-nums sm:text-5xl">
                    {fmt(stat.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="top-contributors" className="mt-14">
          <h2 id="top-contributors" className="font-editorial text-ink text-3xl font-light">
            Top contributors
          </h2>

          {isLoading ? (
            <div
              aria-busy="true"
              aria-label="Loading leaderboard"
              className="border-hairline mt-4 border-t"
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border-hairline border-b py-5">
                  <div className="bg-ink/10 h-5 w-1/2 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="bg-paper-deep mt-4 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">No contributors yet.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Ask or answer a question and you will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-4 max-w-4xl">
              <div
                className={`border-hairline text-ink-muted grid ${GRID_COLS} items-center gap-2 border-b border-t px-3 py-3 text-sm`}
              >
                <span>Place</span>
                <span>Contributor</span>
                <span className="hidden text-right sm:block">Posts</span>
                <span className="hidden text-right sm:block">Answers</span>
                <span className="hidden text-right sm:block">Upvotes</span>
                <span className="text-right">Points</span>
              </div>

              <ul>
                {displayRows.map((item) => {
                  const isMe = item.id === currentUserId;
                  const showGap = meBelowBoard && isMe && displayRows.length > 1;
                  return (
                    <li
                      key={`${item.rank}-${item.id || item.name}`}
                      className="border-hairline border-b"
                    >
                      {showGap ? (
                        <p className="text-ink-muted px-3 py-2 text-sm" aria-hidden="true">
                          &hellip;
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={!item.id}
                        onClick={() => item.id && setSelectedContributorId(item.id)}
                        className={`hover:bg-paper-deep/60 grid min-h-14 w-full ${GRID_COLS} items-center gap-2 px-3 py-3 text-left transition-colors duration-200 disabled:cursor-default ${
                          isMe ? "bg-wash/60" : ""
                        }`}
                      >
                        <span className="font-editorial text-ink text-2xl font-light tabular-nums">
                          {fmt(item.rank)}
                        </span>
                        <span className="flex min-w-0 items-center gap-3">
                          <ContributorAvatar name={item.name} photoUrl={item.photoUrl} />
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span
                                className="text-ink truncate text-base font-semibold"
                                title={item.name}
                              >
                                {item.name}
                              </span>
                              {isMe && (
                                <span className="text-ink-body shrink-0 text-sm">(you)</span>
                              )}
                            </span>
                            <span className="text-ink-muted block text-sm tabular-nums leading-snug sm:hidden">
                              {fmt(item.posts)} {item.posts === 1 ? "post" : "posts"} ·{" "}
                              {fmt(item.answers)} {item.answers === 1 ? "answer" : "answers"} ·{" "}
                              {fmt(item.upvotes)} {item.upvotes === 1 ? "upvote" : "upvotes"}
                            </span>
                          </span>
                        </span>
                        <span className="text-ink-body hidden text-right text-base tabular-nums sm:block">
                          {fmt(item.posts)}
                        </span>
                        <span className="text-ink-body hidden text-right text-base tabular-nums sm:block">
                          {fmt(item.answers)}
                        </span>
                        <span className="text-ink-body hidden text-right text-base tabular-nums sm:block">
                          {fmt(item.upvotes)}
                        </span>
                        <span className="text-ink text-right text-base font-semibold tabular-nums">
                          {fmt(item.score)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-ink-muted mt-4 text-sm">
                Parents with consistently useful answers get more visibility across the community.
              </p>
            </div>
          )}
        </section>

        <ContributorModal
          contributor={selectedContributor}
          threads={threads}
          isLoadingThreads={isLoadingThreads}
          onClose={() => setSelectedContributorId(null)}
        />
      </div>
    </div>
  );
}
