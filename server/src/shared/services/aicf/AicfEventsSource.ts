import axios from "axios";

import { AITA_USER_AGENT, attachAitaIdentity } from "../aita/aitaIdentity";
import { parseAicfEventsPage, type AicfEventsPage } from "./aicfEventsParser";
import { AICF_EVENTS_URL } from "./aicfIngest";

/**
 * Reads AICF's "All Events" page. One GET of one public page, nothing else.
 *
 * aicf.in's robots.txt (read 2026-11-14) disallows only /wp-admin/, and the page
 * is the federation's own public calendar. That is permission to read, not a
 * licence to republish: what we store are the facts of each event (name, dates,
 * place, AICF's event code) with a link back to AICF and to the organiser's own
 * brochure, never AICF's text or files.
 *
 * Identity, robots.txt and pacing come from the shared bot identity
 * (services/aita/aitaIdentity.ts). It is named for AITA because AITA was the first
 * site read, but nothing in it is AITA-specific: it keys every rule on the host.
 */

export interface HtmlResponse {
  status: number;
  body: string;
}

export type FetchHtml = (url: string) => Promise<HtmlResponse>;

const MAX_RETRIES = 3;

export class AicfEventsSource {
  private readonly fetchHtml: FetchHtml;

  constructor(options: { fetchHtml?: FetchHtml } = {}) {
    if (options.fetchHtml) {
      this.fetchHtml = options.fetchHtml;
      return;
    }
    const http = attachAitaIdentity(
      axios.create({
        timeout: 60_000,
        headers: { "User-Agent": AITA_USER_AGENT, Accept: "text/html" },
        validateStatus: () => true,
        maxRedirects: 5,
        maxContentLength: 16 * 1024 * 1024,
      })
    );
    this.fetchHtml = async (url) => {
      const response = await http.get<string>(url, { responseType: "text" });
      return {
        status: response.status,
        body: typeof response.data === "string" ? response.data : String(response.data),
      };
    };
  }

  async fetchEvents(): Promise<{ sourceUrl: string; page: AicfEventsPage }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.fetchHtml(AICF_EVENTS_URL);
        if (response.status === 200) {
          return { sourceUrl: AICF_EVENTS_URL, page: parseAicfEventsPage(response.body) };
        }
        lastError = new Error(`GET ${AICF_EVENTS_URL} returned ${response.status}`);
        if (response.status < 500) break;
      } catch (error) {
        lastError = error;
      }
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    throw lastError instanceof Error ? lastError : new Error(`GET ${AICF_EVENTS_URL} failed`);
  }
}
