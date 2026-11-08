import { AppError } from "../../utils/AppError";

/**
 * Files an admin attaches to a support reply. They arrive as base64 inside the
 * reply's JSON (the server has no multipart parser, and replies are small enough
 * not to need one), go out with the email, and are not stored: the ticket keeps
 * only each file's name, type and size.
 */

export const MAX_ATTACHMENTS = 5;
/** Decoded bytes across all files. Gmail caps a message at 25 MB after base64 (+33%). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Types a support reply plausibly needs. Executables and archives are refused. */
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  csv: "text/csv",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

export interface ReplyAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** A name safe for a mail header and a download: no paths, no control characters. */
const cleanName = (name: string) =>
  name
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f"<>]/g, "")
    .trim()
    .slice(0, 150);

/** Validates and decodes the request's `attachments`. Throws a 400 explaining what is wrong. */
export function parseReplyAttachments(raw: unknown): ReplyAttachment[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new AppError("Attachments must be a list", 400);
  if (raw.length > MAX_ATTACHMENTS) {
    throw new AppError(`Attach at most ${MAX_ATTACHMENTS} files`, 400);
  }

  let total = 0;
  return raw.map((item) => {
    const { filename, content } = (item ?? {}) as { filename?: unknown; content?: unknown };
    const name = typeof filename === "string" ? cleanName(filename) : "";
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    if (!name || !ALLOWED[ext]) {
      throw new AppError(
        `"${name || "A file"}" is not a type we send. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        400
      );
    }
    const data = typeof content === "string" ? content.replace(/\s/g, "") : "";
    if (!data || data.length % 4 !== 0 || !BASE64.test(data)) {
      throw new AppError(`"${name}" could not be read. Attach it again.`, 400);
    }
    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0) throw new AppError(`"${name}" is empty`, 400);
    total += buffer.length;
    if (total > MAX_ATTACHMENT_BYTES) {
      throw new AppError("Attachments can be at most 10 MB in total", 400);
    }
    return { filename: name, content: buffer, contentType: ALLOWED[ext]! };
  });
}
