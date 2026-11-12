"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { AdminDataTable, AdminDataTableColumn } from "@/modules/shared/ui/AdminDataTable";
import { Button } from "@/modules/shared/ui/Button";
import { DetailDrawer, DetailRow, DetailSection } from "@/modules/shared/ui/DetailDrawer";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { toast } from "@/lib/toast";
import {
  EnquiryFilters,
  EnquiryList,
  EnquiryTurn,
  FollowUpStatus,
  TeamMessage,
  WhatsAppEnquiry,
  whatsappPilotApi,
} from "@/lib/api/whatsappPilotApi";
import {
  ANSWERED_BY_LABEL,
  ASSISTANCE_LABEL,
  CATEGORY_LABEL,
  FOLLOW_UP_LABEL,
  SETTABLE_STATUSES,
  replyDue,
  statusBadge,
  topicOf,
} from "../utils/enquiryLabels";

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const FEEDBACK_LABEL = { helpful: "Helpful", not_helpful: "Not helpful" } as const;

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-400 focus:border-power-orange-solid focus:outline-none focus:ring-2 focus:ring-power-orange-solid/25";

const when = (iso: string) => format(new Date(iso), "MMM d, h:mm a");

/** WhatsApp lets a business message freely for 24 hours after the parent's last message. */
const WINDOW_MS = 24 * 60 * 60 * 1000;
const replyWindowEnd = (lastMessageAt: string) =>
  new Date(new Date(lastMessageAt).getTime() + WINDOW_MS).toISOString();
const replyWindowOpen = (lastMessageAt: string) =>
  Date.now() < new Date(lastMessageAt).getTime() + WINDOW_MS;

const child = (e: WhatsAppEnquiry) =>
  [e.childAge ? `${e.childAge} yrs` : null, e.sport, e.level, e.city].filter(Boolean).join(", ") ||
  "—";

const MAX_REPLY = 1000;

/** The parent's exchanges and the team's messages, in the order they happened. */
type TimelineItem =
  | { kind: "turn"; at: string; turn: EnquiryTurn }
  | { kind: "team"; at: string; message: TeamMessage };
const timeline = (turns: EnquiryTurn[], team: TeamMessage[]): TimelineItem[] =>
  [
    ...turns.map((turn): TimelineItem => ({ kind: "turn", at: turn.at, turn })),
    ...team.map((message): TimelineItem => ({ kind: "team", at: message.at, message })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

/** When the team's reply is due, in red once it has passed. Nothing when no reply is owed. */
function ReplyDue({ enquiry }: { enquiry: WhatsAppEnquiry }) {
  const due = replyDue(enquiry);
  if (!due) return <span className="text-slate-500">—</span>;
  return (
    <span
      className={`whitespace-nowrap text-sm ${due.overdue ? "font-medium text-red-700" : "text-slate-700"}`}
    >
      {due.label}
    </span>
  );
}

export function EnquiriesTab() {
  const [filters, setFilters] = useState<EnquiryFilters>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<EnquiryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // The search box waits for a pause in typing, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q: search.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Bumped after a save, so the list refetches and shows the change.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(async () => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    whatsappPilotApi
      .listEnquiries(filters, page)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err, "Could not load the enquiries."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadKey]);

  const setFilter = (key: keyof EnquiryFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await whatsappPilotApi.exportEnquiries(filters);
    } catch (err) {
      toast.error(errorMessage(err, "Could not export the enquiries."));
    } finally {
      setExporting(false);
    }
  };

  const columns: AdminDataTableColumn<WhatsAppEnquiry>[] = [
    {
      key: "date",
      header: "Last message",
      render: (e) => (
        <span className="whitespace-nowrap text-slate-600">{when(e.lastMessageAt)}</span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      render: (e) => <span className="font-mono text-xs text-slate-700">{e.reference}</span>,
    },
    {
      key: "question",
      header: "Question",
      className: "min-w-[16rem]",
      render: (e) => <span className="line-clamp-2 text-slate-900">{e.question}</span>,
    },
    {
      key: "child",
      header: "Child",
      render: (e) => <span className="text-slate-700">{child(e)}</span>,
    },
    {
      key: "topic",
      header: "Topic",
      render: (e) => <span className="text-slate-700">{topicOf(e) ?? "—"}</span>,
    },
    {
      key: "answeredBy",
      header: "Answered by",
      render: (e) => (
        <span className="text-slate-700">
          {e.answeredBy ? ANSWERED_BY_LABEL[e.answeredBy] : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const badge = statusBadge(e);
        return badge ? (
          <StatusBadge status={badge.label} tone={badge.tone} size="sm" />
        ) : (
          <span className="text-slate-500">—</span>
        );
      },
    },
    {
      key: "due",
      header: "Reply due",
      render: (e) => <ReplyDue enquiry={e} />,
    },
    {
      key: "feedback",
      header: "Feedback",
      render: (e) => (
        <span className="text-slate-700">{e.feedback ? FEEDBACK_LABEL[e.feedback] : "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Status"
          className={selectClass}
          value={filters.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Any status</option>
          {(["new", "reviewing", "contacted", "done", "none"] as const).map((status) => (
            <option key={status} value={status}>
              {FOLLOW_UP_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          aria-label="Topic"
          className={selectClass}
          value={filters.category ?? ""}
          onChange={(e) => setFilter("category", e.target.value)}
        >
          <option value="">Any topic</option>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Answered by"
          className={selectClass}
          value={filters.answeredBy ?? ""}
          onChange={(e) => setFilter("answeredBy", e.target.value)}
        >
          <option value="">Anyone</option>
          <option value="assistant">{ANSWERED_BY_LABEL.assistant}</option>
          <option value="team">{ANSWERED_BY_LABEL.team}</option>
        </select>
        <select
          aria-label="Help asked for"
          className={selectClass}
          value={filters.assistance ?? ""}
          onChange={(e) => setFilter("assistance", e.target.value)}
        >
          <option value="">Any help asked</option>
          {Object.entries(ASSISTANCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Feedback"
          className={selectClass}
          value={filters.feedback ?? ""}
          onChange={(e) => setFilter("feedback", e.target.value)}
        >
          <option value="">Any feedback</option>
          <option value="helpful">Helpful</option>
          <option value="not_helpful">Not helpful</option>
        </select>
        <input
          aria-label="Sport"
          className={`${selectClass} w-36`}
          placeholder="Sport"
          value={filters.sport ?? ""}
          onChange={(e) => setFilter("sport", e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          From
          <input
            type="date"
            className={selectClass}
            value={filters.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          To
          <input
            type="date"
            className={selectClass}
            value={filters.to ?? ""}
            onChange={(e) => setFilter("to", e.target.value ? `${e.target.value}T23:59:59` : "")}
          />
        </label>
      </div>

      <AdminDataTable
        columns={columns}
        rows={list?.rows ?? []}
        getRowKey={(e) => e.id}
        loading={loading}
        emptyMessage="No enquiries match these filters"
        search={{ value: search, onChange: setSearch, placeholder: "Search the question" }}
        toolbarExtra={
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            loading={exporting}
            disabled={!list || list.total === 0}
            onClick={handleExport}
          >
            Export CSV{list ? ` (${list.total})` : ""}
          </Button>
        }
        pagination={
          list
            ? {
                page: list.page,
                totalPages: list.totalPages,
                total: list.total,
                onPageChange: setPage,
              }
            : undefined
        }
        onRowClick={(e) => setOpenId(e.id)}
      />

      <EnquiryDrawer
        key={openId ?? "closed"}
        enquiry={list?.rows.find((e) => e.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />
    </div>
  );
}

function EnquiryDrawer({
  enquiry,
  onClose,
  onChanged,
}: {
  enquiry: WhatsAppEnquiry | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  // The drawer is keyed by enquiry, so each one starts with its own note and a hidden number.
  const [note, setNote] = useState(enquiry?.teamNote ?? "");
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const savedNote = enquiry?.teamNote ?? "";
  // The list does not carry the conversation, so it is fetched when the drawer opens.
  const [turns, setTurns] = useState<EnquiryTurn[] | null>(null);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [turnsFailed, setTurnsFailed] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const enquiryId = enquiry?.id;

  useEffect(() => {
    if (!enquiryId) return;
    let cancelled = false;
    whatsappPilotApi
      .getEnquiry(enquiryId)
      .then((full) => {
        if (cancelled) return;
        setTurns(full.turns ?? []);
        setTeamMessages(full.teamMessages ?? []);
      })
      .catch(() => {
        if (!cancelled) setTurnsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enquiryId]);

  if (!enquiry) return null;

  const save = async (changes: { followUpStatus?: FollowUpStatus; teamNote?: string }) => {
    setSaving(true);
    try {
      await whatsappPilotApi.updateEnquiry(enquiry.id, changes);
      await onChanged();
      toast.success("Saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save that."));
    } finally {
      setSaving(false);
    }
  };

  const reveal = async () => {
    setRevealing(true);
    try {
      setPhone(await whatsappPilotApi.revealContact(enquiry.id));
    } catch (err) {
      toast.error(errorMessage(err, "Could not show the number."));
    } finally {
      setRevealing(false);
    }
  };

  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      const updated = await whatsappPilotApi.sendReply(enquiry.id, text);
      setTeamMessages(updated.teamMessages ?? []);
      setReply("");
      await onChanged();
      toast.success("Sent on WhatsApp.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not send that."));
    } finally {
      setSending(false);
    }
  };

  const windowOpen = replyWindowOpen(enquiry.lastMessageAt);
  const badge = statusBadge(enquiry);

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={<span className="font-mono">{enquiry.reference}</span>}
      subtitle={`Parent ${enquiry.parentRef} · started ${when(enquiry.createdAt)} · ${enquiry.turnCount} ${
        enquiry.turnCount === 1 ? "message" : "messages"
      }`}
      headerExtra={
        badge ? <StatusBadge status={badge.label} tone={badge.tone} size="sm" /> : undefined
      }
      widthClass="max-w-xl"
    >
      <DetailSection title="What the parent asked">
        <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{enquiry.question}</p>
      </DetailSection>

      <DetailSection title="Child">
        <DetailRow label="Age" value={enquiry.childAge ?? "—"} />
        <DetailRow label="Sport" value={enquiry.sport ?? "—"} />
        <DetailRow label="Level" value={enquiry.level ?? "—"} />
        <DetailRow label="City / area" value={enquiry.city ?? "—"} />
        <DetailRow label="Playing context" value={enquiry.playingContext ?? "—"} />
        <DetailRow label="Objective" value={enquiry.objective ?? "—"} />
      </DetailSection>

      {(enquiry.category || enquiry.answeredBy) && (
        <DetailSection title="Request">
          <DetailRow label="Topic" value={topicOf(enquiry) ?? "—"} />
          <DetailRow
            label="Answered by"
            value={enquiry.answeredBy ? ANSWERED_BY_LABEL[enquiry.answeredBy] : "—"}
          />
          <DetailRow
            label="Confirmed by the parent"
            value={enquiry.confirmedAt ? when(enquiry.confirmedAt) : "Not confirmed"}
          />
          {enquiry.replyDueAt && (
            <DetailRow
              label="Team reply due"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  {when(enquiry.replyDueAt)}
                  <ReplyDue enquiry={enquiry} />
                </span>
              }
            />
          )}
        </DetailSection>
      )}

      <DetailSection title="Conversation">
        {turnsFailed ? (
          <p className="text-sm text-slate-500">The conversation could not be loaded.</p>
        ) : turns === null ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : turns.length === 0 && teamMessages.length === 0 ? (
          // Enquiries from before every exchange was kept have only the latest answer.
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
            {enquiry.guidance ?? "Nothing recorded."}
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline(turns, teamMessages).map((item, index) =>
              item.kind === "turn" ? (
                <li key={`t-${item.turn.at}-${index}`} className="space-y-1.5">
                  <p className="text-xs text-slate-400">{when(item.turn.at)}</p>
                  <p className="ml-6 whitespace-pre-wrap break-words rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900">
                    {item.turn.parent}
                  </p>
                  <p className="mr-6 whitespace-pre-wrap break-words rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    {item.turn.assistant}
                  </p>
                </li>
              ) : (
                <li key={`m-${item.message.at}-${index}`} className="space-y-1.5">
                  <p className="text-xs text-slate-400">
                    {when(item.message.at)} · Team
                    {item.message.by ? ` (${item.message.by})` : ""}
                    {item.message.via === "template" ? " · sent as template" : ""}
                  </p>
                  <p className="mr-6 whitespace-pre-wrap break-words rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900">
                    {item.message.text}
                  </p>
                </li>
              )
            )}
          </ol>
        )}
      </DetailSection>

      <DetailSection title="Assistance">
        <DetailRow
          label="Asked for"
          value={
            enquiry.assistance.length
              ? enquiry.assistance.map((a) => ASSISTANCE_LABEL[a] ?? a).join(", ")
              : "Nothing"
          }
        />
        <DetailRow
          label="Feedback"
          value={enquiry.feedback ? FEEDBACK_LABEL[enquiry.feedback] : "—"}
        />
        <DetailRow label="Conversation closed" value={enquiry.closed ? "Yes" : "No"} />
        {enquiry.followUpSummary && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {enquiry.followUpSummary}
          </p>
        )}
        {enquiry.ticketId && (
          <DetailRow
            label="Support ticket"
            value={<span className="font-mono text-xs">{enquiry.ticketId}</span>}
          />
        )}
      </DetailSection>

      {enquiry.followUpStatus !== "none" && (
        <DetailSection title="Follow-up">
          <div className="flex flex-wrap gap-2">
            {SETTABLE_STATUSES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={enquiry.followUpStatus === status ? "secondary" : "outline"}
                disabled={saving || enquiry.followUpStatus === status}
                onClick={() => save({ followUpStatus: status })}
              >
                {FOLLOW_UP_LABEL[status]}
              </Button>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Contact the parent">
        {enquiry.hasContact ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {phone ? (
                <a href={`tel:+${phone}`} className="font-mono text-sm text-slate-900 underline">
                  +{phone}
                </a>
              ) : (
                <Button size="sm" variant="outline" loading={revealing} onClick={reveal}>
                  Show WhatsApp number
                </Button>
              )}
              <span className="text-xs text-slate-500">Each look is logged.</span>
            </div>
            <p className="text-xs text-slate-500">
              {windowOpen
                ? `They last wrote ${when(enquiry.lastMessageAt)}. A message sent before ${when(
                    replyWindowEnd(enquiry.lastMessageAt)
                  )} goes as normal text.`
                : `They last wrote ${when(enquiry.lastMessageAt)}, more than a day ago, so WhatsApp only allows the approved team template. Your message goes inside it, on one line.`}
            </p>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              maxLength={MAX_REPLY}
              aria-label="Message to the parent"
              placeholder="Write to the parent. It is sent from the PowerMySport WhatsApp number, signed as the team."
              className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-slate-400 focus:outline-none focus:ring-2"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {reply.length}/{MAX_REPLY}
              </span>
              <Button size="sm" loading={sending} disabled={!reply.trim()} onClick={send}>
                Send on WhatsApp
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No number is kept for this enquiry: it started before numbers were kept with every
            enquiry. If the parent writes again, their new enquiry will have one.
          </p>
        )}
      </DetailSection>

      <DetailSection title="Team note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={1000}
          aria-label="Team note"
          placeholder="What was said or done. Visible to admins only."
          className="focus:border-power-orange-solid focus:ring-power-orange-solid/25 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-slate-400 focus:outline-none focus:ring-2"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={saving}
            disabled={note === savedNote}
            onClick={() => save({ teamNote: note })}
          >
            Save note
          </Button>
        </div>
      </DetailSection>
    </DetailDrawer>
  );
}
