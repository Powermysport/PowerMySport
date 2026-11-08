"use client";

import { Mail, Paperclip, Reply, Sparkles, StickyNote, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { adminApi, type SupportTicketRecord } from "../services/admin";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";

const REPLY_MAX_LENGTH = 5000;
const HINT_MAX_LENGTH = 500;
/** A gap the AI left for the team, such as "[confirm date]". */
const PLACEHOLDER = /\[[^\]\n]{1,60}\]/;

// Matches the server's rules (supportAttachments.ts), so a bad file is caught on pick.
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
];
const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** A file's contents as base64, without the data-URL prefix. */
const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Where a reply will go: the account address for a signed-in requester, else the form address. */
export function replyAddress(ticket: SupportTicketRecord): string | undefined {
  return ticket.userId ? ticket.userId.email : ticket.requesterEmail;
}

/**
 * The ticket's conversation and a reply box. A reply is emailed to the requester
 * and saved on the ticket only once the email has gone; the server refuses to save
 * it otherwise, so what is listed here is what the requester received.
 */
export function SupportTicketReply({
  ticket,
  onUpdated,
}: {
  ticket: SupportTicketRecord;
  onUpdated: (ticket: SupportTicketRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<"reply" | "resolve" | null>(null);
  const [hint, setHint] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const hintId = useId();

  const to = replyAddress(ticket);
  const notes = ticket.notes ?? [];
  const trimmed = message.trim();
  const unfilled = PLACEHOLDER.exec(message)?.[0];
  const busy = sending !== null || drafting;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const addFiles = (picked: FileList | null) => {
    const next = [...files];
    for (const file of Array.from(picked ?? [])) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(
          `${file.name} is not a type we send. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`
        );
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`Attach at most ${MAX_FILES} files.`);
        break;
      }
      if (next.reduce((sum, f) => sum + f.size, 0) + file.size > MAX_TOTAL_BYTES) {
        toast.error(`${file.name} would take the attachments over 10 MB.`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    // Lets the same file be picked again after it is removed.
    if (fileInput.current) fileInput.current.value = "";
  };

  // Writes a first draft into the box. It never sends: the admin reads and edits it.
  const draftWithAi = async () => {
    if (busy) return;
    if (trimmed && !window.confirm("Replace what you have written with an AI draft?")) return;
    setDrafting(true);
    try {
      const response = await adminApi.draftSupportTicketReply(ticket._id, {
        ...(hint.trim() ? { instructions: hint.trim() } : {}),
      });
      if (response.success && response.data?.draft) {
        setMessage(response.data.draft.slice(0, REPLY_MAX_LENGTH));
      } else {
        toast.error(response.message || "The AI could not write a draft.");
      }
    } catch (error) {
      toast.error(errorMessage(error, "The AI could not write a draft. Try again."));
    } finally {
      setDrafting(false);
    }
  };

  const send = async (resolve: boolean) => {
    if (!trimmed || busy || unfilled) return;
    setSending(resolve ? "resolve" : "reply");
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({ filename: file.name, content: await readAsBase64(file) }))
      );
      const response = await adminApi.replyToSupportTicket(ticket._id, {
        message: trimmed,
        ...(resolve ? { status: "RESOLVED" as const } : {}),
        ...(attachments.length ? { attachments } : {}),
      });
      if (response.success && response.data) {
        toast.success(response.message || "Reply sent.");
        onUpdated(response.data);
        setMessage("");
        setFiles([]);
        setOpen(false);
      } else {
        toast.error(response.message || "The reply was not sent.");
      }
    } catch (error) {
      toast.error(errorMessage(error, "The reply was not sent. Try again."));
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
      {notes.length > 0 && (
        <ol className="space-y-3" aria-label="Conversation">
          {notes.map((note, i) => {
            const emailed = Boolean(note.emailedAt);
            const fromUser = note.authorType === "USER";
            return (
              <li
                key={note._id ?? i}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  emailed
                    ? "border-slate-200 bg-slate-50"
                    : fromUser
                      ? "border-slate-200 bg-white"
                      : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
                  {emailed ? (
                    <>
                      <Mail size={13} aria-hidden />
                      Reply emailed to {note.emailedTo}
                    </>
                  ) : fromUser ? (
                    "From the requester"
                  ) : (
                    <>
                      <StickyNote size={13} aria-hidden />
                      Internal note, not sent
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span>{formatDate(note.emailedAt ?? note.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap leading-6 text-slate-800">{note.message}</p>
                {note.attachments && note.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Attached files">
                    {note.attachments.map((file) => (
                      <li
                        key={file.filename}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                      >
                        <Paperclip size={12} aria-hidden />
                        {file.filename} · {formatSize(file.size)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!to ? (
        <p className="text-sm text-slate-500">
          No email address on this ticket, so it cannot be answered by email.
        </p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className={btn("outline", "sm")}>
          <Reply size={14} aria-hidden />
          Reply by email
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={hintId} className={labelClass}>
                What should the reply say? (optional, for the AI draft)
              </label>
              <input
                id={hintId}
                type="text"
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                maxLength={HINT_MAX_LENGTH}
                placeholder="e.g. The June PDF is ready; the December one comes next week"
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              onClick={draftWithAi}
              disabled={busy}
              className={btn("outline", "md")}
            >
              <Sparkles size={15} aria-hidden />
              {drafting ? "Writing..." : trimmed ? "Redraft with AI" : "Draft with AI"}
            </button>
          </div>
          <div>
            <label htmlFor={fieldId} className={labelClass}>
              Reply to {to}
            </label>
            <textarea
              id={fieldId}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={8}
              disabled={drafting}
              maxLength={REPLY_MAX_LENGTH}
              autoFocus
              placeholder="Write your answer. It is emailed as written, with their original message quoted below it."
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              {message.length}/{REPLY_MAX_LENGTH}
              {ticket.status === "OPEN" && " · Sending moves the ticket to In progress."}
            </p>
            {unfilled && (
              <p role="status" className="mt-1 text-sm font-medium text-amber-800">
                Fill in {unfilled} before sending. The AI leaves these where it could not know the
                answer.
              </p>
            )}
          </div>
          <div>
            <input
              ref={fileInput}
              id={`${fieldId}-files`}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(event) => addFiles(event.target.files)}
              disabled={busy || files.length >= MAX_FILES}
              className="sr-only"
            />
            <label
              htmlFor={`${fieldId}-files`}
              className={btn(
                "outline",
                "sm",
                busy || files.length >= MAX_FILES
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              )}
            >
              <Paperclip size={14} aria-hidden />
              Attach files
            </label>
            <span className="ml-2 text-xs text-slate-500">
              Up to {MAX_FILES} files, 10 MB in total. PDF, images, Word, Excel, CSV or text.
            </span>
            {files.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Files to attach">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 text-xs text-slate-700"
                  >
                    <Paperclip size={12} aria-hidden />
                    {file.name} · {formatSize(file.size)}
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      disabled={busy}
                      aria-label={`Remove ${file.name}`}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                ))}
                <li className="self-center text-xs text-slate-500">
                  {formatSize(totalBytes)} of 10 MB
                </li>
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => send(false)}
              disabled={!trimmed || busy || Boolean(unfilled)}
              className={btn("primary", "sm")}
            >
              {sending === "reply" ? "Sending..." : "Send reply"}
            </button>
            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <button
                type="button"
                onClick={() => send(true)}
                disabled={!trimmed || busy || Boolean(unfilled)}
                className={btn("outline", "sm")}
              >
                {sending === "resolve" ? "Sending..." : "Send and mark resolved"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className={btn("quiet", "sm")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
